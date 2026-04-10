/**
 * k6 API Benchmark Scenario
 * 
 * API 端点性能基准测试
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Counter } from 'k6/metrics';

// Custom metrics per endpoint
const productListDuration = new Trend('product_list_duration');
const productDetailDuration = new Trend('product_detail_duration');
const searchDuration = new Trend('search_duration');
const categoryDuration = new Trend('category_duration');
const cartDuration = new Trend('cart_duration');
const requestCount = new Counter('total_requests');

export const options = {
  vus: __ENV.VUS || 5,
  iterations: __ENV.ITERATIONS || 100,
  thresholds: {
    product_list_duration: ['p(95)<300', 'p(99)<500'],
    product_detail_duration: ['p(95)<200', 'p(99)<400'],
    search_duration: ['p(95)<500', 'p(99)<1000'],
    category_duration: ['p(95)<200', 'p(99)<400'],
    cart_duration: ['p(95)<300', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
  },
  tags: {
    testType: 'api-benchmark',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  // Product List Benchmark
  group('Product List', function() {
    const res = http.get(`${BASE_URL}/api/products?limit=20&page=1`);
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body && (Array.isArray(body) || body.data);
        } catch { return false; }
      },
    });
    productListDuration.add(res.timings.duration);
    requestCount.add(1);
  });

  // Product Detail Benchmark
  group('Product Detail', function() {
    const res = http.get(`${BASE_URL}/api/products/1`);
    check(res, {
      'status is 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    productDetailDuration.add(res.timings.duration);
    requestCount.add(1);
  });

  // Search Benchmark
  group('Search', function() {
    const queries = ['phone', 'laptop', 'shirt', 'shoes', 'watch'];
    const query = queries[Math.floor(Math.random() * queries.length)];
    const res = http.get(`${BASE_URL}/api/products/search?q=${query}`);
    check(res, {
      'status is 200': (r) => r.status === 200,
    });
    searchDuration.add(res.timings.duration);
    requestCount.add(1);
  });

  // Category List Benchmark
  group('Category List', function() {
    const res = http.get(`${BASE_URL}/api/categories`);
    check(res, {
      'status is 200': (r) => r.status === 200,
    });
    categoryDuration.add(res.timings.duration);
    requestCount.add(1);
  });

  // Cart Operations Benchmark
  group('Cart Operations', function() {
    const headers = { 'Content-Type': 'application/json' };
    const payload = JSON.stringify({ productId: 1, quantity: 1 });
    const res = http.post(`${BASE_URL}/api/cart`, payload, { headers });
    check(res, {
      'cart operation successful': (r) => r.status === 200 || r.status === 201 || r.status === 401,
    });
    cartDuration.add(res.timings.duration);
    requestCount.add(1);
  });

  sleep(0.1);
}

export function handleSummary(data) {
  return {
    'stdout': JSON.stringify({
      metrics: {
        product_list: extractMetric(data, 'product_list_duration'),
        product_detail: extractMetric(data, 'product_detail_duration'),
        search: extractMetric(data, 'search_duration'),
        category: extractMetric(data, 'category_duration'),
        cart: extractMetric(data, 'cart_duration'),
      },
      total_requests: data.metrics.total_requests?.values?.count || 0,
      failed_requests: data.metrics.http_req_failed?.values?.rate || 0,
    }, null, 2),
  };
}

function extractMetric(data, name) {
  const metric = data.metrics[name];
  if (!metric) return null;
  return {
    avg: metric.values.avg,
    min: metric.values.min,
    max: metric.values.max,
    p90: metric.values['p(90)'],
    p95: metric.values['p(95)'],
    p99: metric.values['p(99)'],
  };
}

