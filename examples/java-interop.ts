// Demonstrate calling Java standard library static methods from TypeScript.
//
// The "java:" import prefix tells the tyvm compiler to resolve these as
// JVM classes on the classpath rather than TypeScript modules.

import { Math } from "java:java.lang.Math";
import { System } from "java:java.lang.System";

function main(): void {
  // Use Java's System.currentTimeMillis() to measure elapsed time
  const start: number = System.currentTimeMillis();

  // Use Java's Math static methods
  const sqrtTwo: number = Math.sqrt(2);
  const piApprox: number = Math.pow(Math.PI, 2);

  console.log(sqrtTwo);
  console.log(piApprox);

  // Compute a sum to burn some time
  let sum: number = 0;
  let i: number = 0;
  while (i < 1000000) {
    sum = sum + i;
    i = i + 1;
  }

  const end: number = System.currentTimeMillis();
  console.log(sum);
  console.log(end - start);
}
