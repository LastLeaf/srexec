var runner = require('../build/Release/sruncer_runner');

runner.run({
	workingDir: '/home/lastleaf',
	//chroot: '/',
	//user: 'nobody',
	//group: 'nogroup',
	//inputFile: '/etc/passwd',
	//outputFile: '/tmp/output',
	//errFile: '/tmp/err',
	argv: ['ifconfig'],
	timeLimit: 1000,
	totalTimeLimit: 3000,
	lxcConfigFile: __dirname + '/../lxc.conf'
}, function(err, details) {
    console.info(arguments);
});
