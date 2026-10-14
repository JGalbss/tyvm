// Node.js `crypto` polyfill for tyvm
//
// Implements a subset of the Node.js crypto API backed by Java's security
// and crypto libraries. All hashing goes through java.security.MessageDigest,
// random bytes come from java.security.SecureRandom, and symmetric
// encryption uses javax.crypto.Cipher with javax.crypto.spec.SecretKeySpec.
//
// Usage:
//   import { createHash, randomBytes, randomUUID } from "node:crypto";

import { MessageDigest } from "java:java.security.MessageDigest";
import { SecureRandom } from "java:java.security.SecureRandom";
import { Cipher } from "java:javax.crypto.Cipher";
import { SecretKeySpec } from "java:javax.crypto.spec.SecretKeySpec";
import { Base64 } from "java:java.util.Base64";
import { UUID } from "java:java.util.UUID";
import { StringBuilder } from "java:java.lang.StringBuilder";
import { Mac } from "java:javax.crypto.Mac";
import { IvParameterSpec } from "java:javax.crypto.spec.IvParameterSpec";
import { SecretKeyFactory } from "java:javax.crypto.SecretKeyFactory";
import { PBEKeySpec } from "java:javax.crypto.spec.PBEKeySpec";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Map Node-style algorithm names to Java MessageDigest names.
function mapAlgorithm(algo: string): string {
  if (algo === "sha256" || algo === "SHA256" || algo === "sha-256") {
    return "SHA-256";
  }
  if (algo === "sha512" || algo === "SHA512" || algo === "sha-512") {
    return "SHA-512";
  }
  if (algo === "sha1" || algo === "SHA1" || algo === "sha-1") {
    return "SHA-1";
  }
  if (algo === "md5" || algo === "MD5") {
    return "MD5";
  }
  return algo;
}

// Map Node-style algorithm names to Java Mac (HMAC) algorithm names.
function mapHmacAlgorithm(algo: string): string {
  if (algo === "sha256" || algo === "SHA256" || algo === "sha-256") {
    return "HmacSHA256";
  }
  if (algo === "sha512" || algo === "SHA512" || algo === "sha-512") {
    return "HmacSHA512";
  }
  if (algo === "sha1" || algo === "SHA1" || algo === "sha-1") {
    return "HmacSHA1";
  }
  if (algo === "md5" || algo === "MD5") {
    return "HmacMD5";
  }
  return "Hmac" + algo;
}

// Hex-encode a byte array. Each byte becomes two lowercase hex chars.
function bytesToHex(bytes: number[]): string {
  const hexChars: string = "0123456789abcdef";
  let result: string = "";
  let i = 0;
  while (i < bytes.length) {
    const b: number = bytes[i];
    // High nibble
    const hi: number = (b >> 4) & 0x0f;
    // Low nibble
    const lo: number = b & 0x0f;
    result = result + hexChars.charAt(hi) + hexChars.charAt(lo);
    i = i + 1;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Hash — wraps java.security.MessageDigest
// ---------------------------------------------------------------------------

class Hash {
  private md: MessageDigest;

  constructor(algorithm: string) {
    // MessageDigest.getInstance returns a digest for the given algorithm
    this.md = MessageDigest.getInstance(mapAlgorithm(algorithm));
  }

  // Feed data into the hash. Returns this for chaining.
  update(data: string): Hash {
    // MessageDigest.update accepts byte[]; getBytes() converts the string
    this.md.update(data.getBytes("UTF-8"));
    return this;
  }

  // Finalize the hash and return it in the requested encoding.
  // encoding: "hex" (default), "base64", or "buffer" (raw byte array).
  digest(encoding: string): string {
    // digest() returns byte[]
    const raw: number[] = this.md.digest();

    if (encoding === "base64") {
      // java.util.Base64.getEncoder().encodeToString(byte[])
      return Base64.getEncoder().encodeToString(raw);
    }
    // Default to hex
    return bytesToHex(raw);
  }
}

// ---------------------------------------------------------------------------
// Hmac — wraps javax.crypto.Mac
// ---------------------------------------------------------------------------

class Hmac {
  private mac: Mac;

  constructor(algorithm: string, key: string) {
    const javaAlgo: string = mapHmacAlgorithm(algorithm);
    // Create a SecretKeySpec from the key bytes
    const keySpec: SecretKeySpec = new SecretKeySpec(
      key.getBytes("UTF-8"),
      javaAlgo
    );
    this.mac = Mac.getInstance(javaAlgo);
    this.mac.init(keySpec);
  }

  update(data: string): Hmac {
    this.mac.update(data.getBytes("UTF-8"));
    return this;
  }

  digest(encoding: string): string {
    const raw: number[] = this.mac.doFinal();

    if (encoding === "base64") {
      return Base64.getEncoder().encodeToString(raw);
    }
    return bytesToHex(raw);
  }
}

// ---------------------------------------------------------------------------
// CipherWrapper — wraps javax.crypto.Cipher for encrypt/decrypt
// ---------------------------------------------------------------------------

class CipherWrapper {
  private cipher: Cipher;

  constructor(algorithm: string, key: number[], iv: number[], encrypt: boolean) {
    // Map common Node names to Java cipher transformation strings
    let transform: string = "AES/CBC/PKCS5Padding";
    if (algorithm === "aes-256-cbc" || algorithm === "aes-128-cbc") {
      transform = "AES/CBC/PKCS5Padding";
    }
    if (algorithm === "aes-256-ecb" || algorithm === "aes-128-ecb") {
      transform = "AES/ECB/PKCS5Padding";
    }

    const keySpec: SecretKeySpec = new SecretKeySpec(key, "AES");
    const ivSpec: IvParameterSpec = new IvParameterSpec(iv);

    this.cipher = Cipher.getInstance(transform);
    if (encrypt) {
      this.cipher.init(Cipher.ENCRYPT_MODE, keySpec, ivSpec);
    } else {
      this.cipher.init(Cipher.DECRYPT_MODE, keySpec, ivSpec);
    }
  }

  // Process a chunk of data. Returns encrypted/decrypted bytes.
  update(data: number[]): number[] {
    return this.cipher.update(data);
  }

  // Finalize the cipher and return the last block.
  final(): number[] {
    return this.cipher.doFinal();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Create a Hash object for the given algorithm.
// Supported: "sha256", "sha512", "sha1", "md5"
export function createHash(algorithm: string): Hash {
  return new Hash(algorithm);
}

// Create an Hmac object for the given algorithm and key.
export function createHmac(algorithm: string, key: string): Hmac {
  return new Hmac(algorithm, key);
}

// Generate an array of random bytes using java.security.SecureRandom.
export function randomBytes(size: number): number[] {
  const sr: SecureRandom = new SecureRandom();
  const bytes: number[] = new Array(size);
  // SecureRandom.nextBytes fills the array with random bytes
  sr.nextBytes(bytes);
  return bytes;
}

// Generate a random UUID string (v4) using java.util.UUID.
export function randomUUID(): string {
  return UUID.randomUUID().toString();
}

// Create an encrypting cipher. key and iv are byte arrays.
// algorithm: "aes-256-cbc", "aes-128-cbc", etc.
export function createCipheriv(
  algorithm: string,
  key: number[],
  iv: number[]
): CipherWrapper {
  return new CipherWrapper(algorithm, key, iv, true);
}

// Create a decrypting cipher. key and iv are byte arrays.
export function createDecipheriv(
  algorithm: string,
  key: number[],
  iv: number[]
): CipherWrapper {
  return new CipherWrapper(algorithm, key, iv, false);
}

// Derive a key from a password using PBKDF2.
// Backed by javax.crypto.SecretKeyFactory with PBKDF2WithHmacSHA256.
export function pbkdf2Sync(
  password: string,
  salt: string,
  iterations: number,
  keylen: number,
  digest: string
): number[] {
  // Map digest to the Java PBKDF2 variant
  let factoryAlgo: string = "PBKDF2WithHmacSHA256";
  if (digest === "sha512" || digest === "SHA512") {
    factoryAlgo = "PBKDF2WithHmacSHA512";
  }
  if (digest === "sha1" || digest === "SHA1") {
    factoryAlgo = "PBKDF2WithHmacSHA1";
  }

  // PBEKeySpec(char[] password, byte[] salt, int iterationCount, int keyLength)
  // keyLength is in bits, so multiply by 8
  const spec: PBEKeySpec = new PBEKeySpec(
    password.toCharArray(),
    salt.getBytes("UTF-8"),
    iterations,
    keylen * 8
  );
  const factory: SecretKeyFactory = SecretKeyFactory.getInstance(factoryAlgo);
  const secretKey = factory.generateSecret(spec);
  return secretKey.getEncoded();
}
