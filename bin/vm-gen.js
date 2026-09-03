#!/usr/bin/env node
'use strict';
// vm-gen command-line interface.
//
//   vm-gen build <source.vgs> [--target js|lua] [-o out] [--seed N]
//   vm-gen disasm <source.vgs>
//   vm-gen run <source.vgs>            (compile to JS in-memory and execute)
//
const fs = require('fs');
const path = require('path');
const { generate, compile, disassemble } = require('../src/generate');

function usage() {
  console.log(`vm-gen -- generate protected Lua & JS virtual machines

Usage:
  vm-gen build <source.vgs> [options]   Compile to a standalone protected VM
  vm-gen disasm <source.vgs>            Print canonical bytecode (pre-protection)
  vm-gen run <source.vgs>               Compile + execute immediately (JS backend)

Options:
  --target, -t   js | lua                Target VM language (default: js)
  --out, -o      <file>                  Output path (default: <source>.<ext>)
  --seed         <number>                Deterministic build seed (default: random)
  --no-banner                            Omit the generated-file header comment
  --help, -h                             Show this help
`);
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target' || a === '-t') opts.target = argv[++i];
    else if (a === '--out' || a === '-o') opts.out = argv[++i];
    else if (a === '--seed') opts.seed = parseInt(argv[++i], 10);
    else if (a === '--no-banner') opts.banner = false;
    else if (a === '--help' || a === '-h') opts.help = true;
    else opts._.push(a);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmd = opts._[0];
  if (opts.help || !cmd) { usage(); return; }

  const file = opts._[1];
  if (!file) { console.error('error: missing source file'); process.exit(2); }
  const source = fs.readFileSync(file, 'utf8');

  if (cmd === 'disasm') {
    console.log(disassemble(compile(source)));
    return;
  }

  if (cmd === 'run') {
    const { output } = generate(source, { target: 'js', banner: false, seed: opts.seed });
    // Execute the generated standalone module in a fresh context.
    const mod = { exports: {} };
    new Function('module', 'exports', 'require', 'process', 'console', 'Buffer', output)(
      mod, mod.exports, require, process, console, Buffer);
    return;
  }

  if (cmd === 'build') {
    const target = (opts.target || 'js').toLowerCase();
    const ext = target === 'lua' ? '.lua' : '.js';
    const out = opts.out || (file.replace(/\.[^.]+$/, '') + '.vm' + ext);
    const { output, meta } = generate(source, { target, banner: opts.banner, seed: opts.seed });
    fs.writeFileSync(out, output);
    console.error(`vm-gen: wrote ${path.relative(process.cwd(), out)} `
      + `(${target}, image ${meta.imageSize}B, ${meta.numFns} fns, checksum 0x${meta.checksum.toString(16)})`);
    return;
  }

  console.error(`error: unknown command '${cmd}'`);
  usage();
  process.exit(2);
}

main();
