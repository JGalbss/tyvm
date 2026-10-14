// Structured concurrency with channels: parallel computation with
// coordinated shutdown.
//
// Demonstrates spawning multiple producers that feed a single consumer
// through a shared channel, with deterministic result collection.

import { Task, spawn, Channel, channel } from "tyvm";

function fibonacci(n: number): number {
  if (n <= 1) {
    return n;
  }
  let a = 0;
  let b = 1;
  let i = 2;
  while (i <= n) {
    const temp = a + b;
    a = b;
    b = temp;
    i = i + 1;
  }
  return b;
}

function computeAndSend(ch: Channel<number>, n: number): void {
  const result: number = fibonacci(n);
  ch.send(result);
}

function main(): void {
  const results: Channel<number> = channel();

  // Spawn 8 parallel Fibonacci computations
  const count = 8;
  spawn(computeAndSend(results, 10));
  spawn(computeAndSend(results, 20));
  spawn(computeAndSend(results, 30));
  spawn(computeAndSend(results, 35));
  spawn(computeAndSend(results, 10));
  spawn(computeAndSend(results, 20));
  spawn(computeAndSend(results, 30));
  spawn(computeAndSend(results, 35));

  // Collect all results
  let total = 0;
  let i = 0;
  while (i < count) {
    const val: number = results.recv();
    console.log(val);
    total = total + val;
    i = i + 1;
  }

  console.log(total);
}
