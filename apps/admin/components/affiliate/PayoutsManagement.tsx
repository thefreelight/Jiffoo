/**
 * Payouts Management Component
 *
 * Manages payout requests from affiliates with i18n support.
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader, Filter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { affiliateAdminApi, type Payout } from '@/lib/affiliate-api';
import { useT } from 'shared/src/i18n';

export function PayoutsManagement() {
  const t = useT();
  const { toast } = useToast();
  const [payouts, setPayouts] = React.useState<Payout[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<string>('');
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

  // 处理对话框
  const [processDialog, setProcessDialog] = React.useState<{
    open: boolean;
    payout: Payout | null;
    action: 'approve' | 'reject' | null;
    note: string;
    failureReason: string;
  }>({
    open: false,
    payout: null,
    action: null,
    note: '',
    failureReason: '',
  });

  // 加载提现记录
  const loadPayouts = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await affiliateAdminApi.getPayouts({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });

      if (response.success && response.data) {
        setPayouts(response.data.payouts);
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      toast({
        title: getText('tenant.affiliate.payouts.loadFailed', 'Failed to load payouts'),
        description: error.message || getText('common.tryAgain', 'Please try again'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, toast, t]);

  React.useEffect(() => {
    loadPayouts();
  }, [loadPayouts]);

  // 打开处理对话框
  const handleOpenProcessDialog = (payout: Payout, action: 'approve' | 'reject') => {
    setProcessDialog({
      open: true,
      payout,
      action,
      note: '',
      failureReason: '',
    });
  };

  // 处理提现
  const handleProcessPayout = async () => {
    if (!processDialog.payout || !processDialog.action) return;

    try {
      const status = processDialog.action === 'approve' ? 'COMPLETED' : 'FAILED';
      await affiliateAdminApi.processPayout(processDialog.payout.id, {
        status,
        note: processDialog.note || undefined,
        failureReason: processDialog.action === 'reject' ? processDialog.failureReason : undefined,
      });

      toast({
        title: getText('tenant.affiliate.payouts.processed', 'Payout processed'),
        description: processDialog.action === 'approve'
          ? getText('tenant.affiliate.payouts.approved', 'Payout has been approved')
          : getText('tenant.affiliate.payouts.rejected', 'Payout has been rejected'),
      });

      setProcessDialog({ open: false, payout: null, action: null, note: '', failureReason: '' });
      loadPayouts();
    } catch (error: any) {
      toast({
        title: getText('tenant.affiliate.payouts.processFailed', 'Process failed'),
        description: error.message || getText('tenant.affiliate.payouts.processFailedDesc', 'Failed to process payout'),
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: Payout['status']) => {
    const statusConfig = {
      PENDING: {
        label: getText('tenant.affiliate.payouts.status.pendingReview', 'Pending Review'),
        variant: 'secondary' as const,
        icon: Clock,
      },
      PROCESSING: {
        label: getText('tenant.affiliate.payouts.status.processing', 'Processing'),
        variant: 'default' as const,
        icon: Loader,
      },
      COMPLETED: {
        label: getText('tenant.affiliate.payouts.status.completed', 'Completed'),
        variant: 'default' as const,
        icon: CheckCircle,
      },
      FAILED: {
        label: getText('tenant.affiliate.payouts.status.failed', 'Failed'),
        variant: 'destructive' as const,
        icon: XCircle,
      },
      CANCELLED: {
        label: getText('tenant.affiliate.payouts.status.cancelled', 'Cancelled'),
        variant: 'destructive' as const,
        icon: AlertCircle,
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return '-';
    const methodLabels: Record<string, string> = {
      BANK_TRANSFER: getText('tenant.affiliate.payouts.method.bankTransfer', 'Bank Transfer'),
      PAYPAL: 'PayPal',
      ALIPAY: getText('tenant.affiliate.payouts.method.alipay', 'Alipay'),
      WECHAT: getText('tenant.affiliate.payouts.method.wechat', 'WeChat Pay'),
    };
    return methodLabels[method] || method;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{getText('tenant.affiliate.payouts.title', 'Payout Requests')}</CardTitle>
          <CardDescription>
            {getText('tenant.affiliate.payouts.description', 'Review and process payout requests from affiliates')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={getText('tenant.affiliate.payouts.filterByStatus', 'Filter by status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{getText('tenant.affiliate.payouts.allStatuses', 'All Statuses')}</SelectItem>
                  <SelectItem value="PENDING">{getText('tenant.affiliate.status.pending', 'Pending')}</SelectItem>
                  <SelectItem value="PROCESSING">{getText('tenant.affiliate.payouts.status.processing', 'Processing')}</SelectItem>
                  <SelectItem value="COMPLETED">{getText('tenant.affiliate.payouts.status.completed', 'Completed')}</SelectItem>
                  <SelectItem value="FAILED">{getText('tenant.affiliate.payouts.status.failed', 'Failed')}</SelectItem>
                  <SelectItem value="CANCELLED">{getText('tenant.affiliate.payouts.status.cancelled', 'Cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 提现列表 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : payouts.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{getText('tenant.affiliate.payouts.noRequests', 'No payout requests found')}</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{getText('tenant.affiliate.payouts.requestDate', 'Request Date')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.payouts.user', 'User')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.payouts.amount', 'Amount')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.payouts.method', 'Method')}</TableHead>
                      <TableHead>{getText('common.status', 'Status')}</TableHead>
                      <TableHead>{getText('tenant.affiliate.payouts.processedDate', 'Processed Date')}</TableHead>
                      <TableHead>{getText('common.actions', 'Actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(payout.createdAt), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {payout.user?.username || payout.userId.slice(0, 8)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payout.user?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${payout.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {getPaymentMethodLabel(payout.method)}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payout.status)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {payout.processedAt ? (
                            format(new Date(payout.processedAt), 'MMM dd, yyyy HH:mm')
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payout.status === 'PENDING' && (
                            <div className="flex gap-2">
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleOpenProcessDialog(payout, 'approve')}
                              >
                                {getText('tenant.affiliate.payouts.approve', 'Approve')}
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleOpenProcessDialog(payout, 'reject')}
                              >
                                {getText('tenant.affiliate.payouts.reject', 'Reject')}
                              </Button>
                            </div>
                          )}
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
                    {Math.min(page * pagination.limit, pagination.total)} {getText('common.of', 'of')} {pagination.total} {getText('tenant.affiliate.payouts.requests', 'requests')}
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

      {/* 处理提现对话框 */}
      <Dialog open={processDialog.open} onOpenChange={(open) => setProcessDialog({ ...processDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {processDialog.action === 'approve'
                ? getText('tenant.affiliate.payouts.approveTitle', 'Approve Payout Request')
                : getText('tenant.affiliate.payouts.rejectTitle', 'Reject Payout Request')}
            </DialogTitle>
            <DialogDescription>
              {processDialog.action === 'approve'
                ? getText('tenant.affiliate.payouts.approveDesc', 'Confirm that you want to approve this payout request.')
                : getText('tenant.affiliate.payouts.rejectDesc', 'Provide a reason for rejecting this payout request.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {processDialog.payout && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{getText('tenant.affiliate.payouts.user', 'User')}:</span>
                  <span className="font-medium">{processDialog.payout.user?.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{getText('tenant.affiliate.payouts.amount', 'Amount')}:</span>
                  <span className="font-semibold">${processDialog.payout.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{getText('tenant.affiliate.payouts.method', 'Method')}:</span>
                  <span>{getPaymentMethodLabel(processDialog.payout.method)}</span>
                </div>
              </div>
            )}

            {processDialog.action === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="failureReason">{getText('tenant.affiliate.payouts.rejectionReason', 'Rejection Reason')} *</Label>
                <Textarea
                  id="failureReason"
                  placeholder={getText('tenant.affiliate.payouts.rejectionPlaceholder', 'Enter the reason for rejection...')}
                  value={processDialog.failureReason}
                  onChange={(e) => setProcessDialog({ ...processDialog, failureReason: e.target.value })}
                  rows={3}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="note">{getText('tenant.affiliate.payouts.noteOptional', 'Note (Optional)')}</Label>
              <Textarea
                id="note"
                placeholder={getText('tenant.affiliate.payouts.notePlaceholder', 'Add any additional notes...')}
                value={processDialog.note}
                onChange={(e) => setProcessDialog({ ...processDialog, note: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProcessDialog({ open: false, payout: null, action: null, note: '', failureReason: '' })}
            >
              {getText('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant={processDialog.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleProcessPayout}
              disabled={processDialog.action === 'reject' && !processDialog.failureReason}
            >
              {processDialog.action === 'approve'
                ? getText('tenant.affiliate.payouts.approve', 'Approve')
                : getText('tenant.affiliate.payouts.reject', 'Reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

