'use strict';

var fs = require('fs-extra');
var path = require('path');
var suExec = require('su-exec');

module.exports = function(express, config, queue){
	var router = express.Router();
	var reqDir = './req';
	var mntDir = './mnt';
	var tmpDir = './tmp';

	// run pipeline request
	router.route('/~/:id')
	.all(function(req, res, next){
		req.reqId = encodeURIComponent(req.params.id);
		next();
	})
	.get(function(req, res, next){
		// read final result
		fs.readFile(reqDir + '/' + req.reqId, {encoding: 'utf8'}, function(err, str){
			if(err) res.sendStatus(404);
			else res(str);
		});
	})
	.post(function(req, res, next){
		// get post body
		var sizeLimit = config.httpd.postBodyLimit;
		var bufArr = [];
		var onData = function(data){
			sizeLimit -= data.length;
			if(sizeLimit < 0) {
				req.removeListener('data', onData);
				return;
			}
			bufArr.push(data);
		};
		req.on('data', onData);
		req.on('end', function(){
			if(sizeLimit < 0) {
				res.sendStatus(413);
				return;
			}
			req.body = Buffer.concat(bufArr);
			next();
		});
	})
	.post(function(req, res, next){
		// check required files
		var pipeline = null;
		try {
			pipeline = JSON.parse(req.body.toString('utf8'));
		} catch(e) {
			res.sendStatus(400);
			return;
		}
		pipeline = queue.filter(pipeline, config);
		if(!pipeline) {
			res.sendStatus(406);
			return;
		}
		var requiredFiles = [];
		var missedFiles = [];
		pipeline.forEach(function(step){
			if(step.execFile) requiredFiles.push(step.execFile);
			if(step.stdin) requiredFiles.push(step.stdin);
		});
		var end = function(){
			if(missedFiles.length) {
				res.status(404).send(JSON.stringify(missedFiles));
				return;
			}
			// accept req pipeline
			if(queue.add(pipeline)) {
				res.sendStatus(200);
			} else {
				res.sendStatus(503);
			}
		};
		var c = requiredFiles.length + 1;
		requiredFiles.forEach(function(file){
			fs.stat(mntDir + path.normalize('/' + file), function(err, stat){
				if(err || !stat.isFile()) {
					missedFiles.push(file);
				}
				if(!--c) end();
			});
		});
		if(!--c) end();
	})
	.delete(function(req, res, next){
		// delete a result
		suExec.execPath('rm', ['rm', reqDir + '/' + req.reqId], function(err){
			if(err) res.sendStatus(500);
			else res.sendStatus(200);
		});
	});

	// storage request
	router.route('*')
	.get(function(req, res, next){
		var rs = fs.createReadStream(mntDir + path.normalize('/' + req.path));
		rs.on('error', function(err){
			res.sendStatus(404);
		});
		rs.on('open', function(){
			rs.pipe(res);
		});
	})
	.put(function(req, res, next){
		// save to tmp file
		var failed = false;
		var tmpFile = tmpDir + '/' + (Date.now() + Math.random());
		var tmpFs = fs.createWriteStream(tmpFile);
		tmpFs.once('error', function(err){
			res.sendStatus(403);
		});
		tmpFs.once('finish', function(){
			if(failed) return;
			// move tmp to dest
			var destFile = mntDir + path.normalize('/' + req.path);
			suExec.execPath('mkdir', ['mkdir', '-p', path.dirname(destFile)], function(){
				suExec.execPath('mv', ['mv', '-T', tmpFile, destFile], function(err, status, signal){
					if(err || status || signal) {
						fs.remove(tmpFile, function(){
							res.sendStatus(403);
						});
						return;
					}
					suExec.execPath('chown', ['chown', 'root:root', destFile], function(){
						res.sendStatus(200);
					});
				});
			});
		});
		req.pipe(tmpFs);
		// limit size
		var sizeLimit = config.httpd.putBodyLimit;
		req.on('data', function(data){
			sizeLimit -= data.length;
			if(sizeLimit >= 0) return;
			failed = true;
			req.unpipe();
			tmpFs.end();
			fs.remove(tmpFile, function(){
				res.sendStatus(413);
			});
		});
	})
	.delete(function(req, res, next){
		suExec.execPath('rm', ['rm', mntDir + path.normalize('/' + req.path)], function(err){
			if(err) res.sendStatus(500);
			else res.sendStatus(200);
		});
	});

	return router;
};
