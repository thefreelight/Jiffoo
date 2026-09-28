'use client'

import { useState } from 'react'
import { useT } from 'shared/src/i18n/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient, unwrapApiResponse } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ContentTranslations, useStoreDefaultLocale, type ContentTranslation } from '@/components/products/ContentTranslations'
import { resolveApiErrorMessage } from '@/lib/error-utils'

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  translations: ContentTranslation[]
}

const empty = { name: '', slug: '', description: '', translations: [] as ContentTranslation[] }

export default function CategoriesPage() {
  const t = useT()
  const client = useQueryClient()
  const { data: defaultLocale = 'en' } = useStoreDefaultLocale()
  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const response = await apiClient.get<{ items: Category[] }>('/admin/products/categories', { params: { limit: 100 } })
      return unwrapApiResponse(response).items
    },
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(empty)
  const [error, setError] = useState('')

  const edit = async (id: string) => {
    const response = await apiClient.get<Category>(`/admin/products/categories/${id}`)
    const category = unwrapApiResponse(response)
    setSelectedId(id)
    setForm({
      name: category.name, slug: category.slug, description: category.description ?? '',
      translations: category.translations,
    })
    setEditing(true)
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      const data = { ...form, translations: form.translations.filter((row) => row.name.trim()) }
      const response = selectedId
        ? await apiClient.put(`/admin/products/categories/${selectedId}`, data)
        : await apiClient.post('/admin/products/categories', data)
      unwrapApiResponse(response)
      setEditing(false)
      setError('')
      await client.invalidateQueries({ queryKey: ['admin-categories'] })
      await client.invalidateQueries({ queryKey: ['categories'] })
    } catch (failure) {
      setError(resolveApiErrorMessage(failure, t))
    }
  }

  const remove = async (category: Category) => {
    if (!window.confirm(t('merchant.contentTranslations.deleteConfirmation'))) return
    try {
      unwrapApiResponse(await apiClient.delete(`/admin/products/categories/${category.id}`))
      await client.invalidateQueries({ queryKey: ['admin-categories'] })
      await client.invalidateQueries({ queryKey: ['categories'] })
    } catch (failure) {
      setError(resolveApiErrorMessage(failure, t))
    }
  }

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('merchant.contentTranslations.categories')}</h1>
        <Button onClick={() => { setSelectedId(null); setForm(empty); setEditing(true) }}>{t('merchant.contentTranslations.createCategory')}</Button>
      </div>
      {error && <p role="alert">{error}</p>}
      <ul className="divide-y">
        {categories.map((category) => (
          <li key={category.id} className="flex items-center justify-between gap-4 py-3">
            <span>{category.name}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => edit(category.id)} aria-label={`${t('merchant.contentTranslations.editCategory')}: ${category.name}`}>{t('merchant.contentTranslations.editCategory')}</Button>
              <Button variant="outline" onClick={() => remove(category)} aria-label={`${t('merchant.contentTranslations.deleteCategory')}: ${category.name}`}>{t('merchant.contentTranslations.deleteCategory')}</Button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <form onSubmit={save} className="max-w-xl space-y-4 border-t pt-6">
          <h2 className="font-semibold">{t(selectedId ? 'merchant.contentTranslations.editCategory' : 'merchant.contentTranslations.createCategory')}</h2>
          <p>{t('merchant.contentTranslations.defaultContent')}: {t(`merchant.contentTranslations.locales.${defaultLocale}`)}</p>
          <Label htmlFor="category-name">{t('merchant.contentTranslations.categoryName')}</Label>
          <Input id="category-name" required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          <Label htmlFor="category-slug">{t('merchant.contentTranslations.slug')}</Label>
          <Input id="category-slug" required value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} />
          <Label htmlFor="category-description">{t('merchant.contentTranslations.baseDescription')}</Label>
          <Textarea id="category-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          <ContentTranslations defaultLocale={defaultLocale} translations={form.translations} onChange={(translations) => setForm((current) => ({ ...current, translations }))} />
          <div className="flex gap-2">
            <Button type="submit">{t('merchant.contentTranslations.save')}</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>{t('merchant.contentTranslations.cancel')}</Button>
          </div>
        </form>
      )}
    </main>
  )
}
