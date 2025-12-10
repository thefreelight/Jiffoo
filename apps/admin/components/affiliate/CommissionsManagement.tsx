/**
 * Commissions Management Component
 *
 * Displays and manages commission records with i18n support.
 */

'use client';

import React from 'react';
import { format } from 'date-fns';
import { Clock, CheckCircle, XCircle, DollarSign, Filter } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import { affiliateAdminApi, type Commission } from '@/lib/affiliate-api';
import { useT } from 'shared/src/i18n';

export function CommissionsManagement() {
  const t = useT();
  const { toast } = useToast();
  const [commissions, setCommissions] = React.useState<Commission[]>([]);
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

  // 加载佣金记录
  const loadCommissions = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await affiliateAdminApi.getCommissions({
        page,
        limit: 20,
        status: statusFilter || undefined,
      });

      if (response.success && response.data) {
        setCommissions(response.data.commissions);
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      toast({
        title: getText('tenant.affiliate.commissions.loadFailed', 'Failed to load commissions'),
        description: error.message || getText('common.tryAgain', 'Please try again'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, toast, t]);

  React.useEffect(() => {
    loadCommissions();
  }, [loadCommissions]);

  const getStatusBadge = (status: Commission['status']) => {
    const statusConfig = {
      PENDING: {
        label: getText('tenant.affiliate.status.pending', 'Pending'),
        variant: 'secondary' as const,
        icon: Clock,
      },
      SETTLED: {
        label: getText('tenant.affiliate.status.settled', 'Settled'),
        variant: 'default' as const,
        icon: CheckCircle,
      },
      PAID: {
        label: getText('tenant.affiliate.status.paid', 'Paid'),
        variant: 'default' as const,
        icon: CheckCircle,
      },
      REFUNDED: {
        label: getText('tenant.affiliate.status.refunded', 'Refunded'),
        variant: 'destructive' as const,
        icon: XCircle,
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>{getText('tenant.affiliate.commissions.title', 'Commission Records')}</CardTitle>
        <CardDescription>
          {getText('tenant.affiliate.commissions.description', 'View and manage all commission records')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* 筛选栏 */}
        <div className="mb-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={getText('tenant.affiliate.commissions.filterByStatus', 'Filter by status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{getText('tenant.affiliate.commissions.allStatuses', 'All Statuses')}</SelectItem>
                <SelectItem value="PENDING">{getText('tenant.affiliate.status.pending', 'Pending')}</SelectItem>
                <SelectItem value="SETTLED">{getText('tenant.affiliate.status.settled', 'Settled')}</SelectItem>
                <SelectItem value="PAID">{getText('tenant.affiliate.status.paid', 'Paid')}</SelectItem>
                <SelectItem value="REFUNDED">{getText('tenant.affiliate.status.refunded', 'Refunded')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 佣金列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : commissions.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{getText('tenant.affiliate.commissions.noRecords', 'No commission records found')}</p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{getText('tenant.affiliate.commissions.date', 'Date')}</TableHead>
                    <TableHead>{getText('tenant.affiliate.commissions.affiliate', 'Affiliate')}</TableHead>
                    <TableHead>{getText('tenant.affiliate.commissions.buyer', 'Buyer')}</TableHead>
                    <TableHead>{getText('tenant.affiliate.commissions.orderId', 'Order ID')}</TableHead>
                    <TableHead>{getText('tenant.affiliate.commissions.orderAmount', 'Order Amount')}</TableHead>
                    <TableHead>{getText('tenant.affiliate.commissions.rate', 'Rate')}</TableHead>
                    <TableHead>{getText('tenant.affiliate.commissions.commission', 'Commission')}</TableHead>
                    <TableHead>{getText('common.status', 'Status')}</TableHead>
                    <TableHead>{getText('tenant.affiliate.commissions.settleDate', 'Settle Date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(commission.createdAt), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {commission.user?.username || commission.userId.slice(0, 8)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {commission.user?.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {commission.buyer?.username || commission.buyerId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {commission.orderId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        ${commission.orderAmount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {commission.rate}%
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        ${commission.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(commission.status)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {commission.status === 'PENDING' ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(commission.settleAt), 'MMM dd, yyyy')}
                          </span>
                        ) : commission.settledAt ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(commission.settledAt), 'MMM dd, yyyy')}
                          </span>
                        ) : (
                          '-'
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
                  {Math.min(page * pagination.limit, pagination.total)} {getText('common.of', 'of')} {pagination.total} {getText('tenant.affiliate.commissions.records', 'records')}
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
  );
}

