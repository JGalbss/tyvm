// Node.js `url` polyfill for tyvm
//
// Implements the WHATWG URL and URLSearchParams classes, plus the legacy
// parse() and format() helpers. Backed by java.net.URI for parsing.
//
// Usage:
//   import { URL, URLSearchParams, parse, format } from "node:url";

import { URI } from "java:java.net.URI";
import { StringBuilder } from "java:java.lang.StringBuilder";
import { ArrayList } from "java:java.util.ArrayList";

// ---------------------------------------------------------------------------
// URLSearchParams — query string key/value store
// ---------------------------------------------------------------------------

export class URLSearchParams {
  // Internal parallel arrays for keys and values (preserves insertion order
  // and supports duplicate keys, matching the WHATWG spec).
  private _keys: ArrayList<string>;
  private _values: ArrayList<string>;

  constructor(init: string) {
    this._keys = new ArrayList();
    this._values = new ArrayList();

    if (init === "" || init === null) {
      return;
    }

    // Strip leading "?"
    let qs: string = init;
    if (qs.charAt(0) === "?") {
      qs = qs.substring(1);
    }

    // Split on "&" and parse each pair
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
          this._keys.add(pair);
          this._values.add("");
        } else {
          this._keys.add(pair.substring(0, eqIdx));
          this._values.add(pair.substring(eqIdx + 1));
        }
      }
    }
  }

  // Return the first value for the given key, or null if not found.
  get(name: string): string | null {
    let i = 0;
    while (i < this._keys.size()) {
      if (this._keys.get(i) === name) {
        return this._values.get(i);
      }
      i = i + 1;
    }
    return null;
  }

  // Set a key to the given value. Removes all prior entries for that key.
  set(name: string, value: string): void {
    let found: boolean = false;
    let i = 0;
    // First pass: update first occurrence, mark for removal
    while (i < this._keys.size()) {
      if (this._keys.get(i) === name) {
        if (!found) {
          this._values.set(i, value);
          found = true;
        } else {
          this._keys.remove(i);
          this._values.remove(i);
          // Don't increment i; the list shifted
          i = i - 1;
        }
      }
      i = i + 1;
    }
    if (!found) {
      this._keys.add(name);
      this._values.add(value);
    }
  }

  // Check whether the given key exists.
  has(name: string): boolean {
    let i = 0;
    while (i < this._keys.size()) {
      if (this._keys.get(i) === name) {
        return true;
      }
      i = i + 1;
    }
    return false;
  }

  // Remove all entries for the given key.
  delete(name: string): void {
    let i = 0;
    while (i < this._keys.size()) {
      if (this._keys.get(i) === name) {
        this._keys.remove(i);
        this._values.remove(i);
      } else {
        i = i + 1;
      }
    }
  }

  // Append a new key/value pair (allows duplicates).
  append(name: string, value: string): void {
    this._keys.add(name);
    this._values.add(value);
  }

  // Serialize back to a query string (without leading "?").
  toString(): string {
    const sb: StringBuilder = new StringBuilder();
    let i = 0;
    while (i < this._keys.size()) {
      if (i > 0) {
        sb.append("&");
      }
      sb.append(this._keys.get(i));
      sb.append("=");
      sb.append(this._values.get(i));
      i = i + 1;
    }
    return sb.toString();
  }

  // Return the number of entries.
  size(): number {
    return this._keys.size();
  }
}

// ---------------------------------------------------------------------------
// URL — WHATWG URL class backed by java.net.URI
// ---------------------------------------------------------------------------

export class URL {
  href: string;
  protocol: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  searchParams: URLSearchParams;

  constructor(input: string, base: string | null) {
    // java.net.URI handles both absolute and relative resolution
    let uri: URI;
    if (base !== null && base !== "") {
      const baseUri: URI = new URI(base);
      uri = baseUri.resolve(input);
    } else {
      uri = new URI(input);
    }

    // Extract components from the parsed URI
    const scheme: string = uri.getScheme();
    this.protocol = scheme !== null ? scheme + ":" : "";

    this.hostname = uri.getHost() !== null ? uri.getHost() : "";

    const rawPort: number = uri.getPort();
    this.port = rawPort === -1 ? "" : "" + rawPort;

    // host = hostname + optional :port
    if (this.port !== "") {
      this.host = this.hostname + ":" + this.port;
    } else {
      this.host = this.hostname;
    }

    this.pathname = uri.getPath() !== null ? uri.getPath() : "/";
    if (this.pathname === "") {
      this.pathname = "/";
    }

    const rawQuery: string = uri.getQuery();
    this.search = rawQuery !== null ? "?" + rawQuery : "";

    const rawFragment: string = uri.getFragment();
    this.hash = rawFragment !== null ? "#" + rawFragment : "";

    // origin = protocol + "//" + host
    this.origin = this.protocol + "//" + this.host;

    // Reconstruct full href
    this.href = uri.toString();

    // Parse search params from query string
    this.searchParams = new URLSearchParams(
      rawQuery !== null ? rawQuery : ""
    );
  }

  toString(): string {
    return this.href;
  }
}

// ---------------------------------------------------------------------------
// Legacy parse / format helpers
// ---------------------------------------------------------------------------

// Parse a URL string into an object with protocol, host, hostname, port,
// pathname, search, hash, and href fields (matching Node's legacy url.parse).
export function parse(urlString: string): URL {
  return new URL(urlString, null);
}

// Format a URL object back into a string. Accepts any object with the
// standard URL fields.
export function format(urlObj: URL): string {
  const sb: StringBuilder = new StringBuilder();
  if (urlObj.protocol !== "") {
    sb.append(urlObj.protocol);
    sb.append("//");
  }
  sb.append(urlObj.host);
  sb.append(urlObj.pathname);
  if (urlObj.search !== "") {
    sb.append(urlObj.search);
  }
  if (urlObj.hash !== "") {
    sb.append(urlObj.hash);
  }
  return sb.toString();
}
