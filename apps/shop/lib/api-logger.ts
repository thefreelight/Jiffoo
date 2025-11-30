/**
 * API 日志拦截器
 */

import { logger } from './logger';

export interface ApiLogData {
  url: string;
  method: string;
  status?: number;
  duration?: number;
  error?: any;
  requestData?: any;
  responseData?: any;
}

/**
 * 记录 API 调用日志
 */
export function logApiCall(data: ApiLogData) {
  const { url, method, status, duration, error, requestData, responseData } = data;
  
  const logLevel = error || (status && status >= 400) ? 'warn' : 'info';
  const message = error ? 'API Call Failed' : 'API Call';
  
  logger[logLevel](message, {
    type: 'api_call',
    url,
    method: method.toUpperCase(),
    status,
    duration,
    error: error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined,
    requestSize: requestData ? JSON.stringify(requestData).length : undefined,
    responseSize: responseData ? JSON.stringify(responseData).length : undefined,
    timestamp: new Date().toISOString()
  });
}

/**
 * 创建 API 拦截器
 */
export function createApiInterceptor() {
  // 拦截 fetch 请求
  const originalFetch = window.fetch;
  
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startTime = Date.now();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method || 'GET';
    
    try {
      const response = await originalFetch(input, init);
      const duration = Date.now() - startTime;
      
      // 记录成功的 API 调用
      logApiCall({
        url,
        method,
        status: response.status,
        duration,
        requestData: init?.body ? JSON.parse(init.body as string) : undefined
      });
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // 记录失败的 API 调用
      logApiCall({
        url,
        method,
        duration,
        error,
        requestData: init?.body ? JSON.parse(init.body as string) : undefined
      });
      
      throw error;
    }
  };
}

/**
 * 恢复原始的 fetch 函数
 */
export function restoreOriginalFetch() {
  // 这里可以保存原始 fetch 的引用并恢复
  // 目前简化处理
}

/**
 * 为 axios 或其他 HTTP 客户端创建拦截器
 */
export function setupAxiosInterceptors(axiosInstance: any) {
  // 请求拦截器
  axiosInstance.interceptors.request.use(
    (config: any) => {
      config.metadata = { startTime: Date.now() };
      return config;
    },
    (error: any) => {
      logApiCall({
        url: error.config?.url || 'unknown',
        method: error.config?.method || 'unknown',
        error
      });
      return Promise.reject(error);
    }
  );

  // 响应拦截器
  axiosInstance.interceptors.response.use(
    (response: any) => {
      const duration = Date.now() - response.config.metadata.startTime;
      
      logApiCall({
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        duration,
        requestData: response.config.data,
        responseData: response.data
      });
      
      return response;
    },
    (error: any) => {
      const duration = error.config?.metadata ? 
        Date.now() - error.config.metadata.startTime : 
        undefined;
      
      logApiCall({
        url: error.config?.url || 'unknown',
        method: error.config?.method || 'unknown',
        status: error.response?.status,
        duration,
        error,
        requestData: error.config?.data,
        responseData: error.response?.data
      });
      
      return Promise.reject(error);
    }
  );
}

export default {
  logApiCall,
  createApiInterceptor,
  setupAxiosInterceptors
};