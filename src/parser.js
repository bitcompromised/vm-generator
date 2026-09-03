'use strict';
// Recursive-descent parser with precedence climbing for binary operators.
// Produces a plain-object AST consumed by compiler.js.

const { lex } = require('./lexer');

// Binary operator precedence (higher binds tighter).
const BINPREC = {
  '||': 1, '&&': 2,
  '|': 3, '^': 4, '&': 5,
  '==': 6, '!=': 6,
  '<': 7, '>': 7, '<=': 7, '>=': 7,
  '<<': 8, '>>': 8,
  '+': 9, '-': 9,
  '*': 10, '/': 10, '%': 10,
};

function parse(src) {
  const toks = lex(src);
  let p = 0;

  const peek = () => toks[p];
  const next = () => toks[p++];
  const at = (type, value) => {
    const t = toks[p];
    return t.type === type && (value === undefined || t.value === value);
  };
  const eat = (type, value) => {
    const t = toks[p];
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new SyntaxError(`Expected ${value ?? type} but got '${t.value}' (${t.type}) at line ${t.line}`);
    }
    return next();
  };
  const eatOp = (v) => eat('op', v);
  const atOp = (v) => at('op', v);

  function parseProgram() {
    const body = [];
    while (!at('eof')) body.push(parseStatement());
    return { type: 'Program', body };
  }

  function parseBlock() {
    eatOp('{');
    const body = [];
    while (!atOp('}')) body.push(parseStatement());
    eatOp('}');
    return { type: 'Block', body };
  }

  // Map protection annotations to a per-function protection level:
  //   @native -> 0 (no bytecode encryption), @weak -> 1, @medium/@virtualize -> 2,
  //   @heavy -> 3. @virtualize <strength> uses the named strength.
  function protLevelFromAnnots(annots) {
    let level = 1; // default (weak)
    for (const a of annots) {
      const parts = a.split(/\s+/).filter(Boolean);
      const head = parts[0];
      if (head === 'native') level = 0;
      else if (head === 'weak') level = 1;
      else if (head === 'medium') level = 2;
      else if (head === 'heavy') level = 3;
      else if (head === 'virtualize') {
        const s = parts[1];
        level = s === 'weak' ? 1 : s === 'heavy' ? 3 : 2;
      }
    }
    return level;
  }

  function attachAnnots(stmt, annots) {
    if (!annots.length) return stmt;
    const level = protLevelFromAnnots(annots);
    if (stmt.type === 'FnDecl') stmt.protLevel = level;
    else if (stmt.type === 'Let' && stmt.value && stmt.value.type === 'FnExpr') stmt.value.protLevel = level;
    return stmt;
  }

  function parseStatement() {
    if (at('annot')) {
      const annots = [];
      while (at('annot')) annots.push(next().value);
      return attachAnnots(parseStatement(), annots);
    }
    const t = peek();
    if (t.type === 'let') return parseLet();
    if (t.type === 'fn') return parseFn();
    if (t.type === 'return') return parseReturn();
    if (t.type === 'if') return parseIf();
    if (t.type === 'while') return parseWhile();
    if (t.type === 'for') return parseFor();
    if (t.type === 'break') { eat('break'); eatOp(';'); return { type: 'Break' }; }
    if (t.type === 'continue') { eat('continue'); eatOp(';'); return { type: 'Continue' }; }
    if (t.type === 'try') return parseTry();
    if (t.type === 'throw') { eat('throw'); const value = parseExpr(); eatOp(';'); return { type: 'Throw', value }; }
    if (t.type === 'print') return parsePrint();
    if (atOp('{')) return parseBlock();

    const node = parseSimple();
    eatOp(';');
    return node;
  }

  // Compound-assignment operators lower to `target = target <op> rhs`.
  const ASSIGN_OPS = {
    '=': null, '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%',
    '&=': '&', '|=': '|', '^=': '^', '<<=': '<<', '>>=': '>>',
  };

  // Parse one "simple statement" (assignment, compound assignment,
  // increment/decrement, or a bare expression) WITHOUT consuming a terminator.
  // Shared by statements and by the init/update clauses of `for`.
  function parseSimple() {
    // prefix ++/--
    if (atOp('++') || atOp('--')) {
      const op = next().value === '++' ? '+' : '-';
      const target = parseExpr();
      return incDec(target, op);
    }
    const expr = parseExpr();
    const t = peek();
    if (t.type === 'op' && Object.prototype.hasOwnProperty.call(ASSIGN_OPS, t.value)) {
      const aop = next().value;
      const rhs = parseExpr();
      const value = aop === '='
        ? rhs
        : { type: 'Binary', op: ASSIGN_OPS[aop], left: expr, right: rhs };
      return { type: 'Assign', target: expr, value };
    }
    // postfix ++/--
    if (atOp('++') || atOp('--')) {
      const op = next().value === '++' ? '+' : '-';
      return incDec(expr, op);
    }
    return { type: 'ExprStmt', expr };
  }

  function incDec(target, op) {
    return {
      type: 'Assign',
      target,
      value: { type: 'Binary', op, left: target, right: { type: 'Num', value: 1 } },
    };
  }

  function parseTry() {
    eat('try');
    const block = parseBlock();
    let param = null;
    let handler = null;
    let finalizer = null;
    if (at('catch')) {
      eat('catch');
      if (atOp('(')) { eatOp('('); param = eat('ident').value; eatOp(')'); }
      handler = parseBlock();
    }
    if (at('finally')) { eat('finally'); finalizer = parseBlock(); }
    if (!handler && !finalizer) throw new SyntaxError('try must have a catch or finally');
    return { type: 'Try', block, param, handler, finalizer };
  }

  function parseFor() {
    eat('for');
    eatOp('(');
    let init = null;
    if (atOp(';')) { eatOp(';'); }
    else if (at('let')) { init = parseLet(); } // parseLet consumes its own ';'
    else { init = parseSimple(); eatOp(';'); }
    let test = null;
    if (!atOp(';')) test = parseExpr();
    eatOp(';');
    let update = null;
    if (!atOp(')')) update = parseSimple();
    eatOp(')');
    const body = parseBlock();
    return { type: 'For', init, test, update, body };
  }

  function parseLet() {
    eat('let');
    const name = eat('ident').value;
    eatOp('=');
    const value = parseExpr();
    eatOp(';');
    return { type: 'Let', name, value };
  }

  function parseFn() {
    eat('fn');
    const name = eat('ident').value;
    eatOp('(');
    const params = [];
    if (!atOp(')')) {
      params.push(eat('ident').value);
      while (atOp(',')) { eatOp(','); params.push(eat('ident').value); }
    }
    eatOp(')');
    const body = parseBlock();
    return { type: 'FnDecl', name, params, body };
  }

  // Anonymous / named function expression: fn [name] (params) { body }.
  function parseFnExpr() {
    eat('fn');
    let name = null;
    if (at('ident')) name = next().value; // optional name (self-reference)
    eatOp('(');
    const params = [];
    if (!atOp(')')) {
      params.push(eat('ident').value);
      while (atOp(',')) { eatOp(','); params.push(eat('ident').value); }
    }
    eatOp(')');
    const body = parseBlock();
    return { type: 'FnExpr', name, params, body };
  }

  function parseReturn() {
    eat('return');
    let value = null;
    if (!atOp(';')) value = parseExpr();
    eatOp(';');
    return { type: 'Return', value };
  }

  function parseIf() {
    eat('if');
    eatOp('(');
    const test = parseExpr();
    eatOp(')');
    const cons = parseBlock();
    let alt = null;
    if (at('else')) {
      eat('else');
      alt = at('if') ? parseIf() : parseBlock();
    }
    return { type: 'If', test, cons, alt };
  }

  function parseWhile() {
    eat('while');
    eatOp('(');
    const test = parseExpr();
    eatOp(')');
    const body = parseBlock();
    return { type: 'While', test, body };
  }

  function parsePrint() {
    eat('print');
    const value = parseExpr();
    eatOp(';');
    return { type: 'Print', value };
  }

  // ---- expressions ----
  // Grammar: expr -> ternary ; ternary -> binary ('?' expr ':' expr)? .
  function parseExpr() { return parseTernary(); }

  function parseTernary() {
    const cond = parseBinary(0);
    if (atOp('?')) {
      eatOp('?');
      const cons = parseExpr();        // then-branch may itself be a ternary
      eatOp(':');
      const alt = parseExpr();         // right-associative else-branch
      return { type: 'Ternary', test: cond, cons, alt };
    }
    return cond;
  }

  function parseBinary(minPrec) {
    let left = parseUnary();
    while (atOp() && BINPREC[peek().value] !== undefined && BINPREC[peek().value] >= minPrec) {
      const op = next().value;
      const prec = BINPREC[op];
      const right = parseBinary(prec + 1);
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  function parseUnary() {
    if (atOp('-') || atOp('!')) {
      const op = next().value;
      return { type: 'Unary', op, arg: parseUnary() };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    let node = parsePrimary();
    for (;;) {
      if (atOp('(')) {
        eatOp('(');
        const args = [];
        if (!atOp(')')) {
          args.push(parseExpr());
          while (atOp(',')) { eatOp(','); args.push(parseExpr()); }
        }
        eatOp(')');
        node = { type: 'Call', callee: node, args };
      } else if (atOp('[')) {
        eatOp('[');
        const index = parseExpr();
        eatOp(']');
        node = { type: 'Index', object: node, index };
      } else if (atOp('.')) {
        eatOp('.');
        const property = eat('ident').value;
        node = { type: 'Member', object: node, property };
      } else break;
    }
    return node;
  }

  function parsePrimary() {
    const t = peek();
    if (t.type === 'num') { next(); return { type: 'Num', value: t.value }; }
    if (t.type === 'str') { next(); return { type: 'Str', value: t.value }; }
    if (t.type === 'true') { next(); return { type: 'Bool', value: true }; }
    if (t.type === 'false') { next(); return { type: 'Bool', value: false }; }
    if (t.type === 'null') { next(); return { type: 'Null' }; }
    if (t.type === 'ident') { next(); return { type: 'Ident', name: t.value }; }
    if (atOp('(')) { eatOp('('); const e = parseExpr(); eatOp(')'); return e; }
    if (atOp('[')) {
      eatOp('[');
      const elements = [];
      if (!atOp(']')) {
        elements.push(parseExpr());
        while (atOp(',')) { eatOp(','); elements.push(parseExpr()); }
      }
      eatOp(']');
      return { type: 'Array', elements };
    }
    // object / map literal: { key: expr, "k2": expr, ... }
    if (atOp('{')) {
      eatOp('{');
      const props = [];
      while (!atOp('}')) {
        const kt = peek();
        let key;
        if (kt.type === 'str' || kt.type === 'ident') key = next().value;
        else if (kt.type === 'num') key = String(next().value);
        else throw new SyntaxError(`Expected property name but got '${kt.value}' at line ${kt.line}`);
        eatOp(':');
        props.push({ key, value: parseExpr() });
        if (atOp(',')) eatOp(','); else break;
      }
      eatOp('}');
      return { type: 'Object', props };
    }
    // anonymous function expression: fn (params) { body }  /  function (...) {...}
    if (t.type === 'fn') return parseFnExpr();
    throw new SyntaxError(`Unexpected token '${t.value}' (${t.type}) at line ${t.line}`);
  }

  return parseProgram();
}

module.exports = { parse };
