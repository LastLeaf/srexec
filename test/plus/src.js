'use strict';

var readline = require('readline');
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
	terminal: false
});
rl.on('line', function (str) {
	var n = str.split(' ');
	console.log( Number(n[0]) + Number(n[1]) );
});
