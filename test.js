var srexec = require('./index.js');

srexec.createEnvironment('lib/env', function(err, env){
	env.exec('whoami', function(){
		env.destroy();
	});
});
