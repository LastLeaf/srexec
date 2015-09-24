'use strict';

var fs = require('fs-extra');
var path = require('path');

module.exports = function(express, config){
	var router = express.Router();
	var reqQueue = [];
	var reqQueueLimit = config.runner.queueLength;

	// run pipeline request
	router.route('/~/:id')
	.all(function(req, res, next){
		req.reqId = req.param('id');
	})
	.get(function(req, res, next){
		// read final result
		fs.readFile('req/' + req.reqId, {encoding: 'utf8'}, function(err, str){
			if(err) res.sendStatus(404);
			else res(str);
		});
	})
	.put(function(req, res, next){
		// put a file as final result
		fs.writeFile('req/' + req.reqId, req.body, function(err){
			if(err) res.sendStatus(500);
			else res.sendStatus(200);
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
				fs.stat(path.normalize('mnt/' + file), function(err, stat){
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
		fs.remove('req/' + req.reqId, function(err){
			if(err) res.sendStatus(500);
			else res.sendStatus(200);
		});
	});

	// storage request
	router.route('*')
	.get(function(req, res, next){
	})
	.put(function(req, res, next){})
	.post(function(req, res, next){})
	.delete(function(req, res, next){});

	return router;
};
