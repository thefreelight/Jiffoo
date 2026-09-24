import { describe, expect, it } from 'vitest'
import { getAllMessages } from '../../../../packages/shared/src/i18n/messages'

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix]
  return Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key)).sort()
}

describe('Shared messages', () => {
  it('T every namespace has identical leaf keys across supported locales', () => {
    const en = getAllMessages('en')
    for (const locale of ['zh-Hans', 'zh-Hant'] as const) {
      const translated = getAllMessages(locale)
      expect(Object.keys(translated).sort()).toEqual(Object.keys(en).sort())
      for (const namespace of Object.keys(en) as Array<keyof typeof en>) {
        expect(leafKeys(translated[namespace])).toEqual(leafKeys(en[namespace]))
      }
    }
  })
})
