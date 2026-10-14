// ==========================================================================
// Node.js `zlib` polyfill for tyvm
// ==========================================================================
//
// Implements gzip, gunzip, deflate, inflate, and related compression
// utilities backed by Java's java.util.zip package.
//
// Java backing classes:
//   java.util.zip.GZIPOutputStream   — GZIP compression
//   java.util.zip.GZIPInputStream    — GZIP decompression
//   java.util.zip.DeflaterOutputStream — raw DEFLATE compression
//   java.util.zip.InflaterInputStream  — raw DEFLATE decompression
//   java.util.zip.Deflater           — deflate engine configuration
//   java.util.zip.Inflater           — inflate engine configuration
//   java.io.ByteArrayOutputStream    — accumulate output bytes
//   java.io.ByteArrayInputStream     — wrap input bytes as a stream
//
// Usage:
//   import { gzipSync, gunzipSync, deflateSync, inflateSync } from "node:zlib";

import { GZIPOutputStream } from "java:java.util.zip.GZIPOutputStream";
import { GZIPInputStream } from "java:java.util.zip.GZIPInputStream";
import { Deflater } from "java:java.util.zip.Deflater";
import { Inflater } from "java:java.util.zip.Inflater";
import { DeflaterOutputStream } from "java:java.util.zip.DeflaterOutputStream";
import { InflaterInputStream } from "java:java.util.zip.InflaterInputStream";
import { ByteArrayOutputStream } from "java:java.io.ByteArrayOutputStream";
import { ByteArrayInputStream } from "java:java.io.ByteArrayInputStream";

// ---------------------------------------------------------------------------
// Internal: read all bytes from an InputStream into a byte array
// ---------------------------------------------------------------------------

function _readAllBytes(inputStream: any): number[] {
  const baos: ByteArrayOutputStream = new ByteArrayOutputStream();
  const buf: number[] = new Array(4096);
  let n: number = inputStream.read(buf);
  while (n !== -1) {
    baos.write(buf, 0, n);
    n = inputStream.read(buf);
  }
  inputStream.close();
  return baos.toByteArray();
}

// ---------------------------------------------------------------------------
// gzipSync(data) -> number[]
// ---------------------------------------------------------------------------
// Compress a byte array using GZIP format.
// The input is a byte array (number[]); returns compressed bytes.
//
// Backed by: java.util.zip.GZIPOutputStream

export function gzipSync(data: number[]): number[] {
  const baos: ByteArrayOutputStream = new ByteArrayOutputStream();
  const gzos: GZIPOutputStream = new GZIPOutputStream(baos);
  gzos.write(data);
  gzos.close();
  return baos.toByteArray();
}

// ---------------------------------------------------------------------------
// gzipStringSync(data) -> number[]
// ---------------------------------------------------------------------------
// Convenience: compress a UTF-8 string using GZIP.

export function gzipStringSync(data: string): number[] {
  const bytes: number[] = data.getBytes("UTF-8");
  return gzipSync(bytes);
}

// ---------------------------------------------------------------------------
// gunzipSync(data) -> number[]
// ---------------------------------------------------------------------------
// Decompress a GZIP-compressed byte array.
//
// Backed by: java.util.zip.GZIPInputStream

export function gunzipSync(data: number[]): number[] {
  const bais: ByteArrayInputStream = new ByteArrayInputStream(data);
  const gzis: GZIPInputStream = new GZIPInputStream(bais);
  return _readAllBytes(gzis);
}

// ---------------------------------------------------------------------------
// gunzipToStringSync(data) -> string
// ---------------------------------------------------------------------------
// Convenience: decompress GZIP bytes and return as a UTF-8 string.

export function gunzipToStringSync(data: number[]): string {
  const bytes: number[] = gunzipSync(data);
  const result: string = new String(bytes, "UTF-8");
  return result;
}

// ---------------------------------------------------------------------------
// deflateSync(data) -> number[]
// ---------------------------------------------------------------------------
// Compress a byte array using raw DEFLATE (no GZIP header/trailer).
//
// Backed by: java.util.zip.DeflaterOutputStream

export function deflateSync(data: number[]): number[] {
  const baos: ByteArrayOutputStream = new ByteArrayOutputStream();
  const deflater: Deflater = new Deflater();
  const dos: DeflaterOutputStream = new DeflaterOutputStream(baos, deflater);
  dos.write(data);
  dos.close();
  return baos.toByteArray();
}

// ---------------------------------------------------------------------------
// deflateStringSync(data) -> number[]
// ---------------------------------------------------------------------------
// Convenience: deflate a UTF-8 string.

export function deflateStringSync(data: string): number[] {
  const bytes: number[] = data.getBytes("UTF-8");
  return deflateSync(bytes);
}

// ---------------------------------------------------------------------------
// inflateSync(data) -> number[]
// ---------------------------------------------------------------------------
// Decompress a raw DEFLATE-compressed byte array.
//
// Backed by: java.util.zip.InflaterInputStream

export function inflateSync(data: number[]): number[] {
  const bais: ByteArrayInputStream = new ByteArrayInputStream(data);
  const inflater: Inflater = new Inflater();
  const iis: InflaterInputStream = new InflaterInputStream(bais, inflater);
  return _readAllBytes(iis);
}

// ---------------------------------------------------------------------------
// inflateToStringSync(data) -> string
// ---------------------------------------------------------------------------
// Convenience: inflate bytes and return as a UTF-8 string.

export function inflateToStringSync(data: number[]): string {
  const bytes: number[] = inflateSync(data);
  const result: string = new String(bytes, "UTF-8");
  return result;
}

// ---------------------------------------------------------------------------
// deflateRawSync(data) -> number[]
// ---------------------------------------------------------------------------
// Compress using raw DEFLATE with nowrap=true (no zlib header).
//
// Backed by: java.util.zip.Deflater with nowrap=true

export function deflateRawSync(data: number[]): number[] {
  const baos: ByteArrayOutputStream = new ByteArrayOutputStream();
  const deflater: Deflater = new Deflater(Deflater.DEFAULT_COMPRESSION, true);
  const dos: DeflaterOutputStream = new DeflaterOutputStream(baos, deflater);
  dos.write(data);
  dos.close();
  return baos.toByteArray();
}

// ---------------------------------------------------------------------------
// inflateRawSync(data) -> number[]
// ---------------------------------------------------------------------------
// Decompress raw DEFLATE data (no zlib header).
//
// Backed by: java.util.zip.Inflater with nowrap=true

export function inflateRawSync(data: number[]): number[] {
  const bais: ByteArrayInputStream = new ByteArrayInputStream(data);
  const inflater: Inflater = new Inflater(true);
  const iis: InflaterInputStream = new InflaterInputStream(bais, inflater);
  return _readAllBytes(iis);
}

// ---------------------------------------------------------------------------
// Constants — compression levels
// ---------------------------------------------------------------------------

export const Z_NO_COMPRESSION: number = 0;
export const Z_BEST_SPEED: number = 1;
export const Z_BEST_COMPRESSION: number = 9;
export const Z_DEFAULT_COMPRESSION: number = -1;
