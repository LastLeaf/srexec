'use strict';

var fs = require('fs-extra');
var os = require('os');
var http = require('http');
var express = require('express');
var compression = require('compression');
var httpAuth = require('http-auth');
var suExec = require('su-exec');

var router = require('./router.js');
var queue = require('./queue.js');
var env = require('./env.js');

// preparing fs
var config = fs.readJsonSync('config.json');
fs.ensureDirSync('./cgroup/');
fs.ensureDirSync('./env/');
fs.ensureDirSync('./req/');
fs.ensureDirSync('./mnt/');
fs.ensureDirSync('./tmp/');
fs.chmodSync('./tmp', parseInt('40777', 8));
fs.emptyDirSync('./tmp');

// preparing cgroup
var cgroupPrefix = null;
var preparingCgroup = function(){
	suExec.execPath('test', [ 'test',
		'-f', '/sys/fs/cgroup/cpuacct/tasks', '-a',
		'-f', '/sys/fs/cgroup/cpuset/tasks', '-a',
		'-f', '/sys/fs/cgroup/devices/tasks', '-a',
		'-f', '/sys/fs/cgroup/freezer/tasks', '-a',
		'-f', '/sys/fs/cgroup/memory/tasks', '-a',
		'-f', '/sys/fs/cgroup/net_cls/tasks'
	], function(err, status, signal){
		if(err || status || signal) throw('Cannot detect cgroup support from system.');
		preparingEnvs();
	});
};

// preparing envs
var envs = [];
var preparingEnvs = function(){
	var envCount = config.runner.parellel;
	var cpuCount = os.cpus().length;
	if(envCount > cpuCount) envCount = cpuCount;
	if(envCount < 0) envCount += cpuCount;
	if(envCount < 0) envCount = 0;
	envs = new Array(envCount);
	var envPending = envCount + 1;
	config.environment.mnt = 'mnt';
	var createEnv = function(i){
		env.createEnvironment('env/'+i, config.environment, function(err, env){
			envs[i] = env;
			process.on('exit', function(){
				env.destroy();
			});
			if(!--envPending) startHttpd();
		});
	};
	for(var i=0; i<envCount; i++) createEnv(i);
	if(!--envPending) startHttpd();
};

// start http server
var startHttpd = function(){
	// loading express
	var app = express();
	if(config.httpd.htpasswd) {
		var basicAuth = httpAuth.basic({
			realm: 'Srexec Login',
			file: config.httpd.htpasswd
		});
		app.use(httpAuth.connect(basicAuth));
	}
	app.use(compression());
	app.use(router(express, config, queue(config, envs)));

	app.listen(config.httpd.port, config.httpd.host);

	process.setgid(config.httpd.gid);
	process.setuid(config.httpd.uid);
};

preparingCgroup();
