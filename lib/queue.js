'use strict';

var fs = require('fs-extra');
var path = require('path');
var suExec = require('su-exec');

/* running request pipeline
	[
		{ stdin: 'file to read in mnt' },
		{ execPath: 'system program to execute', args: ['argv1', 'argv2', ...], stderr: '' },
		{ execFile: 'program to execute', args: ['argv1', 'argv2', ...], timeLimit: 0, totalTimeLimit: 0, memLimit: 0, fileSizeLimit: 0 },
		... ,
		{ stdout: 'file to write in mnt' }
	]
*/

var processPipeline = function(config, reqId, pipeline, env, envId, cb){
	var root = 'env/' + envId;
	var tmpFilesRoot = root + '/tmp/srexec';
	var curStdio = '/dev/null';
	// exec a pipeline item
	var nextStep = function(){
		var item = pipeline.shift();
		if(!item) {
			cb();
			return;
		}
		// exec path
		var argv = item.args;
		var exec = item.execFile ? path.resolve('/mnt/', item.execFile) : item.execPath;
		if(exec) argv.unshift(exec);
		else argv = ['cat'];
		// stdin
		var curStdin = curStdio;
		if(item.stdin) {
			curStdin = root + path.resolve('/mnt/', item.stdin);
		}
		// stdout
		var curStdout = tmpFilesRoot + '/stdout';
		if(item.stdout) {
			curStdout = root + path.resolve('/mnt/', item.stdout);
		}
		// run in env
		env.exec({
			chroot: root,
			workingDir: '/mnt',
			user: config.runner.uid,
			group: config.runner.gid,
			inputFile: curStdin,
			outputFile: curStdout,
			errFile: item.stderr ? root + path.resolve('/mnt/', item.stderr) : '/dev/null',
			logFile: 'req/' + reqId,
			cpuset: String(envId),
			timeLimit: item.timeLimit,
			totalTimeLimit: item.totalTimeLimit,
			memLimit: item.memLimit,
			fileSizeLimit: item.fileSizeLimit,
			argv: argv
		}, function(err, status, signal){
			// stdout to stdin
			if(curStdout === tmpFilesRoot + '/stdout') {
				suExec.execPath('mv', ['mv', curStdout, tmpFilesRoot + '/stdin'], function(){
					curStdio = tmpFilesRoot + '/stdin';
					if(item.forceContinue || !(err || status || signal)) nextStep();
					else cb();
				});
			} else {
				curStdio = '/dev/null';
				if(item.forceContinue || !(err || status || signal)) nextStep();
				else cb();
			}
		});
	};
	// prepare env
	env.reset(function(){
		suExec.execPath('mkdir', ['mkdir', '-m', '777', tmpFilesRoot], function(){
			nextStep();
		});
	});
};

var filterPipeline = function(pipeline, config){
	if(pipeline.constructor !== Array) return [];
	var filtered = [];
	for(var i=0; i<pipeline.length; i++) {
		var item = pipeline[i];
		var r = {
			stdin: String(item.stdin || ''),
			stdout: String(item.stdout || ''),
			stderr: String(item.stderr || ''),
			forceContinue: !!item.forceContinue,
			timeLimit: Number(item.timeLimit) || config.hardLimit.time,
			totalTimeLimit: Number(item.totalTimeLimit) || config.hardLimit.totalTime,
			memLimit: Number(item.memLimit) || config.hardLimit.mem,
			fileSizeLimit: Number(item.fileSizeLimit) || config.hardLimit.fileSize,
			execPath: String(item.execPath || ''),
			execFile: String(item.execFile || ''),
			args: []
		};
		if(r.timeLimit <= config.hardLimit.time && r.totalTimeLimit <= config.hardLimit.totalTime && r.memLimit <= config.hardLimit.mem && r.fileSizeLimit <= config.hardLimit.fileSize) {
			filtered.push(r);
		} else {
			return null;
		}
		if(item.args && item.args.constructor === Array) {
			while(item.args.length) {
				r.args.push( String(item.args.shift()) );
			}
		}
	}
	return filtered;
};

module.exports = function(config, envs){
	var envQueue = [];
	for(var i=0; i<envs.length; i++) {
		envQueue.push(i);
	}

	var reqQueue = [];
	var reqQueueLimit = config.runner.queueLength;
	var add = function(reqId, pipeline){
		if(reqQueue.length >= reqQueueLimit) return false;
		reqQueue.push({ id: reqId, pipeline: pipeline });
		setTimeout(schedule, 0);
		return true;
	};
	var schedule = function(){
		if(!envQueue.length || !reqQueue.length) return;
		var envId = envQueue.shift();
		var req = reqQueue.shift();
		processPipeline(config, req.id, req.pipeline, envs[envId], envId, function(){
			envQueue.push(envId);
			setTimeout(schedule, 0);
		});
	};

	return {
		add: add,
		filter: filterPipeline
	};
};
