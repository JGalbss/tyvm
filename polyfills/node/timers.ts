// ==========================================================================
// Node.js `timers` polyfill for tyvm
// ==========================================================================
//
// Implements setTimeout, setInterval, clearTimeout, and clearInterval
// backed by Java's ScheduledExecutorService. Since tyvm compiles to JVM
// bytecode, these timers run on real JVM threads rather than an event loop.
//
// Java backing classes:
//   java.util.concurrent.Executors                — thread pool factory
//   java.util.concurrent.ScheduledExecutorService — schedule tasks
//   java.util.concurrent.ScheduledFuture          — cancel scheduled tasks
//   java.util.concurrent.TimeUnit                 — time unit conversions
//   java.util.HashMap                             — map timer IDs to futures
//
// Usage:
//   import { setTimeout, setInterval, clearTimeout, clearInterval } from "node:timers";

import { Executors } from "java:java.util.concurrent.Executors";
import { TimeUnit } from "java:java.util.concurrent.TimeUnit";
import { HashMap } from "java:java.util.HashMap";

// ---------------------------------------------------------------------------
// Shared scheduler
// ---------------------------------------------------------------------------
// A single daemon ScheduledExecutorService backs all timers. Using a pool
// of 2 threads allows overlapping timers to run without blocking each other.

const _scheduler: any = Executors.newScheduledThreadPool(2);

// Map from timer ID (number) to ScheduledFuture so we can cancel.
const _timers: HashMap = new HashMap();

// Monotonically increasing timer ID counter.
let _nextId: number = 1;

// ---------------------------------------------------------------------------
// TimerTask — wraps a callback as a Java Runnable
// ---------------------------------------------------------------------------
// Since tyvm maps TypeScript functions to JVM functional interfaces,
// we wrap the user callback in a class that implements run().

class TimerTask {
  _fn: any;

  constructor(fn: any) {
    this._fn = fn;
  }

  run(): void {
    this._fn();
  }
}

// ---------------------------------------------------------------------------
// IntervalTask — repeating wrapper that reschedules itself
// ---------------------------------------------------------------------------

class IntervalTask {
  _fn: any;
  _delayMs: number;
  _id: number;

  constructor(fn: any, delayMs: number, id: number) {
    this._fn = fn;
    this._delayMs = delayMs;
    this._id = id;
  }

  run(): void {
    // Check if this interval has been cleared
    if (!_timers.containsKey(this._id)) {
      return;
    }
    this._fn();
  }
}

// ---------------------------------------------------------------------------
// setTimeout(callback, delayMs) -> number
// ---------------------------------------------------------------------------
// Schedule a one-time callback after `delayMs` milliseconds.
// Returns a numeric timer ID that can be passed to clearTimeout().
//
// Backed by: ScheduledExecutorService.schedule()

export function setTimeout(callback: any, delayMs: number): number {
  const id: number = _nextId;
  _nextId = _nextId + 1;

  const task: TimerTask = new TimerTask(callback);
  const future: any = _scheduler.schedule(task, delayMs, TimeUnit.MILLISECONDS);
  _timers.put(id, future);

  return id;
}

// ---------------------------------------------------------------------------
// clearTimeout(timerId)
// ---------------------------------------------------------------------------
// Cancel a pending setTimeout. If the callback has already fired, this
// is a no-op.
//
// Backed by: ScheduledFuture.cancel()

export function clearTimeout(timerId: number): void {
  const future: any = _timers.get(timerId);
  if (future !== null) {
    future.cancel(false);
    _timers.remove(timerId);
  }
}

// ---------------------------------------------------------------------------
// setInterval(callback, delayMs) -> number
// ---------------------------------------------------------------------------
// Schedule a repeating callback every `delayMs` milliseconds.
// Returns a numeric timer ID that can be passed to clearInterval().
//
// Backed by: ScheduledExecutorService.scheduleAtFixedRate()

export function setInterval(callback: any, delayMs: number): number {
  const id: number = _nextId;
  _nextId = _nextId + 1;

  const task: IntervalTask = new IntervalTask(callback, delayMs, id);
  const future: any = _scheduler.scheduleAtFixedRate(
    task, delayMs, delayMs, TimeUnit.MILLISECONDS
  );
  _timers.put(id, future);

  return id;
}

// ---------------------------------------------------------------------------
// clearInterval(timerId)
// ---------------------------------------------------------------------------
// Cancel a repeating setInterval. If the interval has already been
// cleared, this is a no-op.
//
// Backed by: ScheduledFuture.cancel()

export function clearInterval(timerId: number): void {
  const future: any = _timers.get(timerId);
  if (future !== null) {
    future.cancel(false);
    _timers.remove(timerId);
  }
}

// ---------------------------------------------------------------------------
// setImmediate(callback) -> number
// ---------------------------------------------------------------------------
// Schedule a callback to run as soon as possible (0ms delay).
// This matches Node.js setImmediate semantics on the JVM.
//
// Backed by: ScheduledExecutorService.schedule() with 0 delay

export function setImmediate(callback: any): number {
  return setTimeout(callback, 0);
}

// ---------------------------------------------------------------------------
// clearImmediate(timerId)
// ---------------------------------------------------------------------------
// Cancel a pending setImmediate.

export function clearImmediate(timerId: number): void {
  clearTimeout(timerId);
}
