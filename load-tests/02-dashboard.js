import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.02'],
  },
};

const BASE_URL = __ENV.BASE_URL;

export default function () {
  const res = http.get(`${BASE_URL}/api/claude-recent-signups`);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has signups data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.signups !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  sleep(2);
}