/**
 * Data Plan Usage Component
 * Displays eSIM data plan usage information
 */

import { useState, useEffect } from 'react';
import { Loader2, Wifi, Calendar, TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface DataPlanUsageProps {
  planId: string;
  installationId?: string;
  className?: string;
}

interface PlanUsageData {
  cardUid: string;
  planId: string;
  planName: string;
  planState: string;
  profileState: string | null;
  buyDate: string;
  activeTime: string | null;
  expiryTime: string | null;
  validTime: string | null;
  dataSize: string;
  usedSize: string | null;
  leftoverSize: string | null;
  apn: string;
  raw?: {
    used_size?: number;
    leftover_size?: number;
    [key: string]: any;
  };
}

export function DataPlanUsage({ planId, installationId, className }: DataPlanUsageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<PlanUsageData | null>(null);

  const fetchUsageData = async () => {
    if (!planId) {
      setError('Plan ID is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (installationId && installationId.trim().length > 0) {
        params.set('installationId', installationId.trim());
      } else {
        params.set('installation', 'default');
      }

      const response = await fetch(`/api/extensions/plugin/odoo/api/plans/status?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || result.error || 'Failed to fetch usage data');
      }

      if (result.data?.items && result.data.items.length > 0) {
        setUsageData(result.data.items[0]);
      } else {
        setError('No usage data found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage data');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fetch on mount
  useEffect(() => {
    fetchUsageData();
  }, [planId, installationId]);

  const formatDataSize = (size: string | null | undefined) => {
    if (!size || size === 'null') return 'N/A';
    const num = parseFloat(size);
    if (isNaN(num)) return 'N/A';
    if (num >= 1024) return `${(num / 1024).toFixed(2)} GB`;
    return `${num.toFixed(2)} MB`;
  };

  const calculateUsagePercentage = () => {
    if (!usageData?.dataSize) return 0;
    
    // Use raw.leftover_size if available
    const total = parseFloat(usageData.dataSize);
    const leftover = usageData.leftoverSize ? parseFloat(usageData.leftoverSize) : 
                     (usageData.raw?.leftover_size ? parseFloat(String(usageData.raw.leftover_size)) : null);
    
    if (isNaN(total) || total === 0) return 0;
    
    // If we have leftover, calculate used from it
    if (leftover !== null && !isNaN(leftover)) {
      const used = total - leftover;
      return Math.min(100, Math.max(0, (used / total) * 100));
    }
    
    // Otherwise try to use usedSize
    const used = usageData.usedSize ? parseFloat(usageData.usedSize) : 0;
    if (isNaN(used)) return 0;
    return Math.min(100, (used / total) * 100);
  };

  const getUsedSize = () => {
    if (!usageData) return 'N/A';
    
    // Try to get from raw data first
    if (usageData.raw?.used_size !== undefined && usageData.raw.used_size !== null) {
      return formatDataSize(String(usageData.raw.used_size));
    }
    
    // Calculate from leftover if available
    if (usageData.dataSize && usageData.leftoverSize) {
      const total = parseFloat(usageData.dataSize);
      const leftover = parseFloat(usageData.leftoverSize);
      if (!isNaN(total) && !isNaN(leftover)) {
        return formatDataSize(String(total - leftover));
      }
    }
    
    // Use raw.leftover_size to calculate
    if (usageData.dataSize && usageData.raw?.leftover_size !== undefined) {
      const total = parseFloat(usageData.dataSize);
      const leftover = parseFloat(String(usageData.raw.leftover_size));
      if (!isNaN(total) && !isNaN(leftover)) {
        return formatDataSize(String(total - leftover));
      }
    }
    
    return formatDataSize(usageData.usedSize);
  };

  const getLeftoverSize = () => {
    if (!usageData) return 'N/A';
    
    // Try raw data first
    if (usageData.raw?.leftover_size !== undefined && usageData.raw.leftover_size !== null) {
      return formatDataSize(String(usageData.raw.leftover_size));
    }
    
    return formatDataSize(usageData.leftoverSize);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr || dateStr === 'null') return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'N/A';
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className={cn('bg-[#141414] border border-[#2a2a2a] p-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-[#bdbdbd]" />
          <span className="font-mono text-[10px] text-[#555] uppercase tracking-widest">
            Data Usage
          </span>
        </div>
        <button
          onClick={fetchUsageData}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 border border-[#2a2a2a] text-[#bdbdbd] hover:border-[#eaeaea] hover:text-[#eaeaea] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className={cn('w-3 h-3', isLoading && 'animate-spin')} />
          <span className="font-mono text-[10px] uppercase tracking-widest">
            {isLoading ? 'Loading...' : 'Check Usage'}
          </span>
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-[#1c1c1c] border border-[#2a2a2a] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#bdbdbd] flex-shrink-0" />
          <p className="text-xs text-[#bdbdbd] font-mono">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && !usageData && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-[#bdbdbd] mx-auto mb-3 animate-spin" />
          <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest">
            Loading usage data...
          </p>
        </div>
      )}

      {/* Usage Data */}
      {!isLoading && usageData && (
        <div className="space-y-4">
          {/* Usage Bar */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-xs text-[#bdbdbd]">Data Consumed</span>
              <span className="font-mono text-xs text-[#eaeaea]">
                {getUsedSize()} / {formatDataSize(usageData.dataSize)}
              </span>
            </div>
            <div className="h-2 bg-[#0f0f0f] border border-[#2a2a2a] overflow-hidden">
              <div
                className="h-full bg-[#eaeaea] transition-all duration-500"
                style={{ width: `${calculateUsagePercentage()}%` }}
              />
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="font-mono text-[9px] text-[#555]">
                {calculateUsagePercentage().toFixed(1)}% Used
              </span>
              <span className="font-mono text-[9px] text-[#555]">
                {getLeftoverSize()} Remaining
              </span>
            </div>
          </div>

          {/* Status Grid */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#1e1e1e]">
            <div>
              <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mb-1">
                Plan Status
              </p>
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  usageData.planState === 'active' ? 'bg-[#eaeaea]' : 'bg-[#555]'
                )} />
                <span className="font-mono text-xs text-[#eaeaea]">
                  {usageData.planState === 'no_active' ? 'Not Active' : 
                   usageData.planState === 'active' ? 'Active' : 
                   usageData.planState || 'Unknown'}
                </span>
              </div>
            </div>
            <div>
              <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mb-1">
                Profile Status
              </p>
              <span className="font-mono text-xs text-[#eaeaea]">
                {usageData.profileState || 'Not Activated'}
              </span>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-2 pt-4 border-t border-[#1e1e1e]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-[#555] uppercase tracking-widest">
                Activated
              </span>
              <span className="font-mono text-[10px] text-[#bdbdbd]">
                {formatDate(usageData.activeTime)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] text-[#555] uppercase tracking-widest">
                Expires
              </span>
              <span className="font-mono text-[10px] text-[#bdbdbd]">
                {formatDate(usageData.expiryTime)}
              </span>
            </div>
          </div>

          {/* Additional Info */}
          {usageData.planName && (
            <div className="pt-4 border-t border-[#1e1e1e]">
              <p className="font-mono text-[9px] text-[#555] uppercase tracking-widest mb-1">
                Plan Name
              </p>
              <p className="font-mono text-xs text-[#bdbdbd]">{usageData.planName}</p>
            </div>
          )}
        </div>
      )}

      {/* Initial Loading State */}
      {!isLoading && !usageData && !error && (
        <div className="text-center py-8">
          <TrendingUp className="w-8 h-8 text-[#555] mx-auto mb-3" />
          <p className="font-mono text-[10px] text-[#555] uppercase tracking-widest">
            No usage data available
          </p>
        </div>
      )}
    </div>
  );
}
