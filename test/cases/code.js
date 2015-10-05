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
			setTimeout(function(){
				httpReq('GET', 'http://a:a@127.0.0.1:1180/~/'+id, undefined, done, function(res){
					assert.equal(res.statusCode, 200);
					var str = fs.readFileSync('mnt/'+id, {encoding: 'utf8'});
					assert.equal(str, '3\n');
					var arr = [];
					res.body.split('\n').forEach(function(line){
						if(line) arr.push(JSON.parse(line));
					});
					cb(arr);
				});
			}, 100);
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
			{execPath: '/tmp/'+id, stdin: 'plus/stdin', stdout: id},
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
			{execPath: '/tmp/'+id, stdin: 'plus/stdin', stdout: id},
		], done, function(arr){
			assert.equal(arr[1].status, 0);
			assert.equal(arr[1].signal, 0);
			done();
		});
	});
});
