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
	it('forever fork', function(done){
		this.timeout(5000);
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
	after(function(done){
		setTimeout(function(){
			done();
		}, 1000);
	});
});
