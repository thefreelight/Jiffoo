'use client'

import { useQuery } from '@tanstack/react-query'
import { useT } from 'shared/src/i18n/react'
import { apiClient, unwrapApiResponse } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export type ContentTranslation = { locale: string; name: string; description?: string | null }

const locales = ['en', 'zh-Hans', 'zh-Hant'] as const

export function useStoreDefaultLocale() {
  return useQuery({
    queryKey: ['store-default-locale'],
    queryFn: async () => {
      const response = await apiClient.get<{ defaultLocale: string }>('/store/context')
      return unwrapApiResponse(response).defaultLocale
    },
  })
}

export function ContentTranslations({
  translations, onChange, defaultLocale,
}: {
  translations: ContentTranslation[]
  onChange: (translations: ContentTranslation[]) => void
  defaultLocale: string
}) {
  const t = useT()
  const update = (locale: string, field: 'name' | 'description', value: string) => {
    const next = [...translations]
    const index = next.findIndex((row) => row.locale === locale)
    if (index === -1) next.push({ locale, name: '', description: '' })
    const row = next.find((item) => item.locale === locale)!
    row[field] = value
    onChange(next)
  }

  return (
    <section className="space-y-5">
      <h2 className="text-base font-semibold">{t('merchant.contentTranslations.title')}</h2>
      {locales.filter((locale) => locale !== defaultLocale).map((locale) => {
        const row = translations.find((item) => item.locale === locale)
        return (
          <div key={locale} className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium">{t(`merchant.contentTranslations.locales.${locale}`)}</h3>
            <div className="space-y-1">
              <Label htmlFor={`translation-${locale}-name`}>{t('merchant.contentTranslations.name')} ({t(`merchant.contentTranslations.locales.${locale}`)})</Label>
              <Input id={`translation-${locale}-name`} value={row?.name ?? ''} onChange={(event) => update(locale, 'name', event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`translation-${locale}-description`}>{t('merchant.contentTranslations.description')} ({t(`merchant.contentTranslations.locales.${locale}`)})</Label>
              <Textarea id={`translation-${locale}-description`} value={row?.description ?? ''} onChange={(event) => update(locale, 'description', event.target.value)} />
            </div>
          </div>
        )
      })}
    </section>
  )
}
