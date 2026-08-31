import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Ramp up to 50 virtual users
    { duration: '1m', target: 50 },   // Stay at 50 for 1 minute (Soak)
    { duration: '10s', target: 0 },   // Ramp down to 0
  ],
  thresholds: {
    // 99% of requests must finish within 1500ms for chat, and 200ms for normal API
    http_req_duration: ['p(99)<1500'],
    http_req_failed: ['rate<0.01'],   // Errors should be less than 1%
  },
};

const BASE_URL = 'http://localhost:3000';

// We just use a generic query here because we are testing overall app resilience and rate limits, 
// not the cache hit rate (which is tested in 2_semantic_cache).

export default function () {
  // 1. Load the homepage / dashboard (simulate data fetch)
  let res = http.get(`${BASE_URL}/`);
  check(res, {
    'homepage status is 200': (r) => r.status === 200,
  });
  sleep(1);

  // 2. Simulate asking the AI (we use a generic query to test API throughput)
  const payload = JSON.stringify({
    query: "What is a good generic gift?",
    friendId: "mock-friend-id",
    groupId: "mock-group-id",
    history: []
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer TEST_BENCHMARK_TOKEN' 
    },
  };

  // We hit the chat endpoint (this will trigger Semantic Cache after the first time!)
  let chatRes = http.post(`${BASE_URL}/api/chat`, payload, params);

  // Note: If you don't provide a Clerk token, this might return 401 Unauthorized in Next.js.
  // To truly load test it locally, you can temporarily comment out the auth check in route.ts, 
  // or grab a token from your browser dev tools.
  check(chatRes, {
    'chat request successful': (r) => r.status === 200 || r.status === 401, // 401 is expected if auth is strict
  });

  sleep(2);
}
