import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 300 },  // ramp to 100 users
    { duration: '1m', target: 300 },    // stay at 100
    { duration: '30s', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],  // 95% of requests under 1s
    http_req_failed: ['rate<0.01'],      // less than 1% errors
  },
};

const BASE_URL = __ENV.BASE_URL || 'https://a-btalksapp.vercel.app';

export default function () {
  const res = http.get(`${BASE_URL}/claude-signup`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  sleep(1);
}