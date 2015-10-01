'use strict';

var fs = require('fs');
var assert = require('assert');
var http = require('http');
var url = require('url');

describe('pipeline queue', function(){
	it('send illegal pipeline request', function(done){
		var urlObj = url.parse('http://a:a@127.0.0.1:1180/~/1');
		urlObj.method = 'POST';
		var req = http.request(urlObj, function(res){
			assert.equal(res.statusCode, 400);
			done();
		}).on('error', done);
		req.end();
	});
	it('send pipeline request and exceed POST body limit', function(done){
		var urlObj = url.parse('http://a:a@127.0.0.1:1180/~/1');
		urlObj.method = 'POST';
		var req = http.request(urlObj, function(res){
			assert.equal(res.statusCode, 413);
			done();
		}).on('error', done);
		req.write(new Buffer(10485761));
		req.end();
	});
	it('send pipeline request and exceed max queue length', function(done){
		var urlObj = url.parse('http://a:a@127.0.0.1:1180/~/1');
		urlObj.method = 'POST';
		var req = http.request(urlObj, function(res){
			assert.equal(res.statusCode, 200);
			var req = http.request(urlObj, function(res){
				assert.equal(res.statusCode, 503);
				done();
			}).on('error', done);
			req.write('[]');
			req.end();
		}).on('error', done);
		req.write('[]');
		req.end();
	});
	it('get file that does not exist', function(done){
		var urlObj = url.parse('http://a:a@127.0.0.1:1180/~/-');
		urlObj.method = 'GET';
		var req = http.request(urlObj, function(res){
			assert.equal(res.statusCode, 404);
			done();
		}).on('error', done);
		req.end();
	});
	it('delete file', function(done){
		var urlObj = url.parse('http://a:a@127.0.0.1:1180/~/1');
		urlObj.method = 'DELETE';
		var req = http.request(urlObj, function(res){
			assert.equal(res.statusCode, 200);
			fs.stat('req/1', function(err, stat){
				assert.notEqual(err, null);
				done();
			});
		}).on('error', done);
		req.end();
	});
});
