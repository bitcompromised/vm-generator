'use strict';
// Reference interpreter (behavioral oracle).
//
// Runs a *canonical* compiled program (the output of compiler.compile) directly,
// with no opcode permutation, encryption, checksums or polymorphism. Its only
// job is to be obviously correct and easy to inspect, so that generated /
// protected VMs can be validated against it (see test/run.js) and so that the
// compiler and optimizer can be debugged without any protection in the way.
//
// It optionally records a full execution trace (step, opcode, stack, locals).

const { OP_NAME, OP_OPERANDS } = require('./opcodes');

const OP = {};
OP_NAME.forEach((n, i) => { OP[n] = i; });

function operandBytes(op) {
  let n = 1;
  for (const k of OP_OPERANDS[op]) n += k === 'u16' ? 2 : 1;
  return n;
}

// Map each instruction's byte offset within a function to its instruction index,
// so byte-offset jump targets (as produced by the compiler) can be followed.
function offsetMap(fn) {
  const map = Object.create(null);
  let off = 0;
  for (let i = 0; i < fn.instrs.length; i++) {
    map[off] = i;
    off += operandBytes(fn.instrs[i].op);
  }
  map[off] = fn.instrs.length;
  return map;
}

// ---- runtime value model (see docs/VALUE-MODEL.md) ----
// number | string | boolean | null | Array | VMObj (map) | closure | cell
class VMObj {
  constructor() { this.keys = []; this.map = Object.create(null); }
  get(k) { k = String(k); return (k in this.map) ? this.map[k] : null; }
  set(k, v) { k = String(k); if (!(k in this.map)) this.keys.push(k); this.map[k] = v; }
  has(k) { return String(k) in this.map; }
}
const isObj = (v) => v instanceof VMObj;
const isClosure = (v) => !!v && typeof v === 'object' && v.__closure === true;
const mkCells = (n) => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = { v: null }; return a; };

function toStr(v) {
  if (v === null || v === undefined) return 'null';
  if (v === true) return 'true';
  if (v === false) return 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return '[' + v.map(toStr).join(', ') + ']';
  if (isObj(v)) return '{' + v.keys.map((k) => k + ': ' + toStr(v.map[k])).join(', ') + '}';
  if (isClosure(v)) return '<fn>';
  return String(v);
}
function truthy(v) { return !(v === null || v === undefined || v === false || v === 0 || v === ''); }
function u32(n) { return n >>> 0; }

function host(name, args) {
  switch (name) {
    case 'len':
      if (Array.isArray(args[0])) return args[0].length;
      if (isObj(args[0])) return args[0].keys.length;
      return String(args[0]).length;
    case 'str': return toStr(args[0]);
    case 'num': return parseFloat(args[0]);
    case 'floor': return Math.floor(args[0]);
    case 'abs': return Math.abs(args[0]);
    case 'rand': return Math.random();
    case 'time': return Date.now();
    case 'push': args[0].push(args[1]); return args[0];
    case 'keys': return isObj(args[0]) ? args[0].keys.slice() : [];
    case 'has': return isObj(args[0]) ? args[0].has(args[1]) : false;
    default: throw new Error('unknown host builtin ' + name);
  }
}

function index(obj, key) {
  if (isObj(obj)) return obj.get(key);
  if (Array.isArray(obj)) return obj[key];
  if (typeof obj === 'string') return obj.charAt(key);
  throw new Error('cannot index ' + toStr(obj));
}
function indexSet(obj, key, val) {
  if (isObj(obj)) { obj.set(key, val); return; }
  if (Array.isArray(obj)) { obj[key] = val; return; }
  throw new Error('cannot assign index of ' + toStr(obj));
}

// Interpret a canonical program.
//   opts.trace     collect a per-step trace (array of records)
//   opts.maxSteps  abort after this many instructions (0 = unlimited)
// Returns { output: string[], steps, returnValue, trace }.
// Only an explicit THROW is catchable; other runtime errors abort the VM.
function interpret(program, opts = {}) {
  const { functions: fns, consts } = program;
  const maxSteps = opts.maxSteps || 0;
  const output = [];
  const trace = opts.trace ? [] : null;
  const maps = fns.map(offsetMap);

  const stack = [];
  const frames = [];
  const handlers = []; // { fnIdx, frame, framesLen, stackLen, addr }
  let frame = { idx: 0, fn: fns[0], i: 0, locals: mkCells(fns[0].nlocals), upvals: [] };
  let steps = 0;

  function makeFrame(fnIdx, argc, upvals) {
    const callee = fns[fnIdx];
    const locals = mkCells(callee.nlocals);
    for (let k = argc - 1; k >= 0; k--) locals[k].v = stack.pop();
    frames.push(frame);
    return { idx: fnIdx, fn: callee, i: 0, locals, upvals: upvals || [] };
  }

  // Unwind to the nearest handler; returns false if the exception is uncaught.
  function raise(value) {
    while (handlers.length) {
      const h = handlers.pop();
      frames.length = h.framesLen;
      frame = h.frame;
      stack.length = h.stackLen;
      frame.i = maps[h.fnIdx][h.addr];
      stack.push(value);
      return true;
    }
    return false;
  }

  for (;;) {
    if (maxSteps && steps >= maxSteps) throw new Error('interp: step limit exceeded');
    const ins = frame.fn.instrs[frame.i];
    if (!ins) throw new Error('interp: ran off the end of function ' + frame.fn.name);
    const op = ins.op;
    const a = ins.args;
    if (trace) {
      trace.push({
        step: steps, fn: frame.fn.name, i: frame.i, op: OP_NAME[op],
        args: a.slice(), stack: stack.map(toStr), locals: frame.locals.map((c) => toStr(c.v)),
      });
    }
    frame.i++;
    steps++;

    switch (op) {
      case OP.HALT: return { output, steps, returnValue: undefined, trace };
      case OP.PUSH_CONST: stack.push(consts[a[0]]); break;
      case OP.PUSH_TRUE: stack.push(true); break;
      case OP.PUSH_FALSE: stack.push(false); break;
      case OP.PUSH_NULL: stack.push(null); break;
      case OP.POP: stack.pop(); break;
      case OP.DUP: stack.push(stack[stack.length - 1]); break;
      case OP.LOAD: stack.push(frame.locals[a[0]].v); break;
      case OP.STORE: frame.locals[a[0]].v = stack.pop(); break;
      case OP.LOAD_UP: stack.push(frame.upvals[a[0]].v); break;
      case OP.STORE_UP: frame.upvals[a[0]].v = stack.pop(); break;
      case OP.ADD: { const y = stack.pop(), x = stack.pop(); stack.push((typeof x === 'number' && typeof y === 'number') ? x + y : toStr(x) + toStr(y)); break; }
      case OP.SUB: { const y = stack.pop(), x = stack.pop(); stack.push(x - y); break; }
      case OP.MUL: { const y = stack.pop(), x = stack.pop(); stack.push(x * y); break; }
      case OP.DIV: { const y = stack.pop(), x = stack.pop(); stack.push(x / y); break; }
      case OP.MOD: { const y = stack.pop(), x = stack.pop(); stack.push(x % y); break; }
      case OP.NEG: stack.push(-stack.pop()); break;
      case OP.NOT: stack.push(!truthy(stack.pop())); break;
      case OP.EQ: { const y = stack.pop(), x = stack.pop(); stack.push(x === y); break; }
      case OP.NEQ: { const y = stack.pop(), x = stack.pop(); stack.push(x !== y); break; }
      case OP.LT: { const y = stack.pop(), x = stack.pop(); stack.push(x < y); break; }
      case OP.GT: { const y = stack.pop(), x = stack.pop(); stack.push(x > y); break; }
      case OP.LTE: { const y = stack.pop(), x = stack.pop(); stack.push(x <= y); break; }
      case OP.GTE: { const y = stack.pop(), x = stack.pop(); stack.push(x >= y); break; }
      case OP.BAND: { const y = stack.pop(), x = stack.pop(); stack.push(u32(x & y)); break; }
      case OP.BOR: { const y = stack.pop(), x = stack.pop(); stack.push(u32(x | y)); break; }
      case OP.BXOR: { const y = stack.pop(), x = stack.pop(); stack.push(u32(x ^ y)); break; }
      case OP.SHL: { const y = stack.pop(), x = stack.pop(); stack.push(u32(x << y)); break; }
      case OP.SHR: { const y = stack.pop(), x = stack.pop(); stack.push(u32(x >>> y)); break; }
      case OP.JMP: frame.i = maps[frame.idx][a[0]]; break;
      case OP.JZ: { const t = stack.pop(); if (!truthy(t)) frame.i = maps[frame.idx][a[0]]; break; }
      case OP.JNZ: { const t = stack.pop(); if (truthy(t)) frame.i = maps[frame.idx][a[0]]; break; }
      case OP.CALL: { const fnIdx = a[0], argc = a[1]; frame = makeFrame(fnIdx, argc, []); break; }
      case OP.CALL_VALUE: {
        const argc = a[0];
        const args = new Array(argc);
        for (let k = argc - 1; k >= 0; k--) args[k] = stack.pop();
        const callee = stack.pop();
        if (!isClosure(callee)) throw new Error('value is not callable: ' + toStr(callee));
        for (let k = 0; k < argc; k++) stack.push(args[k]);
        frame = makeFrame(callee.fn, argc, callee.upvals);
        break;
      }
      case OP.CLOSURE: {
        const cfn = fns[a[0]];
        const ups = cfn.upvals.map((d) => d.fromLocal ? frame.locals[d.index] : frame.upvals[d.index]);
        stack.push({ __closure: true, fn: a[0], upvals: ups });
        break;
      }
      case OP.RET: {
        const rv = stack.pop();
        if (frames.length === 0) return { output, steps, returnValue: rv, trace };
        frame = frames.pop();
        stack.push(rv);
        break;
      }
      case OP.CALL_HOST: {
        const nameIdx = a[0], argc = a[1];
        const args = new Array(argc);
        for (let j = argc - 1; j >= 0; j--) args[j] = stack.pop();
        stack.push(host(consts[nameIdx], args));
        break;
      }
      case OP.NEW_ARR: {
        const n = a[0], arr = new Array(n);
        for (let m = n - 1; m >= 0; m--) arr[m] = stack.pop();
        stack.push(arr);
        break;
      }
      case OP.NEW_OBJ: {
        const n = a[0], pairs = [];
        for (let m = 0; m < n; m++) { const v = stack.pop(); const k = stack.pop(); pairs.push([k, v]); }
        pairs.reverse();
        const obj = new VMObj();
        for (const [k, v] of pairs) obj.set(k, v);
        stack.push(obj);
        break;
      }
      case OP.ARR_GET: { const key = stack.pop(), obj = stack.pop(); stack.push(index(obj, key)); break; }
      case OP.ARR_SET: { const val = stack.pop(), key = stack.pop(), obj = stack.pop(); indexSet(obj, key, val); stack.push(val); break; }
      case OP.TRY: handlers.push({ fnIdx: frame.idx, frame, framesLen: frames.length, stackLen: stack.length, addr: a[0] }); break;
      case OP.END_TRY: handlers.pop(); break;
      case OP.THROW: {
        const value = stack.pop();
        if (!raise(value)) throw new Error('uncaught exception: ' + toStr(value));
        break;
      }
      case OP.PRINT: output.push(toStr(stack.pop())); break;
      default: throw new Error('interp: illegal opcode ' + op);
    }
  }
}

module.exports = { interpret, VMObj };
