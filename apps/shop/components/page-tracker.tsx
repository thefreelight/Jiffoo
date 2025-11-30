/**
 * 页面浏览跟踪组件
 */

'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { log } from '@/lib/logger';

export function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 记录页面浏览
    const url = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    
    log.pageView(url, document.referrer);
    
    // 记录页面性能指标
    if ('performance' in window) {
      // 等待页面完全加载后记录性能指标
      setTimeout(() => {
        const navigation = (performance as any).getEntriesByType('navigation')[0];
        if (navigation) {
          log.performance('page_load_time', navigation.loadEventEnd - navigation.fetchStart, {
            page: url,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
            firstPaint: getFirstPaint(),
            firstContentfulPaint: getFirstContentfulPaint()
          });
        }
        
        // 记录资源加载性能
        const resources = performance.getEntriesByType('resource');
        if (resources.length > 0) {
          const totalResourceTime = resources.reduce((total: number, resource: any) => {
            return total + (resource.responseEnd - resource.startTime);
          }, 0);
          
          log.performance('resource_load_time', totalResourceTime, {
            page: url,
            resourceCount: resources.length
          });
        }
      }, 1000);
    }
  }, [pathname, searchParams]);

  return null;
}

function getFirstPaint(): number | undefined {
  if ('performance' in window) {
    const paintEntries = (performance as any).getEntriesByType('paint');
    const firstPaint = paintEntries.find((entry: any) => entry.name === 'first-paint');
    return firstPaint?.startTime;
  }
  return undefined;
}

function getFirstContentfulPaint(): number | undefined {
  if ('performance' in window) {
    const paintEntries = (performance as any).getEntriesByType('paint');
    const firstContentfulPaint = paintEntries.find((entry: any) => entry.name === 'first-contentful-paint');
    return firstContentfulPaint?.startTime;
  }
  return undefined;
}

export default PageTracker;