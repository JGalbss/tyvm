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
