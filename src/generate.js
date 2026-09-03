'use strict';
// High-level pipeline: source string -> protected VM source in a target language.

const { compile } = require('./compiler');
const { buildImage } = require('./protect');
const { emitJs } = require('./emit-js');
const { emitLua } = require('./emit-lua');
const { disassemble } = require('./disasm');

function generate(source, options = {}) {
  const target = (options.target || 'js').toLowerCase();
  const program = compile(source);
  const { image, meta } = buildImage(program, { seed: options.seed });

  let out;
  if (target === 'js' || target === 'javascript') out = emitJs(image, options);
  else if (target === 'lua') out = emitLua(image, options);
  else throw new Error(`Unknown target '${target}' (expected js or lua)`);

  return { output: out, program, image, meta };
}

module.exports = { generate, compile, buildImage, disassemble };
