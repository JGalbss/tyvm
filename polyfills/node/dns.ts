// ==========================================================================
// Node.js `dns` polyfill for tyvm
// ==========================================================================
//
// Implements DNS lookup and resolve operations backed by Java's
// java.net.InetAddress. Since tyvm has no event loop, all operations
// are synchronous (matching the dns.promises or callback-free style).
//
// Java backing classes:
//   java.net.InetAddress     — hostname resolution (DNS lookup)
//   java.net.Inet4Address    — IPv4 address representation
//   java.net.Inet6Address    — IPv6 address representation
//   java.util.ArrayList      — collect multiple results
//
// Usage:
//   import { lookup, resolve, resolve4, resolve6, reverse } from "node:dns";

import { InetAddress } from "java:java.net.InetAddress";
import { ArrayList } from "java:java.util.ArrayList";

// ---------------------------------------------------------------------------
// LookupResult — returned by lookup()
// ---------------------------------------------------------------------------

export class LookupResult {
  address: string;
  family: number;

  constructor(address: string, family: number) {
    this.address = address;
    this.family = family;
  }
}

// ---------------------------------------------------------------------------
// lookup(hostname) -> LookupResult
// ---------------------------------------------------------------------------
// Resolve a hostname to its first IP address using the OS resolver.
// Returns a LookupResult with the address string and family (4 or 6).
//
// Backed by: java.net.InetAddress.getByName()

export function lookup(hostname: string): LookupResult {
  const addr: InetAddress = InetAddress.getByName(hostname);
  const hostAddress: string = addr.getHostAddress();

  // Determine address family by checking for colon (IPv6 contains ':')
  let family: number = 4;
  if (hostAddress.indexOf(":") !== -1) {
    family = 6;
  }

  return new LookupResult(hostAddress, family);
}

// ---------------------------------------------------------------------------
// resolve(hostname) -> ArrayList<string>
// ---------------------------------------------------------------------------
// Resolve a hostname to all of its IP addresses.
// Returns an ArrayList of address strings.
//
// Backed by: java.net.InetAddress.getAllByName()

export function resolve(hostname: string): ArrayList {
  const addrs: any = InetAddress.getAllByName(hostname);
  const result: ArrayList = new ArrayList();

  let i = 0;
  while (i < addrs.length) {
    const addr: InetAddress = addrs[i];
    result.add(addr.getHostAddress());
    i = i + 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// resolve4(hostname) -> ArrayList<string>
// ---------------------------------------------------------------------------
// Resolve a hostname to its IPv4 addresses only.
//
// Backed by: java.net.InetAddress.getAllByName() with IPv4 filter

export function resolve4(hostname: string): ArrayList {
  const addrs: any = InetAddress.getAllByName(hostname);
  const result: ArrayList = new ArrayList();

  let i = 0;
  while (i < addrs.length) {
    const addr: InetAddress = addrs[i];
    const hostAddress: string = addr.getHostAddress();
    // IPv4 addresses do not contain ':'
    if (hostAddress.indexOf(":") === -1) {
      result.add(hostAddress);
    }
    i = i + 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// resolve6(hostname) -> ArrayList<string>
// ---------------------------------------------------------------------------
// Resolve a hostname to its IPv6 addresses only.
//
// Backed by: java.net.InetAddress.getAllByName() with IPv6 filter

export function resolve6(hostname: string): ArrayList {
  const addrs: any = InetAddress.getAllByName(hostname);
  const result: ArrayList = new ArrayList();

  let i = 0;
  while (i < addrs.length) {
    const addr: InetAddress = addrs[i];
    const hostAddress: string = addr.getHostAddress();
    // IPv6 addresses contain ':'
    if (hostAddress.indexOf(":") !== -1) {
      result.add(hostAddress);
    }
    i = i + 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// reverse(ip) -> string
// ---------------------------------------------------------------------------
// Perform a reverse DNS lookup on an IP address, returning the hostname.
//
// Backed by: java.net.InetAddress.getByName().getHostName()

export function reverse(ip: string): string {
  const addr: InetAddress = InetAddress.getByName(ip);
  return addr.getHostName();
}

// ---------------------------------------------------------------------------
// getServers() -> ArrayList<string>
// ---------------------------------------------------------------------------
// Returns the DNS servers configured on the system. Java does not expose
// system DNS servers directly, so this returns an empty list as a
// best-effort placeholder. Applications that need DNS server info should
// use platform-specific methods.

export function getServers(): ArrayList {
  return new ArrayList();
}
