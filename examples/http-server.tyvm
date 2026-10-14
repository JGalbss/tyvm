// HTTP Server Simulation — Virtual-thread-per-request model
//
// Simulates a concurrent HTTP server where each incoming request is
// handled on its own virtual thread. This mirrors the architecture of
// modern Java HTTP servers using Project Loom's virtual threads, but
// written entirely in TypeScript.
//
// The simulation:
//   - 20 concurrent "requests" arrive simultaneously
//   - Each is dispatched to a virtual thread via spawn()
//   - Handlers perform route-dependent computation (hash, DB sim, primes)
//   - Results flow back through a channel (fan-in)
//
// Compile & run:
//   node dist/cli.js compile examples/http-server.ts
//   java -cp out:runtime/tyvm-runtime.jar http-server

import { spawn, Task, Channel, channel } from "tyvm";
import { System } from "java:java.lang.System";

// Handle a /hello route: compute a rolling hash to simulate processing
function handleHello(requestId: number): number {
  let hash = requestId;
  let i = 0;
  while (i < 100000) {
    hash = (hash * 31 + i) % 1000000007;
    i = i + 1;
  }
  return hash;
}

// Handle a /status route: simulate a database query
function handleStatus(requestId: number): number {
  let checksum = 0;
  let i = 0;
  while (i < 50000) {
    checksum = (checksum + i * 7) % 999983;
    i = i + 1;
  }
  return checksum;
}

// Handle a /compute route: count primes (heavy computation)
function handleCompute(requestId: number): number {
  let count = 0;
  let n = 2;
  let limit: number = (requestId + 1) * 200;
  while (n < limit) {
    let isPrime = true;
    let d = 2;
    while (d * d <= n) {
      if (n % d === 0) {
        isPrime = false;
      }
      d = d + 1;
    }
    if (isPrime) {
      count = count + 1;
    }
    n = n + 1;
  }
  return count;
}

// Route dispatcher: picks a handler based on request ID mod 3,
// simulating /hello, /status, and /compute endpoints.
function routeRequest(results: Channel<number>, requestId: number): void {
  let result = 0;
  const route: number = requestId % 3;
  if (route === 0) {
    result = handleHello(requestId);
  } else if (route === 1) {
    result = handleStatus(requestId);
  } else {
    result = handleCompute(requestId);
  }
  results.send(result);
}

function main(): void {
  console.log("=== tyvm HTTP Server Simulation ===");
  console.log("Virtual-thread-per-request model");
  console.log("Dispatching 20 concurrent requests...");

  const results: Channel<number> = channel();
  const startTime: number = System.currentTimeMillis();
  const numRequests = 20;

  // Fan out: spawn one virtual thread per request — just like
  // Java's virtual-thread-per-request executor model
  let reqId = 0;
  while (reqId < numRequests) {
    spawn(routeRequest(results, reqId));
    reqId = reqId + 1;
  }

  // Fan in: collect all responses through the channel
  let received = 0;
  let totalResult = 0;
  while (received < numRequests) {
    const val: number = results.recv();
    console.log(val);
    totalResult = totalResult + val;
    received = received + 1;
  }

  const elapsed: number = System.currentTimeMillis() - startTime;
  console.log("--- All requests handled ---");
  console.log("Aggregate:");
  console.log(totalResult);
  console.log("Elapsed ms:");
  console.log(elapsed);
}
