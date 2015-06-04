'use strict';

var fs = require('fs');
var childProcess = require('child_process');

// read config
var configFile = process.env.SREXEC || 'config.json';
var config = JSON.parse( fs.readFileSync(configFile, {encoding: 'utf8'}) );

// start root daemon
if(process.getuid() !== 0) {
	console.error('Please run this script as root.');
	return -1;
}
process.chdir(__dirname);
var rootProc = childProcess.execFile('build/Release/srexec_root');
rootProc.stdout.on('close', function(){
	process.exit();
});
rootProc.stdout.on('data', function(buf){
	console.info(buf.toString('utf8'));
});
rootProc.stdin.write('hello world!\n');

// drop privilege
process.setgid(config.httpd.gid);
process.setuid(config.httpd.uid);

//require('./lib/runner.js');