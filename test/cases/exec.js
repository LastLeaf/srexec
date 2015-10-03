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
	it('cat', function(done){
		setTimeout(function(){
			var pipeline = [
				{execPath: 'cat', argv: ['file content...'], stdout: 'cat'},
			];
			httpReq('POST', 'http://a:a@127.0.0.1:1180/~/cat', JSON.stringify(pipeline), done, function(res){
				assert.equal(res.statusCode, 200);
				setTimeout(function(){
					httpReq('GET', 'http://a:a@127.0.0.1:1180/~/cat', undefined, done, function(res){
						assert.equal(res.statusCode, 200);
						console.info(res.body);
						assert.equal( fs.readFileSync('mnt/cat', {encoding: 'utf8'}), 'file content...' );
						done();
					});
				}, 500);
			});
		}, 1000);
	});
});
