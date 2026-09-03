// ================================================================
// Reconstructed from vm-gen bytecode
// Best-effort decompilation; not guaranteed to match original source
// ================================================================

'use strict';

function $main() {
  runTests()
    // VM block 0 @ 0
    // HALT
}
$main();
function runTests() {
    // VM block 0 @ 0
    console.log((("" + "Node.js ") + __vm___getglobal("process")["version"]));
    console.log((("" + "V8 ") + __vm___getglobal("process")["versions"]["v8"]));
    console.log((((("" + "Platform: ") + __vm___getglobal("process")["platform"]) + " ") + __vm___getglobal("process")["arch"]));
    console.log("");
    console.log(((("" + "Running ") + __vm___getglobal("tests")["length"]) + " VM tests...n"));
    v0 = __vm___getglobal("tests");
    v1 = 0;
    // VM block 1 @ 134
    // if (!((v1 < (v0).length))) goto 410
    // conditional jump -> VM_410
    // VM block 2 @ 148
    v2 = v0[v1];
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // VM try handler -> 287
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    v4 = (__vm___getglobal("Number")((__vm___getglobal("process")["hrtime"] - __vm___getglobal("process")["hrtime"]["bigint"])) / 1000000);
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    console.log((v4["toFixed"] + 3));
    // end VM try
    // VM jump -> 397
    // goto VM_397
    // VM block 3 @ 287
    v5 = v4;
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    v6 = (__vm___getglobal("Number")((__vm___getglobal("process")["hrtime"] - __vm___getglobal("process")["hrtime"]["bigint"])) / 1000000);
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    console.log((v6["toFixed"] + 3));
    console.log((("" + "       ") + v5["message"]));
    // VM block 4 @ 397
    v1 = (v1 + 1);
    // VM jump -> 134
    // goto VM_134
    // VM block 5 @ 410
    console.log("\n--------------------------------");
    console.log((("" + "Passed: ") + 0));
    console.log((("" + "Failed: ") + 0));
    console.log((("" + "Total:  ") + __vm___getglobal("tests")["length"]));
    console.log("--------------------------------");
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = makeCounter;
    v1 = v0();
    // if (!((v1() !== 1))) goto 41
    // conditional jump -> VM_41
    // VM block 1 @ 26
    throw new __vm___getglobal("Error")("First increment failed");
    // VM block 2 @ 41
    // if (!((v1() !== 2))) goto 68
    // conditional jump -> VM_68
    // VM block 3 @ 53
    throw new __vm___getglobal("Error")("Second increment failed");
    // VM block 4 @ 68
    // if (!((v1() !== 3))) goto 95
    // conditional jump -> VM_95
    // VM block 5 @ 80
    throw new __vm___getglobal("Error")("Third increment failed");
    // VM block 6 @ 95
    return null;
}

function makeCounter() {
    // VM block 0 @ 0
    v0 = 0;
    return $anon;
    return null;
}

function $anon() {
    // VM block 0 @ 0
    upvalue_0 = (upvalue_0 + 1);
    // unsupported VM instruction: CLOSE_UPVALUE
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    return (upvalue_0 + 1);
    // unsupported VM instruction: CLOSE_UPVALUE
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = makeCounter;
    v1 = v0();
    v2 = v0();
    // if (!((v1() !== 1))) goto 49
    // conditional jump -> VM_49
    // VM block 1 @ 34
    throw new __vm___getglobal("Error")("Counter A incorrect");
    // VM block 2 @ 49
    // if (!((v1() !== 2))) goto 76
    // conditional jump -> VM_76
    // VM block 3 @ 61
    throw new __vm___getglobal("Error")("Counter A incorrect");
    // VM block 4 @ 76
    // if (!((v2() !== 1))) goto 103
    // conditional jump -> VM_103
    // VM block 5 @ 88
    throw new __vm___getglobal("Error")("Counter B leaked state");
    // VM block 6 @ 103
    return null;
}

function makeCounter() {
    // VM block 0 @ 0
    v0 = 0;
    return $anon;
    return null;
}

function $anon() {
    // VM block 0 @ 0
    upvalue_0 = (upvalue_0 + 1);
    // unsupported VM instruction: CLOSE_UPVALUE
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    return (upvalue_0 + 1);
    // unsupported VM instruction: CLOSE_UPVALUE
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = test;
    // if (!((v0() !== "inner"))) goto 33
    // conditional jump -> VM_33
    // VM block 1 @ 18
    throw new __vm___getglobal("Error")("Lexical scope is incorrect");
    // VM block 2 @ 33
    // if (!(("outer" !== "outer"))) goto 58
    // conditional jump -> VM_58
    // VM block 3 @ 43
    throw new __vm___getglobal("Error")("Outer scope was modified");
    // VM block 4 @ 58
    return null;
}

function test() {
    // VM block 0 @ 0
    return "inner";
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = "outer";
    v1 = "inner";
    // if (!((v1 !== "inner"))) goto 37
    // conditional jump -> VM_37
    // VM block 1 @ 22
    throw new __vm___getglobal("Error")("Inner block scope failed");
    // VM block 2 @ 37
    // if (!((v0 !== "outer"))) goto 62
    // conditional jump -> VM_62
    // VM block 3 @ 47
    throw new __vm___getglobal("Error")("Block scope leaked");
    // VM block 4 @ 62
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = [1, 2, 3, 4];
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!((__vm___getglobal("JSON")["stringify"] !== v1))) goto 73
    // conditional jump -> VM_73
    // VM block 1 @ 58
    throw new __vm___getglobal("Error")("Arrow function failed");
    // VM block 2 @ 73
    return null;
}

function $anon(v0) {
    // VM block 0 @ 0
    return (v0 * 2);
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = { "value": 42, "regular": $anon, "arrow": $anon };
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!((v0 !== v0["regular"]))) goto 56
    // conditional jump -> VM_56
    // VM block 1 @ 41
    throw new __vm___getglobal("Error")("Regular this binding failed");
    // VM block 2 @ 56
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!((v0 !== __vm___getglobal(v0["arrow"])))) goto 92
    // conditional jump -> VM_92
    // VM block 3 @ 77
    throw new __vm___getglobal("Error")("Arrow this behavior is unexpected");
    // VM block 4 @ 92
    return null;
}

function $anon() {
    // VM block 0 @ 0
    return this["value"];
    return null;
}

function $anon() {
    // VM block 0 @ 0
    return __vm___getglobal("undefined");
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = { "greet": $anon };
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!((v1 !== v1["greet"]))) goto 64
    // conditional jump -> VM_64
    // VM block 1 @ 49
    throw new __vm___getglobal("Error")("Prototype lookup failed");
    // VM block 2 @ 64
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    // if (!((__vm___getglobal("Object")["getPrototypeOf"] === v1))) goto 104
    // conditional jump -> VM_104
    // VM block 3 @ 89
    throw new __vm___getglobal("Error")("Prototype relationship failed");
    // VM block 4 @ 104
    return null;
}

function $anon() {
    // VM block 0 @ 0
    return "hello";
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = { "__isClass": true, "__name": "Animal", "__super": null, "__ctor": $anon, "__methods": { "speak": $anon } };
    v1 = { "__isClass": true, "__name": "Dog", "__super": v0, "__methods": { "speak": $anon } };
    v2 = new v1("Rex");
    // if (!(!(v2 instanceof v1))) goto 114
    // conditional jump -> VM_114
    // VM block 1 @ 99
    throw new __vm___getglobal("Error")("Dog instanceof failed");
    // VM block 2 @ 114
    // if (!(!(v2 instanceof v0))) goto 143
    // conditional jump -> VM_143
    // VM block 3 @ 128
    throw new __vm___getglobal("Error")("Animal instanceof failed");
    // VM block 4 @ 143
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!((v2 !== v2["speak"]))) goto 175
    // conditional jump -> VM_175
    // VM block 5 @ 160
    throw new __vm___getglobal("Error")("Method override failed");
    // VM block 6 @ 175
    return null;
}

function $anon(v0) {
    // VM block 0 @ 0
    this["name"] = v0;
    return null;
}

function $anon() {
    // VM block 0 @ 0
    return (("" + this["name"]) + " speaks");
    return null;
}

function $anon() {
    // VM block 0 @ 0
    return (("" + this["name"]) + " barks");
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = numbers;
    v1 = [v0()];
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!((__vm___getglobal("JSON")["stringify"] !== v1))) goto 56
    // conditional jump -> VM_56
    // VM block 1 @ 41
    throw new __vm___getglobal("Error")("Generator failed");
    // VM block 2 @ 56
    return null;
}

function numbers() {
    // VM block 0 @ 0
    return null;
}

function $anon() {
    // VM block 0 @ 0
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    // if (!((v0 !== 123))) goto 46
    // conditional jump -> VM_46
    // VM block 1 @ 31
    throw new __vm___getglobal("Error")("Promise resolution failed");
    // VM block 2 @ 46
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = [];
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!(("microtask"["join"] !== ","))) goto 85
    // conditional jump -> VM_85
    // VM block 1 @ 70
    throw new __vm___getglobal("Error")("Microtask ordering failed");
    // VM block 2 @ 85
    return null;
}

function $anon() {
    // VM block 0 @ 0
    // VM try handler -> 22
    throw new __vm___getglobal("Error")("test");
    // end VM try
    // VM jump -> 44
    // goto VM_44
    // VM block 1 @ 22
    v0 = undefined;
    // VM block 2 @ 44
    throw new __vm___getglobal("Error")("Exception handling failed");
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = { "name": "Alice", "age": 30 };
    v1 = v0;
    v2 = v1["name"];
    v3 = v1["age"];
    // if ((v2 !== "Alice")) goto 68
    // conditional jump -> VM_68
    // VM block 1 @ 54
    // if ((v3 !== 30)) goto 68
    // conditional jump -> VM_68
    // VM block 2 @ 64
    // VM jump -> 69
    // goto VM_69
    // VM block 3 @ 68
    // VM block 4 @ 69
    // if (!(true)) goto 87
    // conditional jump -> VM_87
    // VM block 5 @ 72
    throw new __vm___getglobal("Error")("Object destructuring failed");
    // VM block 6 @ 87
    v4 = [10, 20];
    v5 = v4[0];
    v6 = v4[1];
    // if ((v5 !== 10)) goto 143
    // conditional jump -> VM_143
    // VM block 7 @ 129
    // if ((v6 !== 20)) goto 143
    // conditional jump -> VM_143
    // VM block 8 @ 139
    // VM jump -> 144
    // goto VM_144
    // VM block 9 @ 143
    // VM block 10 @ 144
    // if (!(true)) goto 162
    // conditional jump -> VM_162
    // VM block 11 @ 147
    throw new __vm___getglobal("Error")("Array destructuring failed");
    // VM block 12 @ 162
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = __vm___getglobal("Symbol")("private-ish");
    v1 = {  };
    v1[v0] = 123;
    // if (!((v1[v0] !== 123))) goto 61
    // conditional jump -> VM_61
    // VM block 1 @ 46
    throw new __vm___getglobal("Error")("Symbol property failed");
    // VM block 2 @ 61
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!((__vm___getglobal("Object")["keys"][v1] !== 0))) goto 104
    // conditional jump -> VM_104
    // VM block 3 @ 89
    throw new __vm___getglobal("Error")("Symbol unexpectedly appeared in Object.keys()");
    // VM block 4 @ 104
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = new __vm___getglobal("WeakMap")();
    v1 = {  };
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // if (!(("value"["get"] !== v1))) goto 72
    // conditional jump -> VM_72
    // VM block 1 @ 57
    throw new __vm___getglobal("Error")("WeakMap failed");
    // VM block 2 @ 72
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = __vm___regex("hello\\s+world", "i");
    // unsupported VM instruction: CALL_METHOD
    // unsupported VM instruction: UNKNOWN
    // unsupported VM instruction: UNKNOWN
    throw new __vm___getglobal("Error")("RegExp matching failed");
    return null;
}

function $anon() {
    // VM block 0 @ 0
    // if (!((9007199254741000 !== 9007199254741000))) goto 25
    // conditional jump -> VM_25
    // VM block 1 @ 10
    throw new __vm___getglobal("Error")("BigInt arithmetic failed");
    // VM block 2 @ 25
    return null;
}

function $anon() {
    // VM block 0 @ 0
    v0 = { "value": 10 };
    v1 = new __vm___getglobal("Proxy")(v0, { "get": $anon });
    // if (!((v1["value"] !== 20))) goto 67
    // conditional jump -> VM_67
    // VM block 1 @ 52
    throw new __vm___getglobal("Error")("Proxy get trap failed");
    // VM block 2 @ 67
    return null;
}

function $anon(v0, v1) {
    // VM block 0 @ 0
    // if (!((v1 === "value"))) goto 22
    // conditional jump -> VM_22
    // VM block 1 @ 10
    return (v0[v1] * 2);
    // VM block 2 @ 22
    return v0[v1];
    return null;
}

// Original VM entry point: $main()
// $main();
