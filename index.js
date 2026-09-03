'use strict';
// Public programmatic API for vm-gen.
//
//   const { generate, compile, buildImage, disassemble } = require('vm-gen');
//   const { output } = generate('print 1 + 1;', { target: 'lua' });
//
const { generate, compile, buildImage, disassemble } = require('./src/generate');
const { emitJs } = require('./src/emit-js');
const { emitLua } = require('./src/emit-lua');
const opcodes = require('./src/opcodes');

module.exports = { generate, compile, buildImage, disassemble, emitJs, emitLua, opcodes };
