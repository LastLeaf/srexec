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

var execPipeline = function(id, srcFile, pipeline, done, cb){
	httpReq('PUT', 'http://a:a@127.0.0.1:1180/plus/'+srcFile, fs.readFileSync('plus/'+srcFile), done, function(res){
		assert.equal(res.statusCode, 200);
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/'+id, JSON.stringify(pipeline), done, function(res){
			assert.equal(res.statusCode, 200);
			var waitUntil = Date.now() + 1500;
			var checkRes = function(arr){
				var str = fs.readFileSync('mnt/'+id, {encoding: 'utf8'});
				assert.equal(str, '3\n');
				cb(arr);
			};
			var waitRes = function(){
				httpReq('GET', 'http://a:a@127.0.0.1:1180/~/'+id, undefined, done, function(res){
					if(res.statusCode !== 200) {
						if(Date.now() > waitUntil) return;
						setTimeout(waitRes, 100);
						return;
					}
					var arr = [];
					res.body.split('\n').forEach(function(line){
						if(line) arr.push(JSON.parse(line));
					});
					if(arr.length === pipeline.length) return checkRes(arr);
					var lastArr = arr[arr.length-1];
					if(lastArr && (lastArr.status || lastArr.signal)) return checkRes(arr);
					setTimeout(waitRes, 100);
				});
			};
			waitRes();
		});
	});
};

describe('common a+b code', function(){
	before(function(done){
		httpReq('PUT', 'http://a:a@127.0.0.1:1180/plus/stdin', '1 2\n', done, function(res){
			assert.equal(res.statusCode, 200);
			done();
		});
	});
	it('C', function(done){
		var id = 'plus_c';
		var file = 'src.c';
		execPipeline(id, file, [
			{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'plus/'+file]},
			{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
		], done, function(arr){
			assert.equal(arr[1].status, 0);
			assert.equal(arr[1].signal, 0);
			done();
		});
	});
	it('C++', function(done){
		var id = 'plus_cpp';
		var file = 'src.cpp';
		execPipeline(id, file, [
			{execPath: 'g++', args: ['-o', '/tmp/'+id, 'plus/'+file]},
			{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
		], done, function(arr){
			assert.equal(arr[1].status, 0);
			assert.equal(arr[1].signal, 0);
			done();
		});
	});
	it('JAVA', function(done){
		var id = 'plus_java';
		var file = 'Main.java';
		execPipeline(id, file, [
			{execPath: 'javac', args: ['-d', '/tmp', 'plus/'+file]},
			{execPath: 'java', args: ['Main'], workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
		], done, function(arr){
			assert.equal(arr[1].status, 0);
			assert.equal(arr[1].signal, 0);
			done();
		});
	});
	it('Node.js', function(done){
		var id = 'plus_nodejs';
		var file = 'src.js';
		execPipeline(id, file, [
			{execPath: 'nodejs', args: ['/mnt/plus/'+file], workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
		], done, function(arr){
			assert.equal(arr[0].status, 0);
			assert.equal(arr[0].signal, 0);
			done();
		});
	});
	it('Python', function(done){
		var id = 'plus_py';
		var file = 'src.py';
		execPipeline(id, file, [
			{execPath: 'python', args: ['/mnt/plus/'+file], workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
		], done, function(arr){
			assert.equal(arr[0].status, 0);
			assert.equal(arr[0].signal, 0);
			done();
		});
	});
	it('Shell', function(done){
		var id = 'plus_sh';
		var file = 'src.sh';
		execPipeline(id, file, [
			{execPath: '/bin/bash', args: ['/mnt/plus/'+file], workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
		], done, function(arr){
			assert.equal(arr[0].status, 0);
			assert.equal(arr[0].signal, 0);
			done();
		});
	});
	after(function(done){
		setTimeout(function(){
			done();
		}, 1000);
	});
});
