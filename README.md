# vm-gen

**Generate self-contained, per-build-unique protected virtual machines in JavaScript _and_ Lua.**

`vm-gen` takes a program written in a small source language, compiles it to
bytecode, then emits a single standalone VM file (in JS or Lua) that embeds the
program as an encrypted, integrity-checked *image* and executes it. Every build
produces a **different** VM — opcodes are randomly remapped and the bytecode is
freshly encrypted — so no two outputs share the same instruction encoding. This
is the "virtualization" approach used by commercial code protectors, distilled
into a small, readable, hackable codebase.

Inspired by and extending [GPT-VM-js](https://github.com/eadanGPT/GPT-VM-js)
(a single-language JS VM with PRNG-XOR bytecode blinding), `vm-gen` generalizes
the idea into a **generator** with two interchangeable back-ends.

---

## Quick start

```bash
# Execute a program directly (compiles to a JS VM in memory and runs it)
node bin/vm-gen.js run examples/fib.vgs

# Build a standalone protected VM you can ship
node bin/vm-gen.js build examples/fib.vgs --target js  -o fib.vm.js
node bin/vm-gen.js build examples/fib.vgs --target lua -o fib.vm.lua

# Run them with a stock runtime — no dependency on vm-gen:
node fib.vm.js
lua  fib.vm.lua        # any Lua 5.1+ (or LuaJIT)

# Inspect the compiled (pre-protection) bytecode
node bin/vm-gen.js disasm examples/fib.vgs
```

Run the test suite (JS + Lua parity via the bundled `fengari` interpreter):

```bash
npm test
```

---

## The source language (`.vgs` — or plain `.js`)

A small C/JS-flavored language — enough to be interesting, small enough to read.
The overlap with JavaScript is deliberate: a `.js` file written in the supported
subset can be fed to `vm-gen` directly (see [`sample.js`](sample.js)).

```c
// recursion, branching, loops
fn fib(n) {
  if (n < 2) { return n; }
  return fib(n - 1) + fib(n - 2);
}

for (let i = 0; i <= 10; i++) {
  print "fib(" + str(i) + ") = " + str(fib(i));
}
```

Supported:

- **Values:** numbers, strings, booleans (`true`/`false`), `null`, arrays.
- **Variables:** `let name = expr;`, reassignment `name = expr;` (block-scoped).
  Compound assignment `+= -= *= /= %= &= |= ^= <<= >>=` and `++` / `--`.
- **Operators:** `+ - * / %`, comparisons, `&& || !` (short-circuit),
  bitwise `& | ^ << >>`, ternary `cond ? a : b`.
- **Control flow:** `if/else`, `while`, `for (init; test; update)`, `break`, `continue`.
- **Functions:** top-level `fn` with parameters and recursion (no closures yet).
- **Arrays:** `[a, b, c]`, indexing `a[i]`, assignment `a[i] = v`.
- **`print expr;`** and host builtins:
  `len`, `str`, `num`, `floor`, `abs`, `rand`, `time`, `push`.
- **`.js` aliases:** `function` → `fn`, `const`/`var` → `let`, and
  `console.log(a, b, …)` lowers to `print` (arguments joined by spaces).

See [`examples/`](examples/) for `hello.vgs`, `fib.vgs`, and `arrays.vgs`, and
[`sample.js`](sample.js) for a plain-JavaScript input.

### Compile-time optimization

Every build except the `development` profile runs a **behavior-preserving**
optimizer over the AST before codegen: constant folding (`2 + 3 * 4` → `14`),
constant propagation of single-assignment `let`s, short-circuit/branch pruning,
and dead-code elimination after `return`/`break`/`continue`. Protection never
changes semantics — the test suite proves optimized and unoptimized builds print
identical output, and both match the reference interpreter.

---

## Code-protection techniques

All of these are applied at build time by [`src/protect.js`](src/protect.js) and
reversed at load time inside the generated VM. The generated JS and Lua VMs
implement the exact same algorithms, bit for bit.

| # | Technique | What it does |
|---|-----------|--------------|
| 1 | **Opcode permutation** | Each build assigns every canonical opcode a *random byte*. The VM is generated with the inverse map. Static disassembly patterns from one build don't transfer to another — a moving-target defense. |
| 2 | **Bytecode encryption** | Every function's byte stream is XORed with a keyed LCG keystream (a distinct key per function, derived from a per-build `codeSeed`). The raw bytes in the file are meaningless without running the generator's PRNG. |
| 3 | **Constant-pool encryption** | Strings and numeric literals are serialized and encrypted with a separate `constSeed`, so string scanning the artifact reveals nothing. |
| 4 | **Integrity / anti-tamper** | An FNV-1a checksum covers the whole image body. The VM verifies it at startup and **refuses to run** a modified image. Flip one byte and it aborts. |
| 5 | **Bytecode virtualization** | The program never exists as native JS/Lua — it runs on a custom stack machine, so there is no source-level control flow to read. |
| 6 | **Dud-code injection** | Decoy functions are appended to the image's function table. They are never referenced by any call, so they never execute, but once the cipher is broken they disassemble into believable code — padding the datastream an analyst must read. On by default for the `aggressive` profile; toggle with `--dud` / `--no-dud` (and size with `--dud-count N`). |

Because 1–3 are all seeded from a single build seed, `--seed N` gives you
**reproducible** builds, while omitting it gives a fresh, unique VM every time:

```bash
node bin/vm-gen.js build examples/fib.vgs --seed 42 -o a.js
node bin/vm-gen.js build examples/fib.vgs --seed 42 -o b.js   # a.js === b.js
node bin/vm-gen.js build examples/fib.vgs               -o c.js   # different bytes
```

### Scope / honest limitations

This is a **client-side** protector, and like *all* client-side obfuscation it
is not cryptographic secrecy: the VM must be able to decrypt and run the image,
so a determined analyst with the artifact can recover behavior. The goal —
as with commercial VM protectors — is to raise the cost of static analysis and
automated tampering, not to make reverse engineering impossible. The integrity
check deters casual patching, not an attacker who also regenerates the checksum.

---

## Architecture

```
                         ┌─────────────┐
  source.vgs ──lexer──►  │             │            ┌── emit-js  ──► fib.vm.js
              ──parser─► │  compiler   │──► image ──┤
              ──compile► │ (canonical  │  (protect) └── emit-lua ──► fib.vm.lua
                         │  bytecode)  │
                         └─────────────┘
```

| File | Responsibility |
|------|----------------|
| [`src/lexer.js`](src/lexer.js) | Tokenizer for `.vgs`. |
| [`src/parser.js`](src/parser.js) | Recursive-descent + precedence-climbing parser → AST. |
| [`src/opcodes.js`](src/opcodes.js) | Canonical, language-agnostic opcode table (single source of truth). |
| [`src/optimize.js`](src/optimize.js) | Behavior-preserving AST optimizer (folding, propagation, DCE). |
| [`src/compiler.js`](src/compiler.js) | AST → per-function bytecode, scopes, jump backpatching. |
| [`src/protect.js`](src/protect.js) | Opcode permutation, encryption, checksum → one opaque image. |
| [`src/emit-js.js`](src/emit-js.js) | Standalone JS VM generator. |
| [`src/emit-lua.js`](src/emit-lua.js) | Standalone Lua VM generator (pure Lua 5.1+, no libraries). |
| [`src/interp.js`](src/interp.js) | Reference interpreter / behavioral oracle. |
| [`src/disasm.js`](src/disasm.js) | Canonical (pre-protection) disassembler for debugging. |
| [`src/version.js`](src/version.js) | Version numbers, image-header format, build profiles. |
| [`src/benchmark.js`](src/benchmark.js) | Profiling / benchmarking. |
| [`bin/vm-gen.js`](bin/vm-gen.js) | CLI. |
| [`index.js`](index.js) | Programmatic API. |

### The image format

A single byte array, embedded in the generated VM as base64. The header is
**formalized** (format 2) so future VM generations can coexist and be told apart:

```
magic 'V''G' | major | minor | flags | profile | arch | u32 checksum
└── body (checksummed together with the header meta bytes) ──────────┐
    u32 codeSeed | u32 constSeed | u8 nOpcodes | perm[nOpcodes]       │
    u16 constCount | u32 encConstLen | encConst[…]                    │
    u16 fnCount | per fn: name, nparams, nlocals, u32 codeLen, enc[…] │
```

- **major/minor** — image format version; a decoder refuses a `major` it doesn't know.
- **flags** — bit 0 `optimized`, bit 1 `limited` (runtime resource limits present).
- **profile** — the build profile (`development`/`balanced`/`aggressive`/`performance`).
- **arch** — VM architecture id (reserved so register/threaded/block VMs can coexist).
- **checksum** — FNV-1a over the header meta bytes **and** the body, so tampering
  with either the header fields or the body is detected.

The VM verifies the checksum, rebuilds the inverse opcode map, decrypts the
constant pool and each function's code, then runs a stack-machine dispatch loop.

### Versioning

Four independent version numbers let a host reason about compatibility of each
component separately (`vm-gen --version` prints them): compiler, VM ABI,
bytecode, and protection scheme. See [`src/version.js`](src/version.js).

## Programmatic use

```js
const { generate, compile, disassemble } = require('vm-gen');

const src = 'print 2 + 3 * 4;';
const { output } = generate(src, { target: 'lua', seed: 7 });
console.log(output);                 // standalone Lua source

console.log(disassemble(compile(src))); // canonical bytecode listing
```

## Build profiles

`--profile` selects a bundle of build settings (explicit flags still override):

| Profile | Optimize | Opcode perm. | Runtime limits | Use |
|---------|:--------:|:------------:|----------------|-----|
| `development` | off | identity | none | readable disasm, debugging |
| `balanced` *(default)* | on | random | call-depth 1024 | ship-ready protection |
| `aggressive` | on | random | depth 512, 2e8 instr | maximum hardening |
| `performance` | on | random | none | speed over limits |

```bash
vm-gen build app.vgs --target js --profile aggressive --seed random
```

### Resource limits

Builds can embed a runtime **instruction budget** (`--max-steps`) and
**call-depth limit** (`--max-depth`) directly into the generated VM. When a limit
is exceeded the VM fails in a controlled way (aborts with a diagnostic) instead of
spinning or overflowing — the same mechanism the fuzzer relies on to bound
malformed images. Both back-ends enforce them identically.

## Tooling

- **Reference interpreter** — `vm-gen exec <source>` runs the *canonical*
  bytecode with no protection at all; `--trace` prints a per-step dump (opcode,
  stack, locals). It is the behavioral **oracle** the test suite validates every
  generated VM against. See [`src/interp.js`](src/interp.js).
- **Benchmark** — `vm-gen benchmark <source>` reports compile time, artifact and
  image size, startup+execution time, memory, instruction/dispatch/constant
  counts. See [`src/benchmark.js`](src/benchmark.js).
- **Fuzzer** — `npm run fuzz` throws malformed source and mutated images at the
  lexer, parser, compiler and VM (truncation, corrupt lengths, bad opcodes/jumps,
  stack underflow, recursion blow-ups) and asserts graceful failure + that no
  tampered image ever reproduces clean output. See [`test/fuzz.js`](test/fuzz.js).
- **Known-good artifacts** — `node test/known-good.js` compares a fixed build
  matrix against golden hashes so any change to the serializer/protector output
  is caught immediately; regenerate intentional changes with
  `UPDATE_GOLDEN=1 node test/known-good.js`. Part of `npm test`.

## CLI reference

```
vm-gen build     <source> [--target js|lua] [--profile P] [-o out] [--seed N]
                          [--max-steps N] [--max-depth N] [--no-optimize] [--no-banner]
vm-gen run       <source>             compile to JS in memory and execute
vm-gen exec      <source> [--trace]   run on the reference interpreter (oracle)
vm-gen disasm    <source>             print canonical bytecode (pre-protection)
vm-gen benchmark <source> [--profile P]   profile compile/build/run metrics
vm-gen --version                      print component versions
```

`<source>` is a `.vgs` program or a `.js` file in the supported subset.

## Implementation status

Landed in this update:

- **Language:** `.js` input, `for`/`break`/`continue`, ternary, compound
  assignment, `++`/`--`, `console.log`.
- **Optimizer:** constant folding, constant propagation, branch pruning,
  dead-code elimination — all behavior-preserving and test-verified.
- **Format:** formalized versioned header (major/minor/flags/profile/arch),
  header-bound checksum, four component version numbers.
- **Profiles:** `development` / `balanced` / `aggressive` / `performance`.
- **Runtime:** embeddable instruction & call-depth limits with controlled failure.
- **Tooling:** reference interpreter (oracle) + trace, benchmark command,
  fuzzer, known-good artifact regression suite.

Deliberately deferred (larger designs, not yet started — semantics-first, so
they are added only when they can be done without breaking behavior):

- Objects/maps, methods, exceptions (`try/catch/finally`), modules/imports,
  anonymous functions, closures/upvalues.
- Register VM and multi-architecture generation from a common VM definition;
  instruction-set polymorphism, basic-block & control-flow virtualization.
- Constant-pool concealment as unsolved expressions; multi-domain anti-tamper;
  cryptographic signing / licensing / server-backed secrets.
- Selective virtualization annotations (`@native` / `@virtualize` / strength).
- Garbage-collection / runtime value-model choices.

## License

MIT — see [LICENSE](LICENSE).
