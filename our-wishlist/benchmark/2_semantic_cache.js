import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    // 99% of requests must finish within 1500ms
    http_req_duration: ['p(99)<1500'],
  },
};

const BASE_URL = 'http://localhost:3000';

const QUERIES = [
  "What is a good gift for a coffee lover?", // Repeating generic question (Cache HIT)
  "What is a good gift for a coffee lover?", // Repeating generic question (Cache HIT)
  "What is a good gift for a coffee lover?", // Repeating generic question (Cache HIT)
  "What is a good gift for a coffee lover?", // Repeating generic question (Cache HIT)
  "Sony WH-1000XM5 headphones",              // Exact product query (Cache HIT)
  "Apple AirPods Pro 2",                     // Exact product query (Cache HIT)
  "Nike Air Force 1 White Size 10",          // Exact product query (Cache HIT)
  "Best tech gifts under $100",              // Generic query (Cache HIT/MISS depending on luck)
  "Birthday present for a 5 year old boy",   // Unique-ish
  "Christmas gift for my girlfriend",        // Unique-ish
  "Cool gadgets for dad",                    // Unique-ish
  "Something for a ski trip",                // Unique-ish
  "Unique wedding gift for best friend",     // Unique (Cache MISS)
  "What should I get my mom for mothers day?", // Unique (Cache MISS)
  "Gift ideas for a photographer",           // Unique (Cache MISS)
  "Best books for a sci-fi fan"              // Unique (Cache MISS)
];

export default function () {
  const randomQuery = QUERIES[Math.floor(Math.random() * QUERIES.length)];

  const payload = JSON.stringify({
    query: randomQuery,
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

  let chatRes = http.post(`${BASE_URL}/api/chat`, payload, params);
  
  check(chatRes, {
    'chat request successful': (r) => r.status === 200 || r.status === 401,
  });
  
  sleep(2);
}
