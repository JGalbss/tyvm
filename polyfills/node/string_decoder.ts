// ==========================================================================
// Node.js `string_decoder` polyfill for tyvm
// ==========================================================================
//
// Implements the StringDecoder class that converts byte sequences into
// strings, properly handling multi-byte characters that may be split
// across chunks (e.g., UTF-8 multi-byte sequences).
//
// Java backing classes:
//   java.nio.charset.Charset        — charset registry and lookup
//   java.nio.charset.CharsetDecoder — stateful byte-to-char decoder
//   java.nio.ByteBuffer             — input buffer for the decoder
//   java.nio.CharBuffer             — output buffer for the decoder
//   java.lang.StringBuilder         — accumulate decoded characters
//
// Usage:
//   import { StringDecoder } from "node:string_decoder";

import { Charset } from "java:java.nio.charset.Charset";
import { CharsetDecoder } from "java:java.nio.charset.CharsetDecoder";
import { ByteBuffer } from "java:java.nio.ByteBuffer";
import { CharBuffer } from "java:java.nio.CharBuffer";
import { StringBuilder } from "java:java.lang.StringBuilder";
import { CodingErrorAction } from "java:java.nio.charset.CodingErrorAction";

// ---------------------------------------------------------------------------
// Internal: map Node.js encoding names to Java Charset names
// ---------------------------------------------------------------------------

function _mapEncoding(encoding: string): string {
  if (encoding === null || encoding === "utf8" || encoding === "utf-8") {
    return "UTF-8";
  }
  if (encoding === "ascii") {
    return "US-ASCII";
  }
  if (encoding === "latin1" || encoding === "binary") {
    return "ISO-8859-1";
  }
  if (encoding === "utf16le" || encoding === "ucs2" || encoding === "ucs-2") {
    return "UTF-16LE";
  }
  // Fall through to the provided name — Java may recognize it
  return encoding;
}

// ---------------------------------------------------------------------------
// StringDecoder
// ---------------------------------------------------------------------------
// A stateful decoder that handles multi-byte character boundaries.
// When a byte chunk ends in the middle of a multi-byte sequence, the
// partial bytes are buffered internally and prepended to the next chunk.

export class StringDecoder {
  _charset: Charset;
  _decoder: CharsetDecoder;
  _encoding: string;
  // Pending bytes from the previous write() that formed an incomplete
  // multi-byte character. Stored as a ByteBuffer.
  _pending: ByteBuffer;
  _pendingLen: number;

  constructor(encoding: string) {
    this._encoding = encoding;
    if (encoding === null) {
      this._encoding = "utf8";
    }
    const javaCharset: string = _mapEncoding(this._encoding);
    this._charset = Charset.forName(javaCharset);
    this._decoder = this._charset.newDecoder();
    // Replace malformed/unmappable characters with '?' instead of throwing
    this._decoder.onMalformedInput(CodingErrorAction.REPLACE);
    this._decoder.onUnmappableCharacter(CodingErrorAction.REPLACE);
    this._pending = ByteBuffer.allocate(8);
    this._pendingLen = 0;
  }

  // ---- write(bytes) -> string --------------------------------------------
  // Decode a chunk of bytes into a string. If the chunk ends mid-character,
  // the trailing bytes are buffered for the next call.
  //
  // For simplicity, this implementation decodes the full chunk and lets
  // the Java CharsetDecoder handle partial sequences internally. The
  // decoder's state persists across calls.
  //
  // `bytes` is a byte array (number[]).

  write(bytes: number[]): string {
    const len: number = bytes.length;
    // Combine pending bytes with new bytes
    const totalLen: number = this._pendingLen + len;
    const combined: ByteBuffer = ByteBuffer.allocate(totalLen);

    // Copy pending bytes first
    let i = 0;
    while (i < this._pendingLen) {
      combined.put(this._pending.get(i));
      i = i + 1;
    }

    // Copy new bytes
    i = 0;
    while (i < len) {
      combined.put(bytes[i]);
      i = i + 1;
    }
    combined.flip();

    // Decode as much as possible
    const outBuf: CharBuffer = CharBuffer.allocate(totalLen * 2);
    this._decoder.decode(combined, outBuf, false);
    outBuf.flip();
    const result: string = outBuf.toString();

    // Save any remaining undecoded bytes as pending
    const remaining: number = combined.remaining();
    this._pendingLen = remaining;
    if (remaining > 0) {
      this._pending = ByteBuffer.allocate(8);
      i = 0;
      while (i < remaining) {
        this._pending.put(i, combined.get());
        i = i + 1;
      }
    } else {
      this._pendingLen = 0;
    }

    return result;
  }

  // ---- end(bytes?) -> string ---------------------------------------------
  // Flush any remaining bytes in the decoder. If `bytes` is provided,
  // they are decoded first. Any incomplete multi-byte characters are
  // replaced with the replacement character.

  end(bytes: number[]): string {
    let result: string = "";

    if (bytes !== null && bytes.length > 0) {
      result = this.write(bytes);
    }

    // Flush any pending bytes
    if (this._pendingLen > 0) {
      const buf: ByteBuffer = ByteBuffer.allocate(this._pendingLen);
      let i = 0;
      while (i < this._pendingLen) {
        buf.put(this._pending.get(i));
        i = i + 1;
      }
      buf.flip();

      const outBuf: CharBuffer = CharBuffer.allocate(this._pendingLen * 2);
      this._decoder.decode(buf, outBuf, true);
      this._decoder.flush(outBuf);
      outBuf.flip();
      result = result + outBuf.toString();

      this._pendingLen = 0;
    }

    // Reset decoder state for potential reuse
    this._decoder.reset();

    return result;
  }

  // ---- encoding property -------------------------------------------------
  // Returns the encoding name as provided to the constructor.

  getEncoding(): string {
    return this._encoding;
  }
}
