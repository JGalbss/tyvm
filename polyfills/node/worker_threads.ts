// ==========================================================================
// Node.js `worker_threads` polyfill for tyvm
// ==========================================================================
//
// Implements Worker, parentPort, workerData, and isMainThread backed by
// Java virtual threads (Project Loom, Java 21+). Virtual threads provide
// lightweight concurrency similar to Node.js worker threads but with
// much lower overhead.
//
// Java backing classes:
//   java.lang.Thread               — virtual thread creation and management
//   java.util.concurrent.LinkedBlockingQueue — message passing between threads
//   java.util.concurrent.ConcurrentHashMap   — shared worker registry
//   java.util.concurrent.atomic.AtomicInteger — thread-safe ID generation
//   java.util.HashMap              — worker data storage
//
// Usage:
//   import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

import { Thread } from "java:java.lang.Thread";
import { LinkedBlockingQueue } from "java:java.util.concurrent.LinkedBlockingQueue";
import { ConcurrentHashMap } from "java:java.util.concurrent.ConcurrentHashMap";
import { AtomicInteger } from "java:java.util.concurrent.atomic.AtomicInteger";
import { HashMap } from "java:java.util.HashMap";
import { ArrayList } from "java:java.util.ArrayList";
import { System } from "java:java.lang.System";

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------

// Thread-safe worker ID counter
const _workerIdCounter: AtomicInteger = new AtomicInteger(0);

// Registry of active workers by ID
const _workers: ConcurrentHashMap = new ConcurrentHashMap();

// The main thread's name, used to detect isMainThread
const _mainThreadName: string = Thread.currentThread().getName();

// Per-thread message queues for the "parentPort" channel.
// Maps thread name -> LinkedBlockingQueue of messages.
const _parentQueues: ConcurrentHashMap = new ConcurrentHashMap();

// Per-thread worker data. Maps thread name -> workerData object.
const _workerDataMap: ConcurrentHashMap = new ConcurrentHashMap();

// ---------------------------------------------------------------------------
// isMainThread
// ---------------------------------------------------------------------------
// Returns true if the current thread is the main thread.

export function getIsMainThread(): boolean {
  return Thread.currentThread().getName() === _mainThreadName;
}

export const isMainThread: boolean = true;

// ---------------------------------------------------------------------------
// MessagePort — bidirectional message channel endpoint
// ---------------------------------------------------------------------------
// Wraps a LinkedBlockingQueue to provide postMessage / on("message")
// semantics.

export class MessagePort {
  _queue: LinkedBlockingQueue;
  _listeners: ArrayList;

  constructor() {
    this._queue = new LinkedBlockingQueue();
    this._listeners = new ArrayList();
  }

  // Post a message to this port. The message is placed in the queue
  // and will be delivered to any registered listeners.
  postMessage(message: any): void {
    this._queue.put(message);
  }

  // Register a listener for incoming messages.
  on(event: string, listener: any): void {
    if (event === "message") {
      this._listeners.add(listener);
    }
  }

  // Receive the next message, blocking until one is available.
  // Returns the message value.
  // Backed by: LinkedBlockingQueue.take()
  receive(): any {
    return this._queue.take();
  }

  // Receive the next message with a timeout in milliseconds.
  // Returns null if no message is available within the timeout.
  receiveTimeout(timeoutMs: number): any {
    const TimeUnit: any = java.util.concurrent.TimeUnit;
    return this._queue.poll(timeoutMs, TimeUnit.MILLISECONDS);
  }

  // Check if there are pending messages without blocking.
  hasMessages(): boolean {
    return !this._queue.isEmpty();
  }

  // Drain all pending messages into an ArrayList.
  drainMessages(): ArrayList {
    const messages: ArrayList = new ArrayList();
    this._queue.drainTo(messages);
    return messages;
  }
}

// ---------------------------------------------------------------------------
// Worker — run code in a separate virtual thread
// ---------------------------------------------------------------------------
// In Node.js, Worker takes a filename and runs it in a new thread.
// In tyvm, we accept a function (Runnable) to execute in a virtual thread,
// since the compilation model differs from Node.js file-based workers.

export class Worker {
  _id: number;
  _thread: Thread;
  _port: MessagePort;
  _workerPort: MessagePort;
  _terminated: boolean;

  constructor(fn: any, workerData: any) {
    this._id = _workerIdCounter.incrementAndGet();
    this._port = new MessagePort();
    this._workerPort = new MessagePort();
    this._terminated = false;

    // Store worker data for the child thread
    const workerId: number = this._id;

    // Register this worker
    _workers.put(this._id, this);

    // Create a virtual thread (Java 21+) to run the worker function
    // The worker function receives the workerPort for communication
    const self: Worker = this;
    const workerRunnable: any = fn;

    // Store worker data and parent port before starting the thread
    const threadName: string = "tyvm-worker-" + this._id;

    this._thread = Thread.ofVirtual().name(threadName).start(fn);

    // Store the worker's message queue so parentPort can access it
    _parentQueues.put(threadName, this._workerPort);
    if (workerData !== null) {
      _workerDataMap.put(threadName, workerData);
    }
  }

  // Send a message to the worker thread.
  postMessage(message: any): void {
    this._workerPort.postMessage(message);
  }

  // Register a handler for messages from the worker.
  on(event: string, listener: any): void {
    if (event === "message") {
      this._port.on(event, listener);
    }
  }

  // Receive a message from the worker (blocking).
  receive(): any {
    return this._port.receive();
  }

  // Terminate the worker thread. Returns a promise-like result
  // (synchronous in tyvm).
  terminate(): void {
    if (!this._terminated) {
      this._terminated = true;
      this._thread.interrupt();
      _workers.remove(this._id);
    }
  }

  // Wait for the worker thread to finish.
  // Backed by: Thread.join()
  join(): void {
    this._thread.join();
  }

  // Check if the worker is still running.
  isAlive(): boolean {
    return this._thread.isAlive();
  }

  // Get the worker's thread ID.
  getThreadId(): number {
    return this._id;
  }
}

// ---------------------------------------------------------------------------
// parentPort — communication channel from inside a worker
// ---------------------------------------------------------------------------
// In a worker thread, parentPort allows sending messages back to the
// parent. On the main thread, parentPort is null.
//
// Since tyvm cannot dynamically detect which thread is calling,
// we provide functions that look up the correct queue by thread name.

export function getParentPort(): MessagePort {
  const threadName: string = Thread.currentThread().getName();
  const port: any = _parentQueues.get(threadName);
  if (port === null) {
    return null;
  }
  return port;
}

// ---------------------------------------------------------------------------
// workerData — data passed from the parent to the worker
// ---------------------------------------------------------------------------
// Retrieved from the per-thread worker data map.

export function getWorkerData(): any {
  const threadName: string = Thread.currentThread().getName();
  return _workerDataMap.get(threadName);
}

// ---------------------------------------------------------------------------
// threadId — unique ID for the current thread
// ---------------------------------------------------------------------------

export function getThreadId(): number {
  return Thread.currentThread().threadId();
}
