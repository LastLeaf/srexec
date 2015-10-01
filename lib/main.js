'use strict';

var fs = require('fs-extra');
var os = require('os');
var http = require('http');
var express = require('express');
var compression = require('compression');
var httpAuth = require('http-auth');

var router = require('./router.js');
var queue = require('./queue.js');
var env = require('./env.js');

// preparing fs
var config = fs.readJsonSync('config.json');
fs.ensureDirSync(config.runner.dir);
fs.ensureDirSync(config.runner.dir + '/env/');
fs.ensureDirSync(config.runner.dir + '/req/');
fs.ensureDirSync(config.runner.dir + '/mnt/');
fs.ensureDirSync(config.runner.dir + '/tmp/');
fs.chmodSync(config.runner.dir + '/tmp', parseInt('40777', 8));
fs.emptyDirSync(config.runner.dir + '/tmp');

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

preparingEnvs();
