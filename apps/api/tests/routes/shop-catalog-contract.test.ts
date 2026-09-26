import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'node:crypto'
import { createTestApp } from '../helpers/create-test-app'
import { getTestPrisma } from '../helpers/db'
import { createAdminWithToken, createUserWithToken } from '../helpers/auth'

describe('Shop catalog contract', () => {
  let app: FastifyInstance
  const db = getTestPrisma()

  beforeAll(async () => { app = await createTestApp() })
  afterAll(async () => { await app.close() })

  const category = async (translations: Array<{ locale: string; name: string }> = []) =>
    db.category.create({
      data: {
        name: 'Base category', slug: `category-${randomUUID()}`,
        translations: { create: translations },
      },
    })

  const product = async (options: { categoryId?: string; isActive?: boolean } = {}) =>
    db.product.create({
      data: {
        name: 'Base product', slug: `product-${randomUUID()}`,
        categoryId: options.categoryId, isActive: options.isActive ?? true,
        variants: { create: { name: 'Standard', salePrice: 12, stock: 3 } },
      },
    })

  it('A by-slug returns an active product with declared fields', async () => {
    const item = await product()
    const response = await app.inject({ method: 'GET', url: `/api/v1/products/by-slug/${item.slug}` })
    expect(response.statusCode).toBe(200)
    expect(response.json().data).toMatchObject({ id: item.id, slug: item.slug, name: item.name, price: 12, variants: [{ name: 'Standard' }] })
  })

  it('B by-slug returns 404 for an unknown slug', async () => {
    const response = await app.inject({ method: 'GET', url: `/api/v1/products/by-slug/missing-${randomUUID()}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('NOT_FOUND')
  })

  it('C by-slug returns 404 for an inactive product', async () => {
    const item = await product({ isActive: false })
    const response = await app.inject({ method: 'GET', url: `/api/v1/products/by-slug/${item.slug}` })
    expect(response.statusCode).toBe(404)
    expect(response.json().error.code).toBe('NOT_FOUND')
  })

  it('D categories localize zh-Hans and fall back to the base name', async () => {
    const translated = await category([{ locale: 'zh-Hans', name: '分类名称' }])
    const base = await category()
    const response = await app.inject({ method: 'GET', url: '/api/v1/products/categories?locale=zh-Hans&limit=100' })
    expect(response.statusCode).toBe(200)
    const items = response.json().data.items as Array<{ id: string; name: string }>
    expect(items.find((item) => item.id === translated.id)?.name).toBe('分类名称')
    expect(items.find((item) => item.id === base.id)?.name).toBe('Base category')
  })

  it('E product detail embeds the localized category name', async () => {
    const group = await category([{ locale: 'zh-Hans', name: '翻译分类' }])
    const item = await product({ categoryId: group.id })
    const response = await app.inject({ method: 'GET', url: `/api/v1/products/by-slug/${item.slug}?locale=zh-Hans` })
    expect(response.statusCode).toBe(200)
    expect(response.json().data.categoryName).toBe('翻译分类')
    expect(response.json().data.categorySlug).toBe(group.slug)
  })

  it('F admin category create and update replace translations', async () => {
    const { token } = await createAdminWithToken()
    const slug = `admin-category-${randomUUID()}`
    const created = await app.inject({
      method: 'POST', url: '/api/v1/admin/products/categories',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Admin category', slug, translations: [{ locale: 'zh-Hans', name: '简体' }] },
    })
    expect(created.statusCode).toBe(201)
    const id = created.json().data.id as string
    expect(created.json().data.translations).toEqual([{ locale: 'zh-Hans', name: '简体', description: null }])
    const updated = await app.inject({
      method: 'PUT', url: `/api/v1/admin/products/categories/${id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { translations: [{ locale: 'zh-Hant', name: '繁體' }] },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json().data.translations).toEqual([{ locale: 'zh-Hant', name: '繁體', description: null }])
    const read = await app.inject({ method: 'GET', url: `/api/v1/admin/products/categories/${id}`, headers: { authorization: `Bearer ${token}` } })
    expect(read.json().data.translations).toEqual([{ locale: 'zh-Hant', name: '繁體', description: null }])
  })

  it('G deleting a category cascades to its translations', async () => {
    const { token } = await createAdminWithToken()
    const group = await category([{ locale: 'zh-Hans', name: '待删除' }])
    const response = await app.inject({ method: 'DELETE', url: `/api/v1/admin/products/categories/${group.id}`, headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(200)
    expect(await db.categoryTranslation.count({ where: { categoryId: group.id } })).toBe(0)
  })

  it('H admin product creation exposes its zh-Hant translation publicly', async () => {
    const { token } = await createAdminWithToken()
    const created = await app.inject({
      method: 'POST', url: '/api/v1/admin/products',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Created product', translations: [{ locale: 'zh-Hant', name: '繁體商品' }],
        variants: [{ name: 'Standard', salePrice: 12, stock: 3 }],
      },
    })
    expect(created.statusCode).toBe(201)
    expect(created.json().data.translations).toEqual([{ locale: 'zh-Hant', name: '繁體商品', description: null }])
    const detail = await app.inject({ method: 'GET', url: `/api/v1/products/${created.json().data.id}?locale=zh-Hant` })
    expect(detail.statusCode).toBe(200)
    expect(detail.json().data.name).toBe('繁體商品')
  })

  it('I removing a product translation falls back to the base name', async () => {
    const { token } = await createAdminWithToken()
    const item = await product()
    await db.productTranslation.create({ data: { productId: item.id, locale: 'zh-Hant', name: '舊名稱' } })
    const detail = await app.inject({ method: 'GET', url: `/api/v1/admin/products/${item.id}`, headers: { authorization: `Bearer ${token}` } })
    expect(detail.statusCode).toBe(200)
    const updated = await app.inject({
      method: 'PUT', url: `/api/v1/admin/products/${item.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { variants: [{ id: detail.json().data.variants[0].id, name: 'Standard', salePrice: 12, stock: 3 }], translations: [] },
    })
    expect(updated.statusCode).toBe(200)
    expect(updated.json().data.translations).toEqual([])
    const publicDetail = await app.inject({ method: 'GET', url: `/api/v1/products/${item.id}?locale=zh-Hant` })
    expect(publicDetail.json().data.name).toBe('Base product')
  })

  it('J admin product and category writes reject unsupported locales', async () => {
    const { token } = await createAdminWithToken()
    for (const [url, payload] of [
      ['/api/v1/admin/products', { name: 'Invalid product', variants: [{ name: 'Standard', salePrice: 12, stock: 3 }], translations: [{ locale: 'fr', name: 'Nom' }] }],
      ['/api/v1/admin/products/categories', { name: 'Invalid category', slug: `invalid-${randomUUID()}`, translations: [{ locale: 'fr', name: 'Nom' }] }],
    ] as const) {
      const response = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` }, payload })
      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('N category writes deny customer accounts', async () => {
    const { token } = await createUserWithToken()
    const group = await category()
    for (const [method, url, payload] of [
      ['POST', '/api/v1/admin/products/categories', { name: 'Denied', slug: `denied-${randomUUID()}` }],
      ['PUT', `/api/v1/admin/products/categories/${group.id}`, { name: 'Denied' }],
      ['DELETE', `/api/v1/admin/products/categories/${group.id}`, undefined],
    ] as const) {
      const response = await app.inject({ method, url, headers: { authorization: `Bearer ${token}` }, payload })
      expect(response.statusCode).toBe(403)
    }
  })

  it('P default-locale product and category requests use base content despite translation rows', async () => {
    const group = await category([{ locale: 'en', name: 'Wrong category' }])
    const item = await product({ categoryId: group.id })
    await db.productTranslation.create({ data: { productId: item.id, locale: 'en', name: 'Wrong product' } })
    const detail = await app.inject({ method: 'GET', url: `/api/v1/products/by-slug/${item.slug}?locale=en` })
    expect(detail.json().data).toMatchObject({ name: 'Base product', categoryName: 'Base category' })
    const list = await app.inject({ method: 'GET', url: '/api/v1/products/categories?locale=en&limit=100' })
    expect(list.json().data.items.find((row: { id: string }) => row.id === group.id).name).toBe('Base category')
  })

  it('Q admin product and category writes reject default-locale translations', async () => {
    const { token } = await createAdminWithToken()
    const group = await category()
    const item = await product()
    for (const [method, url, payload] of [
      ['POST', '/api/v1/admin/products', { name: 'Bad', variants: [{ name: 'Standard', salePrice: 12, stock: 1 }], translations: [{ locale: 'en', name: 'Wrong' }] }],
      ['PUT', `/api/v1/admin/products/${item.id}`, { variants: [{ name: 'Standard', salePrice: 12, stock: 3 }], translations: [{ locale: 'en', name: 'Wrong' }] }],
      ['POST', '/api/v1/admin/products/categories', { name: 'Bad', slug: `bad-${randomUUID()}`, translations: [{ locale: 'en', name: 'Wrong' }] }],
      ['PUT', `/api/v1/admin/products/categories/${group.id}`, { translations: [{ locale: 'en', name: 'Wrong' }] }],
    ] as const) {
      const response = await app.inject({ method, url, payload, headers: { authorization: `Bearer ${token}` } })
      expect(response.statusCode).toBe(400)
      expect(response.json().error.code).toBe('DEFAULT_LOCALE_TRANSLATION')
    }
  })

  it('R deleting a category with a product preserves both', async () => {
    const { token } = await createAdminWithToken()
    const group = await category()
    const item = await product({ categoryId: group.id })
    const response = await app.inject({ method: 'DELETE', url: `/api/v1/admin/products/categories/${group.id}`, headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe('CATEGORY_NOT_EMPTY')
    expect(await db.category.findUnique({ where: { id: group.id } })).toBeTruthy()
    expect(await db.product.findUnique({ where: { id: item.id } })).toBeTruthy()
  })

  it('S deleting a category with a child preserves both', async () => {
    const { token } = await createAdminWithToken()
    const group = await category()
    const child = await db.category.create({ data: { name: 'Child', slug: `child-${randomUUID()}`, parentId: group.id } })
    const response = await app.inject({ method: 'DELETE', url: `/api/v1/admin/products/categories/${group.id}`, headers: { authorization: `Bearer ${token}` } })
    expect(response.statusCode).toBe(409)
    expect(response.json().error.code).toBe('CATEGORY_NOT_EMPTY')
    expect(await db.category.findUnique({ where: { id: group.id } })).toBeTruthy()
    expect(await db.category.findUnique({ where: { id: child.id } })).toBeTruthy()
  })
})
