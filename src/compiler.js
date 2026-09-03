'use strict';
// Compile an AST into canonical bytecode:
//   { functions: [{ name, nparams, nlocals, instrs, upvals }], consts, entry, hostNames }
// Each function's `instrs` is a list of { op, args } where op is a CANONICAL
// opcode id (see opcodes.js) and args are already-resolved numeric operands.
// Jump operands are absolute byte offsets within that function's own stream.
//
// The compiler performs closure conversion: nested function expressions capture
// free variables from enclosing functions as UPVALUES. Each captured variable is
// described by { fromLocal, index } -- fromLocal means "the enclosing frame's
// local cell at `index`", otherwise "the enclosing frame's upvalue at `index`".
// At runtime a CLOSURE instruction wires these to shared cells so mutations are
// visible to every closure over the same variable, and the variable survives
// after the defining function returns.

const { OP, OP_OPERANDS } = require('./opcodes');
const { parse } = require('./parser');
const { optimize } = require('./optimize');
const { expandImports, hasImports } = require('./modules');

const HOST_BUILTINS = new Set(['len', 'str', 'num', 'floor', 'abs', 'rand', 'time', 'push', 'keys', 'has']);

function operandBytes(canonOp) {
  let n = 1;
  for (const kind of OP_OPERANDS[canonOp]) n += kind === 'u16' ? 2 : 1;
  return n;
}

class FnEmitter {
  constructor(name, params, compiler, parent) {
    this.name = name;
    this.nparams = params.length;
    this.instrs = [];
    this.compiler = compiler;
    this.parent = parent || null;
    // scope chain for block scoping; slot indices are per-function
    this.scopes = [new Map()];
    this.nextSlot = 0;
    // stack of { brk, cont } label pairs for break/continue inside loops
    this.loops = [];
    // upvalue descriptors captured from enclosing functions
    this.upvals = [];
    this.upvalMap = new Map();
    for (const pnam of params) this.declare(pnam);
  }
  pushScope() { this.scopes.push(new Map()); }
  popScope() { this.scopes.pop(); }
  declare(name) {
    const slot = this.nextSlot++;
    this.scopes[this.scopes.length - 1].set(name, slot);
    return slot;
  }
  resolveLocal(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      if (this.scopes[i].has(name)) return this.scopes[i].get(name);
    }
    return -1;
  }
  addUpval(fromLocal, index, name) {
    if (this.upvalMap.has(name)) return this.upvalMap.get(name);
    const u = this.upvals.length;
    this.upvals.push({ fromLocal, index, name });
    this.upvalMap.set(name, u);
    return u;
  }
  // Resolve a name captured from an enclosing function into an upvalue index,
  // creating upvalues along the whole parent chain as needed. Returns -1 if the
  // name is not an enclosing local/upvalue (i.e. it is global or undefined).
  resolveUpval(name) {
    if (!this.parent) return -1;
    const pl = this.parent.resolveLocal(name);
    if (pl >= 0) return this.addUpval(true, pl, name);
    const pu = this.parent.resolveUpval(name);
    if (pu >= 0) return this.addUpval(false, pu, name);
    return -1;
  }
  resolve(name) {
    const l = this.resolveLocal(name);
    if (l >= 0) return { kind: 'local', slot: l };
    const u = this.resolveUpval(name);
    if (u >= 0) return { kind: 'upval', index: u };
    return { kind: 'none' };
  }
  emit(op, ...args) { const idx = this.instrs.length; this.instrs.push({ op, args }); return idx; }
  label() { return { pos: -1 }; }
  mark(lbl) { lbl.pos = this.instrs.length; }
}

class Compiler {
  constructor() {
    this.consts = [];
    this.constKey = new Map();     // dedupe pool
    this.functions = [];           // finished function records (flat, global idx)
    this.fnIndex = new Map();      // top-level name -> index
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
    // Pre-pass: register top-level function declarations so calls can be forward
    // references. main is function 0.
    this.fnIndex.set('$main', 0);
    this.functions.push(null); // placeholder for main
    const topFns = [];
    const topStmts = [];
    for (const stmt of ast.body) {
      if (stmt.type === 'FnDecl') {
        if (this.fnIndex.has(stmt.name)) throw new Error(`Duplicate function '${stmt.name}'`);
        const idx = this.functions.length;
        this.fnIndex.set(stmt.name, idx);
        this.functions.push(null); // reserve
        topFns.push({ idx, stmt });
      } else {
        topStmts.push(stmt);
      }
    }

    // compile main
    const main = new FnEmitter('$main', [], this, null);
    for (const s of topStmts) this.compileStmt(main, s);
    main.emit(OP.HALT);
    this.functions[0] = this.finishFn(main);

    // compile each top-level function
    for (const { idx, stmt } of topFns) {
      const fe = new FnEmitter(stmt.name, stmt.params, this, null);
      fe.protLevel = stmt.protLevel; // selective-virtualization annotation (may be undefined)
      this.compileBlock(fe, stmt.body, /*ownScope*/ false);
      fe.emit(OP.PUSH_NULL); // implicit "return null" fallthrough
      fe.emit(OP.RET);
      this.functions[idx] = this.finishFn(fe);
    }

    return {
      functions: this.functions,
      consts: this.consts,
      entry: 0,
      hostNames: this.hostNames,
    };
  }

  // Compile a nested function expression, appending it to the flat function
  // table and emitting a CLOSURE in the parent that captures its upvalues.
  compileFnExpr(parentFe, node) {
    const idx = this.functions.length;
    this.functions.push(null); // reserve the slot before compiling the body
    const fe = new FnEmitter(node.name || '$anon', node.params, this, parentFe);
    fe.protLevel = node.protLevel; // selective-virtualization annotation (may be undefined)
    this.compileBlock(fe, node.body, /*ownScope*/ false);
    fe.emit(OP.PUSH_NULL);
    fe.emit(OP.RET);
    this.functions[idx] = this.finishFn(fe);
    parentFe.emit(OP.CLOSURE, idx);
  }

  // Resolve labels to absolute byte offsets and freeze the function.
  finishFn(fe) {
    const offsets = new Array(fe.instrs.length + 1);
    let off = 0;
    for (let i = 0; i < fe.instrs.length; i++) { offsets[i] = off; off += operandBytes(fe.instrs[i].op); }
    offsets[fe.instrs.length] = off;
    for (const ins of fe.instrs) {
      ins.args = ins.args.map((a) => (a && typeof a === 'object' && 'pos' in a) ? offsets[a.pos] : a);
    }
    return {
      name: fe.name, nparams: fe.nparams, nlocals: fe.nextSlot,
      instrs: fe.instrs, byteLen: off,
      upvals: fe.upvals.map((u) => ({ fromLocal: u.fromLocal, index: u.index })),
      protLevel: (fe.protLevel != null) ? fe.protLevel : 1, // default: weak (1 cipher round)
    };
  }

  compileBlock(fe, block, ownScope = true) {
    if (ownScope) fe.pushScope();
    for (const s of block.body) this.compileStmt(fe, s);
    if (ownScope) fe.popScope();
  }

  // Emit a store into a variable resolved as local or upvalue.
  emitStore(fe, name) {
    const r = fe.resolve(name);
    if (r.kind === 'local') fe.emit(OP.STORE, r.slot);
    else if (r.kind === 'upval') fe.emit(OP.STORE_UP, r.index);
    else throw new Error(`Assignment to undeclared variable '${name}'`);
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
          this.emitStore(fe, s.target.name);
        } else if (s.target.type === 'Index') {
          this.compileExpr(fe, s.target.object);
          this.compileExpr(fe, s.target.index);
          this.compileExpr(fe, s.value);
          fe.emit(OP.ARR_SET);
          fe.emit(OP.POP);
        } else if (s.target.type === 'Member') {
          this.compileExpr(fe, s.target.object);
          fe.emit(OP.PUSH_CONST, this.constId(s.target.property));
          this.compileExpr(fe, s.value);
          fe.emit(OP.ARR_SET);
          fe.emit(OP.POP);
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
      case 'Throw': {
        this.compileExpr(fe, s.value);
        fe.emit(OP.THROW);
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
        fe.loops.push({ brk: lEnd, cont: lTop }); // continue re-tests the loop
        this.compileBlock(fe, s.body);
        fe.loops.pop();
        fe.emit(OP.JMP, lTop);
        fe.mark(lEnd);
        break;
      }
      case 'For': {
        fe.pushScope();
        if (s.init) this.compileStmt(fe, s.init);
        const lTop = fe.label();
        const lCont = fe.label();
        const lEnd = fe.label();
        fe.mark(lTop);
        if (s.test) { this.compileExpr(fe, s.test); fe.emit(OP.JZ, lEnd); }
        fe.loops.push({ brk: lEnd, cont: lCont }); // continue runs the update
        this.compileBlock(fe, s.body);
        fe.loops.pop();
        fe.mark(lCont);
        if (s.update) this.compileStmt(fe, s.update);
        fe.emit(OP.JMP, lTop);
        fe.mark(lEnd);
        fe.popScope();
        break;
      }
      case 'Break': {
        if (fe.loops.length === 0) throw new Error('break outside of a loop');
        fe.emit(OP.JMP, fe.loops[fe.loops.length - 1].brk);
        break;
      }
      case 'Continue': {
        if (fe.loops.length === 0) throw new Error('continue outside of a loop');
        fe.emit(OP.JMP, fe.loops[fe.loops.length - 1].cont);
        break;
      }
      case 'Try': {
        this.compileTry(fe, s);
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
        throw new Error('Nested function declarations are not supported; use a function expression assigned to a let');
      default:
        throw new Error(`Unknown statement ${s.type}`);
    }
  }

  // try { B } [catch (e) { C }] [finally { F }]
  //
  //   TRY handler          ; install a catch handler at `handler`
  //     B
  //   END_TRY              ; body completed without throwing
  //     F                  ; normal-path finally
  //   JMP end
  // handler:               ; VM jumps here with the thrown value on the stack
  //     (catch)  STORE e / POP ; C ; F        -- exception handled, run finally
  //     (no catch, finally-only) STORE $exc ; F ; LOAD $exc ; THROW  -- re-raise
  // end:
  //
  // Known limitation: `finally` does not run if the catch body itself throws, or
  // on an early `return` inside the try body.
  compileTry(fe, s) {
    const handler = fe.label();
    const end = fe.label();
    fe.emit(OP.TRY, handler);
    this.compileBlock(fe, s.block);
    fe.emit(OP.END_TRY);
    if (s.finalizer) this.compileBlock(fe, s.finalizer); // normal-path finally
    fe.emit(OP.JMP, end);

    fe.mark(handler);
    fe.pushScope();
    if (s.handler) {
      if (s.param) { const slot = fe.declare(s.param); fe.emit(OP.STORE, slot); }
      else fe.emit(OP.POP);
      this.compileBlock(fe, s.handler, /*ownScope*/ false);
      if (s.finalizer) this.compileBlock(fe, s.finalizer); // caught-path finally
    } else {
      // finally-only: run the finalizer, then re-raise the caught value.
      const slot = fe.declare('$exc');
      fe.emit(OP.STORE, slot);
      this.compileBlock(fe, s.finalizer, /*ownScope*/ false);
      fe.emit(OP.LOAD, slot);
      fe.emit(OP.THROW);
    }
    fe.popScope();
    fe.mark(end);
  }

  compileExpr(fe, e) {
    switch (e.type) {
      case 'Num': fe.emit(OP.PUSH_CONST, this.constId(e.value)); break;
      case 'Str': fe.emit(OP.PUSH_CONST, this.constId(e.value)); break;
      case 'Bool': fe.emit(e.value ? OP.PUSH_TRUE : OP.PUSH_FALSE); break;
      case 'Null': fe.emit(OP.PUSH_NULL); break;
      case 'Ident': {
        const r = fe.resolve(e.name);
        if (r.kind === 'local') fe.emit(OP.LOAD, r.slot);
        else if (r.kind === 'upval') fe.emit(OP.LOAD_UP, r.index);
        else if (this.fnIndex.has(e.name)) fe.emit(OP.CLOSURE, this.fnIndex.get(e.name)); // fn as value
        else throw new Error(`Undefined variable '${e.name}'`);
        break;
      }
      case 'FnExpr': this.compileFnExpr(fe, e); break;
      case 'Array': {
        for (const el of e.elements) this.compileExpr(fe, el);
        fe.emit(OP.NEW_ARR, e.elements.length);
        break;
      }
      case 'Object': {
        for (const pr of e.props) {
          fe.emit(OP.PUSH_CONST, this.constId(pr.key));
          this.compileExpr(fe, pr.value);
        }
        fe.emit(OP.NEW_OBJ, e.props.length);
        break;
      }
      case 'Index': {
        this.compileExpr(fe, e.object);
        this.compileExpr(fe, e.index);
        fe.emit(OP.ARR_GET);
        break;
      }
      case 'Member': {
        this.compileExpr(fe, e.object);
        fe.emit(OP.PUSH_CONST, this.constId(e.property));
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
      case 'Ternary': {
        this.compileExpr(fe, e.test);
        const lElse = fe.label();
        const lEnd = fe.label();
        fe.emit(OP.JZ, lElse);
        this.compileExpr(fe, e.cons);
        fe.emit(OP.JMP, lEnd);
        fe.mark(lElse);
        this.compileExpr(fe, e.alt);
        fe.mark(lEnd);
        break;
      }
      case 'Call': this.compileCall(fe, e); break;
      default:
        throw new Error(`Unknown expression ${e.type}`);
    }
  }

  compileCall(fe, e) {
    const callee = e.callee;

    // console.log(...) -> PRINT (kept as a built-in convenience for .js input)
    if (callee.type === 'Member' && callee.object.type === 'Ident'
        && callee.object.name === 'console' && callee.property === 'log'
        && fe.resolve('console').kind === 'none') {
      this.compileConsoleLog(fe, e.args);
      fe.emit(OP.PUSH_NULL);
      return;
    }

    // method call obj.m(args) -> load the property as the callee value, CALL_VALUE
    if (callee.type === 'Member') {
      this.compileExpr(fe, callee.object);
      fe.emit(OP.PUSH_CONST, this.constId(callee.property));
      fe.emit(OP.ARR_GET);
      for (const a of e.args) this.compileExpr(fe, a);
      fe.emit(OP.CALL_VALUE, e.args.length);
      return;
    }

    if (callee.type === 'Ident') {
      const name = callee.name;
      const r = fe.resolve(name);
      if (r.kind === 'local' || r.kind === 'upval') {
        // a variable holding a closure value
        this.compileExpr(fe, callee);
        for (const a of e.args) this.compileExpr(fe, a);
        fe.emit(OP.CALL_VALUE, e.args.length);
        return;
      }
      if (this.fnIndex.has(name)) {
        for (const a of e.args) this.compileExpr(fe, a);
        fe.emit(OP.CALL, this.fnIndex.get(name), e.args.length);
        return;
      }
      if (HOST_BUILTINS.has(name)) {
        for (const a of e.args) this.compileExpr(fe, a);
        fe.emit(OP.CALL_HOST, this.hostId(name), e.args.length);
        return;
      }
      throw new Error(`Call to unknown function '${name}'`);
    }

    // callee is an arbitrary expression, e.g. (fn(){...})() or arr[i]()
    this.compileExpr(fe, callee);
    for (const a of e.args) this.compileExpr(fe, a);
    fe.emit(OP.CALL_VALUE, e.args.length);
  }

  compileConsoleLog(fe, args) {
    if (args.length === 0) {
      fe.emit(OP.PUSH_CONST, this.constId(''));
      fe.emit(OP.PRINT);
      return;
    }
    this.compileExpr(fe, args[0]);
    for (let i = 1; i < args.length; i++) {
      fe.emit(OP.PUSH_CONST, this.constId(' '));
      fe.emit(OP.ADD);
      this.compileExpr(fe, args[i]);
      fe.emit(OP.ADD);
    }
    fe.emit(OP.PRINT);
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

function compile(src, opts = {}) {
  // resolve `import "..."` modules before lexing (a no-op when there are none)
  if (opts.resolveImport || hasImports(src)) src = expandImports(src, opts.resolveImport);
  let ast = parse(src);
  if (opts.optimize) ast = optimize(ast); // behavior-preserving AST optimization
  return new Compiler().compileProgram(ast);
}

module.exports = { compile, HOST_BUILTINS };
