/**
 * Affiliate Users List Component
 *
 * Displays and manages affiliate users with i18n support.
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import { Search, Edit, DollarSign, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { affiliateAdminApi, type AffiliateUser } from '@/lib/affiliate-api';
import { useT } from 'shared/src/i18n';

export function AffiliateUsersList() {
  const t = useT();
  const { toast } = useToast();
  const [users, setUsers] = React.useState<AffiliateUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Helper function for translations with fallback
  const getText = (key: string, fallback: string): string => {
    return t ? t(key) : fallback;
  };

  // 编辑分润比例对话框
  const [editDialog, setEditDialog] = React.useState<{
    open: boolean;
    user: AffiliateUser | null;
    rate: string;
  }>({
    open: false,
    user: null,
    rate: '',
  });

  // 加载用户列表
  const loadUsers = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await affiliateAdminApi.getAffiliateUsers({
        page,
        limit: 20,
        search: search || undefined,
      });

      if (response.success && response.data) {
        setUsers(response.data.users);
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      toast({
        title: getText('tenant.affiliate.users.loadFailed', 'Failed to load users'),
        description: error.message || getText('common.tryAgain', 'Please try again'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, search, toast, t]);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // 搜索处理
  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  // 打开编辑对话框
  const handleEditRate = (user: AffiliateUser) => {
    setEditDialog({
      open: true,
      user,
      rate: user.customCommissionRate?.toString() || '',
    });
  };

  // 保存分润比例
  const handleSaveRate = async () => {
    if (!editDialog.user) return;

    const rate = editDialog.rate ? parseFloat(editDialog.rate) : null;

    if (rate !== null && (isNaN(rate) || rate < 0 || rate > 100)) {
      toast({
        title: getText('tenant.affiliate.users.invalidRate', 'Invalid rate'),
        description: getText('tenant.affiliate.users.rateRange', 'Commission rate must be between 0 and 100'),
        variant: 'destructive',
      });
      return;
    }

    try {
      await affiliateAdminApi.setUserCommissionRate(editDialog.user.id, rate);

      toast({
        title: getText('tenant.affiliate.users.rateUpdated', 'Rate updated'),
        description: getText('tenant.affiliate.users.rateUpdatedDesc', 'Commission rate has been updated'),
      });

      setEditDialog({ open: false, user: null, rate: '' });
      loadUsers();
    } catch (error: any) {
      toast({
        title: getText('tenant.affiliate.users.updateFailed', 'Update failed'),
        description: error.message || getText('tenant.affiliate.users.updateFailedDesc', 'Failed to update commission rate'),
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{getText('tenant.affiliate.users.title', 'Affiliate Users')}</CardTitle>
          <CardDescription>
            {getText('tenant.affiliate.users.description', 'Manage affiliate users and their commission rates')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 搜索栏 */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={getText('tenant.affiliate.users.searchPlaceholder', 'Search by username, email, or referral code...')}
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* 用户列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{getText('tenant.affiliate.users.noUsers', 'No affiliate users found')}</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{getText('tenant.affiliate.users.user', 'User')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.users.referralCode', 'Referral Code')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.users.commissionRate', 'Commission Rate')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.users.totalReferrals', 'Total Referrals')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.users.totalEarnings', 'Total Earnings')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.users.pendingBalance', 'Pending Balance')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.users.joined', 'Joined')}</TableHead>
                      <TableHead>{getText('common.actions', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {user.referralCode}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {user.customCommissionRate !== null ? (
                            <Badge variant="default">
                              {user.customCommissionRate}% ({getText('tenant.affiliate.users.custom', 'Custom')})
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{getText('tenant.affiliate.users.default', 'Default')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            {user.totalReferrals}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-green-600 font-semibold">
                            <DollarSign className="h-4 w-4" />
                            {user.totalEarnings.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            ${user.pendingBalance.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditRate(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    {getText('common.showingResults', 'Showing')} {(page - 1) * pagination.limit + 1} {getText('common.to', 'to')}{' '}
                    {Math.min(page * pagination.limit, pagination.total)} {getText('common.of', 'of')} {pagination.total} {getText('tenant.affiliate.users.usersCount', 'users')}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      {getText('common.previous', 'Previous')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      {getText('common.next', 'Next')}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 编辑分润比例对话框 */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getText('tenant.affiliate.users.editRate', 'Edit Commission Rate')}</DialogTitle>
            <DialogDescription>
              {getText('tenant.affiliate.users.editRateDesc', 'Set a custom commission rate for')} {editDialog.user?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rate">{getText('tenant.affiliate.users.commissionRatePercent', 'Commission Rate (%)')}</Label>
              <Input
                id="rate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder={getText('tenant.affiliate.users.ratePlaceholder', 'Leave empty to use default rate')}
                value={editDialog.rate}
                onChange={(e) => setEditDialog({ ...editDialog, rate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                {getText('tenant.affiliate.users.rateHint', 'Leave empty to use the default commission rate. Enter a value between 0 and 100 to set a custom rate.')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, user: null, rate: '' })}>
              {getText('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleSaveRate}>{getText('common.save', 'Save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

