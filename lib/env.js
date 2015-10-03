'use strict';

var path = require('path');
var suExec = require('su-exec');
var exec = require('./exec.js');

var defaultOptions = {
	bind: [
		'/dev'
	],
	robind: [
		'/bin',
		'/etc',
		'/lib',
		'/lib32',
		'/lib64',
		'/opt',
		'/proc',
		'/usr',
		'/var'
	],
	tmp: [
		'/tmp',
		'/run',
		'/run/lock',
		'/run/shm',
		'/run/user'
	],
	tmpSize: 16*1024*1024,
	mnt: ''
};

// read-only bind mount
var bindMount = function(src, dest, ro, cb){
	suExec.execPath('mountpoint', ['mountpoint', '-q', dest], function(err, status, signal){
		if(err || signal) return cb( new Error() );
		if(!status) return cb();
		suExec.execPath('mkdir', ['mkdir', dest], function(){
			suExec.execPath('mount', ['mount', '--bind', src, dest], function(err, status, signal){
				if(err || status || signal) return cb( new Error() );
				if(!ro) return cb();
				suExec.execPath('mount', ['mount', '-o', 'remount,ro', dest], function(err, status, signal){
					if(err || status || signal) return cb( new Error() );
					cb();
				});
			});
		});
	});
};

// mount tmpfs
var tmpMount = function(dest, size, cb){
	suExec.execPath('mountpoint', ['mountpoint', '-q', dest], function(err, status, signal){
		if(err || signal) return cb( new Error() );
		if(!status) return cb();
		suExec.execPath('mkdir', ['mkdir', dest], function(){
			suExec.execPath('mount', ['mount', '-t', 'tmpfs', '-o', 'size='+size, 'tmpfs', dest], function(err, status, signal){
				if(err || status || signal) return cb( new Error() );
				cb();
			});
		});
	});
};

// create a new environment
exports.createEnvironment = function(root, options, cb){
	if(typeof(options) === 'function') {
		cb = options;
		options = {};
	}

	// the exports
	var env = {
		exec: exec,
		reset: function(cb){
			// clear tmp dirs
			var c = (options.tmp || defaultOptions.tmp).length + 1;
			var lastErr = null;
			var end = function(){
				cb(lastErr, env);
			};
			(options.tmp || defaultOptions.tmp).forEach(function(dir){
				suExec.execPath('umount', ['umount', '-f', '-l', root + dir], function(){
					tmpMount(root + dir, options.tmpSize || defaultOptions.tmpSize, function(err){
						if(err) lastErr = err;
						if(!--c) end();
					});
				});
			});
			if(!--c) end();
		},
		destroy: function(){
			// umount all
			[]
				.concat(options.bind || defaultOptions.bind)
				.concat(options.robind || defaultOptions.robind)
				.concat(options.tmp || defaultOptions.tmp)
				.concat(options.mnt || defaultOptions.mnt ? ['/mnt'] : [])
			.reverse().forEach(function(dir){
				suExec.execPath('umount', ['umount', '-f', '-l', root + dir], function(){});
			});
		}
	};

	// do basic mount
	root = path.resolve(process.cwd(), root);
	suExec.execPath('mkdir', ['mkdir', root], function(){
		var c = (options.bind || defaultOptions.bind).length + (options.robind || defaultOptions.robind).length + (options.tmp || defaultOptions.tmp).length + 1;
		var lastErr = null;
		var end = function(){
			cb(lastErr, env);
		};
		(options.bind || defaultOptions.bind).forEach(function(dir){
			bindMount(dir, root + dir, false, function(err){
				if(err) lastErr = err;
				if(!--c) end();
			});
		});
		(options.robind || defaultOptions.robind).forEach(function(dir){
			bindMount(dir, root + dir, true, function(err){
				if(err) lastErr = err;
				if(!--c) end();
			});
		});
		(options.tmp || defaultOptions.tmp).forEach(function(dir){
			tmpMount(root + dir, options.tmpSize || defaultOptions.tmpSize, function(err){
				if(err) lastErr = err;
				if(!--c) end();
			});
		});
		if(options.mnt || defaultOptions.mnt) {
			var dir = options.mnt || defaultOptions.mnt;
			bindMount(dir, root + '/mnt', false, function(err){
				if(err) lastErr = err;
				if(!--c) end();
			});
		}
		if(!--c) end();
	});
};
