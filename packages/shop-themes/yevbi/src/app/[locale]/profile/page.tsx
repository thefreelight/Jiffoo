'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Package,
  CreditCard,
  Settings,
  Headphones,
  LogOut,
  Wifi,
  ShoppingBag,
  Zap,
  QrCode,
  Loader2,
  Clock,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { authApi, ordersApi, type Order } from '../../../lib/api';
import { cn } from '../../../lib/utils';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'esims', label: 'My eSIMs' },
  { id: 'orders', label: 'Orders' },
  { id: 'settings', label: 'Settings' },
];

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || 'en';

  const [activeTab, setActiveTab] = useState('overview');
  const [userData, setUserData] = useState<{ firstName?: string; lastName?: string; email: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const isAuth = authApi.isAuthenticated();
      if (!isAuth) {
        router.push(`/${locale}/auth/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      try {
        const currentUser = await authApi.getProfile();
        if (currentUser) {
          setUserData({
            firstName: currentUser.username?.split(' ')[0] || 'User',
            lastName: currentUser.username?.split(' ')[1] || '',
            email: currentUser.email,
          });
        }
        const ordersData = await ordersApi.getOrders();
        setOrders(ordersData.items.slice(0, 8));
      } catch (error) {
        console.error('Profile load error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [locale, router]);

  const handleLogout = () => {
    authApi.logout();
    router.push(`/${locale}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center transition-colors duration-300">
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
      </div>
    );
  }

  const displayName = [userData?.firstName, userData?.lastName].filter(Boolean).join(' ') || 'User';
  const initials = (userData?.firstName?.[0] || '') + (userData?.lastName?.[0] || '');

  return (
    <div className="min-h-screen bg-background pb-24 transition-colors duration-300">

      {/* Top bar — user identity + quick actions */}
      <div className="border-b border-border bg-background relative z-10 transition-colors duration-300">
        <div className="container mx-auto px-4 lg:px-8 max-w-5xl pt-28 pb-0">
          {/* User row */}
          <div className="flex items-center justify-between pb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-muted flex items-center justify-center font-bold text-sm text-foreground flex-shrink-0">
                {initials || <UserIcon className="w-4 h-4" />}
              </div>
              <div>
                <p className="font-bold text-sm text-foreground uppercase tracking-tight leading-tight">{displayName}</p>
                <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest">{userData?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex items-center gap-0 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => tab.id === 'orders' ? router.push(`/${locale}/orders`) : setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-3 font-mono text-xs uppercase tracking-widest border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground/60 hover:text-muted-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 lg:px-8 max-w-5xl py-10">

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">

            {/* Inline stats */}
            <div className="grid grid-cols-3 divide-x divide-border border border-border transition-colors duration-300">
              <div className="px-6 py-5">
                <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1">Active Plans</p>
                <p className="text-2xl font-bold text-foreground">0</p>
              </div>
              <div className="px-6 py-5">
                <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1">Data Left</p>
                <p className="text-2xl font-bold text-foreground">—</p>
              </div>
              <div className="px-6 py-5">
                <p className="font-mono text-[10px] text-muted-foreground/60 uppercase tracking-widest mb-1">Total Orders</p>
                <p className="text-2xl font-bold text-foreground">{orders.length}</p>
              </div>
            </div>

            {/* Active Plans section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Active Plans</h2>
              </div>
              <div className="border border-border">
                <div className="px-6 py-10 text-center">
                  <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest mb-5">No active plans</p>
                  <button
                    onClick={() => router.push(`/${locale}/products`)}
                    className="font-mono text-sm uppercase tracking-widest px-6 py-3 bg-primary text-primary-foreground border border-primary hover:bg-muted hover:text-foreground hover:border-foreground transition-all inline-flex items-center gap-2"
                  >
                    Browse Plans <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Recent orders */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Recent Orders</h2>
                <button
                  onClick={() => router.push(`/${locale}/orders`)}
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground flex items-center gap-1 transition-colors"
                >
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {orders.length === 0 ? (
                <div className="border border-border px-6 py-8 text-center">
                  <p className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">No orders yet</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border">
                  {orders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => router.push(`/${locale}/orders/${order.id}`)}
                      className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted transition-colors text-left group"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                          #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          ${order.totalAmount.toFixed(2)}
                        </span>
                        <span className={cn(
                          'font-mono text-[10px] uppercase tracking-widest w-14 text-right',
                          order.status === 'PAID' ? 'text-muted-foreground' : 'text-muted-foreground/60'
                        )}>
                          {order.status === 'PAID' ? 'Paid' : order.status}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border border border-border">
              {[
                { icon: <CreditCard className="w-4 h-4" />, label: 'Payment Methods', sub: 'Manage saved cards' },
                { icon: <Settings className="w-4 h-4" />, label: 'Account Settings', sub: 'Email & password' },
                { icon: <Headphones className="w-4 h-4" />, label: 'Help Center', sub: 'Get support', href: '/help' },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => item.href ? router.push(`/${locale}${item.href}`) : undefined}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors text-left group"
                >
                  <span className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">{item.icon}</span>
                  <div>
                    <p className="font-mono text-xs text-muted-foreground group-hover:text-foreground uppercase tracking-widest transition-colors">{item.label}</p>
                    <p className="font-mono text-[10px] text-muted-foreground/60">{item.sub}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 ml-auto group-hover:text-muted-foreground transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* eSIMs tab */}
        {activeTab === 'esims' && (
          <div>
            <div className="border border-border px-6 py-16 text-center">
              <div className="w-10 h-10 bg-muted flex items-center justify-center mx-auto mb-4 text-muted-foreground/60">
                <QrCode className="w-5 h-5" />
              </div>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-2">No active eSIM plans</p>
              <p className="font-mono text-[10px] text-muted-foreground/60 mb-6">Purchase a plan to get started.</p>
              <button
                onClick={() => router.push(`/${locale}/products`)}
                className="font-mono text-sm uppercase tracking-widest px-6 py-3 bg-primary text-primary-foreground border border-primary hover:bg-muted hover:text-foreground hover:border-foreground transition-all inline-flex items-center gap-2"
              >
                Browse Plans <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Settings tab */}
        {activeTab === 'settings' && (
          <div className="border border-border divide-y divide-border">
            {[
              { label: 'Display Name', value: displayName },
              { label: 'Email Address', value: userData?.email || '—' },
              { label: 'Password', value: '••••••••' },
              { label: 'Language', value: 'English' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-4">
                <span className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">{row.label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{row.value}</span>
                  <button className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 hover:text-muted-foreground transition-colors">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
