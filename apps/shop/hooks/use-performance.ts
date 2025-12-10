'use client';

import { useEffect, useRef } from 'react';
import { 
  trackRender, 
  trackApiStart, 
  trackApiEnd,
  getPerformanceSummary,
  resetRenderTrackers 
} from '@/lib/performance-monitor';

/**
 * Hook: 追踪组件渲染性能
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useRenderTracker('MyComponent');
 *   return <div>...</div>;
 * }
 * ```
 */
export function useRenderTracker(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  
  useEffect(() => {
    const renderTime = performance.now() - lastRenderTime.current;
    renderCount.current++;
    trackRender(componentName, renderTime);
    lastRenderTime.current = performance.now();
  });
}

/**
 * Hook: 追踪 API 请求性能
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { trackRequest } = useApiTracker();
 *   
 *   const fetchData = async () => {
 *     const { start, end } = trackRequest('/api/data');
 *     start();
 *     try {
 *       const res = await fetch('/api/data');
 *       end(res.status);
 *     } catch (e) {
 *       end(500);
 *     }
 *   };
 * }
 * ```
 */
export function useApiTracker() {
  const trackRequest = (url: string) => {
    const requestId = `${url}_${Date.now()}`;
    
    return {
      start: () => trackApiStart(url, requestId),
      end: (status?: number, metadata?: Record<string, unknown>) => 
        trackApiEnd(url, requestId, status, metadata),
    };
  };
  
  return { trackRequest };
}

/**
 * Hook: 获取性能摘要
 */
export function usePerformanceSummary() {
  return getPerformanceSummary();
}

/**
 * Hook: 在路由切换时重置渲染追踪器
 */
export function useResetRenderTrackersOnNavigate() {
  useEffect(() => {
    // 组件卸载时重置
    return () => {
      resetRenderTrackers();
    };
  }, []);
}

export { 
  trackRender, 
  trackApiStart, 
  trackApiEnd,
  getPerformanceSummary,
  resetRenderTrackers 
};

