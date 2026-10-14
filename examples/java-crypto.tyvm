// Java Crypto — Hash computation with Java library interop
//
// Demonstrates cryptographic-style hash computations using Java standard
// library interop (Math, System) alongside tyvm's virtual threads and
// channels. Computes polynomial rolling hashes (inspired by Java's
// String.hashCode algorithm) and formats them as hex digits.
//
// Hashes are computed in parallel across 8 virtual threads, showing how
// tyvm seamlessly combines Java interop with its concurrency primitives.
//
// Compile & run:
//   node dist/cli.js compile examples/java-crypto.ts
//   java -cp out:runtime/tyvm-runtime.jar java-crypto

import { spawn, Task, Channel, channel } from "tyvm";
import { System } from "java:java.lang.System";
import { Math } from "java:java.lang.Math";

// Polynomial rolling hash inspired by java.lang.String.hashCode().
// Uses Java's Math.abs for consistent unsigned-style output.
function computeHash(seed: number, rounds: number): number {
  let hash: number = seed;
  let i = 0;
  while (i < rounds) {
    hash = ((hash * 31) + i + seed) % 1000000007;
    i = i + 1;
  }
  return Math.abs(hash);
}

// Extract hex nibbles from a hash value. Prints each nibble as 0-9 or a-f.
// This demonstrates the kind of bit-manipulation you would do with
// MessageDigest output, but using pure arithmetic.
function countHexDigits(value: number): number {
  let remaining: number = Math.floor(Math.abs(value));
  let digits = 0;
  if (remaining === 0) {
    return 1;
  }
  while (remaining > 0) {
    remaining = Math.floor(remaining / 16);
    digits = digits + 1;
  }
  return digits;
}

// Hash a message on a virtual thread and send the hash pair to results
function hashWorker(results: Channel<number>, messageId: number): void {
  // Compute two hashes with different seeds (simulating different hash algos)
  const hash1: number = computeHash(messageId * 7 + 1, 100);
  const hash2: number = computeHash(messageId * 13 + 3, 200);
  const combined: number = hash1 + hash2;

  // Log the individual hashes
  console.log(hash1);
  console.log(hash2);

  // Send combined hash through channel
  results.send(combined);
}

function main(): void {
  console.log("=== Java Crypto: Hash Computation Demo ===");

  // Part 1: Sequential hashing with Java Math interop
  console.log("--- Sequential hashes ---");

  let seed = 0;
  while (seed < 5) {
    const hash: number = computeHash(seed, 100);
    const hexDigits: number = countHexDigits(hash);
    console.log("seed:");
    console.log(seed);
    console.log("hash:");
    console.log(hash);
    console.log("hex digits:");
    console.log(hexDigits);
    seed = seed + 1;
  }

  // Part 2: Parallel hashing across virtual threads
  console.log("--- Parallel hashing (8 threads) ---");

  const results: Channel<number> = channel();
  const numMessages = 8;
  const startTime: number = System.currentTimeMillis();

  let m = 0;
  while (m < numMessages) {
    spawn(hashWorker(results, m));
    m = m + 1;
  }

  // Collect and sum all hash results
  let totalHash = 0;
  let collected = 0;
  while (collected < numMessages) {
    const val: number = results.recv();
    totalHash = totalHash + val;
    collected = collected + 1;
  }

  const elapsed: number = System.currentTimeMillis() - startTime;

  console.log("--- Results ---");
  console.log("Combined hash total:");
  console.log(totalHash);
  console.log("Parallel elapsed ms:");
  console.log(elapsed);

  // Demonstrate Java System interop
  const javaVersion: string = System.getProperty("java.version");
  console.log("Java version:");
  console.log(javaVersion);
}
