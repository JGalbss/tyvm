// Producer-Consumer Pipeline — Multi-stage concurrent processing
//
// Demonstrates a realistic multi-stage pipeline:
//   Producers --> [work channel] --> Workers --> [results channel] --> Aggregator
//
// Multiple producer threads generate work items, a pool of worker threads
// processes them concurrently, and an aggregator thread collects and
// summarizes results. Channels coordinate all communication between stages.
//
// Compile & run:
//   node dist/cli.js compile examples/producer-consumer.ts
//   java -cp out:runtime/tyvm-runtime.jar producer-consumer

import { spawn, Task, Channel, channel } from "tyvm";
import { System } from "java:java.lang.System";

// Producers generate work items and signal completion through a done channel.
// Each producer creates a batch of numbers tagged with its producer ID.
function producer(id: number, work: Channel<number>, count: number, producerDone: Channel<number>): void {
  let i = 0;
  while (i < count) {
    // Encode producer ID and sequence number: value = producerId * 10000 + seq
    const value: number = id * 10000 + i;
    work.send(value);
    i = i + 1;
  }
  // Signal that this producer is finished
  producerDone.send(id);
}

// Workers pull items from the work channel, perform computation, and
// push results downstream. Stop when they receive sentinel value -1.
function worker(id: number, work: Channel<number>, results: Channel<number>): void {
  let item: number = work.recv();
  while (item >= 0) {
    // Extract the original sequence number
    const seq: number = item % 10000;

    // Compute: count factors of (seq + 2) — simulates real work
    let num: number = seq + 2;
    let factors = 0;
    let d = 1;
    while (d <= num) {
      if (num % d === 0) {
        factors = factors + 1;
      }
      d = d + 1;
    }

    results.send(factors);
    item = work.recv();
  }
}

// Aggregator collects all results and computes final statistics
function aggregator(results: Channel<number>, totalExpected: number, done: Channel<number>): void {
  let count = 0;
  let sum = 0;
  let maxVal = 0;
  let minVal = 999999;

  while (count < totalExpected) {
    const val: number = results.recv();
    sum = sum + val;
    if (val > maxVal) {
      maxVal = val;
    }
    if (val < minVal) {
      minVal = val;
    }
    count = count + 1;
  }

  // Send summary statistics through the done channel
  done.send(count);
  done.send(sum);
  done.send(minVal);
  done.send(maxVal);
}

// Coordinator: waits for all producers to finish, then sends stop signals
// to workers so they shut down cleanly.
function coordinator(producerDone: Channel<number>, work: Channel<number>, numProducers: number, numWorkers: number): void {
  // Wait for all producers to signal completion
  let finished = 0;
  while (finished < numProducers) {
    producerDone.recv();
    finished = finished + 1;
  }

  // All producers done — send sentinel values to stop each worker
  let w = 0;
  while (w < numWorkers) {
    work.send(0 - 1);
    w = w + 1;
  }
}

function main(): void {
  console.log("=== Producer-Consumer Pipeline ===");
  console.log("");

  const numProducers = 3;
  const numWorkers = 4;
  const itemsPerProducer = 50;
  const totalItems: number = numProducers * itemsPerProducer;

  const work: Channel<number> = channel();
  const results: Channel<number> = channel();
  const done: Channel<number> = channel();
  const producerDone: Channel<number> = channel();

  const startTime: number = System.currentTimeMillis();

  // Start the aggregator first so it is ready to consume results
  spawn(aggregator(results, totalItems, done));

  // Start worker pool
  console.log("Starting 4 workers...");
  let w = 0;
  while (w < numWorkers) {
    spawn(worker(w, work, results));
    w = w + 1;
  }

  // Start coordinator that will send stop signals after all producers finish
  spawn(coordinator(producerDone, work, numProducers, numWorkers));

  // Start producers
  console.log("Starting 3 producers (50 items each)...");
  let p = 0;
  while (p < numProducers) {
    spawn(producer(p, work, itemsPerProducer, producerDone));
    p = p + 1;
  }

  // Read aggregation results from the done channel
  const totalCount: number = done.recv();
  const totalSum: number = done.recv();
  const minFactors: number = done.recv();
  const maxFactors: number = done.recv();

  const elapsed: number = System.currentTimeMillis() - startTime;

  console.log("");
  console.log("=== Pipeline Complete ===");
  console.log("Items processed:");
  console.log(totalCount);
  console.log("Sum of factor counts:");
  console.log(totalSum);
  console.log("Min factors:");
  console.log(minFactors);
  console.log("Max factors:");
  console.log(maxFactors);
  console.log("Elapsed ms:");
  console.log(elapsed);
}
