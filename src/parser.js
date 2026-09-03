'use strict';
// Recursive-descent parser with precedence climbing for binary operators.
// Produces a plain-object AST consumed by compiler.js.

const { lex } = require('./lexer');

// Binary operator precedence (higher binds tighter).
const BINPREC = {
  '??': 1,
  '||': 1, '&&': 2,
  '|': 3, '^': 4, '&': 5,
  '===': 6, '!==': 6, '==': 6, '!=': 6,
  '<': 7, '>': 7, '<=': 7, '>=': 7, 'instanceof': 7, 'in': 7,
  '<<': 8, '>>': 8,
  '+': 9, '-': 9,
  '*': 10, '/': 10, '%': 10,
  '**': 11,
};

// Keyword tokens that act as binary operators (their token .type equals the
// operator text, not 'op').
const KEYWORD_BINOPS = new Set(['instanceof', 'in']);

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

  // Accept an identifier OR any keyword-typed token as a plain name. Lets code
  // use words like `fn`, `get`, `of`, `value`, `class` in binding / property /
  // member positions (real JavaScript allows most of these there).
  const atName = () => {
    const t = toks[p];
    return t.type === 'ident' || (typeof t.value === 'string' && /^[A-Za-z_$]/.test(t.value) && t.type !== 'str' && t.type !== 'num');
  };
  const eatName = () => {
    const t = toks[p];
    if (!atName()) throw new SyntaxError(`Expected name but got '${t.value}' (${t.type}) at line ${t.line}`);
    return next().value;
  };
  // Current token's binary-operator text, or null. Handles both 'op' tokens and
  // keyword operators (instanceof / in).
  const curBinOp = () => {
    const t = toks[p];
    if (t.type === 'op' && BINPREC[t.value] !== undefined) return t.value;
    if (KEYWORD_BINOPS.has(t.type)) return t.type;
    return null;
  };

  // `fn` is both the `function` alias AND a legal identifier in .js input (many
  // files use a variable literally named `fn`). Treat the token at the cursor as
  // the function keyword only when it actually introduces a function.
  function fnIsFunctionExpr() {
    const n1 = toks[p + 1];
    if (!n1) return false;
    if (n1.type === 'op' && n1.value === '*') return true;          // fn* generator
    if (n1.type !== 'op' && n1.type !== 'str' && n1.type !== 'num'
        && typeof n1.value === 'string' && /^[A-Za-z_$]/.test(n1.value)) return true; // named
    if (n1.type === 'op' && n1.value === '(') {                     // anonymous: fn (..) {
      let depth = 0;
      for (let j = p + 1; j < toks.length; j++) {
        const t = toks[j];
        if (t.type === 'op' && t.value === '(') depth++;
        else if (t.type === 'op' && t.value === ')') { depth--; if (depth === 0) { const nx = toks[j + 1]; return nx && nx.type === 'op' && nx.value === '{'; } }
        else if (t.type === 'eof') return false;
      }
    }
    return false;
  }

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
    if (t.type === 'fn' && fnIsFunctionExpr()) return parseFn();
    // 'async function' as a top-level declaration
    if (t.type === 'async' && toks[p+1] && toks[p+1].type === 'fn') return parseFn();
    if (t.type === 'class') return parseClass(false);
    if (t.type === 'import') return parseImport();
    if (t.type === 'export') { // `export [default] <decl>` -> just the declaration
      eat('export'); if (at('ident', 'default')) next();
      if (atOp('{')) { // export { a, b } [from '...']; -> no-op binding list
        eatOp('{'); while (!atOp('}')) { eatName(); if (at('ident', 'as')) { next(); eatName(); } if (atOp(',')) eatOp(','); else break; } eatOp('}');
        if (at('ident', 'from')) { next(); if (at('str')) next(); }
        if (atOp(';')) eatOp(';');
        return { type: 'Seq', body: [] };
      }
      return parseStatement();
    }
    if (t.type === 'return') return parseReturn();
    if (t.type === 'if') return parseIf();
    if (t.type === 'while') return parseWhile();
    if (t.type === 'for') return parseFor();
    if (t.type === 'break') { eat('break'); if (atOp(';')) eatOp(';'); return { type: 'Break' }; }
    if (t.type === 'continue') { eat('continue'); if (atOp(';')) eatOp(';'); return { type: 'Continue' }; }
    if (t.type === 'try') return parseTry();
    if (t.type === 'throw') { eat('throw'); const value = parseExpr(); if (atOp(';')) eatOp(';'); return { type: 'Throw', value }; }
    if (t.type === 'print') return parsePrint();
    if (atOp('{')) return parseBlock();

    const node = parseSimple();
    // semicolons are often optional; accept one if present, otherwise allow
    // statement termination before closing braces or control keywords.
    if (atOp(';')) eatOp(';');
    else if (!(atOp('}') || at('else') || at('catch') || at('finally') || at('eof'))) {
      // require a semicolon in other contexts
      eatOp(';');
    }
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

  // ---- destructuring & parameters ----
  let tmpCounter = 0;
  const freshTmp = () => `__d${tmpCounter++}`;

  // Parse a `{...}` / `[...]` binding pattern. Returns a Pattern descriptor that
  // `destructure()` desugars into plain Let/Assign statements against a source.
  function parsePattern() {
    if (atOp('{')) {
      eatOp('{');
      const props = []; let rest = null;
      while (!atOp('}')) {
        if (atOp('...')) { eatOp('...'); rest = eatName(); break; }
        let computed = false, key;
        if (atOp('[')) { computed = true; eatOp('['); key = parseExpr(); eatOp(']'); }
        else key = eatName();
        let target;
        if (atOp(':')) { eatOp(':'); target = parseBindingTarget(); }
        else target = key; // shorthand { a } -> a = src.a
        let def = null;
        if (atOp('=')) { eatOp('='); def = parseExpr(); }
        props.push({ key, computed, target, def });
        if (atOp(',')) eatOp(','); else break;
      }
      eatOp('}');
      return { kind: 'obj', props, rest };
    }
    eatOp('[');
    const elements = []; let rest = null;
    while (!atOp(']')) {
      if (atOp(',')) { elements.push(null); eatOp(','); continue; } // elision / hole
      if (atOp('...')) { eatOp('...'); rest = parseBindingTarget(); break; }
      const target = parseBindingTarget();
      let def = null;
      if (atOp('=')) { eatOp('='); def = parseExpr(); }
      elements.push({ target, def });
      if (atOp(',')) eatOp(','); else break;
    }
    eatOp(']');
    return { kind: 'arr', elements, rest };
  }

  function parseBindingTarget() {
    if (atOp('{') || atOp('[')) return parsePattern();
    return eatName();
  }

  // `undefined ? default : access`  (VM treats a missing property as null).
  function withDefault(access, def) {
    return {
      type: 'Ternary',
      test: { type: 'Binary', op: '===', left: access, right: { type: 'Ident', name: 'undefined' } },
      cons: def, alt: access,
    };
  }

  // Desugar `pattern = srcExpr` into a list of Let statements appended to `out`.
  function destructure(pattern, srcExpr, out) {
    if (pattern.kind === 'obj') {
      for (const pr of pattern.props) {
        const access = pr.computed
          ? { type: 'Index', object: srcExpr, index: pr.key }
          : { type: 'Member', object: srcExpr, property: pr.key };
        bindTarget(pr.target, pr.def ? withDefault(access, pr.def) : access, out);
      }
      if (pattern.rest) out.push({ type: 'Let', name: pattern.rest, value: srcExpr }); // best-effort
    } else {
      let i = 0;
      for (const el of pattern.elements) {
        const idx = i++;
        if (!el) continue; // hole
        const access = { type: 'Index', object: srcExpr, index: { type: 'Num', value: idx } };
        bindTarget(el.target, el.def ? withDefault(access, el.def) : access, out);
      }
      if (pattern.rest) bindTarget(pattern.rest, srcExpr, out); // best-effort
    }
  }

  function bindTarget(target, valExpr, out) {
    if (typeof target === 'string') { out.push({ type: 'Let', name: target, value: valExpr }); return; }
    const t = freshTmp();
    out.push({ type: 'Let', name: t, value: valExpr });
    destructure(target, { type: 'Ident', name: t }, out);
  }

  // Parse a parameter list. Destructuring / default / rest params are normalised
  // into a plain name list plus a `prologue` of statements prepended to the body.
  function parseParamList() {
    eatOp('(');
    const names = []; const prologue = []; let k = 0;
    while (!atOp(')')) {
      if (atOp('...')) { eatOp('...'); names.push(eatName()); break; } // rest: best-effort single
      if (atOp('{') || atOp('[')) {
        const pattern = parsePattern();
        const syn = `__arg${k++}`; names.push(syn);
        if (atOp('=')) { eatOp('='); parseExpr(); } // default on a destructured param: ignored
        destructure(pattern, { type: 'Ident', name: syn }, prologue);
      } else {
        const n = eatName(); names.push(n);
        if (atOp('=')) {
          eatOp('='); const def = parseExpr();
          prologue.push({ type: 'Assign', target: { type: 'Ident', name: n }, value: withDefault({ type: 'Ident', name: n }, def) });
        }
      }
      if (atOp(',')) eatOp(','); else break;
    }
    eatOp(')');
    return { names, prologue };
  }

  function withPrologue(prologue, block) {
    return prologue.length ? { type: 'Block', body: [...prologue, ...block.body] } : block;
  }

  // ---- classes ----
  // Desugared to an Object value carrying the constructor, method table and a
  // link to the superclass; `new` and method dispatch consult that at runtime.
  function parseClassBody() {
    eatOp('{');
    const members = [];
    while (!atOp('}')) {
      if (atOp(';')) { eatOp(';'); continue; }
      let isStatic = false, isAsync = false, isGen = false, kind = 'method';
      if (at('ident', 'static') && !nextIsMemberEnd()) { next(); isStatic = true; }
      if (at('async') && !nextIsMemberEnd()) { next(); isAsync = true; }
      if (atOp('*')) { eatOp('*'); isGen = true; }
      if ((at('ident', 'get') || at('ident', 'set')) && !nextIsMemberEnd()) { kind = next().value; }
      let computed = false, key;
      if (atOp('[')) { computed = true; eatOp('['); key = parseExpr(); eatOp(']'); }
      else key = eatName();
      const { names, prologue } = parseParamList();
      const block = parseBlock();
      members.push({ kind, static: isStatic, computed, key, value: { type: 'FnExpr', name: null, params: names, body: withPrologue(prologue, block), async: isAsync, generator: isGen } });
    }
    eatOp('}');
    return members;
  }
  // A method modifier word (static/async/get/set) is a real member name when the
  // next token is '(' or '=' or the member terminator.
  function nextIsMemberEnd() {
    const n = toks[p + 1];
    return n && n.type === 'op' && (n.value === '(' || n.value === '=' || n.value === ';' || n.value === '}');
  }

  function parseClass(asExpr) {
    eat('class');
    let name = null;
    if (atName() && !at('extends') && !atOp('{')) name = eatName();
    let superClass = null;
    if (at('extends')) { eat('extends'); superClass = parseUnary(); }
    const members = parseClassBody();
    return { type: 'Class', name, superClass, members, expr: !!asExpr };
  }

  // ---- modules ----
  function parseImport() {
    eat('import');
    // Bare side-effect import `import "mod";` is the province of the compile-time
    // .vgs module expander (src/modules.js); if one reaches the parser it was not
    // expanded (no resolver), so reject it rather than silently dropping code.
    if (at('str')) { const src = peek().value; throw new SyntaxError(`import "${src}" requires a module resolver`); }
    const out = [];
    let defaultName = null; const named = [];
    if (atName()) defaultName = eatName();
    if (atOp(',')) eatOp(',');
    if (atOp('*')) { eatOp('*'); if (at('ident', 'as')) next(); const ns = eatName(); named.push({ imported: null, local: ns, ns: true }); }
    else if (atOp('{')) {
      eatOp('{');
      while (!atOp('}')) {
        const imported = eatName(); let local = imported;
        if (at('ident', 'as')) { next(); local = eatName(); }
        named.push({ imported, local });
        if (atOp(',')) eatOp(','); else break;
      }
      eatOp('}');
    }
    if (at('ident', 'from')) next();
    const src = at('str') ? next().value : '';
    if (atOp(';')) eatOp(';');
    const tmp = freshTmp();
    out.push({ type: 'Let', name: tmp, value: requireCall(src) });
    if (defaultName) out.push({ type: 'Let', name: defaultName, value: { type: 'Ident', name: tmp } });
    for (const n of named) {
      out.push({ type: 'Let', name: n.local, value: n.ns ? { type: 'Ident', name: tmp } : { type: 'Member', object: { type: 'Ident', name: tmp }, property: n.imported } });
    }
    return { type: 'Seq', body: out };
  }
  function requireCall(src) {
    return { type: 'Call', callee: { type: 'Ident', name: 'require' }, args: [{ type: 'Str', value: src }] };
  }

  function parseTry() {
    eat('try');
    const block = parseBlock();
    let param = null;
    let handler = null;
    let finalizer = null;
    if (at('catch')) {
      eat('catch');
      if (atOp('(')) {
        eatOp('(');
        if (atOp('{') || atOp('[')) {
          // destructured catch binding: bind to a temp, destructure in-handler
          const pattern = parsePattern(); const tmp = freshTmp(); param = tmp; eatOp(')');
          const block = parseBlock();
          const pro = []; destructure(pattern, { type: 'Ident', name: tmp }, pro);
          handler = { type: 'Block', body: [...pro, ...block.body] };
        } else { param = eatName(); eatOp(')'); handler = parseBlock(); }
      } else { handler = parseBlock(); }
    }
    if (at('finally')) { eat('finally'); finalizer = parseBlock(); }
    if (!handler && !finalizer) throw new SyntaxError('try must have a catch or finally');
    return { type: 'Try', block, param, handler, finalizer };
  }

  function parseFor() {
    eat('for');
    if (at('await')) next(); // for await (...) -> treat as for-of
    eatOp('(');
    // for-of / for-in: `for ([let|const] <target> of|in <expr>) body`
    const save = p;
    let isDecl = false;
    if (at('let')) { isDecl = true; }
    // lookahead for `of`/`in` after the loop variable/pattern
    if (looksLikeForInOf()) {
      if (isDecl) eat('let');
      const target = (atOp('{') || atOp('[')) ? parsePattern() : eatName();
      const kind = at('ident', 'of') ? 'of' : (at('in') ? 'in' : null);
      next(); // consume of/in
      const iter = parseExpr();
      eatOp(')');
      const body = parseBlock();
      // Desugar to an index loop over a snapshot of the iterable. `len`/index
      // access cover arrays and strings; `for-in` yields keys via `keys()`.
      const s = freshTmp(), i = freshTmp();
      const source = kind === 'in'
        ? { type: 'Call', callee: { type: 'Ident', name: 'keys' }, args: [iter] }
        : iter;
      const elem = { type: 'Index', object: { type: 'Ident', name: s }, index: { type: 'Ident', name: i } };
      const bindings = [];
      if (typeof target === 'string') bindings.push({ type: 'Let', name: target, value: elem });
      else destructure(target, elem, bindings);
      const forNode = {
        type: 'For',
        init: { type: 'Let', name: i, value: { type: 'Num', value: 0 } },
        test: { type: 'Binary', op: '<', left: { type: 'Ident', name: i }, right: { type: 'Call', callee: { type: 'Ident', name: 'len' }, args: [{ type: 'Ident', name: s }] } },
        update: { type: 'Assign', target: { type: 'Ident', name: i }, value: { type: 'Binary', op: '+', left: { type: 'Ident', name: i }, right: { type: 'Num', value: 1 } } },
        body: { type: 'Block', body: [...bindings, ...body.body] },
      };
      return { type: 'Block', body: [{ type: 'Let', name: s, value: source }, forNode] };
    }
    p = save;
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

  // Scan the head of a for(...) to decide if it is a for-of / for-in.
  function looksLikeForInOf() {
    let j = p; if (toks[j] && toks[j].type === 'let') j++;
    let depth = 0;
    for (; j < toks.length; j++) {
      const t = toks[j];
      if (t.type === 'op' && (t.value === '(' || t.value === '[' || t.value === '{')) depth++;
      else if (t.type === 'op' && (t.value === ')' || t.value === ']' || t.value === '}')) { if (depth === 0) return false; depth--; }
      else if (depth === 0 && t.type === 'op' && t.value === ';') return false;
      else if (depth === 0 && ((t.type === 'ident' && t.value === 'of') || t.type === 'in')) return true;
      else if (t.type === 'eof') return false;
    }
    return false;
  }

  function parseLet() {
    eat('let');
    // destructuring declaration: let {a,b} = e; / let [a,,c] = e;
    if (atOp('{') || atOp('[')) {
      const pattern = parsePattern();
      eatOp('=');
      const value = parseExpr();
      if (atOp(';')) eatOp(';');
      const out = []; const t = freshTmp();
      out.push({ type: 'Let', name: t, value });
      destructure(pattern, { type: 'Ident', name: t }, out);
      return { type: 'Seq', body: out };
    }
    const name = eatName();
    // Initializer is optional: `let x;` declares an uninitialized (null) binding.
    let value = null;
    if (atOp('=')) { eatOp('='); value = parseExpr(); }
    // multiple declarators: let a = 1, b = 2;
    if (atOp(',')) {
      const out = [{ type: 'Let', name, value }];
      while (atOp(',')) {
        eatOp(',');
        const n2 = eatName(); let v2 = null;
        if (atOp('=')) { eatOp('='); v2 = parseExpr(); }
        out.push({ type: 'Let', name: n2, value: v2 });
      }
      if (atOp(';')) eatOp(';');
      return { type: 'Seq', body: out };
    }
    if (atOp(';')) eatOp(';');
    return { type: 'Let', name, value };
  }

  function parseFn() {
    let isAsync = false;
    if (at('async')) { next(); isAsync = true; }
    eat('fn');
    let isGen = false; if (atOp('*')) { eatOp('*'); isGen = true; }
    const name = eatName();
    const { names, prologue } = parseParamList();
    const block = parseBlock();
    return { type: 'FnDecl', name, params: names, body: withPrologue(prologue, block), async: isAsync, generator: isGen };
  }

  // Anonymous / named function expression: fn [name] (params) { body }.
  function parseFnExpr() {
    let isAsync = false;
    if (at('async')) { next(); isAsync = true; }
    eat('fn');
    let isGen = false; if (atOp('*')) { eatOp('*'); isGen = true; }
    let name = null;
    if (atName()) name = eatName(); // optional name (self-reference)
    const { names, prologue } = parseParamList();
    const block = parseBlock();
    return { type: 'FnExpr', name, params: names, body: withPrologue(prologue, block), async: isAsync, generator: isGen };
  }

  function parseReturn() {
    eat('return');
    let value = null;
    if (!atOp(';') && !atOp('}') && !at('else') && !at('catch') && !at('finally') && !at('eof')) value = parseExpr();
    if (atOp(';')) eatOp(';');
    return { type: 'Return', value };
  }

  function parseIf() {
    eat('if');
    eatOp('(');
    const test = parseExpr();
    eatOp(')');
    // allow either a block or a single statement (e.g. `if (x) return y`);
    // single statements are wrapped so downstream passes always see a Block.
    const cons = atOp('{') ? parseBlock() : { type: 'Block', body: [parseStatement()] };
    let alt = null;
    if (at('else')) {
      eat('else');
      alt = at('if') ? parseIf() : (atOp('{') ? parseBlock() : { type: 'Block', body: [parseStatement()] });
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
    let op;
    while ((op = curBinOp()) !== null && BINPREC[op] >= minPrec) {
      next();
      const prec = BINPREC[op];
      // '**' is right-associative; everything else left-associative.
      const right = parseBinary(op === '**' ? prec : prec + 1);
      left = { type: 'Binary', op, left, right };
    }
    return left;
  }

  function parseUnary() {
    // prefix ++/-- should be valid in expression position
    if (atOp('++') || atOp('--')) {
      const op = next().value === '++' ? '+' : '-';
      const target = parseUnary();
      return incDec(target, op);
    }
    if (atOp('-') || atOp('!') || atOp('+') || atOp('~')) {
      const op = next().value;
      return { type: 'Unary', op, arg: parseUnary() };
    }
    if (at('typeof') || at('void') || at('delete')) {
      const op = next().type;
      return { type: 'Unary', op, arg: parseUnary() };
    }
    if (at('await')) { next(); return { type: 'Await', arg: parseUnary() }; }
    if (at('yield')) {
      next();
      if (atOp('*')) eatOp('*');
      // yield with no operand (e.g. before `}` or `;`)
      const noArg = atOp(';') || atOp('}') || atOp(')') || atOp(']') || atOp(',') || at('eof');
      const arg = noArg ? { type: 'Null' } : parseUnary();
      return { type: 'Yield', arg };
    }
    return parsePostfix();
  }

  function parseArgs() {
    eatOp('(');
    const args = [];
    if (!atOp(')')) {
      args.push(parseSpreadable());
      while (atOp(',')) { eatOp(','); if (atOp(')')) break; args.push(parseSpreadable()); }
    }
    eatOp(')');
    return args;
  }

  // An argument or array element that may be spread: `...expr`.
  function parseSpreadable() {
    if (atOp('...')) { eatOp('...'); return { type: 'Spread', arg: parseExpr() }; }
    return parseExpr();
  }

  function parsePostfix() {
    let node = parsePrimary();
    for (;;) {
      if (atOp('(')) {
        node = { type: 'Call', callee: node, args: parseArgs() };
      } else if (atOp('[')) {
        eatOp('[');
        const index = parseExpr();
        eatOp(']');
        node = { type: 'Index', object: node, index };
      } else if (atOp('.')) {
        eatOp('.');
        const property = eatName();
        node = { type: 'Member', object: node, property };
      } else if (atOp('?.')) {
        // optional chaining: lowered to ordinary member/index/call (best effort)
        eatOp('?.');
        if (atOp('(')) { node = { type: 'Call', callee: node, args: parseArgs(), optional: true }; }
        else if (atOp('[')) { eatOp('['); const index = parseExpr(); eatOp(']'); node = { type: 'Index', object: node, index, optional: true }; }
        else { const property = eatName(); node = { type: 'Member', object: node, property, optional: true }; }
      } else break;
    }
    return node;
  }

  // Does the '(' at the cursor open an arrow-function parameter list? Scans to
  // the matching ')' and checks for a following '=>'.
  function looksLikeArrowParen() {
    let depth = 0, j = p;
    for (; j < toks.length; j++) {
      const t = toks[j];
      if (t.type === 'op' && (t.value === '(' || t.value === '[' || t.value === '{')) depth++;
      else if (t.type === 'op' && (t.value === ')' || t.value === ']' || t.value === '}')) {
        depth--; if (depth === 0) { const n = toks[j + 1]; return n && n.type === 'op' && n.value === '=>'; }
      } else if (t.type === 'eof') return false;
    }
    return false;
  }

  function arrowBody(prologue, isAsync, params) {
    const block = atOp('{') ? parseBlock() : { type: 'Block', body: [{ type: 'Return', value: parseExpr() }] };
    return { type: 'FnExpr', name: null, params, body: withPrologue(prologue, block), async: isAsync, generator: false };
  }

  // In an object literal, is the modifier word at the cursor actually the key?
  function objMemberEnd(off) {
    const n = toks[p + off];
    return n && n.type === 'op' && (n.value === ':' || n.value === '(' || n.value === ',' || n.value === '}');
  }

  function parsePrimary() {
    const t = peek();
    if (t.type === 'num') { next(); return { type: 'Num', value: t.value }; }
    if (t.type === 'str') { next(); return { type: 'Str', value: t.value }; }
    if (t.type === 'regex') { next(); return { type: 'Regex', pattern: t.value.pattern, flags: t.value.flags || '' }; }
    if (t.type === 'true') { next(); return { type: 'Bool', value: true }; }
    if (t.type === 'false') { next(); return { type: 'Bool', value: false }; }
    if (t.type === 'null') { next(); return { type: 'Null' }; }
    if (t.type === 'ident') {
      // arrow function shorthand: `x => expr`
      if (toks[p+1] && toks[p+1].type === 'op' && toks[p+1].value === '=>') {
        const name = next().value; // consume ident
        eatOp('=>');
        return arrowBody([], false, [name]);
      }
      next();
      return { type: 'Ident', name: t.value };
    }
    // template literal
    if (t.type === 'tpl_start') {
      next(); // consume tpl_start
      const parts = [];
      while (!at('tpl_end')) {
        if (at('str')) { parts.push({ type: 'Str', value: next().value }); continue; }
        if (at('tpl_expr_start')) { next(); // consume start
          // parse an expression until tpl_expr_end appears
          const expr = parseExpr();
          if (!at('tpl_expr_end')) throw new SyntaxError('Unterminated template expression');
          next(); // consume tpl_expr_end
          parts.push(expr);
          continue;
        }
        // unexpected token inside template
        throw new SyntaxError(`Unexpected token in template: ${peek().type}`);
      }
      eat('tpl_end');
      return { type: 'Template', parts };
    }

    // async arrow / async function expression
    if (t.type === 'async') {
      if (toks[p+1] && toks[p+1].type === 'op' && toks[p+1].value === '(') {
        const save = p; next(); // consume async
        if (looksLikeArrowParen()) { const { names, prologue } = parseParamList(); eatOp('=>'); return arrowBody(prologue, true, names); }
        p = save;
      }
      if (toks[p+1] && toks[p+1].type === 'ident' && toks[p+2] && toks[p+2].type === 'op' && toks[p+2].value === '=>') {
        next(); const name = eatName(); eatOp('=>'); return arrowBody([], true, [name]);
      }
      if (toks[p+1] && toks[p+1].type === 'fn') return parseFnExpr();
    }
    // class expression
    if (t.type === 'class') return parseClass(true);
    // super (best-effort placeholder; resolved at runtime where possible)
    if (t.type === 'super') { next(); return { type: 'Super' }; }
    // `new` expressions
    if (t.type === 'new') {
      next();
      if (atOp('.')) { eatOp('.'); eatName(); return { type: 'Null' }; } // new.target
      const callee = parsePrimary();
      let args = [];
      if (atOp('(')) args = parseArgs();
      return { type: 'New', callee, args };
    }
    if (atOp('(')) {
      if (looksLikeArrowParen()) {
        const { names, prologue } = parseParamList();
        eatOp('=>');
        return arrowBody(prologue, false, names);
      }
      eatOp('('); const e = parseExpr(); eatOp(')'); return e;
    }
    if (atOp('[')) {
      eatOp('[');
      const elements = [];
      while (!atOp(']')) {
        if (atOp(',')) { elements.push(null); eatOp(','); continue; } // hole
        elements.push(parseSpreadable());
        if (atOp(',')) eatOp(','); else break;
      }
      eatOp(']');
      return { type: 'Array', elements };
    }
    // object / map literal
    if (atOp('{')) {
      eatOp('{');
      const props = [];
      while (!atOp('}')) {
        if (atOp('...')) { eatOp('...'); props.push({ spread: parseExpr() }); if (atOp(',')) eatOp(','); continue; }
        let isAsync = false, isGen = false, kind = 'init';
        if (at('async') && !objMemberEnd(1)) { next(); isAsync = true; }
        if (atOp('*')) { eatOp('*'); isGen = true; }
        if ((at('ident', 'get') || at('ident', 'set')) && !objMemberEnd(1)) { kind = next().value; }
        let computed = false, key = null, keyNode = null;
        if (atOp('[')) { computed = true; eatOp('['); keyNode = parseExpr(); eatOp(']'); }
        else if (at('str')) key = next().value;
        else if (at('num')) key = String(next().value);
        else key = eatName();
        if (atOp('(')) { // method / getter / setter
          const { names, prologue } = parseParamList();
          const block = parseBlock();
          const fn = { type: 'FnExpr', name: null, params: names, body: withPrologue(prologue, block), async: isAsync, generator: isGen };
          props.push({ key, keyNode, computed, value: fn, kind: (kind === 'init' ? 'init' : kind) });
        } else if (kind === 'get' || kind === 'set') { // `get`/`set` used as an ordinary key
          if (atOp(':')) { eatOp(':'); props.push({ key: kind, value: parseExpr() }); }
          else props.push({ key: kind, value: { type: 'Ident', name: kind } });
        } else if (atOp(':')) {
          eatOp(':'); props.push({ key, keyNode, computed, value: parseExpr() });
        } else { // shorthand { name }
          props.push({ key, value: { type: 'Ident', name: key } });
        }
        if (atOp(',')) eatOp(','); else break;
      }
      eatOp('}');
      return { type: 'Object', props };
    }
    // anonymous function expression: fn (params) { body }  /  function (...) {...}
    if (t.type === 'fn' && fnIsFunctionExpr()) return parseFnExpr();
    // `fn` used as an ordinary identifier (common in .js input)
    if (t.type === 'fn') { next(); return { type: 'Ident', name: t.value }; }
    if (t.type === 'async' && toks[p+1] && toks[p+1].type === 'fn') return parseFnExpr();
    // any remaining keyword used as a bare identifier (best-effort tolerance)
    if (typeof t.value === 'string' && /^[A-Za-z_$]/.test(t.value)) { next(); return { type: 'Ident', name: t.value }; }
    throw new SyntaxError(`Unexpected token '${t.value}' (${t.type}) at line ${t.line}`);
  }

  return parseProgram();
}

module.exports = { parse };
