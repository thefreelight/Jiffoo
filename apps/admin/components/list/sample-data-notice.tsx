'use client'

/**
 * The line above a list that shows sample rows, so nobody takes them for the
 * store's own data. Sample rows only appear on the demonstration instance.
 */

import { FlaskConical } from 'lucide-react'
import { useT } from 'shared/src/i18n/react'

export function SampleDataNotice() {
  const t = useT()

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  return (
    <div
      data-testid="sample-data-notice"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <div>
        <p className="font-semibold">{getText('merchant.pages.sampleDataTitle', '示例数据')}</p>
        <p className="mt-0.5 text-xs leading-5 text-amber-800">
          {getText(
            'merchant.pages.sampleDataHint',
            '这些行是演示实例用来展示页面样式的样例，不是真实数据，也不能对它们操作。',
          )}
        </p>
      </div>
    </div>
  )
}
