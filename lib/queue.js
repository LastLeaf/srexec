'use strict';

/* running request pipeline
	[
		{ stdin: 'file to read in mnt' },
		{ execPath: 'system program to execute', args: ['argv1', 'argv2', ...] },
		{ execFile: 'program to execute', args: ['argv1', 'argv2', ...] },
		... ,
		{ stdout: 'file to write in mnt' }
	]
*/

var processPipeline = function(pipeline, env, envId, cb){
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
		if(envQueue.length && reqQueue.length) return;
		var envId = envQueue.shift();
		var pipeline = reqQueue.shift();
		processPipeline(pipeline, envs[envId], envId, function(){
			envQueue.push(envId);
			setTimeout(schedule, 0);
		});
	};

	return {
		add: add,
	};
};
