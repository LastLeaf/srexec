'use strict';

var fs = require('fs-extra');
var path = require('path');
var suExec = require('su-exec');

module.exports = function(express, config){
	var router = express.Router();
	var reqQueue = [];
	var reqQueueLimit = config.runner.queueLength;
	var reqDir = config.runner.dir + '/req';
	var mntDir = config.runner.dir + '/mnt';
	var tmpDir = config.runner.dir + '/tmp';

	// run pipeline request
	router.route('/~/:id')
	.all(function(req, res, next){
		req.reqId = req.param('id');
	})
	.get(function(req, res, next){
		// read final result
		fs.readFile(reqDir + '/' + req.reqId, {encoding: 'utf8'}, function(err, str){
			if(err) res.sendStatus(404);
			else res(str);
		});
	})
	.post(function(req, res, next){
		// check required files
		try {
			var pipeline = JSON.parse(req.body.toString('utf8'));
			var requiredFiles = [];
			var missedFiles = [];
			pipeline.forEach(function(step){
				if(step.exec) requiredFiles.push(step.exec);
				if(step.stdin) requiredFiles.push(step.stdin);
			});
			var end = function(){
				if(missedFiles.length) {
					res.status(480, 'Missing Required Files').send(JSON.stringify(missedFiles));
					return;
				}
				// accept req pipeline
				if(reqQueue.length >= reqQueueLimit) {
					res.sendStatus(503);
					return;
				}
				reqQueue.push(pipeline);
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
		} catch(e) {
			res.sendStatus(400);
			return;
		}
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
		var tmpFile = tmpDir + '/' + (Date.now() + Math.random());
		fs.writeFile(tmpFile, req.body, function(err){
			if(err) {
				res.sendStatus(403);
				return;
			}
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
	})
	.delete(function(req, res, next){
		suExec.execPath('rm', ['rm', mntDir + path.normalize('/' + req.path)], function(err){
			if(err) res.sendStatus(500);
			else res.sendStatus(200);
		});
	});

	return router;
};
