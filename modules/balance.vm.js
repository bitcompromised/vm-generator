(function () {
'use strict';
(function () {
var _xuh8zix = 33145;
function _ilwvelg(a, b){ var t = ((a | 0) + 724) ^ (b | 0); return (t >>> 5) & 0xffff; }
function _m7alory(a, b){ var t = ((a | 0) + 233) ^ (b | 0); return (t >>> 1) & 0xffff; }
function _ylgbutc(a, b){ var t = ((a | 0) + 645) ^ (b | 0); return (t >>> 3) & 0xffff; }
var IMAGE_B64 = "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";
var __REQUIRE_BASE__ = "C:\\Users\\eadan\\OneDrive\\Desktop\\Claude-Projects\\vm-gen\\modules";
var SALT = 525483425;
var OP = {
HALT: 0,
PUSH_CONST: 1,
PUSH_TRUE: 2,
PUSH_FALSE: 3,
PUSH_NULL: 4,
POP: 5,
DUP: 6,
LOAD: 7,
STORE: 8,
ADD: 9,
SUB: 10,
MUL: 11,
DIV: 12,
MOD: 13,
NEG: 14,
NOT: 15,
EQ: 16,
NEQ: 17,
LT: 18,
GT: 19,
LTE: 20,
GTE: 21,
BAND: 22,
BOR: 23,
BXOR: 24,
SHL: 25,
SHR: 26,
JMP: 27,
JZ: 28,
JNZ: 29,
CALL: 30,
RET: 31,
CALL_HOST: 32,
NEW_ARR: 33,
ARR_GET: 34,
ARR_SET: 35,
PRINT: 36,
NEW_OBJ: 37,
CLOSURE: 38,
LOAD_UP: 39,
STORE_UP: 40,
LOAD_UPVALUE: 41,
STORE_UPVALUE: 42,
CLOSE_UPVALUE: 43,
CALL_VALUE: 44,
LOAD_THIS: 45,
LOAD_ARGS: 46,
YIELD: 47,
CALL_METHOD: 48,
NEW: 49,
NEW_VALUE: 50,
TRY: 51,
END_TRY: 52,
THROW: 53,
LOADADD: 54,
LOADSUB: 55,
LOADLT: 56,
CONSTADD: 57,
AWAIT: 58
};
var FORMAT_MAJOR = 2;
var EXPECTED_OPCOUNT = 59;
var MAX_STEPS = 0;
var MAX_DEPTH = 1024;
var MAX_OBJECTS = 0;
var MAX_STRING = 0;
var __DEV = true;
var __ectx = { fn: -1, ip: -1, op: -1, depth: 0 };
var objCount = 0;
function guardStr(s) { if (MAX_STRING && typeof s === 'string' && s.length > MAX_STRING) throw new Error('resource limit: string size exceeded'); return s; }
function guardObj() { if (MAX_OBJECTS && ++objCount > MAX_OBJECTS) throw new Error('resource limit: object budget exceeded'); }
var MASK32 = 0x100000000;
function mul32(a, b) {
a = a % MASK32; b = b % MASK32;
var ah = Math.floor(a / 65536), al = a % 65536;
var r = ((ah * b) % 65536) * 65536 + al * b;
return r % MASK32;
}
function lcgNext(s) { return (mul32(s, 1664525) + 1013904223) % MASK32; }
function ksByte(s) { return Math.floor(s / 16777216) % 256; }
function fnSeed(codeSeed, idx) { return (codeSeed + mul32(idx, 2654435761)) % MASK32; }
function roundSeed(cs, idx, r) { return r === 0 ? fnSeed(cs, idx) : (fnSeed(cs, idx) + mul32(r, 2246822519)) % MASK32; }
function cipher(bytes, seed) {
var st = seed % MASK32, out = new Array(bytes.length);
for (var i = 0; i < bytes.length; i++) { st = lcgNext(st); out[i] = (bytes[i] ^ ksByte(st)) & 0xff; }
return out;
}
function decRounds(bytes, cs, idx, rounds) { var out = bytes; for (var r = 0; r < rounds; r++) out = cipher(out, roundSeed(cs, idx, r)); return out; }
function fnv1a(bytes) {
var h = 2166136261;
for (var i = 0; i < bytes.length; i++) {
var low = h % 256;
h = h - low + (low ^ bytes[i]);
h = mul32(h, 16777619);
}
return h % MASK32;
}
function keyedMac(keyBytes, bytes) {
var m1 = fnv1a(keyBytes.concat(bytes));
var m2 = fnv1a(bytes.concat(keyBytes).concat([0x9e, 0x37, 0x79, 0xb9]));
return [m1 & 0xff, (m1 >>> 8) & 0xff, (m1 >>> 16) & 0xff, (m1 >>> 24) & 0xff,
m2 & 0xff, (m2 >>> 8) & 0xff, (m2 >>> 16) & 0xff, (m2 >>> 24) & 0xff];
}
function strBytes(s) {
if (!s) return [];
if (typeof Buffer !== 'undefined') return Array.prototype.slice.call(Buffer.from(s, 'utf8'));
var e = unescape(encodeURIComponent(s)), o = [];
for (var i = 0; i < e.length; i++) o.push(e.charCodeAt(i));
return o;
}
function envKey() {
if (typeof process !== 'undefined' && process.env && process.env.VMGEN_KEY) return process.env.VMGEN_KEY;
if (typeof globalThis !== 'undefined' && globalThis.VMGEN_KEY) return globalThis.VMGEN_KEY;
return '';
}
function decodeB64(s) {
if (typeof Buffer !== 'undefined') return Array.prototype.slice.call(Buffer.from(s, 'base64'));
var bin = atob(s), a = new Array(bin.length);
for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
return a;
}
function utf8(bytes) {
if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('utf8');
return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes)));
}
function load() {
var b = decodeB64(IMAGE_B64);
if (b[0] !== 0x56 || b[1] !== 0x47) throw new Error('bad magic');
var major = b[2]; // b[3]=minor b[4]=flags b[5]=profile b[6]=arch
if (major !== FORMAT_MAJOR) throw new Error('unsupported image format major ' + major);
var checksum = b[7] + b[8] * 256 + b[9] * 65536 + b[10] * 16777216;
var meta = [b[2], b[3], b[4], b[5], b[6]];
var domainBytes = b.slice(11, 27); // 4x u32: header, dispatch, const, fn
function d32(o) { return domainBytes[o] + domainBytes[o + 1] * 256 + domainBytes[o + 2] * 65536 + domainBytes[o + 3] * 16777216; }
var dHeader = d32(0), dDispatch = d32(4), dConst = d32(8), dFn = d32(12);
var SIGNED = (b[4] & 4) !== 0;
var sigBytes = SIGNED ? b.slice(27, 35) : [];
var body = b.slice(SIGNED ? 35 : 27);
if (fnv1a(meta.concat(domainBytes).concat(sigBytes).concat(body)) !== (checksum % MASK32)) throw new Error('integrity check failed: image tampered');
if (fnv1a(meta) !== dHeader) throw new Error('integrity check failed: header domain');
if (SIGNED) {
var mac = keyedMac(strBytes(envKey()), body);
var sigOk = true;
for (var si = 0; si < 8; si++) { if (mac[si] !== sigBytes[si]) sigOk = false; }
if (!sigOk) throw new Error('authenticity/authorization check failed');
}
var p = 0;
function u8() { return body[p++]; }
function u16() { var v = body[p] | (body[p + 1] << 8); p += 2; return v; }
function u32() { var v = body[p] + body[p + 1] * 256 + body[p + 2] * 65536 + body[p + 3] * 16777216; p += 4; return v; }
var obfMaster = u32();
var masterSeed = (obfMaster ^ SALT) >>> 0;
var numCanon = u8();
if (numCanon !== EXPECTED_OPCOUNT) throw new Error('integrity check failed: VM/opcode-table mismatch');
var rs = masterSeed || 0x9e3779b9;
function rng() { rs = lcgNext(rs); return rs; }
var pool = []; for (var pi = 0; pi < 256; pi++) pool.push(pi);
for (var pj = 255; pj > 0; pj--) { var jj = rng() % (pj + 1); var tt = pool[pj]; pool[pj] = pool[jj]; pool[jj] = tt; }
var identPerm = (b[4] & 8) !== 0;
var byte2canon = {};
var permBytes = [];
for (var i = 0; i < numCanon; i++) { var pb = identPerm ? i : pool[i]; byte2canon[pb] = i; permBytes.push(pb); }
var codeSeed = rng() % MASK32;
var constSeed = rng() % MASK32;
if (fnv1a(permBytes) !== dDispatch) throw new Error('integrity check failed: dispatch domain');
var constCount = u16();
var encConstLen = u32();
var encConst = body.slice(p, p + encConstLen); p += encConstLen;
if (fnv1a(encConst) !== dConst) throw new Error('integrity check failed: constant domain');
var constBlob = cipher(encConst, constSeed);
var consts = [];
var cp = 0;
for (var c = 0; c < constCount; c++) {
var tag = constBlob[cp++];
if (tag === 2) {
var A = constBlob[cp] + constBlob[cp + 1] * 256 + constBlob[cp + 2] * 65536 + constBlob[cp + 3] * 16777216; cp += 4;
var B = constBlob[cp] + constBlob[cp + 1] * 256 + constBlob[cp + 2] * 65536 + constBlob[cp + 3] * 16777216; cp += 4;
consts.push((A ^ B) >>> 0);
} else {
var len = constBlob[cp] | (constBlob[cp + 1] << 8); cp += 2;
var raw = constBlob.slice(cp, cp + len); cp += len;
var str = utf8(raw);
consts.push(tag === 0 ? parseFloat(str) : str);
}
}
var fnCount = u16();
var fns = [];
var fnAll = [];
for (var f = 0; f < fnCount; f++) {
var nl = u8();
var name = utf8(body.slice(p, p + nl)); p += nl;
var nparams = u8();
var nlocals = u16();
var nUp = u8();
var upvals = [];
for (var uu = 0; uu < nUp; uu++) { var fl = u8(); var ui = u16(); upvals.push({ fromLocal: fl === 1, index: ui }); }
var protLevel = u8();
var restParam = u8(); // 0xff = none
var fnFlags = u8();   // bit0 = generator
var codeLen = u32();
var enc = body.slice(p, p + codeLen); p += codeLen;
fnAll = fnAll.concat(enc);
fns.push({ name: name, nparams: nparams, nlocals: nlocals, upvals: upvals, restParam: (restParam === 0xff ? null : restParam), generator: (fnFlags & 1) !== 0, async: (fnFlags & 2) !== 0, code: decRounds(enc, codeSeed, f, protLevel) });
}
if (fnv1a(fnAll) !== dFn) throw new Error('integrity check failed: function domain');
return { byte2canon: byte2canon, consts: consts, fns: fns };
}
var __vmset = (typeof WeakSet !== 'undefined') ? new WeakSet() : null;
var __vmeta = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
function mkObj(proto) { var o = proto ? Object.create(proto) : {}; if (__vmset) __vmset.add(o); return o; }
function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && v.__closure !== true && __vmset && __vmset.has(v); }
function metaOf(o) { if (!__vmeta) return null; var m = __vmeta.get(o); if (!m) { m = {}; __vmeta.set(o, m); } return m; }
function isClosure(v) { return !!v && typeof v === 'object' && v.__closure === true; }
function mkCells(n) { var a = new Array(n); for (var i = 0; i < n; i++) a[i] = { v: null }; return a; }
function objKeys(o) { var r = []; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r.push(k); return r; }
function mkFrame(fn, args, upvals, thisObj) {
var locals = mkCells(fn.nlocals), np = fn.nparams;
for (var k = 0; k < np; k++) locals[k].v = (k < args.length ? args[k] : null);
if (fn.restParam != null && fn.restParam >= 0) locals[fn.restParam].v = args.slice(fn.restParam);
return { fn: fn, ip: 0, locals: locals, upvals: upvals || [], thisObj: thisObj, args: args };
}
function toStr(v) {
if (v === null || v === undefined) return 'null';
if (v === true) return 'true';
if (v === false) return 'false';
if (typeof v === 'number') return String(v);
if (typeof v === 'string') return v;
if (isClosure(v)) return '<fn>';
if (Array.isArray(v)) { var a = []; for (var j = 0; j < v.length; j++) a.push(toStr(v[j])); return '[' + a.join(', ') + ']'; }
if (isObj(v)) { var r = [], ks = objKeys(v); for (var i = 0; i < ks.length; i++) r.push(ks[i] + ': ' + toStr(v[ks[i]])); return '{' + r.join(', ') + '}'; }
return String(v);
}
function truthy(v) { return !(v === null || v === undefined || v === false || v === 0 || v === ''); }
function u32of(n) { return n >>> 0; }
function idxGet(obj, key) {
if (isClosure(obj)) {
if (key === 'bind') return function () { var t = arguments[0], b = Array.prototype.slice.call(arguments, 1); return function () { return __runMethod(obj, t, b.concat(Array.prototype.slice.call(arguments))); }; };
if (key === 'call') return function () { return __runMethod(obj, arguments[0], Array.prototype.slice.call(arguments, 1)); };
if (key === 'apply') return function () { return __runMethod(obj, arguments[0], arguments[1] || []); };
return undefined;
}
if (typeof obj === 'string') { if (key === 'length') return obj.length; return obj[key]; }
if (obj === null || obj === undefined) throw new Error('cannot index ' + toStr(obj));
var r = obj[key]; // native property access: VM objects, arrays, class instances, host objects, getters
if (r === undefined && isObj(obj) && !(key in obj)) return null; // VM objects read missing keys as null
return r;
}
function idxSet(obj, key, val) {
if (obj && (typeof obj === 'object' || typeof obj === 'function')) { obj[key] = val; return; }
throw new Error('cannot assign index of ' + toStr(obj));
}
function syncSettled(state, value) {
var t = { __syncthen: true, state: state, value: value };
t.then = function (onF, onR) {
try {
if (t.state === 'fulfilled') return syncSettled('fulfilled', onF ? onF(t.value) : t.value);
if (onR) return syncSettled('fulfilled', onR(t.value));
return t;
} catch (e) { return syncSettled('rejected', e); }
};
t.catch = function (onR) { return t.then(undefined, onR); };
t.finally = function (fn) { if (fn) fn(); return t; };
return t;
}
function toSyncPromise(v) {
if (v && v.__syncthen) return v;
if (v && typeof v.then === 'function') { var got, err, ok = true; v.then(function (x) { got = x; }, function (e) { ok = false; err = e; }); return ok ? syncSettled('fulfilled', got) : syncSettled('rejected', err); }
return syncSettled('fulfilled', v);
}
var __SyncPromise = {
resolve: function (v) { return toSyncPromise(v); },
reject: function (e) { return syncSettled('rejected', e); },
all: function (arr) { var out = []; for (var i = 0; i < arr.length; i++) { var s = toSyncPromise(arr[i]); if (s.state === 'rejected') return s; out.push(s.value); } return syncSettled('fulfilled', out); },
race: function (arr) { return arr.length ? toSyncPromise(arr[0]) : syncSettled('fulfilled', undefined); },
};
var __globals = Object.create(null);
var __module = { exports: {} };
var __hostg = {
module: __module, exports: __module.exports,
undefined: undefined, NaN: NaN, Infinity: Infinity, globalThis: (typeof globalThis !== 'undefined' ? globalThis : undefined), console: console,
Object: Object, Array: Array, Math: Math, JSON: JSON, Number: Number, String: String, Boolean: Boolean,
Promise: Promise, Map: Map, Set: Set, WeakMap: (typeof WeakMap !== 'undefined' ? WeakMap : undefined), WeakSet: (typeof WeakSet !== 'undefined' ? WeakSet : undefined),
Symbol: (typeof Symbol !== 'undefined' ? Symbol : undefined), Proxy: (typeof Proxy !== 'undefined' ? Proxy : undefined), Reflect: (typeof Reflect !== 'undefined' ? Reflect : undefined),
RegExp: RegExp, Date: Date, Error: Error, TypeError: TypeError, RangeError: RangeError,
parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite,
process: (typeof process !== 'undefined' ? process : undefined), Buffer: (typeof Buffer !== 'undefined' ? Buffer : undefined),
setTimeout: (typeof setTimeout !== 'undefined' ? setTimeout : undefined)
};
function __requireBridge(spec) {
try {
var path = require('path');
var base = (typeof __REQUIRE_BASE__ === 'string' && __REQUIRE_BASE__) ? __REQUIRE_BASE__ : process.cwd();
if (spec && (/^\.\.?([\\/]|$)/.test(spec) || spec.indexOf('/') === 0 || /^[A-Za-z]:[\\/]/.test(spec))) return require(path.resolve(base, spec));
return require(spec);
} catch (e) { try { return require(spec); } catch (e2) { return undefined; } }
}
function __typeof(v) {
if (v === undefined) return 'undefined';
if (v === null) return 'object';
if (isClosure(v) || typeof v === 'function') return 'function';
if (Array.isArray(v) || isObj(v)) return 'object';
return typeof v;
}
function __instanceof(o, c) {
if (typeof c === 'function') { try { return o instanceof c; } catch (e) { return false; } }
if (isObj(c) && c['__isClass']) { var k = isObj(o) ? metaOf(o).classRef : null; while (k && isObj(k)) { if (k === c) return true; k = k['__super']; } return false; }
return false;
}
var __runMethod = null; // set inside run(): (closure, thisObj, args) -> result
var __runGeneratorFn = null; // set inside run(): (closure, thisObj) -> yielded array
function __newObj(args) {
var cls = args[0], rest = args.slice(1);
if (typeof cls === 'function') {
if (typeof Proxy !== 'undefined' && cls === Proxy && rest.length === 2 && isObj(rest[1])) {
var h = rest[1], nh = {}, hk = objKeys(h);
for (var hi = 0; hi < hk.length; hi++) { var hv = h[hk[hi]]; nh[hk[hi]] = isClosure(hv) ? toNativeJs(hv) : hv; }
rest[1] = nh;
}
try { for (var a = 0; a < rest.length; a++) rest[a] = toNativeJs(rest[a]); return new (Function.prototype.bind.apply(cls, [null].concat(rest)))(); } catch (e) { return null; }
}
if (isObj(cls) && cls['__isClass']) {
var chain = [], c = cls;
while (c && isObj(c) && c['__isClass']) { chain.unshift(c); c = c['__super']; }
var proto = {};
for (var i = 0; i < chain.length; i++) { var m = chain[i]['__methods']; if (isObj(m)) { var mk = objKeys(m); for (var j = 0; j < mk.length; j++) proto[mk[j]] = m[mk[j]]; } }
var inst = mkObj(proto);
metaOf(inst).classRef = cls;
var ctor = null;
for (var ci = chain.length - 1; ci >= 0; ci--) { if (chain[ci]['__ctor']) { ctor = chain[ci]['__ctor']; break; } }
if (ctor && isClosure(ctor) && __runMethod) __runMethod(ctor, inst, rest);
return inst;
}
return null;
}
function host(name, args) {
switch (name) {
case 'len': return Array.isArray(args[0]) ? args[0].length : (isObj(args[0]) ? objKeys(args[0]).length : String(args[0]).length);
case 'str': return toStr(args[0]);
case 'num': return parseFloat(args[0]);
case 'floor': return Math.floor(args[0]);
case 'abs': return Math.abs(args[0]);
case 'rand': return Math.random();
case 'time': return Date.now();
case 'push': args[0].push(args[1]); return args[0];
case '__extend': {
var a = args[0], it = args[1];
var symIt = (it && typeof Symbol !== 'undefined') ? it[Symbol.iterator] : undefined;
if (Array.isArray(it) || typeof it === 'string') { for (var ei = 0; ei < it.length; ei++) a.push(it[ei]); }
else if (isClosure(symIt) && __runGeneratorFn) { var seq = __runGeneratorFn(symIt, it); for (var gi = 0; gi < seq.length; gi++) a.push(seq[gi]); } // VM generator [Symbol.iterator]()
else if (typeof symIt === 'function') { var iter = symIt.call(it), st; while (!(st = iter.next()).done) a.push(st.value); }
else if (isObj(it)) { var ks = objKeys(it); for (var ki = 0; ki < ks.length; ki++) a.push(it[ks[ki]]); }
return a;
}
case 'keys': return (args[0] && typeof args[0] === 'object') ? objKeys(args[0]) : [];
case 'has': return (args[0] && typeof args[0] === 'object') ? (('' + args[1]) in args[0]) : false;
case '__setglobal': __globals[args[0]] = args[1]; return args[1];
case '__getglobal': {
var nm = args[0];
if (Object.prototype.hasOwnProperty.call(__globals, nm)) return __globals[nm];
if (nm === 'require') return __requireBridge;
if (nm === 'Promise') return __SyncPromise; // synchronous promise model
if (Object.prototype.hasOwnProperty.call(__hostg, nm)) return __hostg[nm];
return undefined;
}
case 'typeof': return __typeof(args[0]);
case 'bitnot': return ~(Number(args[0]) || 0);
case 'pow': return Math.pow(args[0], args[1]);
case 'instanceof': return __instanceof(args[0], args[1]);
case 'inop': { var k = args[0], o = args[1]; if (Array.isArray(o)) return Number(k) >= 0 && Number(k) < o.length; if (o && typeof o === 'object') return (('' + k) in o); return false; }
case 'require': return __requireBridge(args[0]);
case '__new': return __newObj(args);
case '__defaccessor': {
var o = args[0], name = args[1], kind = args[2], fn = args[3];
if (o && typeof o === 'object') {
var d = Object.getOwnPropertyDescriptor(o, name);
var desc = { enumerable: true, configurable: true };
if (d && d.get) desc.get = d.get; if (d && d.set) desc.set = d.set;
if (kind === 'get') desc.get = (function (f) { return function () { return __runMethod(f, this, []); }; })(fn);
else desc.set = (function (f) { return function (v) { __runMethod(f, this, [v]); }; })(fn);
try { Object.defineProperty(o, name, desc); } catch (e) {}
}
return o;
}
case '__regex': { try { return new RegExp(args[0], args[1] || ''); } catch (e) { return null; } }
default: throw new Error('unknown host builtin ' + name);
}
}
function run(prog) {
var b2c = prog.byte2canon, consts = prog.consts, fns = prog.fns;
var stack = [];
var frames = [];
var handlers = []; // { frame, framesLen, stackLen, addr }
var frame = { fn: fns[0], ip: 0, locals: mkCells(fns[0].nlocals), upvals: [] };
function rd8() { return frame.fn.code[frame.ip++]; }
function rd16() { var lo = frame.fn.code[frame.ip], hi = frame.fn.code[frame.ip + 1]; frame.ip += 2; return lo | (hi << 8); }
function raise(value) {
while (handlers.length) {
var h = handlers.pop();
frames.length = h.framesLen;
frame = h.frame;
stack.length = h.stackLen;
frame.ip = h.addr;
stack.push(value);
return true;
}
return false;
}
var steps = 0;
function exec(retDepth) {
for (;;) {
if (MAX_STEPS && ++steps > MAX_STEPS) throw new Error('resource limit: instruction budget exceeded');
var op = b2c[rd8()];
if (__DEV) { __ectx.op = op; __ectx.ip = frame.ip; __ectx.depth = frames.length; __ectx.fn = frame.fn && frame.fn.name; }
try {
switch (op) {
case OP.CALL: {
var fnIdx = rd16(), argc = rd8();
if (MAX_DEPTH && frames.length + 1 > MAX_DEPTH) throw new Error('resource limit: call depth exceeded');
var callee = fns[fnIdx];
var cargs = new Array(argc);
for (var k = argc - 1; k >= 0; k--) cargs[k] = stack.pop();
if (callee.generator) { stack.push(runGenerator(callee, cargs, [], undefined)); break; }
if (callee.async) { stack.push(toSyncPromise(runClosure({ __closure: true, fn: fnIdx, upvals: [] }, cargs, undefined))); break; }
frames.push(frame);
frame = mkFrame(callee, cargs, [], undefined);
break;
}
case OP.JMP: { frame.ip = rd16(); break; }
case OP.AWAIT: {
var av = stack.pop();
if (av && av.__syncthen) { if (av.state === 'rejected') throw { __vmthrow: true, v: av.value }; stack.push(av.value); }
else if (av && (typeof av === 'object' || typeof av === 'function') && typeof av.then === 'function') { var sp = toSyncPromise(av); if (sp.state === 'rejected') throw { __vmthrow: true, v: sp.value }; stack.push(sp.value); }
else stack.push(av);
break;
}
case OP.LT: { var b = stack.pop(), a = stack.pop(); stack.push(a < b); break; }
case OP.PUSH_FALSE: stack.push(false); break;
case OP.RET: {
var rv = stack.pop();
if (frames.length === retDepth) return rv; // returned to caller (main or runClosure)
frame = frames.pop();
stack.push(rv);
break;
}
case OP.PUSH_CONST: stack.push(consts[rd16()]); break;
case OP.SHL: { var b = stack.pop(), a = stack.pop(); stack.push(u32of(a << b)); break; }
case OP.NOT: stack.push(!truthy(stack.pop())); break;
case OP.GT: { var b = stack.pop(), a = stack.pop(); stack.push(a > b); break; }
case OP.LOADADD: { var laI = rd16(); var laX = stack.pop(), laB = frame.locals[laI].v; stack.push((typeof laX === 'number' && typeof laB === 'number') ? laX + laB : toStr(laX) + toStr(laB)); break; }
case OP.GTE: { var b = stack.pop(), a = stack.pop(); stack.push(a >= b); break; }
case OP.NEG: stack.push(-stack.pop()); break;
case OP.JZ: { var addr = rd16(); if (!truthy(stack.pop())) frame.ip = addr; break; }
case OP.LOADLT: { var llI = rd16(); stack.push(stack.pop() < frame.locals[llI].v); break; }
case OP.NEQ: { var b = stack.pop(), a = stack.pop(); stack.push(a !== b); break; }
case OP.MUL: { var b = stack.pop(), a = stack.pop(); stack.push(a * b); break; }
case OP.SHR: { var b = stack.pop(), a = stack.pop(); stack.push(u32of(a >>> b)); break; }
case OP.CALL_METHOD: {
var margc = rd8();
var margs = new Array(margc);
for (var mk = margc - 1; mk >= 0; mk--) margs[mk] = stack.pop();
var mcallee = stack.pop();
var mrecv = stack.pop();
if (typeof mcallee === 'function' && !isClosure(mcallee)) { for (var mn=0;mn<margs.length;mn++) margs[mn]=toNativeJs(margs[mn]); stack.push(mcallee.apply(mrecv, margs)); break; }
if (!isClosure(mcallee)) throw new Error('value is not callable: ' + toStr(mcallee));
var mfn = fns[mcallee.fn];
if (mfn.generator) { stack.push(runGenerator(mfn, margs, mcallee.upvals, mrecv)); break; }
if (mfn.async) { stack.push(toSyncPromise(runClosure(mcallee, margs, mrecv))); break; }
frames.push(frame);
frame = mkFrame(mfn, margs, mcallee.upvals, mrecv);
break;
}
case OP.JNZ: { var addr = rd16(); if (truthy(stack.pop())) frame.ip = addr; break; }
case OP.LOAD: stack.push(frame.locals[rd16()].v); break;
case OP.LOADSUB: { var lsI = rd16(); stack.push(stack.pop() - frame.locals[lsI].v); break; }
case OP.ARR_GET: { var idx = stack.pop(), arr2 = stack.pop(); stack.push(idxGet(arr2, idx)); break; }
case OP.STORE_UP: frame.upvals[rd16()].v = stack.pop(); break;
case OP.END_TRY: { handlers.pop(); break; }
case OP.YIELD: { var yv = stack.pop(); if (frame.yields) frame.yields.push(yv); stack.push(null); break; }
case OP.BXOR: { var b = stack.pop(), a = stack.pop(); stack.push(u32of(a ^ b)); break; }
case OP.LOAD_ARGS: { stack.push(frame.args || []); break; }
case OP.CLOSURE: {
var cidx = rd16();
var cfn = fns[cidx];
var ups = new Array(cfn.upvals.length);
for (var cu = 0; cu < cfn.upvals.length; cu++) { var d = cfn.upvals[cu]; ups[cu] = d.fromLocal ? frame.locals[d.index] : frame.upvals[d.index]; }
stack.push({ __closure: true, fn: cidx, upvals: ups });
break;
}
case OP.PRINT: { var out = (typeof process !== 'undefined' && process.stdout) ? function (s) { process.stdout.write(s + '\n'); } : console.log; out(toStr(stack.pop())); break; }
case OP.STORE: frame.locals[rd16()].v = stack.pop(); break;
case OP.PUSH_TRUE: stack.push(true); break;
case OP.BAND: { var b = stack.pop(), a = stack.pop(); stack.push(u32of(a & b)); break; }
case OP.NEW_OBJ: {
guardObj();
var on = rd16(), pairs = [];
for (var om = 0; om < on; om++) { var ov = stack.pop(), ok = stack.pop(); pairs.push([ok, ov]); }
pairs.reverse();
var obj = mkObj();
for (var pi = 0; pi < pairs.length; pi++) { var pk = pairs[pi][0]; obj[typeof pk === 'symbol' ? pk : ('' + pk)] = pairs[pi][1]; }
stack.push(obj);
break;
}
case OP.LOAD_UP: stack.push(frame.upvals[rd16()].v); break;
case OP.DIV: { var b = stack.pop(), a = stack.pop(); stack.push(a / b); break; }
case OP.DUP: stack.push(stack[stack.length - 1]); break;
case OP.LTE: { var b = stack.pop(), a = stack.pop(); stack.push(a <= b); break; }
case OP.CALL_VALUE: {
var vargc = rd8();
if (MAX_DEPTH && frames.length + 1 > MAX_DEPTH) throw new Error('resource limit: call depth exceeded');
var vargs = new Array(vargc);
for (var vk = vargc - 1; vk >= 0; vk--) vargs[vk] = stack.pop();
var vcallee = stack.pop();
if (typeof vcallee === 'function' && !isClosure(vcallee)) { for (var vn=0;vn<vargs.length;vn++) vargs[vn]=toNativeJs(vargs[vn]); stack.push(vcallee.apply(null, vargs)); break; }
if (!isClosure(vcallee)) throw new Error('value is not callable: ' + toStr(vcallee));
var vfn = fns[vcallee.fn];
if (vfn.generator) { stack.push(runGenerator(vfn, vargs, vcallee.upvals, undefined)); break; }
if (vfn.async) { stack.push(toSyncPromise(runClosure(vcallee, vargs, undefined))); break; }
frames.push(frame);
frame = mkFrame(vfn, vargs, vcallee.upvals, undefined);
break;
}
case OP.NEW_ARR: {
guardObj();
var n = rd16(), arr = new Array(n);
for (var m = n - 1; m >= 0; m--) arr[m] = stack.pop();
stack.push(arr);
break;
}
case OP.POP: stack.pop(); break;
case OP.SUB: { var b = stack.pop(), a = stack.pop(); stack.push(a - b); break; }
case OP.MOD: { var b = stack.pop(), a = stack.pop(); stack.push(a % b); break; }
case OP.LOAD_THIS: { stack.push(frame.thisObj !== undefined ? frame.thisObj : null); break; }
case OP.BOR: { var b = stack.pop(), a = stack.pop(); stack.push(u32of(a | b)); break; }
case OP.PUSH_NULL: stack.push(null); break;
case OP.CONSTADD: { var caI = rd16(); var caX = stack.pop(), caB = consts[caI]; stack.push((typeof caX === 'number' && typeof caB === 'number') ? caX + caB : toStr(caX) + toStr(caB)); break; }
case OP.TRY: { handlers.push({ frame: frame, framesLen: frames.length, stackLen: stack.length, addr: rd16() }); break; }
case OP.CLOSE_UPVALUE: { rd16(); break; } // locals are already heap cells
case OP.THROW: { var tv = stack.pop(); if (!raise(tv)) throw new Error('uncaught exception: ' + toStr(tv)); break; }
case OP.ARR_SET: { var val = stack.pop(), idx2 = stack.pop(), arr3 = stack.pop(); idxSet(arr3, idx2, val); stack.push(val); break; }
case OP.EQ: { var b = stack.pop(), a = stack.pop(); stack.push(a === b); break; }
case OP.ADD: { var b = stack.pop(), a = stack.pop(); stack.push((typeof a === 'number' && typeof b === 'number') ? a + b : guardStr(toStr(a) + toStr(b))); break; }
case OP.CALL_HOST: {
var nameIdx = rd16(), hargc = rd8();
var hargs = new Array(hargc);
for (var j = hargc - 1; j >= 0; j--) hargs[j] = stack.pop();
stack.push(host(consts[nameIdx], hargs));
break;
}
case OP.HALT: return undefined;
default: throw new Error('illegal opcode ' + op + ' at ip=' + (frame.ip - 1));
}
} catch (e) {
if (e instanceof Error && /illegal opcode|resource limit/.test(e.message)) throw e;
var ev = (e && e.__vmthrow) ? e.v : e;
if (!raise(ev)) throw (e && e.__vmthrow) ? new Error('uncaught exception: ' + toStr(ev)) : e;
}
}
}
function runClosure(closure, args, thisObj) {
var fn = fns[closure.fn];
frames.push(frame);
var rd = frames.length;
frame = mkFrame(fn, args, closure.upvals, thisObj);
var rv = exec(rd);
frame = frames.pop();
return rv;
}
__runMethod = function (closure, thisObj, args) { return runClosure(closure, args, thisObj); };
function runGenerator(fn, args, upvals, thisObj) {
frames.push(frame);
var rd = frames.length;
frame = mkFrame(fn, args, upvals, thisObj);
var yields = frame.yields = []; // a real array (spreads / iterates natively)
exec(rd);
frame = frames.pop();
return yields;
}
__runGeneratorFn = function (closure, thisObj) { return runGenerator(fns[closure.fn], [], closure.upvals, thisObj); };
toNativeJs = function (v) {
if (v && v.__closure) return function () { var a = []; for (var i = 0; i < arguments.length; i++) a.push(arguments[i]); return runClosure(v, a); };
return v;
};
return exec(0);
}
var toNativeJs = function (v) { return v; };
try {
run(load());
} catch (e) {
if (typeof console !== 'undefined') {
if (__DEV) {
console.error('[vm-gen] runtime error: ' + (e && e.message ? e.message : e));
console.error('[vm-gen]   at vm fn=' + __ectx.fn + ' ip=' + __ectx.ip + ' op=' + __ectx.op + ' depth=' + __ectx.depth);
if (e && e.stack) console.error('[vm-gen]   host stack:\n' + e.stack);
} else {
console.error('[vm-gen] ' + (e && e.message ? e.message : e));
}
}
if (typeof process !== 'undefined' && process.exit) process.exit(1);
}
})();
})();
