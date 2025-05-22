// tests/performance/api-benchmarks.js
// This file is intended for API benchmark tests.
// You would typically use a dedicated benchmarking tool/library like K6, Artillery,
// or even a simpler custom script with Node.js's fetch or a library like 'autocannon'.

// Example structure if using a generic JS approach (e.g., for simple fetch-based tests)
// For more robust testing, consider tools like K6 (https://k6.io)

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:4321/api'; // Adjust to your dev/test server
const TARGET_VU = parseInt(process.env.PERF_VU || '10'); // Virtual Users
const DURATION_S = parseInt(process.env.PERF_DURATION_S || '30'); // Duration in seconds

async function fetchEndpoint(endpoint, method = 'GET', body = null, headers = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : null,
  };
  const startTime = Date.now();
  try {
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    if (!response.ok) {
      console.error(`[Benchmark] ${method} ${endpoint} - Status: ${response.status}, Duration: ${duration}ms, Error: ${await response.text()}`);
      return { status: response.status, duration, error: true, ok: false };
    }
    // console.log(`[Benchmark] ${method} ${endpoint} - Status: ${response.status}, Duration: ${duration}ms`);
    return { status: response.status, duration, error: false, ok: true, data: await response.json().catch(() => null) };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Benchmark] ${method} ${endpoint} - Request failed: ${error.message}, Duration: ${duration}ms`);
    return { status: 0, duration, error: true, ok: false };
  }
}

// Example benchmark scenario
async function runGetEntitiesBenchmark() {
  console.log(`
Benchmarking GET /entities with ${TARGET_VU} VUs for ${DURATION_S}s...`);
  const results = [];
  const endTime = Date.now() + DURATION_S * 1000;
  let requestsMade = 0;
  let successfulRequests = 0;

  // Simulate multiple virtual users concurrently
  const userPromises = [];
  for (let i = 0; i < TARGET_VU; i++) {
    userPromises.push((async () => {
      while (Date.now() < endTime) {
        const result = await fetchEndpoint('/entities'); // Assuming /entities is an endpoint
        results.push(result.duration);
        requestsMade++;
        if (result.ok) successfulRequests++;
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between requests per VU
      }
    })());
  }
  await Promise.all(userPromises);

  if (results.length === 0) {
    console.log("No requests were made in the benchmark.");
    return;
  }

  const avgDuration = results.reduce((sum, d) => sum + d, 0) / results.length;
  const minDuration = Math.min(...results);
  const maxDuration = Math.max(...results);
  const rps = (requestsMade / DURATION_S).toFixed(2);
  const successRate = ((successfulRequests / requestsMade) * 100).toFixed(2);

  console.log(`GET /entities Benchmark Results:`);
  console.log(`  Total Requests: ${requestsMade}`);
  console.log(`  Successful Requests: ${successfulRequests} (${successRate}%)`);
  console.log(`  Requests Per Second (RPS): ${rps}`);
  console.log(`  Avg. Response Time: ${avgDuration.toFixed(2)}ms`);
  console.log(`  Min. Response Time: ${minDuration.toFixed(2)}ms`);
  console.log(`  Max. Response Time: ${maxDuration.toFixed(2)}ms`);
}

// --- K6 Example (Illustrative - this would be in a separate .js file run by k6) ---
/*
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('http://localhost:4321/api/entities'); // Adjust URL
  check(res, { 'status was 200': (r) => r.status == 200 });
  sleep(1);
}
*/

// To run this script:
// 1. Ensure your dev server is running and API_BASE_URL is correct.
// 2. You might need to handle authentication (e.g., pass an API token in headers).
// 3. Run `node tests/performance/api-benchmarks.js` (if using the fetch-based example)
//    or `k6 run tests/performance/api-benchmarks-k6.js` (if using K6 in a separate file).

async function main() {
  console.log("Starting API Benchmarks...");
  // Add authentication setup here if needed for fetchEndpoint calls
  // e.g., const authToken = await loginAndGetToken();
  // Then pass { 'Authorization': `Bearer ${authToken}` } in fetchEndpoint headers.

  await runGetEntitiesBenchmark();
  // Add calls to other benchmark scenarios here
  // e.g., await runPostTransactionBenchmark();
  console.log("
API Benchmarks Finished.");
}

// If running directly with Node.js:
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runGetEntitiesBenchmark, // Export if you want to run scenarios individually
  // ... other exported scenarios
};
