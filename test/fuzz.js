'use strict';
// Fuzzer for the vm-gen front-end and image decoder / VM.
//
//   node test/fuzz.js [iterations]
//
// Goals:
//   * the lexer / parser / compiler must FAIL GRACEFULLY on garbage input --
//     a thrown Error is fine; a hang or a non-Error crash is not.
//   * the generated VM must never execute a tampered image as if it were clean;
//     integrity must reject it, or a resource limit must stop a runaway loop.
//
// The generated VM is built with a hard instruction budget so that malformed
// images that would otherwise spin forever (corrupt jumps, bad lengths) always
// terminate -- which is exactly what the resource-limit feature is for.

const { compile } = require('../src/compiler');
const { buildImage } = require('../src/protect');
const { emitJs } = require('../src/emit-js');
const { interpret } = require('../src/interp');

const ITERS = parseInt(process.argv[2], 10) || 2000;
let checks = 0, problems = 0;
const fail = (msg) => { problems++; console.log('  PROBLEM: ' + msg); };

// ---- deterministic PRNG so failures reproduce ----
let _s = 0x2545f491;
function rnd() { _s = (Math.imul(_s, 1664525) + 1013904223) >>> 0; return _s / 0x100000000; }
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (n) => Math.floor(rnd() * n);

// ---- 1. front-end fuzzing (lexer / parser / compiler) ----
const CHUNKS = [
  'let', 'fn', 'return', 'if', 'else', 'while', 'for', 'break', 'continue', 'print',
  'true', 'false', 'null', 'function', 'const', 'var', 'console', '.log',
  '(', ')', '{', '}', '[', ']', ';', ',', '=', '==', '+=', '++', '--', '?', ':', '.',
  '+', '-', '*', '/', '%', '<', '>', '&&', '||', '!', '<<', '>>', '&', '|', '^',
  'x', 'y', 'foo', '0', '1', '42', '3.14', '"str"', "'q'", '\n', ' ', '\\', '"', '/*', '*/', '//',
  '\uD83D', '\x00', '\xff', 'é',
];
function randomSource() {
  const n = 1 + int(40);
  let s = '';
  for (let i = 0; i < n; i++) s += pick(CHUNKS);
  return s;
}
const VALID = [
  'print 1+2*3;',
  'let a=[1,2,3]; print a[1];',
  'fn f(n){ if(n<1){return 0;} return n+f(n-1);} print f(5);',
  'for(let i=0;i<3;i=i+1){ print i; }',
  'let x=5; x+=2; print x>3?"big":"small";',
];
function mutateSource(src) {
  const a = src.split('');
  const m = 1 + int(3);
  for (let k = 0; k < m; k++) {
    const i = int(a.length);
    const kind = int(3);
    if (kind === 0) a[i] = pick(CHUNKS);          // substitute
    else if (kind === 1) a.splice(i, 1);          // delete
    else a.splice(i, 0, pick(CHUNKS));            // insert
  }
  return a.join('');
}

console.log(`== front-end fuzz (${ITERS} iterations) ==`);
for (let it = 0; it < ITERS; it++) {
  const src = rnd() < 0.5 ? randomSource() : mutateSource(pick(VALID));
  checks++;
  try {
    const prog = compile(src);
    // if it compiled, it must also interpret under a step budget without hanging
    interpret(prog, { maxSteps: 200000 });
  } catch (e) {
    if (!(e instanceof Error)) fail('non-Error thrown for input ' + JSON.stringify(src));
    // a thrown Error (SyntaxError, compile error, step-limit) is the intended
    // graceful outcome -- nothing to report.
  }
}

// ---- 2. image decoder / VM fuzzing ----
// Run a generated JS VM in a sandbox that neutralizes process.exit and captures
// output. Returns { outcome, lines }.
function runImage(image, cleanLines) {
  const jsSource = emitJs(image, { banner: false, maxSteps: 2000000, maxDepth: 4000 });
  const lines = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  const origLog = console.log, origErr = console.error, origExit = process.exit;
  process.stdout.write = (s) => { lines.push(String(s)); return true; };
  console.log = (...a) => { lines.push(a.join(' ') + '\n'); };
  console.error = () => {};
  process.exit = () => { throw new Error('__exit__'); };
  let outcome = 'ran';
  try {
    new Function('module', 'exports', 'require', 'process', 'console', 'Buffer', jsSource)(
      { exports: {} }, {}, require, process, console, Buffer);
  } catch (e) {
    outcome = (e instanceof Error) ? 'threw' : 'CRASH';
  } finally {
    process.stdout.write = origWrite; console.log = origLog; console.error = origErr; process.exit = origExit;
  }
  return { outcome, text: lines.join('') };
}

console.log('== image decoder / VM fuzz ==');
const BASES = ['print 1+1;', 'fn f(n){return n*2;} print f(21);', 'let a=[1,2,3]; print a[0]+a[2];'];
for (const src of BASES) {
  const program = compile(src);
  const { image } = buildImage(program, { seed: 12345 });
  const clean = runImage(image, null).text;

  const MUTANTS = Math.max(50, Math.floor(ITERS / 10));
  for (let k = 0; k < MUTANTS; k++) {
    const kind = int(4);
    let img;
    if (kind === 0) {                              // truncation
      img = image.slice(0, int(image.length));
    } else if (kind === 1) {                        // single byte flip
      img = image.slice();
      const i = int(img.length);
      img[i] = (img[i] ^ (1 + int(255))) & 0xff;
    } else if (kind === 2) {                        // multi-byte corruption
      img = image.slice();
      const m = 1 + int(5);
      for (let j = 0; j < m; j++) { const i = int(img.length); img[i] = int(256); }
    } else {                                        // corrupt a length field region
      img = image.slice();
      for (let i = 11; i < Math.min(20, img.length); i++) img[i] = int(256);
    }
    checks++;
    const r = runImage(img, clean);
    if (r.outcome === 'CRASH') fail('non-Error crash on mutated image (kind ' + kind + ')');
    // Integrity invariant: a mutated image must NOT reproduce the clean output.
    if (r.outcome === 'ran' && r.text === clean && JSON.stringify(img) !== JSON.stringify(image)) {
      fail('mutated image produced identical clean output (integrity bypass), kind ' + kind);
    }
  }
}

console.log(`\n${checks} inputs exercised, ${problems} problem(s)`);
process.exit(problems ? 1 : 0);
