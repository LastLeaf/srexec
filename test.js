var srexec = require('./index.js');

srexec.createEnvironment('env', function(err, env){
	env.exec('whoami', function(){
		env.destroy();
		srexec.destroy();
	});
});
