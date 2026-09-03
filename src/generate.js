'use strict';
// High-level pipeline: source string -> protected VM source in a target language.

const { compile } = require('./compiler');
const { buildImage } = require('./protect');
const { emitJs } = require('./emit-js');
const { emitLua } = require('./emit-lua');
const { disassemble } = require('./disasm');
const V = require('./version');

// Resolve a build profile into a concrete configuration. Explicit options always
// override the profile's defaults, so `--profile performance --max-depth 100`
// works as expected.
function resolveConfig(options = {}) {
  const profile = (options.profile || 'balanced').toLowerCase();
  const base = V.PROFILE_CONFIG[profile];
  if (!base) throw new Error(`unknown profile '${profile}' (expected ${V.PROFILE_NAMES.join(', ')})`);
  const pick = (k) => (options[k] !== undefined ? options[k] : base[k]);
  return {
    profile,
    optimize: pick('optimize'),
    permute: pick('permute'),
    conceal: pick('conceal'),
    dud: pick('dud'),
    dudCount: options.dudCount,
    maxSteps: pick('maxSteps'),
    maxDepth: pick('maxDepth'),
    maxObjects: pick('maxObjects'),
    maxString: pick('maxString'),
    arch: options.arch || base.arch,
  };
}

function generate(source, options = {}) {
  const target = (options.target || 'js').toLowerCase();
  const cfg = resolveConfig(options);
  const program = compile(source, { optimize: cfg.optimize, resolveImport: options.resolveImport });
  const limited = cfg.maxSteps > 0 || cfg.maxDepth > 0 || cfg.maxObjects > 0 || cfg.maxString > 0;

  const { image, meta } = buildImage(program, {
    seed: options.seed,
    profile: cfg.profile,
    arch: cfg.arch,
    optimized: cfg.optimize,
    permute: cfg.permute,
    conceal: cfg.conceal,
    dud: cfg.dud,
    dudCount: cfg.dudCount,
    limited,
    signKey: options.sign,
  });

  const emitOpts = Object.assign({}, options, { maxSteps: cfg.maxSteps, maxDepth: cfg.maxDepth, maxObjects: cfg.maxObjects, maxString: cfg.maxString, salt: meta.salt });
  let out;
  if (target === 'js' || target === 'javascript') out = emitJs(image, emitOpts);
  else if (target === 'lua') out = emitLua(image, emitOpts);
  else throw new Error(`Unknown target '${target}' (expected js or lua)`);

  return { output: out, program, image, meta, config: cfg };
}

module.exports = { generate, compile, buildImage, disassemble, resolveConfig };
