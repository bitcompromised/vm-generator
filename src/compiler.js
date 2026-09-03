'use strict';
// Compile an AST into canonical bytecode:
//   { functions: [{ name, nparams, nlocals, instrs }], consts, entry, hostNames }
// Each function's `instrs` is a list of { op, args } where op is a CANONICAL
// opcode id (see opcodes.js) and args are already-resolved numeric operands.
// Jump operands are absolute byte offsets within that function's own stream.

const { OP, OP_OPERANDS } = require('./opcodes');
const { parse } = require('./parser');

const HOST_BUILTINS = new Set(['len', 'str', 'num', 'floor', 'abs', 'rand', 'time', 'push']);

function operandBytes(canonOp) {
  let n = 1;
  for (const kind of OP_OPERANDS[canonOp]) n += kind === 'u16' ? 2 : 1;
  return n;
}

class FnEmitter {
  constructor(name, params, compiler) {
    this.name = name;
    this.nparams = params.length;
    this.instrs = [];
    this.compiler = compiler;
    // scope chain for block scoping; slot indices are per-function
    this.scopes = [new Map()];
    this.nextSlot = 0;
    for (const pnam of params) this.declare(pnam);
  }
  pushScope() { this.scopes.push(new Map()); }
  popScope() { this.scopes.pop(); }
  declare(name) {
    const slot = this.nextSlot++;
    this.scopes[this.scopes.length - 1].set(name, slot);
    return slot;
  }
  resolve(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) return this.scopes[i].get(name);
    }
    return -1;
  }
  emit(op, ...args) { const idx = this.instrs.length; this.instrs.push({ op, args }); return idx; }
  label() { return { pos: -1 }; }
  mark(lbl) { lbl.pos = this.instrs.length; }
}

class Compiler {
  constructor() {
    this.consts = [];
    this.constKey = new Map();     // dedupe pool
    this.functions = [];           // FnEmitter list
    this.fnIndex = new Map();      // name -> index
    this.hostNames = [];           // ordered list of host builtin names actually used
    this.hostIndex = new Map();
  }

  constId(value) {
    const key = (typeof value) + ':' + String(value);
    if (this.constKey.has(key)) return this.constKey.get(key);
    const id = this.consts.length;
    this.consts.push(value);
    this.constKey.set(key, id);
    return id;
  }
  hostId(name) {
    if (this.hostIndex.has(name)) return this.hostIndex.get(name);
    const id = this.constId(name); // host name lives in the const pool
    this.hostIndex.set(name, id);
    this.hostNames.push(name);
    return id;
  }

  compileProgram(ast) {
    // Pre-pass: register function declarations so calls can be forward references.
    const topStmts = [];
    // main is function 0
    this.fnIndex.set('$main', 0);
    this.functions.push(null); // placeholder for main
    for (const stmt of ast.body) {
      if (stmt.type === 'FnDecl') {
        if (this.fnIndex.has(stmt.name)) throw new Error(`Duplicate function '${stmt.name}'`);
        this.fnIndex.set(stmt.name, this.functions.length);
        this.functions.push({ __decl: stmt });
      } else {
        topStmts.push(stmt);
      }
    }

    // compile main
    const main = new FnEmitter('$main', [], this);
    for (const s of topStmts) this.compileStmt(main, s);
    main.emit(OP.HALT);
    this.functions[0] = this.finishFn(main);

    // compile user functions
    for (let i = 1; i < this.functions.length; i++) {
      const decl = this.functions[i].__decl;
      const fe = new FnEmitter(decl.name, decl.params, this);
      this.compileBlock(fe, decl.body, /*ownScope*/ false);
      // implicit "return null" fallthrough
      fe.emit(OP.PUSH_NULL);
      fe.emit(OP.RET);
      this.functions[i] = this.finishFn(fe);
    }

    return {
      functions: this.functions,
      consts: this.consts,
      entry: 0,
      hostNames: this.hostNames,
    };
  }

  // Resolve labels to absolute byte offsets and freeze the function.
  finishFn(fe) {
    // compute byte offset of each instruction
    const offsets = new Array(fe.instrs.length + 1);
    let off = 0;
    for (let i = 0; i < fe.instrs.length; i++) { offsets[i] = off; off += operandBytes(fe.instrs[i].op); }
    offsets[fe.instrs.length] = off;
    // resolve label args
    for (const ins of fe.instrs) {
      ins.args = ins.args.map((a) => (a && typeof a === 'object' && 'pos' in a) ? offsets[a.pos] : a);
    }
    return { name: fe.name, nparams: fe.nparams, nlocals: fe.nextSlot, instrs: fe.instrs, byteLen: off };
  }

  compileBlock(fe, block, ownScope = true) {
    if (ownScope) fe.pushScope();
    for (const s of block.body) this.compileStmt(fe, s);
    if (ownScope) fe.popScope();
  }

  compileStmt(fe, s) {
    switch (s.type) {
      case 'Let': {
        this.compileExpr(fe, s.value);
        const slot = fe.declare(s.name);
        fe.emit(OP.STORE, slot);
        break;
      }
      case 'Assign': {
        if (s.target.type === 'Ident') {
          this.compileExpr(fe, s.value);
          const slot = fe.resolve(s.target.name);
          if (slot < 0) throw new Error(`Assignment to undeclared variable '${s.target.name}'`);
          fe.emit(OP.STORE, slot);
        } else if (s.target.type === 'Index') {
          // arr[idx] = value ; ARR_SET expects stack: arr, idx, value
          this.compileExpr(fe, s.target.object);
          this.compileExpr(fe, s.target.index);
          this.compileExpr(fe, s.value);
          fe.emit(OP.ARR_SET);
          fe.emit(OP.POP); // discard the value left by ARR_SET (statement context)
        } else {
          throw new Error('Invalid assignment target');
        }
        break;
      }
      case 'Print': {
        this.compileExpr(fe, s.value);
        fe.emit(OP.PRINT);
        break;
      }
      case 'Return': {
        if (s.value) this.compileExpr(fe, s.value);
        else fe.emit(OP.PUSH_NULL);
        fe.emit(OP.RET);
        break;
      }
      case 'If': {
        this.compileExpr(fe, s.test);
        const lElse = fe.label();
        fe.emit(OP.JZ, lElse);
        this.compileBlock(fe, s.cons);
        if (s.alt) {
          const lEnd = fe.label();
          fe.emit(OP.JMP, lEnd);
          fe.mark(lElse);
          if (s.alt.type === 'If') this.compileStmt(fe, s.alt);
          else this.compileBlock(fe, s.alt);
          fe.mark(lEnd);
        } else {
          fe.mark(lElse);
        }
        break;
      }
      case 'While': {
        const lTop = fe.label();
        const lEnd = fe.label();
        fe.mark(lTop);
        this.compileExpr(fe, s.test);
        fe.emit(OP.JZ, lEnd);
        this.compileBlock(fe, s.body);
        fe.emit(OP.JMP, lTop);
        fe.mark(lEnd);
        break;
      }
      case 'Block': {
        this.compileBlock(fe, s);
        break;
      }
      case 'ExprStmt': {
        this.compileExpr(fe, s.expr);
        fe.emit(OP.POP); // discard result
        break;
      }
      case 'FnDecl':
        throw new Error('Nested functions are not supported');
      default:
        throw new Error(`Unknown statement ${s.type}`);
    }
  }

  compileExpr(fe, e) {
    switch (e.type) {
      case 'Num': fe.emit(OP.PUSH_CONST, this.constId(e.value)); break;
      case 'Str': fe.emit(OP.PUSH_CONST, this.constId(e.value)); break;
      case 'Bool': fe.emit(e.value ? OP.PUSH_TRUE : OP.PUSH_FALSE); break;
      case 'Null': fe.emit(OP.PUSH_NULL); break;
      case 'Ident': {
        const slot = fe.resolve(e.name);
        if (slot < 0) throw new Error(`Undefined variable '${e.name}'`);
        fe.emit(OP.LOAD, slot);
        break;
      }
      case 'Array': {
        for (const el of e.elements) this.compileExpr(fe, el);
        fe.emit(OP.NEW_ARR, e.elements.length);
        break;
      }
      case 'Index': {
        this.compileExpr(fe, e.object);
        this.compileExpr(fe, e.index);
        fe.emit(OP.ARR_GET);
        break;
      }
      case 'Unary': {
        this.compileExpr(fe, e.arg);
        fe.emit(e.op === '-' ? OP.NEG : OP.NOT);
        break;
      }
      case 'Binary': {
        if (e.op === '&&' || e.op === '||') { this.compileLogical(fe, e); break; }
        this.compileExpr(fe, e.left);
        this.compileExpr(fe, e.right);
        fe.emit(this.binOp(e.op));
        break;
      }
      case 'Call': {
        if (e.callee.type !== 'Ident') throw new Error('Only named calls are supported');
        const name = e.callee.name;
        for (const a of e.args) this.compileExpr(fe, a);
        if (this.fnIndex.has(name)) {
          fe.emit(OP.CALL, this.fnIndex.get(name), e.args.length);
        } else if (HOST_BUILTINS.has(name)) {
          fe.emit(OP.CALL_HOST, this.hostId(name), e.args.length);
        } else {
          throw new Error(`Call to unknown function '${name}'`);
        }
        break;
      }
      default:
        throw new Error(`Unknown expression ${e.type}`);
    }
  }

  compileLogical(fe, e) {
    const done = fe.label();
    const shortLbl = fe.label();
    if (e.op === '&&') {
      this.compileExpr(fe, e.left);
      fe.emit(OP.JZ, shortLbl);
      this.compileExpr(fe, e.right);
      fe.emit(OP.JZ, shortLbl);
      fe.emit(OP.PUSH_TRUE);
      fe.emit(OP.JMP, done);
      fe.mark(shortLbl);
      fe.emit(OP.PUSH_FALSE);
      fe.mark(done);
    } else { // ||
      this.compileExpr(fe, e.left);
      fe.emit(OP.JNZ, shortLbl);
      this.compileExpr(fe, e.right);
      fe.emit(OP.JNZ, shortLbl);
      fe.emit(OP.PUSH_FALSE);
      fe.emit(OP.JMP, done);
      fe.mark(shortLbl);
      fe.emit(OP.PUSH_TRUE);
      fe.mark(done);
    }
  }

  binOp(op) {
    switch (op) {
      case '+': return OP.ADD; case '-': return OP.SUB; case '*': return OP.MUL;
      case '/': return OP.DIV; case '%': return OP.MOD;
      case '==': return OP.EQ; case '!=': return OP.NEQ;
      case '<': return OP.LT; case '>': return OP.GT; case '<=': return OP.LTE; case '>=': return OP.GTE;
      case '&': return OP.BAND; case '|': return OP.BOR; case '^': return OP.BXOR;
      case '<<': return OP.SHL; case '>>': return OP.SHR;
      default: throw new Error(`Unknown binary operator ${op}`);
    }
  }
}

function compile(src) {
  const ast = parse(src);
  return new Compiler().compileProgram(ast);
}

module.exports = { compile, HOST_BUILTINS };
