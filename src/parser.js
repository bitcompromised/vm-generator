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

  function parseStatement() {
    const t = peek();
    if (t.type === 'let') return parseLet();
    if (t.type === 'fn') return parseFn();
    if (t.type === 'return') return parseReturn();
    if (t.type === 'if') return parseIf();
    if (t.type === 'while') return parseWhile();
    if (t.type === 'print') return parsePrint();
    if (atOp('{')) return parseBlock();

    // assignment or expression statement
    const expr = parseExpr();
    if (atOp('=')) {
      eatOp('=');
      const value = parseExpr();
      eatOp(';');
      return { type: 'Assign', target: expr, value };
    }
    if (atOp('[')) {
      // was handled inside parseExpr as index; fallthrough
    }
    eatOp(';');
    return { type: 'ExprStmt', expr };
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
  function parseExpr(minPrec = 0) {
    let left = parseUnary();
    while (atOp() && BINPREC[peek().value] !== undefined && BINPREC[peek().value] >= minPrec) {
      const op = next().value;
      const prec = BINPREC[op];
      const right = parseExpr(prec + 1);
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
    throw new SyntaxError(`Unexpected token '${t.value}' (${t.type}) at line ${t.line}`);
  }

  return parseProgram();
}

module.exports = { parse };
