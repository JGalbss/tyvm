# tyvm

TypeScript to JVM bytecode compiler. Write TypeScript, run on the Java Virtual Machine with virtual threads.

```
tyvm compile src/main.ts --run
```

## What is this?

tyvm compiles a strict subset of TypeScript directly to JVM `.class` files — no Java source, no transpilation to JS. Your TypeScript functions become JVM static methods, your types become JVM types, and you get access to virtual threads for lightweight concurrency.

**Pipeline:** TypeScript source → TS Compiler API (parse + typecheck) → IR → JVM bytecode → `.class` files

## Quick start

```bash
npm install
npm run build
npm run runtime:build

# Compile and run a TypeScript file
node dist/cli.js run examples/hello.ts --out out
```

## Examples

Run any file in `examples/` with `node dist/cli.js run examples/<name>.ts --out out`.

### Recursion

```ts
function fib(n: number): number {
  if (n <= 1) {
    return n;
  }
  return fib(n - 1) + fib(n - 2);
}

function main(): void {
  let i = 0;
  while (i < 20) {
    console.log(fib(i));
    i = i + 1;
  }
}
```

### Virtual threads

`spawn(fn(args))` runs `fn(args)` on a virtual thread and returns a `Task`. `task.await()` blocks until the task completes.

```ts
import { Task, spawn } from "tyvm";

function slowCompute(n: number): number {
  let sum = 0;
  let i = 0;
  while (i < n) {
    sum = sum + i;
    i = i + 1;
  }
  return sum;
}

function main(): void {
  const t1: Task<number> = spawn(slowCompute(10000000));
  const t2: Task<number> = spawn(slowCompute(20000000));

  console.log(t1.await()); // 49999995000000
  console.log(t2.await()); // 199999990000000
}
```

### Calling Java

A `java:` import resolves to a JVM class on the classpath, not a TypeScript module.

```ts
import { Math } from "java:java.lang.Math";
import { System } from "java:java.lang.System";

function main(): void {
  const start: number = System.currentTimeMillis();

  console.log(Math.sqrt(2));           // 1.4142135623730951
  console.log(Math.pow(Math.PI, 2));   // 9.869604401089358

  const end: number = System.currentTimeMillis();
  console.log(end - start);
}
```

## Benchmarks

Wall-clock time, median of 5 runs, including process startup. Compile time is not counted. The sources are in `bench/`. Run them with `bash bench/run.sh`.

| Benchmark | Node | Bun | tyvm | tyvm vs Node |
|---|---:|---:|---:|---|
| `collatz` | 9061 ms | 3772 ms | 1202 ms | 7.5x faster |
| `fib` | 1629 ms | 557 ms | 954 ms | 1.7x faster |
| `sieve` | 7483 ms | 8213 ms | 6756 ms | 1.1x faster |
| `stringconcat` | 930 ms | 259 ms | 867 ms | 1.1x faster |
| `sum-loop` | 1169 ms | 472 ms | 1172 ms | same |
| `nested-loops` | 616 ms | 448 ms | 622 ms | same |
| `matmul` | 752 ms | 477 ms | 1618 ms | 2.2x slower |
| `arithmetic` | 1957 ms | 3856 ms | 49668 ms | 25x slower |
| `calloverhead` | 536 ms | 510 ms | 18461 ms | 34x slower |
| `branchheavy` | 1665 ms | 1249 ms | 108060 ms | 65x slower |
| `ackermann` | stack overflow | 1419 ms | 1661 ms | Node fails |
| `boolchain` | 691 ms | 561 ms | `VerifyError` | tyvm fails |

Measured on an Apple Silicon Mac (18 cores) with Node 24.2, Bun 1.3.11, and OpenJDK 25. Other builds were using the CPU at the same time, so treat small differences as noise. tyvm printed the same result as Node on every benchmark that both runtimes finished.

## Supported language features

- `let`, `const` variable declarations
- `function` declarations with typed parameters
- `number` (→ JVM `double`), `boolean`, `string`, `void` types
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparisons: `==`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `&&`, `||`, `!`
- String concatenation with `+`
- `if` / `else`
- `while` loops
- `for` loops
- Recursive function calls
- `console.log()` → `System.out.println`
- Top-level statements (auto-wrapped into `main`)

## Architecture

```
src/
  cli.ts                   CLI entry point
  frontend/
    parse.ts               TypeScript Compiler API wrapper
    lower.ts               TS AST → IR lowering
  ir/
    nodes.ts               Intermediate representation types
  backend/
    opcodes.ts             JVM bytecode opcodes
    classfile.ts           .class file format writer
    descriptors.ts         JVM type descriptor utilities
    emitter.ts             IR → JVM bytecode emission
  runtime/
    java/tyvm/runtime/
      Rt.java              Println, concat, boxing helpers
      Task.java            Virtual thread task wrapper
      Channel.java         Go-style channels
      Scope.java           Structured concurrency
```

Each `.ts` file compiles to one `.class` file. Functions become `public static` methods. A `main()` function gets a JVM-compatible `public static void main(String[])` wrapper.

## Type mapping

| TypeScript | JVM |
|---|---|
| `number` | `double` |
| `boolean` | `boolean` |
| `string` | `java.lang.String` |
| `void` | `void` |
| `T[]` | JVM arrays |
| `Promise<T>` | `tyvm.runtime.Task<T>` |

## Runtime

The tyvm runtime (`runtime/tyvm-runtime.jar`) provides:

- **`Rt`** — println overloads, string concat, boxing/unboxing
- **`Task<T>`** — virtual thread-backed async tasks via `Thread.ofVirtual()`
- **`Channel<T>`** — Go-style unbuffered/buffered channels
- **`Scope`** — structured concurrency primitives

Requires Java 21+ for virtual thread support.

## Development

```bash
npm run build          # Build compiler with tsup
npm run dev            # Watch mode
npm run typecheck      # Type-check with tsc
npm run lint           # Lint with Biome
npm run test           # Run all tests (Vitest)
npm run test:watch     # Watch mode
npm run runtime:build  # Compile Java runtime
```

## Design decisions

- **Strict TS subset, not full JS semantics.** No `Proxy`, `eval`, prototype chains, or dynamic property access. This keeps the compiler tractable and the output fast.
- **`number` = `double`.** Simplest mapping. Integer optimization is a future pass.
- **One class per module.** Every `.ts` file becomes a single JVM class. Functions are static methods.
- **`-noverify` for v0.1.** We don't yet emit `StackMapTable` attributes. This is the first thing to fix for production use.
- **No npm package support yet.** The goal is to support it, but v0.1 focuses on language semantics.

## What's not supported (yet)

- Classes and objects
- Closures / lambdas
- Generics
- Union types
- `import` / `export` (multi-file)
- npm packages
- Template literals
- Destructuring
- Spread operator
- `async` / `await`
- Exceptions

## License

MIT
