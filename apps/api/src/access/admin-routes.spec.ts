import {Controller, Get, type Type} from '@nestjs/common'
import {GUARDS_METADATA, INTERCEPTORS_METADATA, PATH_METADATA} from '@nestjs/common/constants'
import {DiscoveryModule, DiscoveryService, MetadataScanner} from '@nestjs/core'
import {Test} from '@nestjs/testing'

import {AppModule} from '../app.module'
import {AuditInterceptor} from '../audit/audit.interceptor'
import {AdminSessionGuard} from './admin-session.guard'
import {PermissionGuard} from './require-permission'

const paths = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value ?? '']).map(p => String(p).replace(/^\/+/, ''))
const join = (a: string, b: string) => [a, b].filter(Boolean).join('/')
const isAdmin = (path: string) => /^admin(?:\/|$)/i.test(path)
const meta = (key: string, ...targets: object[]): unknown[] =>
  targets.flatMap(t => (Reflect.getMetadata(key, t) as unknown[] | undefined) ?? [])

/**
 * Every route under `/api/admin`, with the guards and interceptors that apply to it. Read from
 * the booted module graph, so a controller nobody remembered to wrap is found too.
 */
async function adminRoutes(extra: Type[] = []) {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, DiscoveryModule],
    controllers: extra
  }).compile()
  const scanner = new MetadataScanner()
  const routes = moduleRef
    .get(DiscoveryService)
    .getControllers()
    .flatMap(wrapper => {
      const type = wrapper.metatype as Type | null
      if (!type) return []
      return paths(Reflect.getMetadata(PATH_METADATA, type)).flatMap(base =>
        scanner.getAllMethodNames(type.prototype).flatMap(name => {
          const handler = (type.prototype as Record<string, object>)[name]
          if (!handler || Reflect.getMetadata(PATH_METADATA, handler) === undefined) return []
          return paths(Reflect.getMetadata(PATH_METADATA, handler))
            .map(sub => join(base, sub))
            .filter(isAdmin)
            .map(path => ({
              route: `${type.name}.${name} /${path}`,
              guards: meta(GUARDS_METADATA, type, handler),
              interceptors: meta(INTERCEPTORS_METADATA, type, handler)
            }))
        })
      )
    })
  await moduleRef.close()
  return routes
}

const unprotected = (routes: Awaited<ReturnType<typeof adminRoutes>>) =>
  routes
    .filter(
      r =>
        !r.guards.includes(AdminSessionGuard) ||
        !r.guards.includes(PermissionGuard) ||
        !r.interceptors.includes(AuditInterceptor)
    )
    .map(r => r.route)

describe('admin routes', () => {
  it('all run AdminSessionGuard, PermissionGuard and the audit interceptor', async () => {
    const routes = await adminRoutes()
    expect(routes.length).toBeGreaterThan(5)
    expect(unprotected(routes)).toEqual([])
  })

  it('catches a bare @Controller under admin/', async () => {
    @Controller('admin/probe')
    class ProbeController {
      @Get()
      probe() {
        return 'open'
      }
    }
    expect(unprotected(await adminRoutes([ProbeController]))).toEqual([
      'ProbeController.probe /admin/probe'
    ])
  })
})
