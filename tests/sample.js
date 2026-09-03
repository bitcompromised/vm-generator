function greet(name) {
  const greeting = "Hello, " + name + "!"; // build message
  return greeting;
}
function factoriala(n) {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result = result * i;
  }
  return result;
}
function factorialb(n) {
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result = result * i;
  }
  return result;
}

const <@name test>secret = "top-secret-token-44";
var test = 5+7;
test += 9;
console.log( greet(<@encstr test hex>>"world"), factoriala(5), secret);
