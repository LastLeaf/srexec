'use strict';

var fs = require('fs');
var assert = require('assert');
var http = require('http');
var url = require('url');

var httpReq = function(method, reqUrl, content, done, cb){
	var urlObj = url.parse(reqUrl);
	urlObj.method = method;
	var req = http.request(urlObj, cb).on('error', done);
	if(content !== undefined) req.write(content);
	req.end();
};

describe('pipeline queue', function(){
	it('send illegal pipeline request', function(done){
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/1', undefined, done, function(res){
			assert.equal(res.statusCode, 400);
			done();
		});
	});
	it('send pipeline request and exceed POST body limit', function(done){
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/1', new Buffer(10485761), done, function(res){
			assert.equal(res.statusCode, 413);
			done();
		});
	});
	it('send pipeline request and exceed resource hard limit', function(done){
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/1', '[{ "timeLimit": 3600001 }]', done, function(res){
			assert.equal(res.statusCode, 406);
			done();
		});
	});
	it('send pipeline request that require missed files', function(done){
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/1', '[{ "stdin": "missed_file_1" }, { "execPath": "missed_file_2" }, { "execFile": "missed_file_3" }]', done, function(res){
			assert.equal(res.statusCode, 404);
			var bufArr = [];
			res.on('data', function(data){
				bufArr.push(data);
			});
			res.on('end', function(){
				var str = Buffer.concat(bufArr).toString('utf8');
				if(str !== '["missed_file_1","missed_file_3"]' && str !== '["missed_file_3","missed_file_1"]') {
					assert.equal(str, '["missed_file_1","missed_file_3"]');
				}
				done();
			});
		});
	});
	it('send pipeline request and exceed max queue length', function(done){
		httpReq('POST', 'http://a:a@127.0.0.1:1180/~/1', '[]', done, function(res){
			assert.equal(res.statusCode, 200);
			httpReq('POST', 'http://a:a@127.0.0.1:1180/~/1', '[]', done, function(res){
				assert.equal(res.statusCode, 503);
				done();
			});
		});
	});
	it('get file that does not exist', function(done){
		httpReq('GET', 'http://a:a@127.0.0.1:1180/~/1', undefined, done, function(res){
			assert.equal(res.statusCode, 404);
			done();
		});
	});
	it('delete file', function(done){
		httpReq('DELETE', 'http://a:a@127.0.0.1:1180/~/1', undefined, done, function(res){
			assert.equal(res.statusCode, 200);
			fs.stat('req/1', function(err, stat){
				assert.notEqual(err, null);
				done();
			});
		});
	});
});
