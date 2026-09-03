#!/usr/bin/env node
'use strict';
// vm-gen command-line interface.
//
//   vm-gen build     <source> [--target js|lua] [--profile P] [-o out] [--seed N]
//   vm-gen run       <source>            compile to JS in-memory and execute
//   vm-gen exec      <source> [--trace]  run on the reference interpreter (oracle)
//   vm-gen disasm    <source>            print canonical bytecode (pre-protection)
//   vm-gen benchmark <source> [--profile P]
//
// <source> may be a .vgs program or a .js file in the supported subset.
//
const fs = require('fs');
const path = require('path');
const { generate, compile, disassemble } = require('../src/generate');
const { interpret } = require('../src/interp');
const { benchmark, formatReport } = require('../src/benchmark');
const V = require('../src/version');

function usage() {
  console.log(`vm-gen -- generate protected Lua & JS virtual machines

Usage:
  vm-gen build     <source> [options]   Compile to a standalone protected VM
  vm-gen run       <source>             Compile + execute immediately (JS backend)
  vm-gen exec      <source> [--trace]   Run on the reference interpreter (oracle)
  vm-gen disasm    <source>             Print canonical bytecode (pre-protection)
  vm-gen benchmark <source> [options]   Profile compile/build/run metrics

<source> is a .vgs program or a .js file in the supported subset.

Options:
  --target, -t   js | lua                Target VM language (default: js)
  --profile, -p  development | balanced | aggressive | performance
                                         Build profile (default: balanced)
  --out, -o      <file>                  Output path (default: <source>.vm.<ext>)
  --seed         <number>                Deterministic build seed (default: random)
  --max-steps    <number>                Runtime instruction budget (0 = unlimited)
  --max-depth    <number>                Runtime call-depth limit (0 = unlimited)
  --sign         <key>                   Embed a keyed signature; the VM then runs
                                         only when env VMGEN_KEY matches this key
  --no-optimize                          Disable compile-time optimization
  --dud, --no-dud                        Force decoy ("dud") functions on/off
                                         (default: on for the aggressive profile)
  --dud-count    <number>                Number of decoy functions to inject
  --no-banner                            Omit the generated-file header comment
  --trace                                (exec) print a full execution trace
  --version, -v                          Print version information
  --help, -h                             Show this help

Profiles: ${V.PROFILE_NAMES.join(', ')}`);
}

function versionInfo() {
  console.log(`vm-gen
  compiler   ${V.COMPILER_VERSION}
  format     ${V.FORMAT_MAJOR}.${V.FORMAT_MINOR}
  vm-abi     ${V.VM_ABI_VERSION}
  bytecode   ${V.BYTECODE_VERSION}
  protection ${V.PROTECTION_VERSION}`);
}

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target' || a === '-t') opts.target = argv[++i];
    else if (a === '--profile' || a === '-p') opts.profile = argv[++i];
    else if (a === '--out' || a === '-o') opts.out = argv[++i];
    else if (a === '--seed') opts.seed = parseInt(argv[++i], 10);
    else if (a === '--max-steps') opts.maxSteps = parseInt(argv[++i], 10);
    else if (a === '--max-depth') opts.maxDepth = parseInt(argv[++i], 10);
    else if (a === '--sign') opts.sign = argv[++i];
    else if (a === '--arch') opts.arch = argv[++i];
    else if (a === '--no-optimize') opts.optimize = false;
    else if (a === '--dud') opts.dud = true;
    else if (a === '--no-dud') opts.dud = false;
    else if (a === '--dud-count') opts.dudCount = parseInt(argv[++i], 10);
    else if (a === '--no-banner') opts.banner = false;
    else if (a === '--trace') opts.trace = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--help' || a === '-h') opts.help = true;
    else opts._.push(a);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.version) { versionInfo(); return; }
  const cmd = opts._[0];
  if (opts.help || !cmd) { usage(); return; }

  const file = opts._[1];
  if (!file) { console.error('error: missing source file'); process.exit(2); }
  const source = fs.readFileSync(file, 'utf8');

  // Resolve `import "x"` relative to the main source file's directory.
  const baseDir = path.dirname(path.resolve(file));
  const resolveImport = (p) => fs.readFileSync(path.resolve(baseDir, p), 'utf8');

  if (cmd === 'disasm') {
    console.log(disassemble(compile(source, { optimize: opts.optimize, resolveImport })));
    return;
  }

  if (cmd === 'exec') {
    // Reference interpreter: no protection, optional debug trace.
    const program = compile(source, { optimize: opts.optimize, resolveImport });
  const res = await interpret(program, { trace: opts.trace });
    if (opts.trace) {
      for (const t of res.trace) {
        console.error(`#${String(t.step).padStart(5)} ${t.fn}@${t.i} ${t.op}`
          + `${t.args.length ? ' ' + t.args.join(',') : ''}`
          + `  stack=[${t.stack.map(String).join(', ')}]`);
      }
      console.error(`-- ${res.steps} steps --`);
    }
    for (const line of res.output) process.stdout.write(line + '\n');
    return;
  }

  if (cmd === 'run') {
    // For faster development and correct semantics (top-level await), run on the reference interpreter.
    const program = compile(source, { optimize: opts.optimize, resolveImport });
    const res = await interpret(program, { trace: opts.trace, maxSteps: opts.maxSteps, dir: path.dirname(path.resolve(file)) });
    if (opts.trace) {
      for (const t of res.trace) {
        console.error(`#${String(t.step).padStart(5)} ${t.fn}@${t.i} ${t.op}`
          + `${t.args.length ? ' ' + t.args.join(',') : ''}`
          + `  stack=[${t.stack.map(String).join(', ')}]`);
      }
      console.error(`-- ${res.steps} steps --`);
    }
    for (const line of res.output) process.stdout.write(line + '\n');
    return;
  }

  if (cmd === 'benchmark' || cmd === 'bench') {
    const r = benchmark(source, { seed: opts.seed, profile: opts.profile, optimize: opts.optimize, maxSteps: opts.maxSteps, maxDepth: opts.maxDepth, resolveImport });
    console.log(formatReport(path.basename(file), r));
    return;
  }

  if (cmd === 'build') {
    const target = (opts.target || 'js').toLowerCase();
    const ext = target === 'lua' ? '.lua' : '.js';
    const out = opts.out || (file.replace(/\.[^.]+$/, '') + '.vm' + ext);
    const { output, meta } = generate(source, {
      target, banner: opts.banner, seed: opts.seed, profile: opts.profile,
      optimize: opts.optimize, maxSteps: opts.maxSteps, maxDepth: opts.maxDepth, sign: opts.sign,
      dud: opts.dud, dudCount: opts.dudCount, arch: opts.arch, resolveImport,
      sourceDir: path.dirname(path.resolve(file)),
    });
    fs.writeFileSync(out, output);
    console.error(`vm-gen: wrote ${path.relative(process.cwd(), out)} `
      + `(${target}, profile ${meta.profile}, format ${meta.major}.${meta.minor}, `
      + `image ${meta.imageSize}B, ${meta.numFns} fns${meta.signed ? ', signed' : ''}, checksum 0x${meta.checksum.toString(16)})`);
    return;
  }

  console.error(`error: unknown command '${cmd}'`);
  usage();
  process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
