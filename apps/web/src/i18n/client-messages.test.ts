/** @jest-environment node */
import {readFileSync, readdirSync} from 'node:fs'
import path from 'node:path'

import {CLIENT_NAMESPACES} from './client-messages'

const srcDir = path.resolve(__dirname, '..')

function sources(dir: string): string[] {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sources(full)
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : []
  })
}

describe('client messages', () => {
  it('cover every namespace a Client Component translates', () => {
    const used = new Set<string>()
    for (const file of sources(srcDir)) {
      const text = readFileSync(file, 'utf8')
      if (!text.startsWith("'use client'")) continue
      for (const m of text.matchAll(/useTranslations\('([\w.]+)'\)/g)) used.add(m[1] ?? '')
    }
    expect(used.size).toBeGreaterThan(0)
    for (const ns of used) expect(CLIENT_NAMESPACES).toContain(ns.split('.')[0])
  })
})
