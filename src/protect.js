'use strict';
// Protection layer: turns a canonical compiled program into a single opaque
// "image" byte array with several code-protection techniques applied.
//
//   1. Opcode permutation  - every build maps canonical opcodes to random bytes.
//   2. Bytecode encryption - each function's byte stream is XORed with a keyed
//                            LCG keystream (unique per function).
//   3. Constant encryption - the constant pool is serialized and encrypted.
//   4. Integrity checksum  - an FNV-1a checksum over the image body detects any
//                            tampering; the generated VM refuses to run if it
//                            does not match.
//
// Every primitive here is duplicated *verbatim in behavior* inside the emitted
// JS and Lua VMs (see emit-js.js / emit-lua.js). The unit tests round-trip
// through both to guarantee they stay in lock-step.

const { OP_NAME, OP_OPERANDS } = require('./opcodes');

const MASK32 = 0x100000000; // 2^32

// ---- 32-bit primitives (must be bit-exact in JS and Lua) ----
function mul32(a, b) {
  a = a % MASK32; b = b % MASK32;
  const ah = Math.floor(a / 65536), al = a % 65536;
  const r = ((ah * b) % 65536) * 65536 + al * b;
  return r % MASK32;
}
function lcgNext(state) {
  // state = state*1664525 + 1013904223  (mod 2^32)
  return (mul32(state, 1664525) + 1013904223) % MASK32;
}
function keystreamByte(state) {
  // high byte of state
  return Math.floor(state / 16777216) % 256;
}
function fnSeed(codeSeed, fnIdx) {
  return (codeSeed + mul32(fnIdx, 2654435761)) % MASK32;
}

// XOR-encrypt/decrypt a byte array in place-style (returns new array).
function cipher(bytes, seed) {
  let st = seed % MASK32;
  const out = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    st = lcgNext(st);
    out[i] = (bytes[i] ^ keystreamByte(st)) & 0xff;
  }
  return out;
}

// FNV-1a 32-bit over a byte array.
function fnv1a(bytes) {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) {
    // xor with a byte only touches the low 8 bits
    const low = h % 256;
    h = h - low + (low ^ bytes[i]);
    h = mul32(h, 16777619);
  }
  return h % MASK32;
}

// ---- small deterministic RNG for reproducible builds ----
function makeRng(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return () => { s = lcgNext(s); return s; };
}

// ---- byte writers ----
function w8(arr, v) { arr.push(v & 0xff); }
function w16(arr, v) { arr.push(v & 0xff, (v >>> 8) & 0xff); }
function w32(arr, v) { arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); }

// ---- encode one function's instructions to canonical bytes using perm ----
function encodeFunction(fn, perm) {
  const bytes = [];
  for (const ins of fn.instrs) {
    bytes.push(perm[ins.op]);
    const kinds = OP_OPERANDS[ins.op];
    for (let k = 0; k < kinds.length; k++) {
      const v = ins.args[k];
      if (kinds[k] === 'u16') { bytes.push(v & 0xff, (v >>> 8) & 0xff); }
      else { bytes.push(v & 0xff); }
    }
  }
  return bytes;
}

// ---- serialize the constant pool to a plain byte blob ----
function serializeConsts(consts) {
  const blob = [];
  for (const c of consts) {
    if (typeof c === 'number') {
      const s = Buffer.from(String(c), 'utf8');
      w8(blob, 0); w16(blob, s.length);
      for (const b of s) blob.push(b);
    } else {
      const s = Buffer.from(String(c), 'utf8');
      w8(blob, 1); w16(blob, s.length);
      for (const b of s) blob.push(b);
    }
  }
  return blob;
}

// Build the full protected image.  Returns { image: number[], meta }.
function buildImage(program, options = {}) {
  const rng = makeRng(options.seed !== undefined ? options.seed : (Date.now() >>> 0));
  const numCanon = OP_NAME.length;

  // 1. random opcode permutation (distinct bytes)
  const pool = [];
  for (let i = 0; i < 256; i++) pool.push(i);
  for (let i = 255; i > 0; i--) { const j = rng() % (i + 1); const t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
  const perm = pool.slice(0, numCanon); // perm[canonId] = emitted byte

  const codeSeed = rng() % MASK32;
  const constSeed = rng() % MASK32;

  // 2. encrypt constant pool
  const constBlob = serializeConsts(program.consts);
  const encConst = cipher(constBlob, constSeed);

  // 3. encode + encrypt each function
  const fnImages = program.functions.map((fn, idx) => {
    const plain = encodeFunction(fn, perm);
    const enc = cipher(plain, fnSeed(codeSeed, idx));
    return { name: fn.name, nparams: fn.nparams, nlocals: fn.nlocals, enc };
  });

  // ---- assemble body ----
  const body = [];
  w32(body, codeSeed);
  w32(body, constSeed);
  w8(body, numCanon);
  for (let i = 0; i < numCanon; i++) w8(body, perm[i]);
  w16(body, program.consts.length);
  w32(body, encConst.length);
  for (const b of encConst) body.push(b);
  w16(body, fnImages.length);
  for (const f of fnImages) {
    const nameBytes = Buffer.from(f.name, 'utf8');
    w8(body, nameBytes.length);
    for (const b of nameBytes) body.push(b);
    w8(body, f.nparams);
    w16(body, f.nlocals);
    w32(body, f.enc.length);
    for (const b of f.enc) body.push(b);
  }

  // 4. checksum over body
  const checksum = fnv1a(body);

  // ---- header + body ----
  const image = [];
  w8(image, 0x56); // 'V'
  w8(image, 0x47); // 'G'
  w8(image, 1);    // version
  w32(image, checksum);
  for (const b of body) image.push(b);

  return {
    image,
    meta: { codeSeed, constSeed, perm, checksum, numFns: fnImages.length, imageSize: image.length },
  };
}

module.exports = {
  buildImage,
  // exported for tests / reuse
  mul32, lcgNext, keystreamByte, fnSeed, cipher, fnv1a, makeRng,
};
