'use strict';

var fs = require('fs-extra');
var http = require('http');
var express = require('express');
var compression = require('compression');
var httpAuth = require('http-auth');

var config = fs.readJsonSync('config.json');

var app = express();
app.use(compression());
if(config.httpd.htpasswd) {
	var basicAuth = httpAuth.basic({
		realm: 'Srexec Login',
		file: config.httpd.htpasswd
	});
	app.use(httpAuth.connect(basicAuth));
}

app.listen(config.httpd.port, config.httpd.host);

process.setgid(config.httpd.gid);
process.setuid(config.httpd.uid);
