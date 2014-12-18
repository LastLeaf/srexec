var runner = require('../build/Release/sruncer_runner');

runner.run({
	id: 'sruncer-run-' + Date.now(),
	//chroot: '/',
	workingDir: '/home/lastleaf',
	//user: 'nobody',
	//group: 'nogroup',
	//inputFile: '/etc/passwd',
	//outputFile: '/tmp/output',
	//errFile: '/tmp/err',
	argv: ['xterm'],
	timeLimit: 1000,
	totalTimeLimit: 3000,
}, function(err, details) {
    console.info(arguments);
});