'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Package,
  Search,
  Loader2,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  Plus,
  Calendar,
  CreditCard,
  Zap,
  Globe,
} from 'lucide-react';
import { AuthGuard } from '../../../components/AuthGuard';
import { ordersApi, type Order } from '../../../lib/api';
import { cn } from '../../../lib/utils';

function OrdersContent() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function fetchOrders() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await ordersApi.getOrders(currentPage, 20);
        setOrders(result.items);
        setTotalPages(result.totalPages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setIsLoading(false);
      }
    }
    fetchOrders();
  }, [currentPage]);

  const getStatusConfig = (status: string) => {
    const normalized = status.toUpperCase();
    switch (normalized) {
      case 'DELIVERED':
      case 'COMPLETED':
        return { color: 'text-foreground bg-muted border-border', label: 'DELIVERED' };
      case 'REFUNDED':
        return { color: 'text-muted-foreground bg-muted border-border', label: 'REFUNDED' };
      case 'PENDING':
      case 'PAID':
        return { color: 'text-muted-foreground bg-muted border-border', label: 'PENDING' };
      case 'CANCELLED':
        return { color: 'text-muted-foreground/40 bg-background border-border', label: 'CANCELLED' };
      default:
        return { color: 'text-muted-foreground bg-muted border-border', label: normalized };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center transition-colors duration-300">
        <div className="max-w-md w-full bg-muted p-8 border border-border">
          <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 border border-primary bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest hover:bg-transparent hover:text-foreground transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
        {/* Header */}
        <div className="border-b border-border">
          <div className="container mx-auto px-4 lg:px-8 py-16">
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-2">
                    MISSION HISTORY
                  </p>
                  <h1 className="text-4xl font-bold text-foreground uppercase tracking-tight">
                    REGISTRY
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2">
                    Global connectivity deployments and activations.
                  </p>
                </div>
                <button
                  onClick={() => router.push(`/${locale}/products`)}
                  className="h-11 px-6 border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest hover:border-foreground hover:text-foreground transition-all flex items-center gap-2"
                >
                  DEPLOY NEW ASSET <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 bg-muted border border-border flex items-center justify-center mx-auto mb-6">
              <Package className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <h2 className="text-xl font-bold text-foreground uppercase mb-2">No Orders Found</h2>
            <p className="text-sm text-muted-foreground mb-8">
              You haven't placed any orders yet.
            </p>
            <button
              onClick={() => router.push(`/${locale}/products`)}
              className="h-11 px-8 bg-primary text-primary-foreground font-mono text-xs uppercase tracking-widest hover:brightness-110 transition-all"
            >
              Browse Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      {/* Compact Hero - max 360px height */}
      <div className="border-b border-border">
        <div className="container mx-auto px-4 lg:px-8 pt-16 pb-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-end justify-between gap-8">
              <div>
                <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-2">
                  MISSION HISTORY
                </p>
                <h1 className="text-4xl font-bold text-foreground uppercase tracking-tight mb-2">
                  REGISTRY
                </h1>
                <p className="text-sm text-muted-foreground">
                  Global connectivity deployments and activations.
                </p>
              </div>
              <button
                onClick={() => router.push(`/${locale}/products`)}
                className="h-11 px-6 border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest hover:border-foreground hover:text-foreground transition-all flex items-center gap-2 flex-shrink-0"
              >
                DEPLOY NEW ASSET <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar - inline, no heavy card */}
        <div className="container mx-auto px-4 lg:px-8 pb-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter */}
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 pl-3 pr-8 bg-muted border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest focus:outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
                >
                  <option value="all">All Status</option>
                  <option value="delivered">Delivered</option>
                  <option value="refunded">Refunded</option>
                  <option value="pending">Pending</option>
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground/60 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Type Filter */}
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-9 pl-3 pr-8 bg-muted border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest focus:outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
                >
                  <option value="all">All Types</option>
                  <option value="esim">eSIM</option>
                  <option value="data">Data</option>
                  <option value="card">Card</option>
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground/60 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Date Range */}
              <div className="relative">
                <select
                  className="h-9 pl-3 pr-8 bg-muted border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest focus:outline-none focus:border-foreground transition-colors appearance-none cursor-pointer"
                >
                  <option>Last 30 Days</option>
                  <option>Last 90 Days</option>
                  <option>Last Year</option>
                  <option>All Time</option>
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground/60 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Order # / Plan / Email..."
                  className="w-full h-9 pl-9 pr-3 bg-muted border border-border text-foreground font-mono text-xs placeholder-muted-foreground/30 focus:outline-none focus:border-foreground transition-colors"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order List - Ledger Style */}
      <div className="container mx-auto px-4 lg:px-8 py-6">
        <div className="max-w-5xl mx-auto space-y-4">
          {orders.map((order) => {
            const statusConfig = getStatusConfig(order.status);
            return (
              <div
                key={order.id}
                className="bg-muted border border-border hover:border-foreground transition-all group"
              >
                {/* Main Row - Clickable */}
                <button
                  onClick={() => router.push(`/${locale}/orders/${order.id}`)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left"
                >
                  {/* Icon */}
                  <div className="w-8 h-8 bg-background border border-border flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  </div>

                  {/* Order Number */}
                  <div className="min-w-[100px]">
                    <span className="font-mono text-sm text-foreground uppercase">
                      #{order.orderNumber || order.id.slice(0, 8)}
                    </span>
                  </div>

                  {/* Status Pill */}
                  <div
                    className={cn(
                      'px-3 py-1 border font-mono text-[10px] uppercase tracking-widest',
                      statusConfig.color
                    )}
                  >
                    {statusConfig.label}
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <Calendar className="w-3 h-3 text-muted-foreground/40" />
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Price */}
                  <div className="text-right min-w-[100px]">
                    <span className="font-mono text-lg font-bold text-foreground">
                      ${order.totalAmount.toFixed(2)}
                    </span>
                  </div>

                  {/* Arrow */}
                  <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                  </div>
                </button>

                {/* Secondary Info Row */}
                <div className="flex items-center gap-6 px-4 pb-3 border-t border-border">
                  <div className="flex items-center gap-6 text-[10px] text-muted-foreground/60 font-mono uppercase tracking-widest pt-2">
                    <span>{order.itemsCount || 0} item{(order.itemsCount || 0) !== 1 ? 's' : ''}</span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> Instant
                    </span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3" /> Card
                    </span>
                    <span className="text-border">·</span>
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3" /> Global
                    </span>
                  </div>

                  <div className="flex-1" />

                  {/* Secondary Action */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Handle buy again
                    }}
                    className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest hover:text-foreground transition-colors pt-2"
                  >
                    Buy Again
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="max-w-5xl mx-auto flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-9 px-4 border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <div className="px-4 py-2 bg-muted border border-border font-mono text-xs text-muted-foreground">
              {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-9 px-4 border border-border text-muted-foreground font-mono text-xs uppercase tracking-widest hover:border-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <AuthGuard>
      <OrdersContent />
    </AuthGuard>
  );
}
