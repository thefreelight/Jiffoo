/**
 * k6 Stress Test Scenario
 * 
 * 渐进式压力测试场景
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Gauge } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const activeVUs = new Gauge('active_vus');

// Stress test stages
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 VUs
    { duration: '2m', target: 10 },   // Stay at 10 VUs
    { duration: '1m', target: 50 },   // Ramp up to 50 VUs
    { duration: '2m', target: 50 },   // Stay at 50 VUs
    { duration: '1m', target: 100 },  // Ramp up to 100 VUs
    { duration: '2m', target: 100 },  // Stay at 100 VUs
    { duration: '1m', target: 200 },  // Ramp up to 200 VUs (breaking point)
    { duration: '2m', target: 200 },  // Stay at 200 VUs
    { duration: '2m', target: 0 },    // Ramp down to 0 VUs
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'],  // 99th percentile under 5s
    http_req_failed: ['rate<0.1'],       // Less than 10% errors
    errors: ['rate<0.1'],
  },
  tags: {
    testType: 'stress',
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function() {
  activeVUs.add(__VU);

  group('Stress Test Requests', function() {
    // Health check
    const healthRes = http.get(`${BASE_URL}/health`);
    check(healthRes, {
      'health status is 200': (r) => r.status === 200,
    });
    errorRate.add(healthRes.status !== 200);
    responseTime.add(healthRes.timings.duration);

    // API endpoint
    const apiRes = http.get(`${BASE_URL}/api/products?limit=20`);
    check(apiRes, {
      'api status is 200': (r) => r.status === 200,
      'api response time < 2s': (r) => r.timings.duration < 2000,
    });
    errorRate.add(apiRes.status !== 200);
    responseTime.add(apiRes.timings.duration);

    // Search endpoint (more intensive)
    const searchRes = http.get(`${BASE_URL}/api/products/search?q=test`);
    check(searchRes, {
      'search status is 200': (r) => r.status === 200,
    });
    errorRate.add(searchRes.status !== 200);
    responseTime.add(searchRes.timings.duration);
  });

  sleep(0.5);
}

export function setup() {
  console.log(`Starting stress test against ${BASE_URL}`);
  console.log('Stages:', JSON.stringify(options.stages, null, 2));
  
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`Target not reachable: ${res.status}`);
  }
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Stress test completed in ${duration.toFixed(2)}s`);
}

