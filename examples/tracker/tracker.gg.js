var passed = 0;
var failed = 0;

function test(name, actual, expected) {
    if (actual === expected) {
        console.log("PASS: " + name);
        passed = passed + 1;
    } else {
        console.log("FAIL: " + name);
        console.log("  Expected: " + expected);
        console.log("  Got: " + actual);
        failed = failed + 1;
    }
}

function testTrue(name, value) {
    test(name, value, true);
}

function testFalse(name, value) {
    test(name, value, false);
}

/* =========================================================
   BASIC ARITHMETIC
   ========================================================= */

test("addition", 2 + 3, 5);
test("subtraction", 10 - 4, 6);
test("multiplication", 6 * 7, 42);
test("division", 84 / 2, 42);
test("modulo", 17 % 5, 2);

test("operator precedence", 2 + 3 * 4, 14);
test("parentheses", (2 + 3) * 4, 20);
test("negative number", -10, -10);
test("negative arithmetic", -10 + 15, 5);

test("large arithmetic", 1000000 * 3, 3000000);


/* =========================================================
   COMPARISONS
   ========================================================= */

testTrue("greater than", 10 > 5);
testTrue("less than", 5 < 10);
testTrue("greater or equal", 10 >= 10);
testTrue("less or equal", 10 <= 10);
testTrue("strict equality", 42 === 42);
testFalse("strict inequality", 42 !== 42);

testFalse("greater than false", 5 > 10);
testFalse("less than false", 10 < 5);


/* =========================================================
   BOOLEAN LOGIC
   ========================================================= */

testTrue("AND", true && true);
testFalse("AND false", true && false);

testTrue("OR", true || false);
testTrue("OR second", false || true);
testFalse("OR false", false || false);

testTrue("NOT", !false);
testFalse("NOT true", !true);

testTrue(
    "complex boolean expression",
    (10 > 5) && (20 > 10)
);

testFalse(
    "complex boolean expression false",
    (10 > 5) && (20 < 10)
);


/* =========================================================
   VARIABLES
   ========================================================= */

var x = 10;
var y = 32;

test("variables", x + y, 42);

x = 20;
test("variable assignment", x, 20);

x = x + 22;
test("variable reassignment", x, 42);

var a = 5;
var b = 10;
var c = a * b;

test("variable dependency", c, 50);


/* =========================================================
   CONDITIONALS
   ========================================================= */

var result = 0;

if (10 > 5) {
    result = 42;
}

test("if statement", result, 42);


result = 0;

if (5 > 10) {
    result = 1;
} else {
    result = 42;
}

test("if else", result, 42);


var score = 85;
var grade = "";

if (score >= 90) {
    grade = "A";
} else if (score >= 80) {
    grade = "B";
} else if (score >= 70) {
    grade = "C";
} else {
    grade = "F";
}

test("else if", grade, "B");


/* =========================================================
   WHILE LOOPS
   ========================================================= */

var sum = 0;
var i = 1;

while (i <= 10) {
    sum = sum + i;
    i = i + 1;
}

test("while loop", sum, 55);


/* =========================================================
   FOR LOOPS
   ========================================================= */

sum = 0;

for (i = 1; i <= 10; i = i + 1) {
    sum = sum + i;
}

test("for loop", sum, 55);


/* =========================================================
   NESTED LOOPS
   ========================================================= */

var count = 0;
var outer = 0;

while (outer < 5) {
    var inner = 0;

    while (inner < 5) {
        count = count + 1;
        inner = inner + 1;
    }

    outer = outer + 1;
}

test("nested loops", count, 25);


/* =========================================================
   FUNCTIONS
   ========================================================= */

function add(a, b) {
    return a + b;
}

test("function call", add(20, 22), 42);


function multiply(a, b) {
    return a * b;
}

test("function multiplication", multiply(6, 7), 42);


function square(n) {
    return n * n;
}

test("function return", square(7), 49);


/* =========================================================
   FUNCTIONS CALLING FUNCTIONS
   ========================================================= */

function double(n) {
    return n * 2;
}

function quadruple(n) {
    return double(double(n));
}

test("nested function calls", quadruple(10), 40);


function calculate(a, b, c) {
    return add(multiply(a, b), c);
}

test("function composition", calculate(6, 7, 2), 44);


/* =========================================================
   RECURSION
   ========================================================= */

function factorial(n) {
    if (n <= 1) {
        return 1;
    }

    return n * factorial(n - 1);
}

test("factorial", factorial(5), 120);
test("factorial zero", factorial(0), 1);


function fibonacci(n) {
    if (n <= 1) {
        return n;
    }

    return fibonacci(n - 1) + fibonacci(n - 2);
}

test("fibonacci", fibonacci(10), 55);


/* =========================================================
   ARRAYS
   ========================================================= */

var numbers = [10, 20, 30, 40, 50];

test("array first element", numbers[0], 10);
test("array middle element", numbers[2], 30);
test("array last element", numbers[4], 50);
test("array length", numbers.length, 5);

numbers[0] = 42;

test("array assignment", numbers[0], 42);


/* =========================================================
   ARRAY LOOPS
   ========================================================= */

var values = [1, 2, 3, 4, 5];
sum = 0;

for (i = 0; i < values.length; i = i + 1) {
    sum = sum + values[i];
}

test("array iteration", sum, 15);


/* =========================================================
   NESTED ARRAYS
   ========================================================= */

var matrix = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
];

test("nested array", matrix[0][0], 1);
test("nested array middle", matrix[1][1], 5);
test("nested array last", matrix[2][2], 9);


/* =========================================================
   STRINGS
   ========================================================= */

var hello = "Hello";
var world = "World";

test("string literal", hello, "Hello");
test("string concatenation", hello + " " + world, "Hello World");
test("string length", "hello".length, 5);
test("empty string", "".length, 0);


/* =========================================================
   OBJECTS
   ========================================================= */

var person = {
    name: "Alice",
    age: 30
};

test("object property", person.name, "Alice");
test("object number", person.age, 30);

person.age = 31;

test("object assignment", person.age, 31);


/* =========================================================
   NESTED OBJECTS
   ========================================================= */

var user = {
    name: "Bob",
    address: {
        city: "Atlanta",
        zip: 30075
    }
};

test("nested object", user.address.city, "Atlanta");
test("nested object number", user.address.zip, 30075);


/* =========================================================
   OBJECT + ARRAY
   ========================================================= */

var team = {
    name: "Team A",
    members: ["Alice", "Bob", "Charlie"]
};

test("object array", team.members[0], "Alice");
test("object array middle", team.members[1], "Bob");
test("object array length", team.members.length, 3);


/* =========================================================
   SCOPE
   ========================================================= */

var globalValue = 10;

function scopeTest() {
    var localValue = 32;
    return globalValue + localValue;
}

test("function scope", scopeTest(), 42);


/* =========================================================
   CLOSURE
   ========================================================= */

function makeAdder(x) {
    return function(y) {
        return x + y;
    };
}

var addTen = makeAdder(10);

test("closure", addTen(32), 42);


/* =========================================================
   HIGHER ORDER FUNCTIONS
   ========================================================= */

function apply(fn, value) {
    return fn(value);
}

function triple(n) {
    return n * 3;
}

test("function as argument", apply(triple, 14), 42);


/* =========================================================
   LOGICAL CONDITIONS
   ========================================================= */

function isAdult(age) {
    return age >= 18;
}

testTrue("function boolean true", isAdult(21));
testFalse("function boolean false", isAdult(15));


function inRange(value, min, max) {
    return value >= min && value <= max;
}

testTrue("range check", inRange(5, 1, 10));
testFalse("range check false", inRange(15, 1, 10));


/* =========================================================
   BREAK
   ========================================================= */

sum = 0;

for (i = 1; i <= 100; i = i + 1) {
    if (i === 10) {
        break;
    }

    sum = sum + i;
}

test("break", sum, 45);


/* =========================================================
   CONTINUE
   ========================================================= */

sum = 0;

for (i = 1; i <= 10; i = i + 1) {
    if (i % 2 === 0) {
        continue;
    }

    sum = sum + i;
}

test("continue", sum, 25);


/* =========================================================
   FIBONACCI ITERATIVE
   ========================================================= */

function fibonacciLoop(n) {
    var a = 0;
    var b = 1;
    var count = 0;

    while (count < n) {
        var next = a + b;
        a = b;
        b = next;
        count = count + 1;
    }

    return a;
}

test("iterative fibonacci", fibonacciLoop(10), 55);


/* =========================================================
   PRIME NUMBER TEST
   ========================================================= */

function isPrime(n) {
    if (n < 2) {
        return false;
    }

    var divisor = 2;

    while (divisor * divisor <= n) {
        if (n % divisor === 0) {
            return false;
        }

        divisor = divisor + 1;
    }

    return true;
}

testTrue("prime 2", isPrime(2));
testTrue("prime 17", isPrime(17));
testTrue("prime 97", isPrime(97));

testFalse("prime 1", isPrime(1));
testFalse("prime 10", isPrime(10));
testFalse("prime 100", isPrime(100));


/* =========================================================
   GREATEST COMMON DIVISOR
   ========================================================= */

function gcd(a, b) {
    while (b !== 0) {
        var temp = b;
        b = a % b;
        a = temp;
    }

    return a;
}

test("GCD", gcd(48, 18), 6);
test("GCD second", gcd(100, 25), 25);


/* =========================================================
   ARRAY ALGORITHM
   ========================================================= */

function sumArray(array) {
    var total = 0;

    for (var i = 0; i < array.length; i = i + 1) {
        total = total + array[i];
    }

    return total;
}

test("sum array function", sumArray([1, 2, 3, 4, 5]), 15);
test("sum empty array", sumArray([]), 0);


/* =========================================================
   MAXIMUM
   ========================================================= */

function maximum(array) {
    var max = array[0];

    for (var i = 1; i < array.length; i = i + 1) {
        if (array[i] > max) {
            max = array[i];
        }
    }

    return max;
}

test("array maximum", maximum([3, 9, 2, 7, 4]), 9);


/* =========================================================
   STRING PROCESSING
   ========================================================= */

function reverseString(str) {
    var result = "";

    for (var i = str.length - 1; i >= 0; i = i - 1) {
        result = result + str[i];
    }

    return result;
}

test("reverse string", reverseString("hello"), "olleh");
test("reverse palindrome", reverseString("racecar"), "racecar");


/* =========================================================
   NESTED FUNCTION + RECURSION
   ========================================================= */

function power(base, exponent) {
    if (exponent === 0) {
        return 1;
    }

    return base * power(base, exponent - 1);
}

test("power", power(2, 10), 1024);
test("power zero", power(5, 0), 1);
test("power one", power(7, 1), 7);


/* =========================================================
   COMPLEX EXPRESSION
   ========================================================= */

var complex =
    ((10 + 5) * 3) -
    (20 / 2) +
    (4 * 2) -
    6;

test("complex expression", complex, 37);


/* =========================================================
   FINAL RESULT
   ========================================================= */

console.log("");
console.log("==============================");
console.log("Tests passed: " + passed);
console.log("Tests failed: " + failed);
console.log("==============================");

if (failed === 0) {
    console.log("ALL TESTS PASSED");
} else {
    console.log("SOME TESTS FAILED");
}
