'use strict';

var fs = require('fs');
var assert = require('assert');
var http = require('http');
var url = require('url');

describe('visit storage', function(){
	it('put file', function(done){
		var urlObj = url.parse('http://a:a@127.0.0.1:1180/test_dir/test_file');
		urlObj.method = 'PUT';
		var req = http.request(urlObj, function(res){
			assert.equal(res.statusCode, 200);
			fs.stat('mnt/test_dir/test_file', function(err, stat){
				assert.equal(err, null);
				assert.equal(stat.uid, 0);
				assert.equal(stat.gid, 0);
				done();
			});
		}).on('error', done);
		req.write('test file content');
		req.end();
	});
	it('get file', function(done){
		var urlObj = url.parse('http://a:a@127.0.0.1:1180/test_dir/test_file');
		urlObj.method = 'GET';
		var req = http.request(urlObj, function(res){
			assert.equal(res.statusCode, 200);
			var bufArr = [];
			res.on('data', function(data){
				bufArr.push(data);
			});
			res.on('end', function(){
				var str = Buffer.concat(bufArr).toString('utf8');
				assert.equal(str, 'test file content');
				done();
			});
		}).on('error', done);
		req.end();
	});
	it('delete file', function(done){
		var urlObj = url.parse('http://a:a@127.0.0.1:1180/test_dir/test_file');
		urlObj.method = 'DELETE';
		var req = http.request(urlObj, function(res){
			assert.equal(res.statusCode, 200);
			fs.stat('mnt/test_dir/test_file', function(err, stat){
				assert.notEqual(err, null);
				done();
			});
		}).on('error', done);
		req.end();
	});
});
