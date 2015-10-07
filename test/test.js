'use strict';

var cases = [
	'storage',
	'queue',
	'exec',
	'code',
	'extreme',
];

if(process.getuid()) {
	console.error('This script should be run as root.');
	process.exit();
}
process.chdir(__dirname);

var fs = require('fs-extra');
var http = require('http');
var childProcess = require('child_process');
var assert = require('assert');

describe('start server', function(){
	before(function(done){
		// clean dirs
		fs.removeSync('mnt');
		fs.removeSync('req');
		fs.removeSync('tmp');
		// waiting start server
		require('../index.js');
		setTimeout(done, 1000);
	});
	it('initialize basic dirs with correct permissions', function(done){
		var stat = fs.statSync('tmp');
		assert.equal(stat.mode, parseInt('40777', 8));
		done();
	});
	it('visit with wrong password', function(done){
		http.get('http://a:b@127.0.0.1:1180/', function(res){
			assert.equal(res.statusCode, 401);
			done();
		}).on('error', done);
	});
	it('visit with correct password', function(done){
		http.get('http://a:a@127.0.0.1:1180/', function(res){
			assert.equal(res.statusCode, 404);
			done();
		}).on('error', done);
	});
});

cases.forEach(function(file){
	require('./cases/' + file + '.js');
});
