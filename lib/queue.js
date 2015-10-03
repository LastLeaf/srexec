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

var processPipeline = function(config, pipeline, env, envId, cb){
	var root = 'env/' + envId;
	var execRoot = root + '/tmp/srexec';
	var curStdio = '/dev/null';
	// exec a pipeline item
	var nextStep = function(){
		var item = pipeline.shift();
		if(!item) {
			cb();
			return;
		}
		// exec path
		var argv = item.argv || [];
		var exec = item.execFile ? '/mnt' + path.normalize('/' + item.execFile) : item.execPath;
		if(exec) argv.unshift(exec);
		else argv = ['cat'];
		// stdin
		var curStdin = curStdio;
		if(item.stdin) {
			curStdin = root + '/mnt' + path.normalize('/' + item.stdin);
		}
		// stdout
		var curStdout = execRoot + '/../srexec-stdout';
		if(item.stdout) {
			curStdout = root + '/mnt' + path.normalize('/' + item.stdout);
		}
		// run in env
		env.exec({
			chroot: root,
			wrokingDir: '/tmp/srexec',
			user: config.runner.uid,
			group: config.runner.gid,
			inputFile: curStdin,
			outputFile: curStdout,
			errFile: item.stderr ? root + '/mnt' + path.normalize('/' + item.stderr) : '/dev/null',
			logFile: 'req/' + envId,
			cpuset: String(envId),
			timeLimit: item.timeLimit,
			totalTimeLimit: item.totalTimeLimit,
			memLimit: item.memLimit,
			fileSizeLimit: item.fileSizeLimit,
			argv: argv
		}, function(){
			// handling stdout
			if(curStdout === execRoot + '/../srexec-stdout') {
				suExec.execPath('mv', ['mv', curStdout, execRoot + '/../srexec-stdin'], function(){
					curStdio = execRoot + '/../srexec-stdin';
					nextStep();
				});
			} else {
				curStdio = '/dev/null';
				nextStep();
			}
		});
	};
	// prepare env
	env.reset(function(){
		suExec.execPath('mkdir', ['mkdir', '-m', '777', execRoot], function(){
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
			timeLimit: Number(item.timeLimit) || config.hardLimit.time,
			totalTimeLimit: Number(item.totalTimeLimit) || config.hardLimit.totalTime,
			memLimit: Number(item.memLimit) || config.hardLimit.mem,
			fileSizeLimit: Number(item.fileSizeLimit) || config.hardLimit.fileSize,
			execPath: String(item.execPath || ''),
			execFile: String(item.execFile || ''),
		};
		if(r.timeLimit <= config.hardLimit.time && r.totalTimeLimit <= config.hardLimit.totalTime && r.memLimit <= config.hardLimit.mem && r.fileSizeLimit <= config.hardLimit.fileSize) {
			filtered.push(r);
		} else {
			return null;
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
	var add = function(pipeline){
		if(reqQueue.length >= reqQueueLimit) return false;
		reqQueue.push(pipeline);
		setTimeout(schedule, 0);
		return true;
	};
	var schedule = function(){
		if(!envQueue.length || !reqQueue.length) return;
		var envId = envQueue.shift();
		var pipeline = reqQueue.shift();
		processPipeline(config, pipeline, envs[envId], envId, function(){
			envQueue.push(envId);
			setTimeout(schedule, 0);
		});
	};

	return {
		add: add,
		filter: filterPipeline
	};
};
