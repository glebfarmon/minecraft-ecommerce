import request from 'supertest'

import {startContentApp} from './support/content-app'

jest.setTimeout(180_000)

type Draft = {
  revision: number
  content: {sections: {id: string; title: {en: string; pl?: string}; items: unknown[]}[]}
}

describe('admin rules API', () => {
  let ctx: Awaited<ReturnType<typeof startContentApp>>
  beforeAll(async () => {
    ctx = await startContentApp()
  })
  afterAll(async () => {
    await ctx.stop()
  })

  const edited = (d: Draft, title: string) => ({
    revision: d.revision,
    content: {
      ...d.content,
      sections: [{...d.content.sections[0], title: {en: title}}, ...d.content.sections.slice(1)]
    }
  })

  it('needs content.write, even to read the draft', async () => {
    const catalogOnly = await ctx.admin({permissions: ['catalog.write']})
    await catalogOnly.get('/api/admin/content/rules/draft').expect(403)
  })

  it('saves the draft with the current revision and refuses a stale one', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const draft = (await editor.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    const saved = (
      await editor.put('/api/admin/content/rules/draft').send(edited(draft, 'Basics')).expect(200)
    ).body as Draft
    expect(saved.revision).toBe(draft.revision + 1)
    await editor
      .put('/api/admin/content/rules/draft')
      .send(edited(draft, 'Other'))
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'stale'})
      })
    const now = (await editor.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    expect(now.content.sections[0]?.title.en).toBe('Basics')
  })

  it('saves a long bilingual rulebook (~300 KB of JSON)', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const draft = (await editor.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    const text = (n: string) => ({
      en: `Rule ${n} `.padEnd(500, 'e'),
      pl: `Zasada ${n} `.padEnd(500, 'p')
    })
    const big = {
      revision: draft.revision,
      content: {
        sections: Array.from({length: 10}, (_, s) => ({
          id: `big-${String(s)}`,
          title: {en: `Section ${String(s)}`},
          items: Array.from({length: 30}, (_, i) => ({
            id: `big-${String(s)}-${String(i)}`,
            text: text(`${String(s)}.${String(i)}`)
          }))
        }))
      }
    }
    expect(JSON.stringify(big).length).toBeGreaterThan(300_000)
    const saved = (await editor.put('/api/admin/content/rules/draft').send(big).expect(200))
      .body as Draft
    // Put the previous draft back for the tests below.
    await editor
      .put('/api/admin/content/rules/draft')
      .send({revision: saved.revision, content: draft.content})
      .expect(200)
  })

  it('refuses unsafe links in the draft', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const draft = (await editor.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    await editor
      .put('/api/admin/content/rules/draft')
      .send(edited(draft, '[x](javascript:alert(1))'))
      .expect(400)
  })

  it('publishes the draft as a new public edition and lists versions', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const before = await ctx.prisma.rulesVersion.count()
    const draft = (await editor.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    await editor
      .post('/api/admin/content/rules/publish')
      .send({revision: draft.revision})
      .expect(201)
    expect(await ctx.prisma.rulesVersion.count()).toBe(before + 1)
    const pub = await request(ctx.app.getHttpServer())
      .get('/api/content/rules?locale=en')
      .expect(200)
    expect((pub.body as {sections: {title: {value: string}}[]}).sections[0]?.title.value).toBe(
      'Basics'
    )
    const list = (await editor.get('/api/admin/content/rules/versions').expect(200)).body as {
      versions: {id: number}[]
      nextCursor: number | null
    }
    expect(list.versions.length).toBe(before + 1)
    expect(list.versions[0]?.id).toBeGreaterThan(list.versions[1]?.id ?? 0)
    await editor.get('/api/admin/content/rules/versions?cursor=2147483647').expect(200)
    await editor.get('/api/admin/content/rules/versions?cursor=2147483648').expect(400)
  })

  it('refuses to publish a draft revision the admin has not seen, publishing nothing', async () => {
    const a = await ctx.admin({permissions: ['content.write']})
    const b = await ctx.admin({permissions: ['content.write']})
    const seen = (await a.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    await b.put('/api/admin/content/rules/draft').send(edited(seen, 'Unseen')).expect(200)
    const before = await ctx.prisma.rulesVersion.count()
    await a
      .post('/api/admin/content/rules/publish')
      .send({revision: seen.revision})
      .expect(409)
      .expect(res => {
        expect(res.body).toMatchObject({message: 'stale'})
      })
    await a.post('/api/admin/content/rules/publish').send({}).expect(400)
    expect(await ctx.prisma.rulesVersion.count()).toBe(before)
    // Put the published title back for the tests below.
    const now = (await b.get('/api/admin/content/rules/draft').expect(200)).body as Draft
    await b.put('/api/admin/content/rules/draft').send(edited(now, 'Basics')).expect(200)
  })

  it('restores an old version into the draft without publishing it', async () => {
    const editor = await ctx.admin({permissions: ['content.write']})
    const oldest = await ctx.prisma.rulesVersion.findFirstOrThrow({orderBy: {id: 'asc'}})
    const draft = (
      await editor
        .post(`/api/admin/content/rules/versions/${String(oldest.id)}/restore`)
        .expect(201)
    ).body as Draft
    expect(draft.content.sections[0]?.title.en).toBe('General')
    const pub = await request(ctx.app.getHttpServer())
      .get('/api/content/rules?locale=en')
      .expect(200)
    expect((pub.body as {sections: {title: {value: string}}[]}).sections[0]?.title.value).toBe(
      'Basics'
    )
    await editor.post('/api/admin/content/rules/versions/999999/restore').expect(404)
    await editor.post('/api/admin/content/rules/versions/9999999999/restore').expect(404)
  })

  it('writes audit rows for save, publish and restore', async () => {
    const actions = (
      await ctx.prisma.auditLog.findMany({where: {action: {startsWith: 'rules.'}}})
    ).map(r => r.action)
    expect(actions).toEqual(
      expect.arrayContaining(['rules.draft', 'rules.publish', 'rules.restore'])
    )
  })
})
