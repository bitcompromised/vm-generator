'use strict';
// vm-gen test suite.
//   * compiles each example, runs the JS backend, checks expected output
//   * builds the Lua backend and runs it through fengari, checks parity
//   * verifies the tamper/integrity check trips when the image is modified
//   * verifies deterministic builds and the per-seed "moving target" property
//
// Lua execution uses fengari if installed; otherwise Lua parity is skipped
// with a warning (JS coverage still runs).

const fs = require('fs');
const path = require('path');
const { generate, buildImage, compile } = require('../src/generate');
const { emitJs } = require('../src/emit-js');

let fengari = null;
try { fengari = require('fengari'); } catch (_) { /* optional */ }

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' -- ' + extra : ''}`); }
}

// Run a generated standalone JS module, capturing stdout lines.
function runJs(source, seed) {
  const { output } = generate(source, { target: 'js', banner: false, seed });
  return captureStdout(() => {
    new Function('module', 'exports', 'require', 'process', 'console', 'Buffer', output)(
      { exports: {} }, {}, require, process, console, Buffer);
  });
}

// Run generated JS from an explicit image (used by the tamper test).
function runJsImage(image) {
  const output = emitJs(image, { banner: false });
  return captureStdout(() => {
    new Function('module', 'exports', 'require', 'process', 'console', 'Buffer', output)(
      { exports: {} }, {}, require, process, console, Buffer);
  });
}

function runLua(source, seed) {
  if (!fengari) return null;
  const { output } = generate(source, { target: 'lua', banner: false, seed });
  const { lua, lauxlib, lualib, to_luastring } = fengari;
  return captureStdout(() => {
    const L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);
    if (lauxlib.luaL_dostring(L, to_luastring(output)) !== lua.LUA_OK) {
      throw new Error('lua: ' + lua.lua_tojsstring(L, -1));
    }
  });
}

function captureStdout(fn) {
  const lines = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  const origLog = console.log;
  const origExit = process.exit;
  process.stdout.write = (s) => { lines.push(String(s)); return true; };
  console.log = (...a) => { lines.push(a.join(' ') + '\n'); };
  process.exit = (code) => { throw new Error('__exit__:' + code); };
  try { fn(); }
  finally { process.stdout.write = origWrite; console.log = origLog; process.exit = origExit; }
  return lines.join('').split('\n').filter((l) => l.length > 0);
}

// ---- fixtures ----
const cases = [
  {
    name: 'arithmetic + strings',
    src: 'let a = 6; let b = 7; print "a*b=" + str(a*b); print (a+b)*2;',
    expect: ['a*b=42', '26'],
  },
  {
    name: 'branching + while',
    src: 'let i = 0; let s = 0; while (i < 5) { if (i % 2 == 0) { s = s + i; } i = i + 1; } print s;',
    expect: ['6'],
  },
  {
    name: 'recursion',
    src: 'fn fact(n){ if (n<=1){return 1;} return n*fact(n-1);} print fact(6);',
    expect: ['720'],
  },
  {
    name: 'logical short-circuit',
    src: 'let t = true; let f = false; print (t && f) || t; print !f;',
    expect: ['true', 'true'],
  },
  {
    name: 'arrays + host',
    src: 'let a = [3,1,2]; a = push(a, 9); print len(a); print a[3]; print str(a);',
    expect: ['4', '9', '[3, 1, 2, 9]'],
  },
];

console.log('== JS backend ==');
for (const c of cases) {
  let out;
  try { out = runJs(c.src, 123); } catch (e) { out = ['<throw> ' + e.message]; }
  ok(c.name, JSON.stringify(out) === JSON.stringify(c.expect), `got ${JSON.stringify(out)}`);
}

console.log(fengari ? '== Lua backend (fengari) ==' : '== Lua backend SKIPPED (fengari not installed) ==');
if (fengari) {
  for (const c of cases) {
    let out;
    try { out = runLua(c.src, 123); } catch (e) { out = ['<throw> ' + e.message]; }
    ok(c.name, JSON.stringify(out) === JSON.stringify(c.expect), `got ${JSON.stringify(out)}`);
  }
}

console.log('== JS/Lua parity on examples ==');
if (fengari) {
  for (const f of ['hello', 'fib', 'arrays']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'examples', f + '.vgs'), 'utf8');
    const j = runJs(src, 99);
    const l = runLua(src, 99);
    ok('parity ' + f, JSON.stringify(j) === JSON.stringify(l), `js=${JSON.stringify(j)} lua=${JSON.stringify(l)}`);
  }
}

console.log('== integrity / tamper detection ==');
{
  const program = compile('print 1 + 1;');
  const { image } = buildImage(program, { seed: 5 });
  // untampered runs fine
  let clean;
  try { clean = runJsImage(image); } catch (e) { clean = ['<throw> ' + e.message]; }
  ok('clean image runs', JSON.stringify(clean) === JSON.stringify(['2']), `got ${JSON.stringify(clean)}`);
  // flip one body byte (offset 10 is inside the checksummed body)
  const tampered = image.slice();
  tampered[10] = (tampered[10] ^ 0xff) & 0xff;
  let threw = false;
  try { runJsImage(tampered); } catch (_) { threw = true; }
  // the VM catches internally and prints to stderr; detect by absence of '2'
  let tamperedOut = [];
  try { tamperedOut = runJsImage(tampered); } catch (_) { threw = true; }
  ok('tampered image rejected', threw || JSON.stringify(tamperedOut) !== JSON.stringify(['2']),
    `got ${JSON.stringify(tamperedOut)}`);
}

console.log('== determinism / moving target ==');
{
  const a = generate('print 42;', { target: 'js', banner: false, seed: 1 }).output;
  const b = generate('print 42;', { target: 'js', banner: false, seed: 1 }).output;
  const c = generate('print 42;', { target: 'js', banner: false, seed: 2 }).output;
  ok('same seed -> identical build', a === b);
  ok('different seed -> different build', a !== c);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
