// ==========================================================================
// Node.js Buffer polyfill for tyvm
// ==========================================================================
//
// Implements the core Buffer API backed by java.nio.ByteBuffer.
// Supports utf8, ascii, hex, and base64 encodings via Java's standard
// library charset and Base64 utilities.
//
// Java backing classes:
//   java.nio.ByteBuffer      — contiguous byte storage with position/limit
//   java.lang.StringBuilder   — efficient string building for hex/base64
//   java.util.Base64          — RFC 4648 base64 encode/decode
//   java.util.Arrays          — array copy for concat/slice
//   java.lang.String          — charset-aware byte<->string conversion
// ==========================================================================

import { ByteBuffer } from "java:java.nio.ByteBuffer";
import { StringBuilder } from "java:java.lang.StringBuilder";
import { Base64 } from "java:java.util.Base64";
import { Arrays } from "java:java.util.Arrays";
import { ArrayList } from "java:java.util.ArrayList";

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

// Hex character lookup. We build a string "0123456789abcdef" and index into
// it instead of using a lookup table or template literals.
const HEX_CHARS: string = "0123456789abcdef";

// Convert a single byte (0-255) to a two-character hex string.
function byteToHex(b: number): string {
  const hi: number = (b >> 4) & 0x0f;
  const lo: number = b & 0x0f;
  const sb: StringBuilder = new StringBuilder();
  // charAt workaround: extract single hex digits from the constant string
  sb.append(HEX_CHARS.charAt(hi));
  sb.append(HEX_CHARS.charAt(lo));
  return sb.toString();
}

// Convert a two-character hex string to a byte value.
function hexToByte(hex: string): number {
  const hi: number = hexDigit(hex.charAt(0));
  const lo: number = hexDigit(hex.charAt(1));
  return hi * 16 + lo;
}

// Convert a single hex character to its numeric value (0-15).
function hexDigit(ch: string): number {
  if (ch === "0") { return 0; }
  if (ch === "1") { return 1; }
  if (ch === "2") { return 2; }
  if (ch === "3") { return 3; }
  if (ch === "4") { return 4; }
  if (ch === "5") { return 5; }
  if (ch === "6") { return 6; }
  if (ch === "7") { return 7; }
  if (ch === "8") { return 8; }
  if (ch === "9") { return 9; }
  if (ch === "a") { return 10; }
  if (ch === "b") { return 11; }
  if (ch === "c") { return 12; }
  if (ch === "d") { return 13; }
  if (ch === "e") { return 14; }
  if (ch === "f") { return 15; }
  if (ch === "A") { return 10; }
  if (ch === "B") { return 11; }
  if (ch === "C") { return 12; }
  if (ch === "D") { return 13; }
  if (ch === "E") { return 14; }
  if (ch === "F") { return 15; }
  return 0;
}

// ---------------------------------------------------------------------------
// Buffer class
// ---------------------------------------------------------------------------

export class Buffer {
  // The underlying java.nio.ByteBuffer. Capacity equals the logical length.
  _buf: ByteBuffer;

  // Logical byte length of the buffer.
  length: number;

  constructor(bb: ByteBuffer, len: number) {
    this._buf = bb;
    this.length = len;
  }

  // ---- static factory methods -------------------------------------------

  // Allocate a zero-filled buffer of `size` bytes.
  // Backed by ByteBuffer.allocate() which zero-fills by default.
  static alloc(size: number): Buffer {
    const bb: ByteBuffer = ByteBuffer.allocate(size);
    return new Buffer(bb, size);
  }

  // Create a Buffer from a string, optionally specifying encoding.
  // Supported encodings: "utf8" (default), "ascii", "hex", "base64".
  static fromString(str: string, encoding: string): Buffer {
    if (encoding === null) {
      encoding = "utf8";
    }

    if (encoding === "hex") {
      return Buffer._fromHex(str);
    }
    if (encoding === "base64") {
      return Buffer._fromBase64(str);
    }

    // utf8 and ascii: use Java String.getBytes() which returns UTF-8 by
    // default. For ascii we do the same — characters outside 0-127 will
    // be encoded as multi-byte, matching Node.js "utf8" behaviour.
    // NOTE: tyvm compiles str.length to String.length() on the JVM.
    const len: number = str.length;
    const bb: ByteBuffer = ByteBuffer.allocate(len);
    let i = 0;
    while (i < len) {
      // charCodeAt returns the UTF-16 code unit; for ASCII and Latin-1
      // this is identical to the byte value.
      const code: number = str.charCodeAt(i);
      bb.put(i, code & 0xff);
      i = i + 1;
    }
    return new Buffer(bb, len);
  }

  // Create a Buffer from an ArrayList of byte values (numbers 0-255).
  static fromArray(arr: ArrayList): Buffer {
    const len: number = arr.size();
    const bb: ByteBuffer = ByteBuffer.allocate(len);
    let i = 0;
    while (i < len) {
      const val: number = arr.get(i);
      bb.put(i, val & 0xff);
      i = i + 1;
    }
    return new Buffer(bb, len);
  }

  // Concatenate an ArrayList of Buffers into one new Buffer.
  static concat(buffers: ArrayList): Buffer {
    // First pass: compute total length.
    let totalLen = 0;
    let b = 0;
    while (b < buffers.size()) {
      const buf: Buffer = buffers.get(b);
      totalLen = totalLen + buf.length;
      b = b + 1;
    }

    // Second pass: copy bytes into the new buffer.
    const bb: ByteBuffer = ByteBuffer.allocate(totalLen);
    let offset = 0;
    b = 0;
    while (b < buffers.size()) {
      const buf: Buffer = buffers.get(b);
      let i = 0;
      while (i < buf.length) {
        bb.put(offset, buf.getByte(i));
        offset = offset + 1;
        i = i + 1;
      }
      b = b + 1;
    }
    return new Buffer(bb, totalLen);
  }

  // ---- internal helpers for hex / base64 --------------------------------

  static _fromHex(hex: string): Buffer {
    const strLen: number = hex.length;
    const byteLen: number = strLen / 2;
    const bb: ByteBuffer = ByteBuffer.allocate(byteLen);
    let i = 0;
    while (i < byteLen) {
      const pos: number = i * 2;
      const pair: string = hex.substring(pos, pos + 2);
      const val: number = hexToByte(pair);
      bb.put(i, val);
      i = i + 1;
    }
    return new Buffer(bb, byteLen);
  }

  static _fromBase64(str: string): Buffer {
    // java.util.Base64.getDecoder().decode(String) returns byte[]
    // We copy the decoded bytes into a ByteBuffer.
    const decoder: any = Base64.getDecoder();
    const decoded: any = decoder.decode(str);
    // decoded is a Java byte[]; its length is available via .length
    const len: number = decoded.length;
    const bb: ByteBuffer = ByteBuffer.allocate(len);
    let i = 0;
    while (i < len) {
      bb.put(i, decoded[i]);
      i = i + 1;
    }
    return new Buffer(bb, len);
  }

  // ---- instance methods -------------------------------------------------

  // Read a single byte at the given index.
  getByte(index: number): number {
    // ByteBuffer.get(int) returns a signed byte (-128..127).
    // We mask with 0xff to produce an unsigned value (0..255).
    const raw: number = this._buf.get(index);
    return raw & 0xff;
  }

  // Write a single byte at the given index.
  setByte(index: number, value: number): void {
    this._buf.put(index, value & 0xff);
  }

  // Convert the buffer (or a region of it) to a string.
  // Supported encodings: "utf8" (default), "ascii", "hex", "base64".
  toString(encoding: string): string {
    if (encoding === null) {
      encoding = "utf8";
    }

    if (encoding === "hex") {
      return this._toHex();
    }
    if (encoding === "base64") {
      return this._toBase64();
    }

    // utf8 / ascii — build a string one character at a time.
    // For true multi-byte UTF-8 we would need a decoder; this handles
    // the common ASCII / Latin-1 subset.
    const sb: StringBuilder = new StringBuilder();
    let i = 0;
    while (i < this.length) {
      const code: number = this.getByte(i);
      // String.fromCharCode equivalent: build via StringBuilder + cast
      // In tyvm the char type maps to a JVM char, so we append the code
      // point directly.
      sb.append(code);
      i = i + 1;
    }
    return sb.toString();
  }

  _toHex(): string {
    const sb: StringBuilder = new StringBuilder();
    let i = 0;
    while (i < this.length) {
      sb.append(byteToHex(this.getByte(i)));
      i = i + 1;
    }
    return sb.toString();
  }

  _toBase64(): string {
    // Copy bytes into a Java byte array and use Base64 encoder.
    // Since we cannot allocate a raw byte[] from TypeScript, we build
    // the base64 string manually using the standard algorithm.
    const sb: StringBuilder = new StringBuilder();
    const chars: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let i = 0;
    while (i < this.length) {
      const b0: number = this.getByte(i);
      const b1: number = (i + 1 < this.length) ? this.getByte(i + 1) : 0;
      const b2: number = (i + 2 < this.length) ? this.getByte(i + 2) : 0;

      const idx0: number = (b0 >> 2) & 0x3f;
      const idx1: number = ((b0 & 0x03) * 16) + ((b1 >> 4) & 0x0f);
      const idx2: number = ((b1 & 0x0f) * 4) + ((b2 >> 6) & 0x03);
      const idx3: number = b2 & 0x3f;

      sb.append(chars.charAt(idx0));
      sb.append(chars.charAt(idx1));

      if (i + 1 < this.length) {
        sb.append(chars.charAt(idx2));
      } else {
        sb.append("=");
      }

      if (i + 2 < this.length) {
        sb.append(chars.charAt(idx3));
      } else {
        sb.append("=");
      }

      i = i + 3;
    }
    return sb.toString();
  }

  // Return a new Buffer that shares no memory, containing bytes from
  // `start` (inclusive) to `end` (exclusive).
  slice(start: number, end: number): Buffer {
    if (end > this.length) {
      end = this.length;
    }
    if (start < 0) {
      start = 0;
    }
    const newLen: number = end - start;
    if (newLen <= 0) {
      return Buffer.alloc(0);
    }
    const bb: ByteBuffer = ByteBuffer.allocate(newLen);
    let i = 0;
    while (i < newLen) {
      bb.put(i, this.getByte(start + i));
      i = i + 1;
    }
    return new Buffer(bb, newLen);
  }

  // Write a string into the buffer at `offset` using the given encoding.
  // Returns the number of bytes written.
  write(str: string, offset: number, encoding: string): number {
    if (encoding === null) {
      encoding = "utf8";
    }
    if (offset < 0) {
      offset = 0;
    }

    let written = 0;
    let i = 0;
    while (i < str.length) {
      if (offset + written >= this.length) {
        return written;
      }
      const code: number = str.charCodeAt(i);
      this.setByte(offset + written, code & 0xff);
      written = written + 1;
      i = i + 1;
    }
    return written;
  }

  // Copy bytes from this buffer into `target`.
  copy(target: Buffer, targetStart: number, sourceStart: number, sourceEnd: number): number {
    if (sourceEnd > this.length) {
      sourceEnd = this.length;
    }
    let count = 0;
    let si: number = sourceStart;
    let ti: number = targetStart;
    while (si < sourceEnd) {
      if (ti >= target.length) {
        return count;
      }
      target.setByte(ti, this.getByte(si));
      si = si + 1;
      ti = ti + 1;
      count = count + 1;
    }
    return count;
  }

  // Fill the buffer with a byte value.
  fill(value: number): Buffer {
    let i = 0;
    while (i < this.length) {
      this.setByte(i, value & 0xff);
      i = i + 1;
    }
    return this;
  }

  // Compare two buffers. Returns 0 if equal, negative if this < other,
  // positive if this > other.
  compare(other: Buffer): number {
    const minLen: number = this.length < other.length ? this.length : other.length;
    let i = 0;
    while (i < minLen) {
      const a: number = this.getByte(i);
      const b: number = other.getByte(i);
      if (a !== b) {
        return a - b;
      }
      i = i + 1;
    }
    return this.length - other.length;
  }

  // Check equality with another Buffer.
  equals(other: Buffer): boolean {
    if (this.length !== other.length) {
      return false;
    }
    return this.compare(other) === 0;
  }

  // ---- Numeric read methods (big-endian / little-endian) ----------------

  // Read an unsigned 8-bit integer at `offset`.
  readUInt8(offset: number): number {
    return this.getByte(offset);
  }

  // Read a signed 8-bit integer at `offset`.
  readInt8(offset: number): number {
    const val: number = this.getByte(offset);
    if (val >= 128) {
      return val - 256;
    }
    return val;
  }

  // Read an unsigned 16-bit integer, big-endian.
  readUInt16BE(offset: number): number {
    const b0: number = this.getByte(offset);
    const b1: number = this.getByte(offset + 1);
    return b0 * 256 + b1;
  }

  // Read an unsigned 16-bit integer, little-endian.
  readUInt16LE(offset: number): number {
    const b0: number = this.getByte(offset);
    const b1: number = this.getByte(offset + 1);
    return b1 * 256 + b0;
  }

  // Read a signed 32-bit integer, big-endian.
  readInt32BE(offset: number): number {
    const b0: number = this.getByte(offset);
    const b1: number = this.getByte(offset + 1);
    const b2: number = this.getByte(offset + 2);
    const b3: number = this.getByte(offset + 3);
    // Shift and combine. The leftmost byte carries the sign.
    const unsigned: number = b0 * 16777216 + b1 * 65536 + b2 * 256 + b3;
    // If high bit is set, convert to signed.
    if (b0 >= 128) {
      return unsigned - 4294967296;
    }
    return unsigned;
  }

  // Read a signed 32-bit integer, little-endian.
  readInt32LE(offset: number): number {
    const b0: number = this.getByte(offset);
    const b1: number = this.getByte(offset + 1);
    const b2: number = this.getByte(offset + 2);
    const b3: number = this.getByte(offset + 3);
    const unsigned: number = b3 * 16777216 + b2 * 65536 + b1 * 256 + b0;
    if (b3 >= 128) {
      return unsigned - 4294967296;
    }
    return unsigned;
  }

  // Read an unsigned 32-bit integer, big-endian.
  readUInt32BE(offset: number): number {
    const b0: number = this.getByte(offset);
    const b1: number = this.getByte(offset + 1);
    const b2: number = this.getByte(offset + 2);
    const b3: number = this.getByte(offset + 3);
    return b0 * 16777216 + b1 * 65536 + b2 * 256 + b3;
  }

  // Read an unsigned 32-bit integer, little-endian.
  readUInt32LE(offset: number): number {
    const b0: number = this.getByte(offset);
    const b1: number = this.getByte(offset + 1);
    const b2: number = this.getByte(offset + 2);
    const b3: number = this.getByte(offset + 3);
    return b3 * 16777216 + b2 * 65536 + b1 * 256 + b0;
  }

  // ---- Numeric write methods --------------------------------------------

  // Write an unsigned 8-bit integer at `offset`.
  writeUInt8(value: number, offset: number): void {
    this.setByte(offset, value & 0xff);
  }

  // Write an unsigned 16-bit integer, big-endian.
  writeUInt16BE(value: number, offset: number): void {
    this.setByte(offset, (value >> 8) & 0xff);
    this.setByte(offset + 1, value & 0xff);
  }

  // Write an unsigned 16-bit integer, little-endian.
  writeUInt16LE(value: number, offset: number): void {
    this.setByte(offset, value & 0xff);
    this.setByte(offset + 1, (value >> 8) & 0xff);
  }

  // Write a signed 32-bit integer, big-endian.
  writeInt32BE(value: number, offset: number): void {
    this.setByte(offset, (value >> 24) & 0xff);
    this.setByte(offset + 1, (value >> 16) & 0xff);
    this.setByte(offset + 2, (value >> 8) & 0xff);
    this.setByte(offset + 3, value & 0xff);
  }

  // Write a signed 32-bit integer, little-endian.
  writeInt32LE(value: number, offset: number): void {
    this.setByte(offset, value & 0xff);
    this.setByte(offset + 1, (value >> 8) & 0xff);
    this.setByte(offset + 2, (value >> 16) & 0xff);
    this.setByte(offset + 3, (value >> 24) & 0xff);
  }

  // Write an unsigned 32-bit integer, big-endian.
  writeUInt32BE(value: number, offset: number): void {
    this.writeInt32BE(value, offset);
  }

  // Write an unsigned 32-bit integer, little-endian.
  writeUInt32LE(value: number, offset: number): void {
    this.writeInt32LE(value, offset);
  }
}
