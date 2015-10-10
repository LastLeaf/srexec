'use strict';

var fs = require('fs');
var assert = require('assert');
var http = require('http');
var url = require('url');

var httpReq = function(method, reqUrl, content, done, cb){
	var urlObj = url.parse(reqUrl);
	urlObj.method = method;
	urlObj.agent = false;
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
	httpReq('PUT', 'http://a:a@127.0.0.1:1180/extreme/'+srcFile, fs.readFileSync('extreme/'+srcFile), done, function(res){
		assert.equal(res.statusCode, 200);
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/'+id, JSON.stringify(pipeline), done, function(res){
			assert.equal(res.statusCode, 200);
			var waitUntil = Date.now() + 1500;
			var checkRes = function(arr){
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

describe('wrong and extreme code', function(){
	var maxCorrectTime = 0;
	var maxCorrectMem = 0;
	it('a correct one', function(done){
		var id = 'extreme_correct';
		var file = 'correct.c';
		execPipeline(id, file, [
			{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
			{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
		], done, function(arr){
			assert.equal(arr[1].status, 0);
			assert.equal(arr[1].signal, 0);
			maxCorrectTime = Math.round(arr[1].time * 2);
			maxCorrectMem = Math.round(arr[1].mem * 1.1);
			done();
		});
	});
	it('time', function(done){
		this.timeout(20000);
		var id = 'extreme_time';
		var file = 'time.c';
		execPipeline(id, file, [
			{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
			{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id, timeLimit: 1000, totalTimeLimit: 3000, memLimit: 64*1024*1024, fileSizeLimit: 1024*1024},
		], done, function(arr){
			assert.equal(arr[1].err, 10);
			done();
		});
	});
	it('time (with a correct one)', function(done){
		this.timeout(20000);
		setTimeout(function(){
			var doneLeft = 2;
			var doneOne = function(){
				if(--doneLeft) return;
				done();
			};
			var id = 'extreme_time_p1';
			var file = 'time.c';
			execPipeline(id, file, [
				{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
				{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id, timeLimit: 1000, totalTimeLimit: 3000, memLimit: 64*1024*1024, fileSizeLimit: 1024*1024},
			], doneOne, function(arr){
				assert.equal(arr[1].err, 10);
				doneOne();
			});
			var id = 'extreme_time_p2';
			var file = 'correct.c';
			execPipeline(id, file, [
				{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
				{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
			], doneOne, function(arr){
				assert.equal(arr[1].status, 0);
				assert.equal(arr[1].signal, 0);
				assert.equal(arr[1].time <= maxCorrectTime, true);
				assert.equal(arr[1].mem <= maxCorrectMem, true);
				doneOne();
			});
		}, 1000);
	});
	it('total time', function(done){
		this.timeout(20000);
		var id = 'extreme_sleep';
		var file = 'sleep.c';
		execPipeline(id, file, [
			{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
			{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id, timeLimit: 1000, totalTimeLimit: 3000, memLimit: 64*1024*1024, fileSizeLimit: 1024*1024},
		], done, function(arr){
			assert.equal(arr[1].err, 10);
			done();
		});
	});
	it('memory', function(done){
		this.timeout(20000);
		var id = 'extreme_memory';
		var file = 'memory.c';
		execPipeline(id, file, [
			{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
			{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id, timeLimit: 10000, totalTimeLimit: 15000, memLimit: 16*1024*1024, fileSizeLimit: 1024*1024},
		], done, function(arr){
			assert.equal(arr[1].err, 11);
			done();
		});
	});
	it('memory (with a correct one)', function(done){
		this.timeout(20000);
		setTimeout(function(){
			var doneLeft = 2;
			var doneOne = function(){
				if(--doneLeft) return;
				done();
			};
			var id = 'extreme_memory_p1';
			var file = 'memory.c';
			execPipeline(id, file, [
				{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
				{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id, timeLimit: 10000, totalTimeLimit: 15000, memLimit: 16*1024*1024, fileSizeLimit: 1024*1024},
			], doneOne, function(arr){
				assert.equal(arr[1].err, 11);
				doneOne();
			});
			var id = 'extreme_memory_p2';
			var file = 'correct.c';
			execPipeline(id, file, [
				{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
				{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
			], doneOne, function(arr){
				assert.equal(arr[1].status, 0);
				assert.equal(arr[1].signal, 0);
				assert.equal(arr[1].time <= maxCorrectTime, true);
				assert.equal(arr[1].mem <= maxCorrectMem, true);
				doneOne();
			});
		}, 1000);
	});
	it('file size', function(done){
		this.timeout(20000);
		var id = 'extreme_output';
		var file = 'output.c';
		execPipeline(id, file, [
			{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
			{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id, timeLimit: 10000, totalTimeLimit: 15000, memLimit: 64*1024*1024, fileSizeLimit: 1024*1024},
		], done, function(arr){
			assert.equal(arr[1].err, 12);
			done();
		});
	});
	it('forever fork', function(done){
		this.timeout(20000);
		var id = 'extreme_fork';
		var file = 'fork.c';
		execPipeline(id, file, [
			{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
			{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id, timeLimit: 1000, totalTimeLimit: 1500, memLimit: 64*1024*1024, fileSizeLimit: 1024*1024},
		], done, function(arr){
			assert.equal(arr[1].err, 11);
			done();
		});
	});
	it('forever fork (with a correct one)', function(done){
		this.timeout(20000);
		setTimeout(function(){
			var doneLeft = 2;
			var doneOne = function(){
				if(--doneLeft) return;
				done();
			};
			var id = 'extreme_fork_p1';
			var file = 'fork.c';
			execPipeline(id, file, [
				{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
				{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id, timeLimit: 1000, totalTimeLimit: 1500, memLimit: 64*1024*1024, fileSizeLimit: 1024*1024},
			], doneOne, function(arr){
				assert.equal(arr[1].err, 11);
				doneOne();
			});
			var id = 'extreme_fork_p2';
			var file = 'correct.c';
			execPipeline(id, file, [
				{execPath: 'gcc', args: ['-o', '/tmp/'+id, 'extreme/'+file]},
				{execPath: '/tmp/'+id, workingDir: '/tmp', stdin: 'plus/stdin', stdout: id},
			], doneOne, function(arr){
				assert.equal(arr[1].status, 0);
				assert.equal(arr[1].signal, 0);
				assert.equal(arr[1].time <= maxCorrectTime, true);
				assert.equal(arr[1].mem <= maxCorrectMem, true);
				doneOne();
			});
		}, 1000);
	});
	after(function(done){
		setTimeout(function(){
			done();
		}, 1000);
	});
});
