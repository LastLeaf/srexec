var runner = require('../build/Release/srexec_runner');

runner.run({
	id: 'srexec-run-' + Date.now(),
	//chroot: '/',
	workingDir: '/home/lastleaf',
	//user: 'nobody',
	//group: 'nogroup',
	//inputFile: '/etc/passwd',
	outputFile: '/tmp/srexec-output',
	//errFile: '/tmp/err',
	argv: ['ls', '/home/lastleaf/research/ftp/pubmed/id_list', '-al'],
	timeLimit: 1000,
	totalTimeLimit: 3000,
}, function(err, details) {
    console.info(arguments);
});
