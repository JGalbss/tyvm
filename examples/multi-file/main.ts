/**
 * Multi-file example — demonstrates cross-file imports in tyvm.
 *
 * Compile with:
 *   tyvm compile examples/multi-file/main.ts
 *
 * This will automatically discover and compile math-utils.ts and
 * string-utils.ts (following the import graph), then produce:
 *   out/Main.class
 *   out/MathUtils.class
 *   out/StringUtils.class
 */

import { add, multiply, square, factorial } from "./math-utils";
import { greet, repeat, exclaim } from "./string-utils";

// Use math utilities
const sum = add(10, 20);
console.log("10 + 20 = " + sum);

const product = multiply(6, 7);
console.log("6 * 7 = " + product);

const sq = square(9);
console.log("9^2 = " + sq);

const fact = factorial(10);
console.log("10! = " + fact);

// Use string utilities
const greeting = greet("World");
console.log(greeting);

const stars = repeat("*", 10);
console.log(stars);

const loud = exclaim(greet("tyvm"));
console.log(loud);
