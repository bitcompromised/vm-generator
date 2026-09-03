'use strict';
// Tokenizer for the vm-gen source language (.vgs).

const KEYWORDS = new Set([
  'let', 'fn', 'return', 'if', 'else', 'while', 'print', 'true', 'false', 'null',
]);

// Multi-char operators first so the longest match wins.
const OPS = [
  '==', '!=', '<=', '>=', '&&', '||', '<<', '>>',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^',
  '(', ')', '{', '}', '[', ']', ',', ';',
];

function isIdentStart(c) { return /[A-Za-z_]/.test(c); }
function isIdentPart(c) { return /[A-Za-z0-9_]/.test(c); }
function isDigit(c) { return c >= '0' && c <= '9'; }

function lex(src) {
  const toks = [];
  let i = 0, line = 1, col = 1;
  const N = src.length;

  const adv = (n = 1) => { for (let k = 0; k < n; k++) { if (src[i] === '\n') { line++; col = 1; } else { col++; } i++; } };
  const push = (type, value) => toks.push({ type, value, line, col });

  while (i < N) {
    const c = src[i];

    // whitespace
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { adv(); continue; }

    // line comments  //...   and block comments /* ... */
    if (c === '/' && src[i + 1] === '/') { while (i < N && src[i] !== '\n') adv(); continue; }
    if (c === '/' && src[i + 1] === '*') {
      adv(2);
      while (i < N && !(src[i] === '*' && src[i + 1] === '/')) adv();
      adv(2);
      continue;
    }

    // numbers (int or float)
    if (isDigit(c)) {
      let s = '';
      while (i < N && (isDigit(src[i]) || src[i] === '.')) { s += src[i]; adv(); }
      push('num', parseFloat(s));
      continue;
    }

    // strings
    if (c === '"' || c === "'") {
      const quote = c; adv();
      let s = '';
      while (i < N && src[i] !== quote) {
        if (src[i] === '\\') {
          adv();
          const e = src[i];
          s += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r'
             : e === '\\' ? '\\' : e === quote ? quote : e;
          adv();
        } else { s += src[i]; adv(); }
      }
      adv(); // closing quote
      push('str', s);
      continue;
    }

    // identifiers / keywords
    if (isIdentStart(c)) {
      let s = '';
      while (i < N && isIdentPart(src[i])) { s += src[i]; adv(); }
      push(KEYWORDS.has(s) ? s : 'ident', s);
      continue;
    }

    // operators
    let matched = null;
    for (const op of OPS) {
      if (src.startsWith(op, i)) { matched = op; break; }
    }
    if (matched) { push('op', matched); adv(matched.length); continue; }

    throw new SyntaxError(`Unexpected character '${c}' at line ${line}:${col}`);
  }

  push('eof', null);
  return toks;
}

module.exports = { lex, KEYWORDS };
