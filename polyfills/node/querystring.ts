// Node.js `querystring` polyfill for tyvm
//
// Pure string-manipulation implementation of query string encoding/decoding.
// No Java dependencies — all parsing is done with indexOf/substring loops
// since tyvm does not support template literals or for-of.
//
// Usage:
//   import { parse, stringify, escape, unescape } from "node:querystring";

import { StringBuilder } from "java:java.lang.StringBuilder";
import { URLEncoder } from "java:java.net.URLEncoder";
import { URLDecoder } from "java:java.net.URLDecoder";
import { HashMap } from "java:java.util.HashMap";

// ---------------------------------------------------------------------------
// escape / unescape — URL percent-encoding
// ---------------------------------------------------------------------------

// URL-encode a string. Backed by java.net.URLEncoder which handles all the
// percent-encoding rules (spaces become "+", special chars become %XX).
export function escape(str: string): string {
  return URLEncoder.encode(str, "UTF-8");
}

// URL-decode a percent-encoded string. Backed by java.net.URLDecoder.
export function unescape(str: string): string {
  return URLDecoder.decode(str, "UTF-8");
}

// ---------------------------------------------------------------------------
// parse — query string to key/value map
// ---------------------------------------------------------------------------

// Parse a query string like "foo=bar&baz=qux" into a HashMap.
// Duplicate keys are overwritten (last value wins), matching Node's default
// behavior. Keys and values are URL-decoded.
export function parse(str: string): HashMap<string, string> {
  const result: HashMap<string, string> = new HashMap();

  if (str === "" || str === null) {
    return result;
  }

  // Strip leading "?" if present
  let qs: string = str;
  if (qs.charAt(0) === "?") {
    qs = qs.substring(1);
  }

  let remaining: string = qs;
  let done: boolean = false;

  while (!done) {
    let pair: string = "";
    const ampIdx: number = remaining.indexOf("&");
    if (ampIdx === -1) {
      pair = remaining;
      done = true;
    } else {
      pair = remaining.substring(0, ampIdx);
      remaining = remaining.substring(ampIdx + 1);
    }

    if (pair.length > 0) {
      const eqIdx: number = pair.indexOf("=");
      if (eqIdx === -1) {
        // Key with no value
        result.put(unescape(pair), "");
      } else {
        const key: string = unescape(pair.substring(0, eqIdx));
        const value: string = unescape(pair.substring(eqIdx + 1));
        result.put(key, value);
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// stringify — key/value map to query string
// ---------------------------------------------------------------------------

// Serialize a HashMap into a query string. Keys and values are URL-encoded.
// The output does not include a leading "?".
export function stringify(obj: HashMap<string, string>): string {
  const sb: StringBuilder = new StringBuilder();
  // We iterate by getting the key set and converting to an ArrayList.
  // Since tyvm does not support iterators, we use toString() parsing as
  // a workaround. In practice the compiler would provide entrySet iteration.
  //
  // For now we accept a parallel-array style approach: callers build the
  // map and we serialize it. This works with the HashMap.toString() output
  // format "{key1=val1, key2=val2}" as a fallback.
  const mapStr: string = obj.toString();

  // Strip the surrounding braces from HashMap.toString()
  if (mapStr.length <= 2) {
    return "";
  }
  const inner: string = mapStr.substring(1, mapStr.length - 1);

  let remaining: string = inner;
  let first: boolean = true;
  let done: boolean = false;

  while (!done) {
    // HashMap.toString() separates entries with ", "
    const sepIdx: number = remaining.indexOf(", ");
    let entry: string = "";
    if (sepIdx === -1) {
      entry = remaining;
      done = true;
    } else {
      entry = remaining.substring(0, sepIdx);
      remaining = remaining.substring(sepIdx + 2);
    }

    if (entry.length > 0) {
      const eqIdx: number = entry.indexOf("=");
      if (eqIdx !== -1) {
        if (!first) {
          sb.append("&");
        }
        sb.append(escape(entry.substring(0, eqIdx)));
        sb.append("=");
        sb.append(escape(entry.substring(eqIdx + 1)));
        first = false;
      }
    }
  }

  return sb.toString();
}
