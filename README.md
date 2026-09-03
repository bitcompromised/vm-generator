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

## The source language (`.vgs`)

A small C/JS-flavored language — enough to be interesting, small enough to read.

```c
// recursion, branching, loops
fn fib(n) {
  if (n < 2) { return n; }
  return fib(n - 1) + fib(n - 2);
}

let i = 0;
while (i <= 10) {
  print "fib(" + str(i) + ") = " + str(fib(i));
  i = i + 1;
}
```

Supported:

- **Values:** numbers, strings, booleans (`true`/`false`), `null`, arrays.
- **Variables:** `let name = expr;`, reassignment `name = expr;` (block-scoped).
- **Operators:** `+ - * / %`, comparisons, `&& || !` (short-circuit),
  bitwise `& | ^ << >>`.
- **Control flow:** `if/else`, `while`.
- **Functions:** top-level `fn` with parameters and recursion (no closures).
- **Arrays:** `[a, b, c]`, indexing `a[i]`, assignment `a[i] = v`.
- **`print expr;`** and host builtins:
  `len`, `str`, `num`, `floor`, `abs`, `rand`, `time`, `push`.

See [`examples/`](examples/) for `hello.vgs`, `fib.vgs`, and `arrays.vgs`.

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
| [`src/compiler.js`](src/compiler.js) | AST → per-function bytecode, scopes, jump backpatching. |
| [`src/protect.js`](src/protect.js) | Opcode permutation, encryption, checksum → one opaque image. |
| [`src/emit-js.js`](src/emit-js.js) | Standalone JS VM generator. |
| [`src/emit-lua.js`](src/emit-lua.js) | Standalone Lua VM generator (pure Lua 5.1+, no libraries). |
| [`src/disasm.js`](src/disasm.js) | Canonical (pre-protection) disassembler for debugging. |
| [`bin/vm-gen.js`](bin/vm-gen.js) | CLI. |
| [`index.js`](index.js) | Programmatic API. |

### The image format

A single byte array, embedded in the generated VM as base64:

```
magic 'V''G' | version | u32 checksum
└── body (checksummed) ──────────────────────────────────────────────┐
    u32 codeSeed | u32 constSeed | u8 nOpcodes | perm[nOpcodes]       │
    u16 constCount | u32 encConstLen | encConst[…]                    │
    u16 fnCount | per fn: name, nparams, nlocals, u32 codeLen, enc[…] │
```

The VM verifies the checksum, rebuilds the inverse opcode map, decrypts the
constant pool and each function's code, then runs a stack-machine dispatch loop.

## Programmatic use

```js
const { generate, compile, disassemble } = require('vm-gen');

const src = 'print 2 + 3 * 4;';
const { output } = generate(src, { target: 'lua', seed: 7 });
console.log(output);                 // standalone Lua source

console.log(disassemble(compile(src))); // canonical bytecode listing
```

## CLI reference

```
vm-gen build  <source.vgs> [--target js|lua] [-o out] [--seed N] [--no-banner]
vm-gen run    <source.vgs>            compile to JS in memory and execute
vm-gen disasm <source.vgs>            print canonical bytecode
```

## License

MIT — see [LICENSE](LICENSE).
