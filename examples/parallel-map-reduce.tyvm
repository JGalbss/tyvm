// Parallel MapReduce — Distributed computation with virtual threads
//
// Implements a MapReduce-style computation that:
//   1. Splits a range of numbers across virtual threads (map phase)
//   2. Each thread computes partial results independently
//   3. Results are collected through channels and reduced (reduce phase)
//
// This demonstrates how tyvm's virtual threads + channels naturally
// express parallel computation patterns without explicit thread pools.
//
// Compile & run:
//   node dist/cli.js compile examples/parallel-map-reduce.ts
//   java -cp out:runtime/tyvm-runtime.jar parallel-map-reduce

import { spawn, Task, Channel, channel } from "tyvm";
import { System } from "java:java.lang.System";
import { Math } from "java:java.lang.Math";

// Map phase: compute the sum of squares for a range [start, end).
// Each mapper runs on its own virtual thread.
function mapSumOfSquares(results: Channel<number>, start: number, end: number): void {
  let sum = 0;
  let i: number = start;
  while (i < end) {
    sum = sum + i * i;
    i = i + 1;
  }
  results.send(sum);
}

// Map phase: count "primes" (numbers with exactly 2 factors) in [start, end).
function mapCountPrimes(results: Channel<number>, start: number, end: number): void {
  let count = 0;
  let n: number = start;
  while (n < end) {
    if (isPrime(n)) {
      count = count + 1;
    }
    n = n + 1;
  }
  results.send(count);
}

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

// Map phase: compute a hash-based checksum over a range
function mapChecksum(results: Channel<number>, start: number, end: number): void {
  let hash = 17;
  let i: number = start;
  while (i < end) {
    hash = ((hash * 31) + i) % 1000000007;
    i = i + 1;
  }
  results.send(hash);
}

// Reduce phase: sum N values from a channel
function reduce(source: Channel<number>, count: number): number {
  let total = 0;
  let i = 0;
  while (i < count) {
    total = total + source.recv();
    i = i + 1;
  }
  return total;
}

function main(): void {
  console.log("=== Parallel MapReduce ===");
  console.log("");

  const startTime: number = System.currentTimeMillis();

  // ---------------------------------------------------------------
  // Job 1: Sum of squares from 0 to 100,000, split across 8 threads
  // ---------------------------------------------------------------
  console.log("Job 1: Sum of squares [0, 100000) across 8 threads");

  const sqResults: Channel<number> = channel();
  const numMappers = 8;
  const rangeSize = 100000;
  const chunkSize: number = rangeSize / numMappers;

  let m = 0;
  while (m < numMappers) {
    const lo: number = m * chunkSize;
    const hi: number = lo + chunkSize;
    spawn(mapSumOfSquares(sqResults, lo, hi));
    m = m + 1;
  }

  // Reduce: sum all partial results
  const sumOfSquares: number = reduce(sqResults, numMappers);
  console.log("  Sum of squares:");
  console.log(sumOfSquares);

  // ---------------------------------------------------------------
  // Job 2: Count primes in [2, 50000), split across 10 threads
  // ---------------------------------------------------------------
  console.log("");
  console.log("Job 2: Count primes in [2, 50000) across 10 threads");

  const primeResults: Channel<number> = channel();
  const primeMappers = 10;
  const primeRange = 50000;
  const primeChunk: number = primeRange / primeMappers;

  let p = 0;
  while (p < primeMappers) {
    const lo: number = p * primeChunk;
    const hi: number = lo + primeChunk;
    // Ensure start >= 2 for the first chunk
    const actualLo: number = Math.max(lo, 2);
    spawn(mapCountPrimes(primeResults, actualLo, hi));
    p = p + 1;
  }

  const primeCount: number = reduce(primeResults, primeMappers);
  console.log("  Primes found:");
  console.log(primeCount);

  // ---------------------------------------------------------------
  // Job 3: Parallel checksums across 6 threads, XOR-reduce
  // ---------------------------------------------------------------
  console.log("");
  console.log("Job 3: Parallel hash checksums across 6 threads");

  const hashResults: Channel<number> = channel();
  const hashMappers = 6;
  const hashRange = 600000;
  const hashChunk: number = hashRange / hashMappers;

  let h = 0;
  while (h < hashMappers) {
    const lo: number = h * hashChunk;
    const hi: number = lo + hashChunk;
    spawn(mapChecksum(hashResults, lo, hi));
    h = h + 1;
  }

  // Collect checksums and combine them
  let combinedHash = 0;
  let hi = 0;
  while (hi < hashMappers) {
    const partial: number = hashResults.recv();
    combinedHash = combinedHash + partial;
    hi = hi + 1;
  }
  console.log("  Combined checksum:");
  console.log(combinedHash);

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  const elapsed: number = System.currentTimeMillis() - startTime;
  console.log("");
  console.log("=== All jobs complete ===");
  console.log("Total threads spawned: 24");
  console.log("Elapsed ms:");
  console.log(elapsed);
}
