'use strict';

var fs = require('fs-extra');
var http = require('http');
var express = require('express');
var compression = require('compression');
var httpAuth = require('http-auth');
var bodyParser = require('body-parser');

var router = require('./router.js');

// preparing fs
var config = fs.readJsonSync('config.json');
fs.ensureDirSync(config.runner.dir);
fs.ensureDirSync(config.runner.dir + '/env/');
fs.ensureDirSync(config.runner.dir + '/req/');
fs.ensureDirSync(config.runner.dir + '/mnt/');
fs.ensureDirSync(config.runner.dir + '/tmp/');
fs.chmodSync(config.runner.dir + '/tmp', parseInt('40777', 8));

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
app.use(bodyParser.raw({ limit: config.httpd.uploadLimit }));
app.use(router(express, config));

app.listen(config.httpd.port, config.httpd.host);

process.setgid(config.httpd.gid);
process.setuid(config.httpd.uid);
