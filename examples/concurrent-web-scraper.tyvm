// Concurrent Web Scraper — Structured concurrency with fan-out/fan-in
//
// Simulates a concurrent data fetcher that:
//   1. Fans out to 12 virtual threads, each "fetching" a URL
//   2. Each thread performs computation proportional to the page "size"
//   3. Each thread extracts "links" (prime-counting as proxy)
//   4. Results flow through a channel to a monitor/aggregator thread
//   5. Main thread receives final statistics
//
// This showcases structured concurrency: all work is spawned, tracked,
// and collected through typed channels. The program exits cleanly once
// all results are aggregated.
//
// Compile & run:
//   node dist/cli.js compile examples/concurrent-web-scraper.ts
//   java -cp out:runtime/tyvm-runtime.jar concurrent-web-scraper

import { spawn, Task, Channel, channel } from "tyvm";
import { System } from "java:java.lang.System";

function isPrime(n: number): boolean {
  if (n < 2) {
    return false;
  }
  if (n < 4) {
    return true;
  }
  if (n % 2 === 0) {
    return false;
  }
  let d = 3;
  while (d * d <= n) {
    if (n % d === 0) {
      return false;
    }
    d = d + 2;
  }
  return true;
}

// Simulate fetching a URL: perform work proportional to "page size",
// then extract "links" by counting primes in a hash-derived range.
function fetchUrl(urlId: number, results: Channel<number>): void {
  // Simulate variable network latency with computation
  const workload: number = (urlId + 1) * 50000;
  let hash = urlId * 7 + 13;
  let i = 0;
  while (i < workload) {
    hash = ((hash * 31) + i) % 1000000007;
    i = i + 1;
  }

  // Simulate link extraction: count primes in a derived range
  let links = 0;
  let j = 0;
  while (j < 1000) {
    let num: number = (hash + j * 17) % 997;
    if (isPrime(num)) {
      links = links + 1;
    }
    j = j + 1;
  }

  // Encode urlId and link count: urlId * 10000 + links
  results.send(urlId * 10000 + links);
}

// Monitor thread: aggregates results as they arrive from fetchers
function monitor(progress: Channel<number>, totalUrls: number, done: Channel<number>): void {
  let received = 0;
  let totalLinks = 0;
  let maxLinks = 0;
  let minLinks = 99999;

  while (received < totalUrls) {
    const result: number = progress.recv();
    const urlId: number = result / 10000;
    const links: number = result % 10000;

    totalLinks = totalLinks + links;
    if (links > maxLinks) {
      maxLinks = links;
    }
    if (links < minLinks) {
      minLinks = links;
    }
    received = received + 1;
  }

  // Send aggregated stats back to main
  done.send(received);
  done.send(totalLinks);
  done.send(minLinks);
  done.send(maxLinks);
}

function main(): void {
  console.log("=== Concurrent Web Scraper Simulation ===");

  const numUrls = 12;
  const results: Channel<number> = channel();
  const done: Channel<number> = channel();

  const startTime: number = System.currentTimeMillis();

  // Start the monitor (aggregator) on its own virtual thread
  spawn(monitor(results, numUrls, done));

  // Fan out: one virtual thread per URL — structured concurrency
  console.log("Spawning 12 concurrent fetchers...");
  let urlId = 0;
  while (urlId < numUrls) {
    spawn(fetchUrl(urlId, results));
    urlId = urlId + 1;
  }

  // Fan in: receive aggregated statistics from the monitor
  const totalFetched: number = done.recv();
  const totalLinks: number = done.recv();
  const minLinks: number = done.recv();
  const maxLinks: number = done.recv();

  const elapsed: number = System.currentTimeMillis() - startTime;

  console.log("=== Scraping Complete ===");
  console.log("URLs fetched:");
  console.log(totalFetched);
  console.log("Total links found:");
  console.log(totalLinks);
  console.log("Min links per page:");
  console.log(minLinks);
  console.log("Max links per page:");
  console.log(maxLinks);
  console.log("Elapsed ms:");
  console.log(elapsed);
}
