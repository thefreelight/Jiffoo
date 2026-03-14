'use client'

/**
 * SEO Meta Editor - Industrial Power Design
 * Component for editing SEO meta tags inline in product/category forms
 */

import { Search, Code } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface SeoMetaData {
  metaTitle?: string | null
  metaDescription?: string | null
  canonicalUrl?: string | null
  structuredData?: string | Record<string, unknown> | null
}

interface SeoMetaEditorProps {
  value: SeoMetaData
  onChange: (data: SeoMetaData) => void
  entityType?: 'product' | 'category'
  className?: string
}

const OPTIMAL_TITLE_LENGTH = { min: 50, max: 60 }
const OPTIMAL_DESC_LENGTH = { min: 150, max: 160 }

export function SeoMetaEditor({
  value,
  onChange,
  entityType = 'product',
  className
}: SeoMetaEditorProps) {
  const handleFieldChange = (field: keyof SeoMetaData, newValue: string) => {
    onChange({
      ...value,
      [field]: newValue || null,
    })
  }

  const structuredValue = typeof value.structuredData === 'string'
    ? value.structuredData
    : value.structuredData
      ? JSON.stringify(value.structuredData, null, 2)
      : ''

  const getTitleLength = () => value.metaTitle?.length || 0
  const getDescLength = () => value.metaDescription?.length || 0

  const getTitleLengthColor = () => {
    const len = getTitleLength()
    if (len === 0) return 'text-gray-300'
    if (len >= OPTIMAL_TITLE_LENGTH.min && len <= OPTIMAL_TITLE_LENGTH.max) return 'text-green-600'
    if (len > OPTIMAL_TITLE_LENGTH.max) return 'text-orange-500'
    return 'text-blue-500'
  }

  const getDescLengthColor = () => {
    const len = getDescLength()
    if (len === 0) return 'text-gray-300'
    if (len >= OPTIMAL_DESC_LENGTH.min && len <= OPTIMAL_DESC_LENGTH.max) return 'text-green-600'
    if (len > OPTIMAL_DESC_LENGTH.max) return 'text-orange-500'
    return 'text-blue-500'
  }

  return (
    <div className={cn("space-y-12 w-full", className)}>
      {/* Section Header */}
      <div className="space-y-3">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-2xl">
            <Search className="w-7 h-7 text-blue-600" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">
              SEO Configuration
            </h2>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">
              Search Engine Optimization Metadata
            </p>
          </div>
        </div>
        <div className="h-1 w-20 bg-blue-600 rounded-full" />
      </div>

      <div className="grid grid-cols-1 gap-12">
        {/* Meta Title */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] pl-1">
              Meta Title
            </Label>
            <div className="flex items-center space-x-3">
              <span className={cn("text-xs font-black uppercase tracking-wider", getTitleLengthColor())}>
                {getTitleLength()} chars
              </span>
              <span className="text-[10px] font-bold text-gray-300 uppercase">
                Optimal: {OPTIMAL_TITLE_LENGTH.min}-{OPTIMAL_TITLE_LENGTH.max}
              </span>
            </div>
          </div>
          <Input
            value={value.metaTitle || ''}
            onChange={(e) => handleFieldChange('metaTitle', e.target.value)}
            placeholder={`${entityType === 'product' ? 'Product' : 'Category'} meta title for search results`}
            className="h-20 text-2xl font-black border-gray-100 focus:border-blue-500 focus:ring-0 rounded-[2rem] bg-gray-50/50 px-10 transition-all placeholder:text-gray-200"
          />
        </div>

        {/* Meta Description */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] pl-1">
              Meta Description
            </Label>
            <div className="flex items-center space-x-3">
              <span className={cn("text-xs font-black uppercase tracking-wider", getDescLengthColor())}>
                {getDescLength()} chars
              </span>
              <span className="text-[10px] font-bold text-gray-300 uppercase">
                Optimal: {OPTIMAL_DESC_LENGTH.min}-{OPTIMAL_DESC_LENGTH.max}
              </span>
            </div>
          </div>
          <Textarea
            value={value.metaDescription || ''}
            onChange={(e) => handleFieldChange('metaDescription', e.target.value)}
            placeholder="Compelling description for search engine results pages (SERP)"
            rows={4}
            className="border-gray-100 rounded-[2rem] p-10 leading-relaxed text-xl font-bold text-gray-700 bg-gray-50/50 resize-none focus:border-blue-500 focus:ring-0 transition-all placeholder:text-gray-200"
          />
        </div>

        {/* Canonical URL */}
        <div className="space-y-4">
          <Label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] pl-1">
            Canonical URL
          </Label>
          <div className="relative">
            <span className="absolute left-10 top-1/2 -translate-y-1/2 font-bold text-gray-400 text-lg">
              https://
            </span>
            <Input
              value={value.canonicalUrl || ''}
              onChange={(e) => handleFieldChange('canonicalUrl', e.target.value)}
              placeholder="example.com/products/slug (prevents duplicate content)"
              className="h-20 pl-32 pr-10 text-xl font-mono font-bold border-gray-100 focus:border-blue-500 focus:ring-0 rounded-[2rem] bg-gray-50/50 transition-all placeholder:text-gray-200"
            />
          </div>
          <p className="text-xs font-bold text-gray-400 pl-4">
            Specify the preferred URL for this content to prevent duplicate content issues
          </p>
        </div>

        {/* Structured Data (JSON-LD) */}
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Label className="text-[11px] font-black text-gray-400 uppercase tracking-[0.3em] pl-1">
              Structured Data (JSON-LD)
            </Label>
            <div className="flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full">
              <Code className="w-3 h-3 text-gray-500" />
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">
                JSON Format
              </span>
            </div>
          </div>
          <Textarea
            value={structuredValue}
            onChange={(e) => handleFieldChange('structuredData', e.target.value)}
            placeholder={`{\n  "@context": "https://schema.org/",\n  "@type": "${entityType === 'product' ? 'Product' : 'Category'}",\n  "name": "..."\n}`}
            rows={8}
            className="border-gray-100 rounded-[2rem] p-10 leading-relaxed text-base font-mono text-gray-700 bg-gray-50/50 resize-none focus:border-blue-500 focus:ring-0 transition-all placeholder:text-gray-300"
          />
          <p className="text-xs font-bold text-gray-400 pl-4">
            Rich snippets for search engines - Product schema for products, BreadcrumbList for categories
          </p>
        </div>
      </div>
    </div>
  )
}
