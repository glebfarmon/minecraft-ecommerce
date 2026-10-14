import {PrismaService} from '../src/prisma/prisma.service'
import {startDatabase} from './support/database'

jest.setTimeout(120_000)

describe('access schema', () => {
  let db: Awaited<ReturnType<typeof startDatabase>>
  let prisma: PrismaService

  beforeAll(async () => {
    db = await startDatabase()
    prisma = new PrismaService()
  })
  afterAll(async () => {
    await prisma.$disconnect()
    await db.stop()
  })

  it('keeps role names unique', async () => {
    await prisma.role.create({data: {name: 'Editor', permissions: [], isSystem: false}})
    await expect(
      prisma.role.create({data: {name: 'Editor', permissions: [], isSystem: false}})
    ).rejects.toThrow()
  })

  it('will not delete a role that still has users', async () => {
    const role = await prisma.role.create({data: {name: 'Busy', permissions: [], isSystem: false}})
    await prisma.user.create({
      data: {id: 'u1', email: 'a@example.com', name: 'A', emailVerified: true, roleId: role.id}
    })
    await expect(prisma.role.delete({where: {id: role.id}})).rejects.toThrow()
  })

  it('keeps invite token hashes unique and sessions per user', async () => {
    const role = await prisma.role.create({data: {name: 'Inv', permissions: [], isSystem: false}})
    const invite = {
      email: 'b@example.com',
      roleId: role.id,
      tokenHash: 'h1',
      expiresAt: new Date(Date.now() + 1000)
    }
    await prisma.invite.create({data: invite})
    await expect(prisma.invite.create({data: invite})).rejects.toThrow()
    const session = await prisma.session.create({
      data: {id: 's1', token: 't1', userId: 'u1', expiresAt: new Date(Date.now() + 1000)}
    })
    expect(session.twoFactorVerifiedAt).toBeNull()
  })
})
