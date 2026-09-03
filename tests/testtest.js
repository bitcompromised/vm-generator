async function test(){
	console.log('test');
	return 5;
}
console.log(test());
await test().then(()=>{console.log('ran')})

