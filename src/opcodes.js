'use strict';
// Canonical opcode table. These ids are STABLE and language-agnostic.
// A per-build random permutation maps each canonical id to the byte that is
// actually emitted into the bytecode (see protect.js). The generated VM is
// built with the inverse permutation, so no two builds share the same opcode
// encoding -- a "moving target" defense against pattern-based disassembly.
//
// The `operands` field describes the operand layout for each instruction so
// that the assembler, the disassembler and both VM back-ends stay in sync.
//   u16  -> unsigned 16-bit, little-endian
//   u8   -> unsigned 8-bit
//   (none) -> no operands
//
// Keep this list append-only; reordering would change the canonical ids.

const OPCODES = [
  // name            operands
  ['HALT',           []],
  ['PUSH_CONST',     ['u16']],   // push consts[idx]
  ['PUSH_TRUE',      []],
  ['PUSH_FALSE',     []],
  ['PUSH_NULL',      []],
  ['POP',            []],
  ['DUP',            []],
  ['LOAD',           ['u16']],   // push locals[slot]
  ['STORE',          ['u16']],   // locals[slot] = pop()
  ['ADD',            []],
  ['SUB',            []],
  ['MUL',            []],
  ['DIV',            []],
  ['MOD',            []],
  ['NEG',            []],
  ['NOT',            []],
  ['EQ',             []],
  ['NEQ',            []],
  ['LT',             []],
  ['GT',             []],
  ['LTE',            []],
  ['GTE',            []],
  ['BAND',           []],
  ['BOR',            []],
  ['BXOR',           []],
  ['SHL',            []],
  ['SHR',            []],
  ['JMP',            ['u16']],   // ip = addr
  ['JZ',             ['u16']],   // if !pop() ip = addr
  ['JNZ',            ['u16']],   // if pop() ip = addr
  ['CALL',           ['u16', 'u8']], // call function fnIdx with argc args
  ['RET',            []],
  ['CALL_HOST',      ['u16', 'u8']], // call host builtin named consts[idx]
  ['NEW_ARR',        ['u16']],   // pop N values -> array
  ['ARR_GET',        []],        // arr[idx]
  ['ARR_SET',        []],        // arr[idx] = val  (leaves val on stack)
  ['PRINT',          []],        // host print pop()
];

const OP = {};
OPCODES.forEach(([name], i) => { OP[name] = i; });

const OP_NAME = OPCODES.map(([name]) => name);
const OP_OPERANDS = OPCODES.map(([, ops]) => ops);

module.exports = { OPCODES, OP, OP_NAME, OP_OPERANDS };
