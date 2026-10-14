// ==========================================================================
// Node.js `cluster` polyfill for tyvm
// ==========================================================================
//
// Implements cluster.fork(), isMaster/isPrimary, isWorker, and basic
// worker management. Node.js cluster forks OS processes, but since tyvm
// runs on the JVM, we use virtual threads (Java 21+) to simulate
// multiple workers within a single JVM process.
//
// Java backing classes:
//   java.lang.Thread               — virtual thread creation
//   java.util.concurrent.ConcurrentHashMap — thread-safe worker registry
//   java.util.concurrent.atomic.AtomicInteger — worker ID generation
//   java.util.concurrent.LinkedBlockingQueue  — inter-worker messaging
//   java.lang.Runtime              — available processor count
//
// Usage:
//   import { fork, isMaster, isWorker, workers } from "node:cluster";

import { Thread } from "java:java.lang.Thread";
import { ConcurrentHashMap } from "java:java.util.concurrent.ConcurrentHashMap";
import { AtomicInteger } from "java:java.util.concurrent.atomic.AtomicInteger";
import { LinkedBlockingQueue } from "java:java.util.concurrent.LinkedBlockingQueue";
import { Runtime } from "java:java.lang.Runtime";
import { ArrayList } from "java:java.util.ArrayList";
import { HashMap } from "java:java.util.HashMap";

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

// Thread-safe worker ID counter (starts at 1 like Node.js)
const _workerIdCounter: AtomicInteger = new AtomicInteger(0);

// Registry of all active workers: id -> ClusterWorker
const _workers: ConcurrentHashMap = new ConcurrentHashMap();

// The main thread's ID, used to detect isMaster
const _mainThreadId: number = Thread.currentThread().threadId();

// Track whether we are in the master process (main thread)
let _isMasterFlag: boolean = true;

// ---------------------------------------------------------------------------
// isMaster / isPrimary / isWorker
// ---------------------------------------------------------------------------
// In Node.js cluster, the first process is the "master" (or "primary")
// and forked processes are "workers". Here, the main thread is the
// master and virtual threads are workers.

export function getIsMaster(): boolean {
  return Thread.currentThread().threadId() === _mainThreadId;
}

export function getIsPrimary(): boolean {
  return getIsMaster();
}

export function getIsWorker(): boolean {
  return !getIsMaster();
}

// Static flags for use in the main thread at module load time
export const isMaster: boolean = true;
export const isPrimary: boolean = true;
export const isWorker: boolean = false;

// ---------------------------------------------------------------------------
// ClusterWorker — represents a worker "process" (virtual thread)
// ---------------------------------------------------------------------------

export class ClusterWorker {
  id: number;
  _thread: Thread;
  _messageQueue: LinkedBlockingQueue;
  _alive: boolean;

  constructor(id: number, thread: Thread) {
    this.id = id;
    this._thread = thread;
    this._messageQueue = new LinkedBlockingQueue();
    this._alive = true;
  }

  // Send a message to this worker.
  // The worker can receive it via its message queue.
  send(message: any): void {
    this._messageQueue.put(message);
  }

  // Receive a message sent to this worker (blocking).
  receive(): any {
    return this._messageQueue.take();
  }

  // Check if the worker has pending messages.
  hasMessages(): boolean {
    return !this._messageQueue.isEmpty();
  }

  // Terminate the worker thread.
  kill(): void {
    this._alive = false;
    this._thread.interrupt();
    _workers.remove(this.id);
  }

  // Alias for kill().
  disconnect(): void {
    this.kill();
  }

  // Check if the worker is still running.
  isAlive(): boolean {
    return this._thread.isAlive();
  }

  // Check if the worker has been disconnected/killed.
  isDead(): boolean {
    return !this._alive;
  }

  // Wait for the worker to finish.
  join(): void {
    this._thread.join();
  }
}

// ---------------------------------------------------------------------------
// fork(workerFn) -> ClusterWorker
// ---------------------------------------------------------------------------
// Create a new worker. In Node.js, fork() re-runs the same script with
// cluster.isWorker set to true. In tyvm, we accept a function to run
// in a virtual thread since the compilation model is different.
//
// Backed by: Virtual threads (Thread.ofVirtual())

export function fork(workerFn: any): ClusterWorker {
  const id: number = _workerIdCounter.incrementAndGet();

  // Create a virtual thread to run the worker function
  const thread: Thread = Thread.ofVirtual()
    .name("cluster-worker-" + id)
    .start(workerFn);

  const worker: ClusterWorker = new ClusterWorker(id, thread);
  _workers.put(id, worker);

  return worker;
}

// ---------------------------------------------------------------------------
// getWorker(id) -> ClusterWorker
// ---------------------------------------------------------------------------
// Retrieve a worker by its ID.

export function getWorker(id: number): ClusterWorker {
  return _workers.get(id);
}

// ---------------------------------------------------------------------------
// getWorkerCount() -> number
// ---------------------------------------------------------------------------
// Return the number of active workers.

export function getWorkerCount(): number {
  return _workers.size();
}

// ---------------------------------------------------------------------------
// disconnect() -> void
// ---------------------------------------------------------------------------
// Disconnect all workers. Each worker's thread is interrupted.

export function disconnect(): void {
  // Iterate known IDs and kill each worker
  const keys: any = _workers.keySet().toArray();
  let i = 0;
  while (i < keys.length) {
    const worker: ClusterWorker = _workers.get(keys[i]);
    if (worker !== null) {
      worker.kill();
    }
    i = i + 1;
  }
}

// ---------------------------------------------------------------------------
// getCPUCount() -> number
// ---------------------------------------------------------------------------
// Return the number of available CPU cores. Useful for determining how
// many workers to fork (a common pattern in Node.js cluster usage).
//
// Backed by: Runtime.getRuntime().availableProcessors()

export function getCPUCount(): number {
  return Runtime.getRuntime().availableProcessors();
}

// ---------------------------------------------------------------------------
// setupMaster(settings) / setupPrimary(settings)
// ---------------------------------------------------------------------------
// In Node.js, these configure cluster settings before forking. Since
// tyvm workers are function-based rather than file-based, these are
// no-ops provided for API compatibility.

export function setupMaster(settings: any): void {
  // No-op: tyvm cluster workers are function-based
}

export function setupPrimary(settings: any): void {
  // No-op: alias for setupMaster
}
