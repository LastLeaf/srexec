'use strict';

var suExec = require('su-exec');

module.exports = function(config, cb){
	var args = [
		'build/Release/runner',
		'srexec-' + (Date.now() + Math.random()),
		config.chroot || '',
		config.workingDir || '',
		config.user || '',
		config.group || '',
		config.inputFile || '',
		config.outputFile || '',
		config.errFile || '',
		config.logFile || '',
		config.cpuset || '',
		String(config.timeLimit || 0),
		String(config.totalTimeLimit || 0),
		String(config.memLimit || 0),
		String(config.fileSizeLimit || 0),
	].concat(config.argv || []);
	suExec.execFile(__dirname + '/../build/Release/runner', args, cb);
};
