'use strict';

var fs = require('fs');
var assert = require('assert');
var http = require('http');
var url = require('url');

var httpReq = function(method, reqUrl, content, done, cb){
	var urlObj = url.parse(reqUrl);
	urlObj.method = method;
	var req = http.request(urlObj, function(res){
		var bufArr = [];
		res.on('data', function(data){
			bufArr.push(data);
		});
		res.on('end', function(){
			res.body = Buffer.concat(bufArr).toString('utf8');
			cb(res);
		});
	}).on('error', done);
	if(content !== undefined) req.write(content);
	req.end();
};

describe('common tasks', function(){
	before(function(done){
		this.timeout(10000);
		setTimeout(function(){
			done();
		}, 2000);
	});
	it('echo', function(done){
		var pipeline = [
			{execPath: 'echo', args: ['file content...'], stdout: 'echo'},
		];
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/echo', JSON.stringify(pipeline), done, function(res){
			assert.equal(res.statusCode, 200);
			setTimeout(function(){
				httpReq('GET', 'http://a:a@127.0.0.1:1180/~/echo', undefined, done, function(res){
					assert.equal(res.statusCode, 200);
					assert.equal( fs.readFileSync('mnt/echo', {encoding: 'utf8'}), 'file content...\n' );
					done();
				});
			}, 100);
		});
	});
	it('cat from stdin to stdout', function(done){
		var pipeline = [
			{stdin: 'echo'},
			{stdout: 'cat'},
		];
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/cat', JSON.stringify(pipeline), done, function(res){
			assert.equal(res.statusCode, 200);
			setTimeout(function(){
				httpReq('GET', 'http://a:a@127.0.0.1:1180/~/cat', undefined, done, function(res){
					assert.equal(res.statusCode, 200);
					assert.equal( fs.readFileSync('mnt/cat', {encoding: 'utf8'}), 'file content...\n' );
					done();
				});
			}, 100);
		});
	});
	it('complex pipeline', function(done){
		var pipeline = [
			{execPath: 'cat', stdin: 'echo', stdout: '/tmp/complex-0'},
			{execPath: 'head', args: ['-c', '4'], stdout: 'complex-1', forceContinue: true},
			{execPath: 'cat', args: ['/tmp/complex-0', 'complex-1']},
			{stdout: 'complex-2'},
		];
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/complex', JSON.stringify(pipeline), done, function(res){
			assert.equal(res.statusCode, 200);
			setTimeout(function(){
				httpReq('GET', 'http://a:a@127.0.0.1:1180/~/complex', undefined, done, function(res){
					assert.equal(res.statusCode, 200);
					assert.equal( fs.readFileSync('mnt/complex-1', {encoding: 'utf8'}), '' );
					assert.equal( fs.readFileSync('mnt/complex-2', {encoding: 'utf8'}), 'file content...\n' );
					done();
				});
			}, 300);
		});
	});
	it('exit codes and force continue', function(done){
		var pipeline = [
			{execPath: 'test', args: ['-f', '/tmp/complex-0'], forceContinue: true},
			{execPath: 'test', args: ['-f', '/tmp/complex-0']},
			{execPath: 'test', args: ['-f', '/tmp/complex-0']},
		];
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/exit_codes', JSON.stringify(pipeline), done, function(res){
			assert.equal(res.statusCode, 200);
			setTimeout(function(){
				httpReq('GET', 'http://a:a@127.0.0.1:1180/~/exit_codes', undefined, done, function(res){
					assert.equal(res.statusCode, 200);
					assert.equal(res.body.match(/\n/g).length, 2);
					done();
				});
			}, 100);
		});
	});
	it('send code, compile, and execute', function(done){
		var pipeline = [
			{execPath: 'echo', args: ['#include <stdio.h>\nint main(){ printf("Hello world!"); return 0; }'], stdout: '/tmp/code.c'},
			{execPath: 'gcc', args: ['-o', '/tmp/code', '/tmp/code.c'], stdin: '/dev/null', stdout: '/dev/null'},
			{execPath: '/tmp/code', stdout: 'gcc'},
		];
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/gcc', JSON.stringify(pipeline), done, function(res){
			assert.equal(res.statusCode, 200);
			setTimeout(function(){
				httpReq('GET', 'http://a:a@127.0.0.1:1180/~/gcc', undefined, done, function(res){
					assert.equal(res.statusCode, 200);
					assert.equal( fs.readFileSync('mnt/gcc', {encoding: 'utf8'}), 'Hello world!' );
					done();
				});
			}, 500);
		});
	});
});
