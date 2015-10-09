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

describe('visit storage', function(){
	it('put file and exceed PUT body limit', function(done){
		httpReq('PUT', 'http://a:a@127.0.0.1:1180/test_dir/test_file', new Buffer(10485761), done, function(res){
			assert.equal(res.statusCode, 413);
			fs.stat('mnt/test_dir/test_file', function(err, stat){
				assert.notEqual(err, null);
				fs.readdir('tmp', function(err, files){
					assert.equal(err, null);
					assert.equal(files.length, 0);
					done();
				});
			});
		});
	});
	it('put file', function(done){
		httpReq('PUT', 'http://a:a@127.0.0.1:1180/test_dir/test_file', 'test file content', done, function(res){
			assert.equal(res.statusCode, 200);
			fs.stat('mnt/test_dir/test_file', function(err, stat){
				assert.equal(err, null);
				assert.equal(stat.uid, 0);
				assert.equal(stat.gid, 0);
				done();
			});
		});
	});
	it('get file', function(done){
		httpReq('GET', 'http://a:a@127.0.0.1:1180/test_dir/test_file', undefined, done, function(res){
			assert.equal(res.statusCode, 200);
			assert.equal(res.body, 'test file content');
			done();
		});
	});
	it('get file that does not exist', function(done){
		httpReq('GET', 'http://a:a@127.0.0.1:1180/test_dir/test_file_2', undefined, done, function(res){
			assert.equal(res.statusCode, 404);
			done();
		});
	});
	it('delete file', function(done){
		httpReq('DELETE', 'http://a:a@127.0.0.1:1180/test_dir/test_file', undefined, done, function(res){
			assert.equal(res.statusCode, 200);
			fs.stat('mnt/test_dir/test_file', function(err, stat){
				assert.notEqual(err, null);
				done();
			});
		});
	});
});
