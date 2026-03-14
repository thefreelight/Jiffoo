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
import { ResetPasswordDialog } from '@/components/customers/reset-password-dialog'
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
  }, [user, isEditing])

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
      <div className="flex items-center justify-center h-screen bg-[#fcfdfe]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{getText('merchant.customers.detail.loading', 'Syncing Identity Node...')}</p>
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#fcfdfe]">
        <div className="text-center max-w-md p-6">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{getText('merchant.customers.detail.customerNotFound', 'User not found')}</h2>
          <p className="text-gray-600 mb-6">{getText('merchant.customers.detail.customerNotFoundDesc', 'The requested user does not exist or has been deleted.')}</p>
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
    <div className="min-h-screen bg-[#fcfdfe]">
      {/* Header Bar */}
      <div className="border-b border-gray-100 pl-20 pr-8 lg:px-8 py-4 sticky top-0 bg-white/80 backdrop-blur-md z-40 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-gray-100 h-10 w-10"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-gray-900 tracking-tight leading-none">
              {getText('merchant.customers.detail.title', 'User Profile')}
            </h1>
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-1">
              ID: {user.id.substring(0, 8)}...
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                className="h-10 px-6 rounded-xl border border-gray-200 font-semibold text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={handleCancel}
                disabled={isSaving}
              >
                <X className="w-4 h-4 text-gray-500" />
                {getText('merchant.customers.cancel', 'Cancel')}
              </Button>
              <Button
                className="h-10 px-6 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 transition-all flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Save className="w-4 h-4" />
                {isSaving ? getText('merchant.customers.saving', 'Saving...') : getText('merchant.customers.saveChanges', 'Save Changes')}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="h-10 px-6 rounded-xl border border-gray-200 font-semibold text-sm hover:bg-gray-50 flex items-center gap-2"
                onClick={() => setResetPasswordDialogOpen(true)}
              >
                <Key className="w-4 h-4 text-gray-500" />
                {getText('merchant.customers.resetPassword.submit', 'Reset Password')}
              </Button>
              <Button
                className="h-10 px-6 rounded-xl font-semibold text-sm shadow-md shadow-blue-100 transition-all flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={handleEdit}
              >
                <User className="w-4 h-4" />
                {getText('merchant.customers.detail.edit', 'Edit User')}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="w-full px-10 py-10 space-y-8 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
          {/* Left Column: Essential Info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Profile Overview Card */}
            <Card className="bg-white rounded-3xl border-gray-100 shadow-sm overflow-hidden p-0 border">
              <div className="h-32 bg-gray-50 border-b border-gray-100" />
              <div className="px-8 pb-8 flex flex-col sm:flex-row items-end gap-8 -mt-16 relative z-10">
                <div className="w-32 h-32 rounded-2xl bg-white p-1 shadow-xl ring-1 ring-gray-100 flex-shrink-0">
                  <UserAvatar
                    src={user.avatar}
                    name={user.username}
                    username={user.username}
                    className="h-full w-full rounded-xl"
                    imageClassName="h-full w-full rounded-xl object-cover"
                    fallbackClassName="h-full w-full rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-500"
                    textClassName="text-2xl"
                  />
                </div>

                <div className="flex-1 pb-2 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight leading-none">
                      {isEditing ? (
                        <Input
                          name="username"
                          value={formData.username}
                          onChange={handleInputChange}
                          className="h-10 text-2xl font-bold py-0 min-w-[240px] border-blue-500 focus:ring-blue-500/20 rounded-xl"
                        />
                      ) : (
                        user.username || 'System User'
                      )}
                    </h2>
                    <Badge className="bg-gray-900 text-[10px] font-bold uppercase tracking-widest h-5 px-3 rounded-full">
                      {user.role}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-blue-500" />
                      {user.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      {getText('merchant.customers.detail.joined', 'Joined')} {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Account Parameters */}
            <Card className="bg-white rounded-3xl border-gray-100 shadow-sm p-8 space-y-8 border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 bg-blue-600 rounded-full" />
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    {getText('merchant.customers.detail.accountDetails', 'Account Parameters')}
                  </h3>
                </div>
                <p className="text-[10px] font-medium text-gray-300 uppercase tracking-wider pl-3">
                  {getText('merchant.customers.detail.accountDetailsDesc', 'System Identity Specifications')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-3">
                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.username', 'Username')}
                  </Label>
                  {isEditing ? (
                    <Input
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      className="rounded-xl border-gray-100 bg-gray-50/50"
                    />
                  ) : (
                    <p className="text-sm font-bold text-gray-900 h-10 flex items-center px-4 bg-gray-50/50 rounded-xl border border-transparent">
                      {user.username}
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.email', 'Email Interface')}
                  </Label>
                  <p className="text-sm font-bold text-gray-400 h-10 flex items-center px-4 bg-gray-50/30 rounded-xl border border-gray-100 border-dashed italic">
                    {user.email}
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.role', 'Permission level')}
                  </Label>
                  {isEditing ? (
                    <Select
                      value={formData.role}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, role: value as UserRole }))}
                    >
                      <SelectTrigger className="rounded-xl border-gray-100 bg-gray-50/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-gray-100">
                        <SelectItem value={UserRole.USER}>REGULAR USER</SelectItem>
                        <SelectItem value={UserRole.ADMIN}>ADMINISTRATOR</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="h-10 flex items-center px-4 bg-gray-50/50 rounded-xl border border-transparent">
                      <Badge variant="outline" className="text-[10px] font-bold border-gray-200 text-gray-600">{user.role}</Badge>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.detail.avatarUrl', 'Interface Skin URL')}
                  </Label>
                  <div className="relative group">
                    {isEditing ? (
                      <Input
                        name="avatar"
                        value={formData.avatar}
                        onChange={handleInputChange}
                        className="rounded-xl border-gray-100 bg-gray-50/50 pr-10"
                      />
                    ) : (
                      <div className="text-sm font-bold text-gray-900 h-10 flex items-center px-4 bg-gray-50/50 rounded-xl border border-transparent pr-10 truncate">
                        {user.avatar || 'N/A'}
                      </div>
                    )}
                    {user.avatar && (
                      <a href={user.avatar} target="_blank" rel="noreferrer" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-blue-500 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">
                    {getText('merchant.customers.detail.accountStatus', 'Account Status')}
                  </Label>
                  {isEditing ? (
                    <div className="h-10 flex items-center px-4 bg-gray-50/50 rounded-xl border border-transparent">
                      <Switch
                        checked={formData.isActive}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                      />
                      <span className={cn(
                        "ml-3 text-xs font-bold uppercase tracking-widest",
                        formData.isActive ? "text-green-600" : "text-red-600"
                      )}>
                        {formData.isActive ? getText('merchant.customers.detail.active', 'ACTIVE') : getText('merchant.customers.detail.inactive', 'INACTIVE')}
                      </span>
                    </div>
                  ) : (
                    <div className="h-10 flex items-center px-4 bg-gray-50/50 rounded-xl border border-transparent">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        user.isActive ? "bg-green-500 animate-pulse" : "bg-red-500"
                      )} />
                      <span className={cn(
                        "ml-3 text-xs font-bold uppercase tracking-widest",
                        user.isActive ? "text-green-600" : "text-red-600"
                      )}>
                        {user.isActive ? getText('merchant.customers.detail.active', 'ACTIVE') : getText('merchant.customers.detail.inactive', 'INACTIVE')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Chronological Log */}
            <Card className="bg-white rounded-3xl border-gray-100 shadow-sm border overflow-hidden">
              <div className="p-8 border-b border-gray-50 bg-gray-50/20">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest">
                    {getText('merchant.customers.detail.temporalEvents', 'CHRONOLOGICAL LOG')}
                  </h3>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { label: getText('merchant.customers.detail.initializationDate', 'INITIALIZATION'), value: new Date(user.createdAt).toLocaleString(), icon: Calendar },
                  { label: getText('merchant.customers.detail.lastSpecificationUpdate', 'SPECIFICATION UPDATE'), value: new Date(user.updatedAt).toLocaleString(), icon: ShieldCheck },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-6 hover:bg-blue-50/20 transition-colors px-10">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-gray-50 rounded-2xl group-hover:bg-white transition-colors">
                        <item.icon className="w-4 h-4 text-gray-400" />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-2">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-900 tracking-tight">
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
            <Card className="bg-gray-900 rounded-3xl p-8 text-white space-y-6 shadow-xl shadow-gray-200 border-none relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
              <div className="space-y-1 relative z-10">
                <span className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.2em]">{getText('merchant.customers.detail.economicContribution', 'LUMINAL VALUE')}</span>
                <div className="text-4xl font-bold italic tracking-tighter">
                  {currency ? formatCurrency(user.totalSpent || 0, currency) : '--'}
                </div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pt-1">{getText('merchant.customers.totalSpent', 'NET SETTLED VALUE')}</p>
              </div>
              <div className="h-px bg-white/10 w-full relative z-10" />
              <div className="flex justify-between items-center relative z-10">
                <div className="space-y-1">
                  <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{getText('merchant.customers.orders', 'TRANS. COUNT')}</span>
                  <div className="text-2xl font-bold italic">{user.totalOrders || 0}</div>
                </div>
                <DollarSign className="w-10 h-10 text-white/5 opacity-50" />
              </div>
            </Card>




          </div>
        </div>
      </div>

      <ResetPasswordDialog
        open={resetPasswordDialogOpen}
        onOpenChange={setResetPasswordDialogOpen}
        user={user}
        onSuccess={() => {
          toast({
            title: getText('merchant.customers.success', 'Success'),
            description: getText('merchant.customers.resetPassword.success', 'Password reset'),
          })
        }}
      />
    </div>
  )
}
