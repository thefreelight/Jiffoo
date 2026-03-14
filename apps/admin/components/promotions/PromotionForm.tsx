/**
 * Promotion Form Component
 *
 * Reusable form for creating and editing promotions/discounts.
 * Uses react-hook-form with Zod validation following backend schema.
 */

'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useT } from 'shared/src/i18n/react'

// Zod schema matching backend CreateDiscountSchema
const promotionFormSchema = z.object({
  code: z.string().min(1, 'Discount code is required').toUpperCase(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'BUY_X_GET_Y', 'FREE_SHIPPING'], {
    errorMap: () => ({ message: 'Invalid discount type' }),
  }),
  value: z.coerce.number().positive('Value must be positive'),
  minAmount: z.coerce.number().positive('Minimum amount must be positive').optional().or(z.literal('')),
  maxUses: z.coerce.number().int().positive('Max uses must be a positive integer').optional().or(z.literal('')),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.boolean().default(true),
  stackable: z.boolean().default(false),
  description: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  customerGroups: z.array(z.string()).optional(),
}).refine(
  (data) => {
    if (data.type === 'PERCENTAGE' && data.value > 100) {
      return false
    }
    return true
  },
  {
    message: 'Percentage discount value cannot exceed 100',
    path: ['value'],
  }
).refine(
  (data) => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) < new Date(data.endDate)
    }
    return true
  },
  {
    message: 'End date must be after start date',
    path: ['endDate'],
  }
)

type PromotionFormData = z.infer<typeof promotionFormSchema>

interface PromotionFormProps {
  initialData?: Partial<PromotionFormData>
  onSubmit: (data: PromotionFormData) => void | Promise<void>
  isLoading?: boolean
  mode?: 'create' | 'edit'
}

export function PromotionForm({
  initialData,
  onSubmit,
  isLoading = false,
  mode = 'create'
}: PromotionFormProps) {
  const t = useT()
  const getText = (key: string, fallback: string) => t ? t(key) : fallback

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<PromotionFormData>({
    resolver: zodResolver(promotionFormSchema),
    defaultValues: {
      code: initialData?.code || '',
      type: initialData?.type || 'PERCENTAGE',
      value: initialData?.value || 0,
      minAmount: initialData?.minAmount,
      maxUses: initialData?.maxUses,
      startDate: initialData?.startDate || '',
      endDate: initialData?.endDate || '',
      isActive: initialData?.isActive ?? true,
      stackable: initialData?.stackable ?? false,
      description: initialData?.description || '',
      productIds: initialData?.productIds || [],
      customerGroups: initialData?.customerGroups || [],
    }
  })

  const selectedType = watch('type')
  const isActive = watch('isActive')
  const isStackable = watch('stackable')

  // Update form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      Object.keys(initialData).forEach((key) => {
        const value = initialData[key as keyof PromotionFormData]
        if (value !== undefined) {
          setValue(key as keyof PromotionFormData, value as never)
        }
      })
    }
  }, [initialData, setValue])

  const discountTypes = [
    { value: 'PERCENTAGE', label: getText('merchant.promotions.percentage', 'Percentage') },
    { value: 'FIXED_AMOUNT', label: getText('merchant.promotions.fixedAmount', 'Fixed Amount') },
    { value: 'BUY_X_GET_Y', label: getText('merchant.promotions.buyXGetY', 'Buy X Get Y') },
    { value: 'FREE_SHIPPING', label: getText('merchant.promotions.freeShipping', 'Free Shipping') },
  ]

  const getValueLabel = () => {
    switch (selectedType) {
      case 'PERCENTAGE':
        return getText('merchant.promotions.form.percentageValue', 'Discount Percentage (%)')
      case 'FIXED_AMOUNT':
        return getText('merchant.promotions.form.fixedAmountValue', 'Discount Amount ($)')
      case 'BUY_X_GET_Y':
        return getText('merchant.promotions.form.buyXValue', 'Buy Quantity (X)')
      case 'FREE_SHIPPING':
        return getText('merchant.promotions.form.shippingValue', 'Threshold Amount')
      default:
        return getText('merchant.promotions.form.value', 'Value')
    }
  }

  const getValuePlaceholder = () => {
    switch (selectedType) {
      case 'PERCENTAGE':
        return '20'
      case 'FIXED_AMOUNT':
        return '10.00'
      case 'BUY_X_GET_Y':
        return '3'
      case 'FREE_SHIPPING':
        return '50.00'
      default:
        return '0'
    }
  }

  const getValueHelperText = () => {
    switch (selectedType) {
      case 'PERCENTAGE':
        return getText('merchant.promotions.form.percentageHelp', 'Enter a value between 0-100')
      case 'FIXED_AMOUNT':
        return getText('merchant.promotions.form.fixedAmountHelp', 'Fixed dollar amount to discount')
      case 'BUY_X_GET_Y':
        return getText('merchant.promotions.form.buyXHelp', 'Number of items to buy for promotion')
      case 'FREE_SHIPPING':
        return getText('merchant.promotions.form.shippingHelp', 'Minimum cart value for free shipping')
      default:
        return ''
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Discount Code */}
      <div className="space-y-2">
        <Label htmlFor="code">
          {getText('merchant.promotions.form.code', 'Discount Code')} *
        </Label>
        <Input
          id="code"
          {...register('code')}
          placeholder="SUMMER2024"
          className="uppercase"
          disabled={isLoading}
        />
        {errors.code && (
          <p className="text-sm text-red-600">{errors.code.message}</p>
        )}
        <p className="text-xs text-gray-500">
          {getText('merchant.promotions.form.codeHelp', 'Code will be automatically converted to uppercase')}
        </p>
      </div>

      {/* Discount Type */}
      <div className="space-y-2">
        <Label htmlFor="type">
          {getText('merchant.promotions.form.type', 'Discount Type')} *
        </Label>
        <Select
          value={selectedType}
          onValueChange={(value) => setValue('type', value as PromotionFormData['type'])}
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {discountTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.type && (
          <p className="text-sm text-red-600">{errors.type.message}</p>
        )}
      </div>

      {/* Value */}
      <div className="space-y-2">
        <Label htmlFor="value">
          {getValueLabel()} *
        </Label>
        <Input
          id="value"
          type="number"
          step={selectedType === 'BUY_X_GET_Y' ? '1' : '0.01'}
          {...register('value')}
          placeholder={getValuePlaceholder()}
          disabled={isLoading}
        />
        {errors.value && (
          <p className="text-sm text-red-600">{errors.value.message}</p>
        )}
        {getValueHelperText() && (
          <p className="text-xs text-gray-500">{getValueHelperText()}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">
          {getText('merchant.promotions.form.description', 'Description')}
        </Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder={getText('merchant.promotions.form.descriptionPlaceholder', 'Internal notes about this promotion')}
          rows={3}
          disabled={isLoading}
        />
        {errors.description && (
          <p className="text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      {/* Constraints Section */}
      <div className="border-t pt-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {getText('merchant.promotions.form.constraints', 'Constraints')}
        </h3>

        {/* Min Amount */}
        <div className="space-y-2">
          <Label htmlFor="minAmount">
            {getText('merchant.promotions.form.minAmount', 'Minimum Purchase Amount')}
          </Label>
          <Input
            id="minAmount"
            type="number"
            step="0.01"
            {...register('minAmount')}
            placeholder="50.00"
            disabled={isLoading}
          />
          {errors.minAmount && (
            <p className="text-sm text-red-600">{errors.minAmount.message}</p>
          )}
          <p className="text-xs text-gray-500">
            {getText('merchant.promotions.form.minAmountHelp', 'Minimum cart value required for discount')}
          </p>
        </div>

        {/* Max Uses */}
        <div className="space-y-2">
          <Label htmlFor="maxUses">
            {getText('merchant.promotions.form.maxUses', 'Maximum Uses')}
          </Label>
          <Input
            id="maxUses"
            type="number"
            step="1"
            {...register('maxUses')}
            placeholder="100"
            disabled={isLoading}
          />
          {errors.maxUses && (
            <p className="text-sm text-red-600">{errors.maxUses.message}</p>
          )}
          <p className="text-xs text-gray-500">
            {getText('merchant.promotions.form.maxUsesHelp', 'Leave empty for unlimited uses')}
          </p>
        </div>
      </div>

      {/* Date Range Section */}
      <div className="border-t pt-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {getText('merchant.promotions.form.dateRange', 'Date Range')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">
              {getText('merchant.promotions.form.startDate', 'Start Date')}
            </Label>
            <Input
              id="startDate"
              type="datetime-local"
              {...register('startDate')}
              disabled={isLoading}
            />
            {errors.startDate && (
              <p className="text-sm text-red-600">{errors.startDate.message}</p>
            )}
          </div>

          {/* End Date */}
          <div className="space-y-2">
            <Label htmlFor="endDate">
              {getText('merchant.promotions.form.endDate', 'End Date')}
            </Label>
            <Input
              id="endDate"
              type="datetime-local"
              {...register('endDate')}
              disabled={isLoading}
            />
            {errors.endDate && (
              <p className="text-sm text-red-600">{errors.endDate.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="border-t pt-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900">
          {getText('merchant.promotions.form.settings', 'Settings')}
        </h3>

        {/* Is Active */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="isActive">
              {getText('merchant.promotions.form.isActive', 'Active')}
            </Label>
            <p className="text-sm text-gray-500">
              {getText('merchant.promotions.form.isActiveHelp', 'Enable or disable this promotion')}
            </p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={(checked) => setValue('isActive', checked)}
            disabled={isLoading}
          />
        </div>

        {/* Stackable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="stackable">
              {getText('merchant.promotions.form.stackable', 'Stackable')}
            </Label>
            <p className="text-sm text-gray-500">
              {getText('merchant.promotions.form.stackableHelp', 'Allow combining with other discounts')}
            </p>
          </div>
          <Switch
            id="stackable"
            checked={isStackable}
            onCheckedChange={(checked) => setValue('stackable', checked)}
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Product Restrictions - Placeholder */}
      <div className="border-t pt-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {getText('merchant.promotions.form.restrictions', 'Restrictions')}
        </h3>
        <p className="text-sm text-gray-500">
          {getText('merchant.promotions.form.restrictionsPlaceholder', 'Product and customer group restrictions will be available in a future update')}
        </p>
      </div>

      {/* Submit Button */}
      <div className="border-t pt-6">
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gray-900 hover:bg-gray-800"
        >
          {isLoading
            ? getText('merchant.promotions.form.submitting', 'Submitting...')
            : mode === 'create'
            ? getText('merchant.promotions.form.create', 'Create Promotion')
            : getText('merchant.promotions.form.update', 'Update Promotion')
          }
        </Button>
      </div>
    </form>
  )
}
