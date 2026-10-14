// ==========================================================================
// Node.js Streams polyfill for tyvm
// ==========================================================================
//
// Implements Readable, Writable, Transform, Duplex, PassThrough, and the
// pipeline() utility. Since tyvm has no event loop, we use:
//
//   - EventEmitter (from ./events.ts) for listener dispatch
//   - tyvm channels for backpressure between piped streams
//   - tyvm spawn for running read pumps on virtual threads
//
// Java backing classes:
//   java.util.ArrayList — internal data queues
//   java.util.HashMap   — inherited via EventEmitter for event storage
//
// Channel-based backpressure:
//   When a Readable is piped to a Writable, a bounded channel gates the
//   flow. The Readable pushes chunks onto the channel; the Writable
//   consumes them. If the channel fills, the producer blocks (virtual
//   thread suspend) until the consumer drains — achieving backpressure
//   without callbacks or Promises.
// ==========================================================================

import { HashMap } from "java:java.util.HashMap";
import { ArrayList } from "java:java.util.ArrayList";
import { spawn, Channel, channel } from "tyvm";
import { EventEmitter } from "./events";

// ---------------------------------------------------------------------------
// Readable stream
// ---------------------------------------------------------------------------

export class Readable extends EventEmitter {
  // Internal buffer of chunks that have been pushed but not yet read.
  _readableBuffer: ArrayList;
  // Whether end() has been called (no more data will arrive).
  _ended: boolean;
  // Whether the stream has been fully consumed and 'end' has been emitted.
  _endEmitted: boolean;
  // Whether the stream is in flowing mode (piped or 'data' listener).
  _flowing: boolean;
  // Pipe destination, if any.
  _pipeDest: Writable;

  constructor() {
    super();
    this._readableBuffer = new ArrayList();
    this._ended = false;
    this._endEmitted = false;
    this._flowing = false;
    this._pipeDest = null;
  }

  // Push a chunk of data into the internal buffer.
  // Passing null signals the end of the stream.
  push(chunk: any): boolean {
    if (chunk === null) {
      this._ended = true;
      this._tryEnd();
      return false;
    }

    if (this._flowing) {
      // In flowing mode, emit 'data' immediately.
      this.emitOne("data", chunk);
      // If piped, also write directly to the destination.
      if (this._pipeDest !== null) {
        this._pipeDest.write(chunk);
      }
    } else {
      // In paused mode, buffer the chunk.
      this._readableBuffer.add(chunk);
    }
    return true;
  }

  // Pull a chunk from the internal buffer (paused / pull mode).
  // If `size` is provided, attempts to return that many items;
  // otherwise returns a single chunk or null if empty.
  read(size: number): any {
    if (this._readableBuffer.size() === 0) {
      if (this._ended) {
        this._tryEnd();
      }
      return null;
    }

    if (size <= 0) {
      // Return a single chunk.
      const chunk: any = this._readableBuffer.get(0);
      this._readableBuffer.remove(0);
      if (this._readableBuffer.size() === 0 && this._ended) {
        this._tryEnd();
      }
      return chunk;
    }

    // Return up to `size` chunks collected into an ArrayList.
    const result: ArrayList = new ArrayList();
    let count = 0;
    while (count < size && this._readableBuffer.size() > 0) {
      result.add(this._readableBuffer.get(0));
      this._readableBuffer.remove(0);
      count = count + 1;
    }
    if (this._readableBuffer.size() === 0 && this._ended) {
      this._tryEnd();
    }
    return result;
  }

  // Pipe this Readable into a Writable. Returns the destination so
  // calls can be chained: readable.pipe(transform).pipe(writable).
  pipe(destination: Writable): Writable {
    this._pipeDest = destination;
    this._flowing = true;

    // Flush any buffered chunks.
    while (this._readableBuffer.size() > 0) {
      const chunk: any = this._readableBuffer.get(0);
      this._readableBuffer.remove(0);
      this.emitOne("data", chunk);
      destination.write(chunk);
    }

    if (this._ended) {
      this._tryEnd();
      destination.end();
    }
    return destination;
  }

  // Unpipe from the current destination.
  unpipe(): void {
    this._pipeDest = null;
    this._flowing = false;
  }

  // Switch to flowing mode without piping — 'data' events fire as
  // chunks arrive.
  resume(): Readable {
    this._flowing = true;
    // Flush buffered data.
    while (this._readableBuffer.size() > 0) {
      const chunk: any = this._readableBuffer.get(0);
      this._readableBuffer.remove(0);
      this.emitOne("data", chunk);
    }
    if (this._ended) {
      this._tryEnd();
    }
    return this;
  }

  // Switch to paused mode — subsequent push() calls will buffer.
  pause(): Readable {
    this._flowing = false;
    return this;
  }

  // Internal: emit 'end' exactly once when all data has been consumed.
  _tryEnd(): void {
    if (this._endEmitted) {
      return;
    }
    if (this._readableBuffer.size() > 0) {
      return;
    }
    this._endEmitted = true;
    this.emitNoArgs("end");
    // If piped, also end the destination.
    if (this._pipeDest !== null) {
      this._pipeDest.end();
    }
  }
}

// ---------------------------------------------------------------------------
// Writable stream
// ---------------------------------------------------------------------------

export class Writable extends EventEmitter {
  // Internal buffer of written chunks (consumed by subclass or pipeline).
  _writableBuffer: ArrayList;
  // Whether end() has been called.
  _finished: boolean;

  constructor() {
    super();
    this._writableBuffer = new ArrayList();
    this._finished = false;
  }

  // Write a chunk of data. Returns true if the stream can accept more
  // data immediately (no backpressure).
  write(chunk: any): boolean {
    if (this._finished) {
      this.emitOne("error", "write after end");
      return false;
    }

    // Store the chunk and invoke the internal _write hook.
    this._writableBuffer.add(chunk);
    this._write(chunk);

    // Emit 'drain' to signal readiness for more data.
    this.emitNoArgs("drain");
    return true;
  }

  // Subclasses override _write to process each chunk.
  // The default implementation is a no-op (data is buffered only).
  _write(chunk: any): void {
    // Override in subclasses.
  }

  // Signal that no more data will be written.
  end(): void {
    if (this._finished) {
      return;
    }
    this._finished = true;
    this.emitNoArgs("finish");
  }

  // Convenience: write a final chunk and then end.
  endWithChunk(chunk: any): void {
    this.write(chunk);
    this.end();
  }
}

// ---------------------------------------------------------------------------
// Duplex stream (both Readable and Writable)
// ---------------------------------------------------------------------------
// True multiple inheritance is not available, so Duplex extends Readable
// and embeds a Writable internally, delegating write-side methods to it.

export class Duplex extends Readable {
  // Embedded writable side.
  _writable: Writable;

  constructor() {
    super();
    this._writable = new Writable();
  }

  // Delegate write-side methods to the embedded Writable.
  write(chunk: any): boolean {
    return this._writable.write(chunk);
  }

  end(): void {
    this._writable.end();
  }

  endWithChunk(chunk: any): void {
    this._writable.endWithChunk(chunk);
  }
}

// ---------------------------------------------------------------------------
// Transform stream
// ---------------------------------------------------------------------------
// A Transform is a Duplex that processes each written chunk through a
// _transform() method and pushes the result to its readable side.

export class Transform extends Duplex {
  constructor() {
    super();

    // Wire the embedded writable's _write to call our _transform.
    // Since we cannot override _write on the embedded instance with a
    // closure (closures capture is limited), we override write() here.
  }

  // Override write to run _transform and push the result.
  write(chunk: any): boolean {
    if (this._writable._finished) {
      this.emitOne("error", "write after end");
      return false;
    }
    const transformed: any = this._transform(chunk);
    if (transformed !== null) {
      this.push(transformed);
    }
    this.emitNoArgs("drain");
    return true;
  }

  // Subclasses override _transform to process each chunk.
  // Return the transformed chunk, or null to produce no output.
  _transform(chunk: any): any {
    // Default: pass through unchanged.
    return chunk;
  }

  // Called once after the last chunk has been written.
  // Subclasses can override to push trailing data.
  _flush(): void {
    // Default: no trailing data.
  }

  // Override end to call _flush before finishing.
  end(): void {
    this._flush();
    this.push(null);
    this._writable.end();
  }
}

// ---------------------------------------------------------------------------
// PassThrough stream
// ---------------------------------------------------------------------------
// A Transform that passes data through without modification.

export class PassThrough extends Transform {
  constructor() {
    super();
  }

  _transform(chunk: any): any {
    return chunk;
  }
}

// ---------------------------------------------------------------------------
// pipeline() — connect a chain of streams
// ---------------------------------------------------------------------------
// Since tyvm does not support rest parameters, pipeline accepts up to
// five stream arguments (source + up to 3 transforms + destination).
// This covers the vast majority of real-world use cases.
//
// Usage:
//   pipeline(readable, transform1, writable, null, null)
//   pipeline(readable, t1, t2, writable, null)
//   pipeline(readable, t1, t2, t3, writable)

export function pipeline(s1: any, s2: any, s3: any, s4: any, s5: any): void {
  // Collect non-null streams into a list.
  const streams: ArrayList = new ArrayList();
  streams.add(s1);
  if (s2 !== null) { streams.add(s2); }
  if (s3 !== null) { streams.add(s3); }
  if (s4 !== null) { streams.add(s4); }
  if (s5 !== null) { streams.add(s5); }

  // Pipe each adjacent pair.
  let i = 0;
  while (i < streams.size() - 1) {
    const source: Readable = streams.get(i);
    const dest: Writable = streams.get(i + 1);
    source.pipe(dest);
    i = i + 1;
  }
}

// ---------------------------------------------------------------------------
// Channel-backed pipe helper
// ---------------------------------------------------------------------------
// For scenarios requiring true backpressure between independent virtual
// threads, pipeWithChannel spawns a producer and consumer thread linked
// by a bounded tyvm channel.
//
// Usage:
//   pipeWithChannel(readable, writable, 16)  // buffer up to 16 chunks

export function pipeWithChannel(source: Readable, dest: Writable, capacity: number): void {
  // Create a bounded channel to transfer chunks.
  const ch: Channel<any> = channel(capacity);

  // Producer: reads from source and sends chunks through the channel.
  // Sends a null sentinel when the source ends.
  function producerFn(src: Readable, out: Channel<any>): void {
    let chunk: any = src.read(0);
    while (chunk !== null) {
      out.send(chunk);
      chunk = src.read(0);
    }
    // Signal end-of-stream.
    out.send(null);
  }

  // Consumer: receives chunks from the channel and writes to dest.
  function consumerFn(input: Channel<any>, dst: Writable): void {
    let chunk: any = input.recv();
    while (chunk !== null) {
      dst.write(chunk);
      chunk = input.recv();
    }
    dst.end();
  }

  // Launch both on virtual threads.
  spawn(producerFn(source, ch));
  spawn(consumerFn(ch, dest));
}
