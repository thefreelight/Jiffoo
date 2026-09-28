/**
 * Customer Detail/Edit Page
 *
 * Displays and allows editing of customer information with a compact design matching admin style.
 */
'use client'

import { AlertTriangle, ArrowLeft, Calendar, Mail, ShieldCheck, User, Save, X, Activity, DollarSign, Package, Clock, ExternalLink, Key } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAdminDashboard, useUser, useUpdateUser } from '@/lib/hooks/use-api'
import { useT } from 'shared/src/i18n/react'
import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { UserRole } from '@/lib/types'
import { GenerateResetLinkDialog } from '@/components/customers/generate-reset-link-dialog'
import { resolveApiErrorMessage } from '@/lib/error-utils'
import { UserAvatar } from '@/components/ui/user-avatar'


export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string
  const t = useT()
  const { toast } = useToast()
  const { data: dashboardData } = useAdminDashboard()
  const currency = dashboardData?.metrics?.currency

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    role: '' as UserRole,
    avatar: '',
    isActive: true
  })

  const getText = (key: string, fallback: string): string => {
    if (!t) return fallback
    const translated = t(key)
    return translated === key ? fallback : translated
  }

  const { data: user, isLoading, error, refetch } = useUser(userId)
  const updateUserMutation = useUpdateUser()

  // Initialize form data when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        role: user.role as UserRole || UserRole.USER,
        avatar: user.avatar || '',
        isActive: user.isActive ?? true
      })
    }
  }, [user?.id, user?.username, user?.role, user?.avatar, user?.isActive, isEditing])

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!user) return

    try {
      setIsSaving(true)
      await updateUserMutation.mutateAsync({
        id: user.id,
        data: {
          username: formData.username,
          role: formData.role,
          isActive: formData.isActive
        }
      })

      toast({
        title: getText('merchant.customers.success', 'Success'),
        description: getText('merchant.customers.edit.success', 'User information updated'),
      })

      setIsEditing(false)
      refetch()
    } catch (err: any) {
      toast({
        title: getText('merchant.customers.error', 'Error'),
        description: resolveApiErrorMessage(err, t, 'merchant.customers.edit.failed', 'Update failed'),
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-page-surface">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-action-strong mx-auto"></div>
          <p className="mt-4 text-[10px] font-bold text-neutral-light uppercase tracking-widest">{getText('merchant.customers.detail.loading', 'Syncing Identity Node...')}</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-page-surface">
        <div className="text-center max-w-md p-6">
          <AlertTriangle className="w-16 h-16 text-danger-base mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-deepest mb-2">{getText('merchant.customers.detail.customerNotFound', 'User not found')}</h2>
          <p className="text-neutral-strong mb-6">{getText('merchant.customers.detail.customerNotFoundDesc', 'The requested user does not exist or has been deleted.')}</p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" className="rounded-xl" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {getText('merchant.customers.detail.goBack', 'Go back')}
            </Button>
            <Button className="rounded-xl" onClick={() => refetch()}>
              {getText('merchant.customers.detail.retry', 'Retry')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-page-surface">
      {/* Header Bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-neutral-faint bg-surface/80 py-4 pl-4 pr-4 backdrop-blur-md sm:pl-20 sm:pr-8 lg:px-8">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-neutral-faint h-10 w-10"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5 text-neutral-deepest" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-neutral-deepest tracking-tight leading-none">
              {getText('merchant.customers.detail.title', 'User Profile')}
            </h1>
            <span className="text-[10px] font-bold text-action-strong uppercase tracking-widest mt-1">
              ID: {user.id.substring(0, 8)}...
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                className="h-10 px-6 rounded-xl border border-neutral-soft font-semibold text-sm hover:bg-neutral-veil flex items-center gap-2"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-4 h-4 text-neutral-base" />
                {getText('merchant.customers.cancel', 'Cancel')}
              </Button>
              <Button
                className="h-10 px-6 rounded-xl font-semibold text-sm shadow-md shadow-action-faint transition-all flex items-center gap-2 bg-action-strong hover:bg-action-deep"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="w-4 h-4" />
                {isSaving ? getText('merchant.customers.saving', 'Saving...') : getText('merchant.customers.saveChanges', 'Save Changes')}
              </Button>
            </>
          ) : (
            <>
              {(
                <Button
                  variant="outline"
                  className="h-10 px-6 rounded-xl border border-neutral-soft font-semibold text-sm hover:bg-neutral-veil flex items-center gap-2"
                  onClick={() => setResetPasswordDialogOpen(true)}
                >
                  <Key className="w-4 h-4 text-neutral-base" />
                  Generate reset link
                </Button>
              )}
              <Button
                className="h-10 px-6 rounded-xl font-semibold text-sm shadow-md shadow-action-faint transition-all flex items-center gap-2 bg-action-strong hover:bg-action-deep"
                onClick={handleEdit}
              >
                <User className="w-4 h-4" />
                {getText('merchant.customers.detail.edit', 'Edit User')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-6 sm:px-10 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Left Column: Essential Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Overview Card */}
            <Card className="bg-surface rounded-3xl border-neutral-faint shadow-sm overflow-hidden p-0 border">
              <div className="h-32 bg-neutral-veil border-b border-neutral-faint" />
              <div className="px-8 pb-8 flex flex-col sm:flex-row items-end gap-8 -mt-16 relative z-10">
                <div className="w-32 h-32 rounded-2xl bg-surface p-1 shadow-xl ring-1 ring-neutral-faint flex-shrink-0">
                  <UserAvatar
                    src={user.avatar}
                    name={user.username}
                    username={user.username}
                    className="h-full w-full rounded-xl"
                    imageClassName="h-full w-full rounded-xl object-cover"
                    fallbackClassName="h-full w-full rounded-xl border border-dashed border-neutral-soft bg-neutral-veil text-neutral-base"
                    textClassName="text-2xl"
                  />
                </div>

                <div className="flex-1 pb-2 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-3xl font-bold text-neutral-deepest tracking-tight leading-none">
                      {isEditing ? (
                        <Input
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          className="h-10 text-2xl font-bold py-0 min-w-[240px] border-action-base focus:ring-action-base/20 rounded-xl"
                        />
                      ) : (
                        user.username || 'System User'
                      )}
                    </h2>
                    <Badge className="bg-neutral-deepest text-[10px] font-bold uppercase tracking-widest h-5 px-3 rounded-full">
                      {user.role}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold text-neutral-light uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-action-base" />
                      {user.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-action-base" />
                      {getText('merchant.customers.detail.joined', 'Joined')} {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Account Parameters */}
            <Card className="bg-surface rounded-3xl border-neutral-faint shadow-sm p-8 space-y-8 border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 bg-action-strong rounded-full" />
                  <h3 className="text-xs font-bold text-neutral-light uppercase tracking-widest">
                    {getText('merchant.customers.detail.accountDetails', 'Account Parameters')}
                  </h3>
                </div>
                <p className="text-[10px] font-medium text-neutral-pale uppercase tracking-wider pl-3">
                  {getText('merchant.customers.detail.accountDetailsDesc', 'System Identity Specifications')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-3">
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.username', 'Username')}
                  </Label>
                  {isEditing ? (
                    <Input
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="rounded-xl border-neutral-faint bg-neutral-veil/50"
                    />
                  ) : (
                    <p className="text-sm font-bold text-neutral-deepest h-10 flex items-center px-4 bg-neutral-veil/50 rounded-xl border border-transparent">
                      {user.username}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.email', 'Email Interface')}
                  </Label>
                  <p className="text-sm font-bold text-neutral-light h-10 flex items-center px-4 bg-neutral-veil/30 rounded-xl border border-neutral-faint border-dashed italic">
                    {user.email}
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.role', 'Permission level')}
                  </Label>
                  {isEditing ? (
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as UserRole }))}
                    >
                      <SelectTrigger className="rounded-xl border-neutral-faint bg-neutral-veil/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-neutral-faint">
                        <SelectItem value={UserRole.USER}>REGULAR USER</SelectItem>
                        <SelectItem value={UserRole.ADMIN}>ADMINISTRATOR</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 flex items-center px-4 bg-neutral-veil/50 rounded-xl border border-transparent">
                      <Badge variant="outline" className="text-[10px] font-bold border-neutral-soft text-neutral-strong">{user.role}</Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.detail.avatarUrl', 'Interface Skin URL')}
                  </Label>
                  <div className="relative group">
                    {isEditing ? (
                      <Input
                        name="avatar"
                        value={formData.avatar}
                        onChange={handleInputChange}
                        className="rounded-xl border-neutral-faint bg-neutral-veil/50 pr-10"
                      />
                    ) : (
                      <div className="text-sm font-bold text-neutral-deepest h-10 flex items-center px-4 bg-neutral-veil/50 rounded-xl border border-transparent pr-10 truncate">
                        {user.avatar || 'N/A'}
                      </div>
                    )}
                    {user.avatar && (
                      <a href={user.avatar} target="_blank" rel="noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-pale hover:text-action-base transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-neutral-light uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.detail.accountStatus', 'Account Status')}
                  </Label>
                  {isEditing ? (
                    <div className="h-10 flex items-center px-4 bg-neutral-veil/50 rounded-xl border border-transparent">
                      <Switch
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      />
                      <span className={cn(
                        "ml-3 text-xs font-bold uppercase tracking-widest",
                        formData.isActive ? "text-success-strong" : "text-danger-strong"
                      )}>
                        {formData.isActive ? getText('merchant.customers.detail.active', 'ACTIVE') : getText('merchant.customers.detail.inactive', 'INACTIVE')}
                      </span>
                    </div>
                  ) : (
                    <div className="h-10 flex items-center px-4 bg-neutral-veil/50 rounded-xl border border-transparent">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        user.isActive ? "bg-success-base animate-pulse" : "bg-danger-base"
                      )} />
                      <span className={cn(
                        "ml-3 text-xs font-bold uppercase tracking-widest",
                        user.isActive ? "text-success-strong" : "text-danger-strong"
                      )}>
                        {user.isActive ? getText('merchant.customers.detail.active', 'ACTIVE') : getText('merchant.customers.detail.inactive', 'INACTIVE')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Chronological Log */}
            <Card className="bg-surface rounded-3xl border-neutral-faint shadow-sm border overflow-hidden">
              <div className="p-8 border-b border-neutral-veil bg-neutral-veil/20">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-action-strong" />
                  <h3 className="text-xs font-bold text-neutral-deepest uppercase tracking-widest">
                    {getText('merchant.customers.detail.temporalEvents', 'CHRONOLOGICAL LOG')}
                  </h3>
                </div>
              </div>
              <div className="divide-y divide-neutral-veil">
                {[
                  { label: getText('merchant.customers.detail.initializationDate', 'INITIALIZATION'), value: new Date(user.createdAt).toLocaleString(), icon: Calendar },
                  { label: getText('merchant.customers.detail.lastSpecificationUpdate', 'SPECIFICATION UPDATE'), value: new Date(user.updatedAt).toLocaleString(), icon: ShieldCheck },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-6 px-4 transition-colors hover:bg-action-veil/20 sm:px-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-neutral-veil rounded-2xl group-hover:bg-surface transition-colors">
                        <item.icon className="w-4 h-4 text-neutral-light" />
                      </div>
                      <span className="text-[10px] font-bold text-neutral-light uppercase tracking-widest pl-2">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-neutral-deepest tracking-tight">
                      {item.value}
                    </span>
                  </div>
                ))}

              </div>
            </Card>
          </div>

          {/* Right Column: Analytics & Status */}
          <div className="space-y-8 text-left">
            {/* Order Statistics */}
            <Card className="bg-neutral-deepest rounded-3xl p-8 text-surface space-y-6 shadow-xl shadow-neutral-soft border-none relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-action-base/10 rounded-full blur-3xl" />
              <div className="space-y-1 relative z-10">
                <span className="text-action-light text-[10px] font-bold uppercase tracking-[0.2em]">{getText('merchant.customers.detail.economicContribution', 'LUMINAL VALUE')}</span>
                <div className="text-4xl font-bold italic tracking-tighter">
                  {currency ? formatCurrency(user.totalSpent || 0, currency) : '--'}
                </div>
                <p className="text-[10px] font-bold text-neutral-base uppercase tracking-widest pt-1">{getText('merchant.customers.totalSpent', 'NET SETTLED VALUE')}</p>
              </div>
              <div className="h-px bg-surface/10 w-full relative z-10" />
              <div className="flex justify-between items-center relative z-10">
                <div className="space-y-1">
                  <span className="text-neutral-base text-[10px] font-bold uppercase tracking-widest">{getText('merchant.customers.orders', 'TRANS. COUNT')}</span>
                  <div className="text-2xl font-bold italic">{user.totalOrders || 0}</div>
                </div>
                <DollarSign className="w-10 h-10 text-surface/5 opacity-50" />
              </div>
            </Card>




          </div>
        </div>
      </div>

      {(
        <GenerateResetLinkDialog
          open={resetPasswordDialogOpen}
          onOpenChange={setResetPasswordDialogOpen}
          user={user}
        />
      )}
    </div>
  )
}
