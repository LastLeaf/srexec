'use strict';

var fs = require('fs');
var srexec = require('./index.js');

srexec.createEnvironment('env', function(err, env){
	env.exec({
		chroot: 'env',
		wrokingDir: '/',
		user: 'nobody',
		group: 'nogroup',
		inputFile: '',
		outputFile: 'env/tmp/stdout',
		errFile: '',
		logFile: 'env/tmp/log',
		cpuset: '1',
		timeLimit: 5000,
		totalTimeLimit: 10000,
		memLimit: 1024*1024,
		fileSizeLimit: 1048576,
		argv: ['/memory']
	}, function(){
		try {
			console.log( fs.readFileSync('env/tmp/log').toString('utf8') );
		} catch(e) {
			console.log(e);
		}
		env.destroy();
		srexec.destroy();
	});
});
