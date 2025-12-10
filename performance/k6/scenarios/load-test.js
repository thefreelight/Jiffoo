/**
 * k6 Load Test Scenario
 * 
 * 标准负载测试场景
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const requestDuration = new Trend('request_duration');
const requestCount = new Counter('requests');

// Test configuration
export const options = {
  vus: __ENV.VUS || 10,
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
  },
  tags: {
    testType: 'load',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Test scenarios
export default function() {
  group('Health Check', function() {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 100ms': (r) => r.timings.duration < 100,
    });
    errorRate.add(res.status !== 200);
    requestDuration.add(res.timings.duration);
    requestCount.add(1);
  });

  group('API Endpoints', function() {
    // Products list
    const productsRes = http.get(`${BASE_URL}/api/products?limit=10`);
    check(productsRes, {
      'products status is 200': (r) => r.status === 200,
      'products response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(productsRes.status !== 200);
    requestDuration.add(productsRes.timings.duration);
    requestCount.add(1);

    // Categories
    const categoriesRes = http.get(`${BASE_URL}/api/categories`);
    check(categoriesRes, {
      'categories status is 200': (r) => r.status === 200,
    });
    errorRate.add(categoriesRes.status !== 200);
    requestCount.add(1);
  });

  sleep(1);
}

// Lifecycle hooks
export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`VUs: ${options.vus}, Duration: ${options.duration}`);
  
  // Verify target is reachable
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`Target not reachable: ${res.status}`);
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration.toFixed(2)}s`);
}

