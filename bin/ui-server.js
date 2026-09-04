'use strict';
// Local web UI for vm-gen. Starts a small HTTP server (Node built-ins only) that
// serves a single-page control panel:
//   * paste / load source, "Analyze" lists every function with its scope
//     (parameters, locals, captured upvalues by name)
//   * per-function protection toggles (flatten / bogus / split / cipher rounds)
//   * two setting groups: VM-INTERPRETER (how the engine + loader are built) and
//     VM-CHILD (how the guest program is protected)
//   * "Build" compiles and returns the VM source + the build summary
//
// Nothing leaves the machine: the server binds to 127.0.0.1 only.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { generate, analyze } = require('../src/generate');
const V = require('../src/version');

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 50 * 1024 * 1024) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Map the UI's {interpreter, child, perFn} payload onto generate() options.
function toGenerateOptions(body) {
  const itp = body.interpreter || {};
  const child = body.child || {};
  const perFn = {};
  for (const k of Object.keys(body.perFn || {})) {
    const v = body.perFn[k];
    const o = {};
    if (v.flatten) o.flatten = true;
    if (v.split) o.split = true;
    if (typeof v.bogus === 'number' && v.bogus > 0) o.bogus = v.bogus;
    if (typeof v.protLevel === 'number') o.protLevel = v.protLevel;
    if (Object.keys(o).length) perFn[k] = o;
  }
  return {
    target: body.target === 'lua' ? 'lua' : 'js',
    seed: (body.seed === '' || body.seed == null) ? undefined : (body.seed | 0),
    profile: body.profile || 'balanced',
    optimize: child.optimize !== false,
    // VM-interpreter (engine + loader) settings
    permute: itp.permute !== false,
    fuse: !!itp.fuse,
    conceal: !!itp.conceal,
    protLevel: typeof itp.cipherRounds === 'number' ? itp.cipherRounds : undefined,
    mutateHandlers: !!itp.mutateHandlers,
    loaderForm: itp.loaderForm || 'auto',
    randomize: itp.randomize !== false,
    minify: itp.minify !== false,
    // VM-child (guest program) settings
    flatten: !!child.flatten,
    bogus: typeof child.bogus === 'number' ? child.bogus : 0,
    split: !!child.split,
    encStr: child.encStr || 'none',
    dud: !!child.dud,
    dudCount: typeof child.dudCount === 'number' ? child.dudCount : undefined,
    renameSymbols: child.renameSymbols !== false,
    prod: !!body.prod,
    // per-function overrides
    perFnProt: perFn,
  };
}

function serve(html, port, initialFile) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }
      if (req.method === 'GET' && req.url === '/initial') {
        let src = '';
        try { if (initialFile) src = fs.readFileSync(initialFile, 'utf8'); } catch (_) { /* ignore */ }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ source: src, file: initialFile || '', profiles: V.PROFILE_NAMES }));
        return;
      }
      if (req.method === 'POST' && req.url === '/analyze') {
        const body = JSON.parse(await readBody(req) || '{}');
        try {
          const result = analyze(body.source || '', { optimize: body.optimize !== false });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, result }));
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
      }
      if (req.method === 'POST' && req.url === '/build') {
        const body = JSON.parse(await readBody(req) || '{}');
        try {
          const opts = toGenerateOptions(body);
          const { output, meta } = generate(body.source || '', opts);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true, output, summary: meta.summary,
            stats: { numFns: meta.numFns, dudFns: meta.dudFns || 0, imageSize: meta.imageSize,
              renameCount: meta.renameCount || 0, encStrCount: meta.encStrCount || 0,
              target: meta.target, checksum: '0x' + meta.checksum.toString(16) },
          }));
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message, stack: e.stack }));
        }
        return;
      }
      res.writeHead(404); res.end('not found');
    } catch (e) {
      res.writeHead(500); res.end('server error: ' + e.message);
    }
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`vm-gen UI running at ${url}`);
    console.log('  (binds to localhost only; Ctrl+C to stop)');
  });
  return server;
}
module.exports = { serve, toGenerateOptions };
