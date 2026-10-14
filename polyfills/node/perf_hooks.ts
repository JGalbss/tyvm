// ==========================================================================
// Node.js `perf_hooks` polyfill for tyvm
// ==========================================================================
//
// Implements performance.now(), performance.mark(), performance.measure(),
// and a basic PerformanceObserver. Timing is backed by System.nanoTime()
// for sub-millisecond precision.
//
// Java backing classes:
//   java.lang.System     — System.nanoTime() for high-resolution timing
//   java.util.HashMap    — store marks and measures
//   java.util.ArrayList  — collect entries and observers
//
// Usage:
//   import { performance, PerformanceObserver } from "node:perf_hooks";

import { System } from "java:java.lang.System";
import { HashMap } from "java:java.util.HashMap";
import { ArrayList } from "java:java.util.ArrayList";

// ---------------------------------------------------------------------------
// Internal: baseline nanoTime captured at module load
// ---------------------------------------------------------------------------
// performance.now() returns milliseconds since the process started.
// We record System.nanoTime() at load time and compute deltas.

const _startNanos: number = System.nanoTime();

// ---------------------------------------------------------------------------
// PerformanceEntry — represents a single performance measurement
// ---------------------------------------------------------------------------

export class PerformanceEntry {
  name: string;
  entryType: string;
  startTime: number;
  duration: number;

  constructor(name: string, entryType: string, startTime: number, duration: number) {
    this.name = name;
    this.entryType = entryType;
    this.startTime = startTime;
    this.duration = duration;
  }
}

// ---------------------------------------------------------------------------
// Performance — the main performance timing API
// ---------------------------------------------------------------------------

export class Performance {
  _marks: HashMap;
  _measures: HashMap;
  _entries: ArrayList;
  _observers: ArrayList;

  constructor() {
    this._marks = new HashMap();
    this._measures = new HashMap();
    this._entries = new ArrayList();
    this._observers = new ArrayList();
  }

  // ---- now() -> number ---------------------------------------------------
  // Returns the number of milliseconds elapsed since the process started,
  // with sub-millisecond precision.
  //
  // Backed by: System.nanoTime() delta from module load time

  now(): number {
    const elapsed: number = System.nanoTime() - _startNanos;
    // Convert nanoseconds to milliseconds (floating point)
    return elapsed / 1000000.0;
  }

  // ---- timeOrigin --------------------------------------------------------
  // Returns the process start time in milliseconds since Unix epoch.
  // Approximated as System.currentTimeMillis() minus elapsed time.

  getTimeOrigin(): number {
    const elapsedMs: number = this.now();
    return System.currentTimeMillis() - elapsedMs;
  }

  // ---- mark(name) --------------------------------------------------------
  // Record a named timestamp (a "mark") at the current time.
  // Returns a PerformanceEntry of type "mark".
  //
  // Backed by: HashMap storing mark name -> startTime

  mark(name: string): PerformanceEntry {
    const startTime: number = this.now();
    const entry: PerformanceEntry = new PerformanceEntry(name, "mark", startTime, 0);
    this._marks.put(name, startTime);
    this._entries.add(entry);
    this._notifyObservers(entry);
    return entry;
  }

  // ---- measure(name, startMark, endMark?) ---------------------------------
  // Measure the duration between two marks. If endMark is null, the
  // current time is used as the end point.
  // Returns a PerformanceEntry of type "measure".
  //
  // Backed by: HashMap lookups for mark timestamps

  measure(name: string, startMark: string, endMark: string): PerformanceEntry {
    const startTime: any = this._marks.get(startMark);
    if (startTime === null) {
      // If the start mark doesn't exist, use 0 (process start)
      const entry: PerformanceEntry = new PerformanceEntry(name, "measure", 0, this.now());
      this._entries.add(entry);
      this._notifyObservers(entry);
      return entry;
    }

    let endTime: number = this.now();
    if (endMark !== null) {
      const endVal: any = this._marks.get(endMark);
      if (endVal !== null) {
        endTime = endVal;
      }
    }

    const duration: number = endTime - startTime;
    const entry: PerformanceEntry = new PerformanceEntry(name, "measure", startTime, duration);
    this._measures.put(name, entry);
    this._entries.add(entry);
    this._notifyObservers(entry);
    return entry;
  }

  // ---- clearMarks(name?) -------------------------------------------------
  // Clear all marks, or a specific mark by name.

  clearMarks(name: string): void {
    if (name === null) {
      this._marks = new HashMap();
    } else {
      this._marks.remove(name);
    }
  }

  // ---- clearMeasures(name?) ----------------------------------------------
  // Clear all measures, or a specific measure by name.

  clearMeasures(name: string): void {
    if (name === null) {
      this._measures = new HashMap();
    } else {
      this._measures.remove(name);
    }
  }

  // ---- getEntries() -> ArrayList<PerformanceEntry> ------------------------
  // Return all recorded performance entries.

  getEntries(): ArrayList {
    return this._entries;
  }

  // ---- getEntriesByName(name) -> ArrayList<PerformanceEntry> --------------
  // Return entries matching the given name.

  getEntriesByName(name: string): ArrayList {
    const result: ArrayList = new ArrayList();
    let i = 0;
    while (i < this._entries.size()) {
      const entry: PerformanceEntry = this._entries.get(i);
      if (entry.name === name) {
        result.add(entry);
      }
      i = i + 1;
    }
    return result;
  }

  // ---- getEntriesByType(type) -> ArrayList<PerformanceEntry> --------------
  // Return entries matching the given type ("mark" or "measure").

  getEntriesByType(entryType: string): ArrayList {
    const result: ArrayList = new ArrayList();
    let i = 0;
    while (i < this._entries.size()) {
      const entry: PerformanceEntry = this._entries.get(i);
      if (entry.entryType === entryType) {
        result.add(entry);
      }
      i = i + 1;
    }
    return result;
  }

  // ---- observer management -----------------------------------------------

  _addObserver(observer: any): void {
    this._observers.add(observer);
  }

  _removeObserver(observer: any): void {
    let i = 0;
    while (i < this._observers.size()) {
      if (this._observers.get(i) === observer) {
        this._observers.remove(i);
        return;
      }
      i = i + 1;
    }
  }

  _notifyObservers(entry: PerformanceEntry): void {
    let i = 0;
    while (i < this._observers.size()) {
      const obs: any = this._observers.get(i);
      obs._onEntry(entry);
      i = i + 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton performance instance
// ---------------------------------------------------------------------------

export const performance: Performance = new Performance();

// ---------------------------------------------------------------------------
// PerformanceObserver — observe performance entries
// ---------------------------------------------------------------------------
// A simplified observer that collects entries matching observed types
// and calls a callback when new entries arrive.

export class PerformanceObserver {
  _callback: any;
  _entryTypes: ArrayList;
  _buffer: ArrayList;

  constructor(callback: any) {
    this._callback = callback;
    this._entryTypes = new ArrayList();
    this._buffer = new ArrayList();
  }

  // Start observing the given entry types.
  // entryTypes is a comma-separated string, e.g. "mark,measure".
  observe(entryTypes: string): void {
    // Parse comma-separated types
    let start = 0;
    let idx: number = entryTypes.indexOf(",");
    while (idx !== -1) {
      const part: string = entryTypes.substring(start, idx).trim();
      if (part.length > 0) {
        this._entryTypes.add(part);
      }
      start = idx + 1;
      idx = entryTypes.indexOf(",", start);
    }
    // Last (or only) segment
    const last: string = entryTypes.substring(start).trim();
    if (last.length > 0) {
      this._entryTypes.add(last);
    }

    performance._addObserver(this);
  }

  // Stop observing.
  disconnect(): void {
    performance._removeObserver(this);
  }

  // Internal: called by Performance when a new entry is recorded.
  _onEntry(entry: PerformanceEntry): void {
    // Check if this entry's type is in our observed types
    let i = 0;
    while (i < this._entryTypes.size()) {
      if (this._entryTypes.get(i) === entry.entryType) {
        this._buffer.add(entry);
        // Call the user's callback with the buffered entries
        this._callback(this._buffer);
        return;
      }
      i = i + 1;
    }
  }

  // Get and clear the buffered entries.
  takeRecords(): ArrayList {
    const records: ArrayList = new ArrayList();
    let i = 0;
    while (i < this._buffer.size()) {
      records.add(this._buffer.get(i));
      i = i + 1;
    }
    this._buffer = new ArrayList();
    return records;
  }
}
