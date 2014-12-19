#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <pwd.h>
#include <grp.h>
#include <errno.h>

const char* childProcessErr[16] = {
	"",
	"Chroot Failed",
	"Working Directory Not Found",
	"Switching System User Failed",
	"Switching System User Group Failed",
	"Redirect Standard Streams Failed",
	"Creating Sandbox Failed",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"",
	"Internal Server Error"
};

void childProcess(RunData* runData){
	char* argv[ARGV_MAX+1];
	struct cgroup* cg;
	struct passwd* pwd;
	struct group* gr;
/*
	// chroot
	if(runData->chroot[0] && chroot(runData->chroot)) {
		_exit(1);
	}

	// set working dir
	if(runData->workingDir[0] && chdir(runData->workingDir)) {
		_exit(2);
	}

	// switch user
	if(runData->user[0]) {
		pwd = getpwnam(runData->user);
		if(pwd == NULL || setgid(pwd->pw_uid)) {
			_exit(3);
		}
	}
	if(runData->group[0]) {
		gr = getgrnam(runData->group);
		if(gr == NULL || setgid(gr->gr_gid)) {
			_exit(4);
		}
	}

	// redirect std
	if(runData->errFile[0] && freopen(runData->errFile, "w", stderr) == NULL) {
		_exit(5);
	}
	if(runData->inputFile[0] && freopen(runData->inputFile, "r", stdin) == NULL) {
		_exit(5);
	}
	if(runData->outputFile[0] && freopen(runData->outputFile, "w", stdout) == NULL) {
		_exit(5);
	}
*/
	// build argv array
	for(int i=0; i<runData->argc; i++) {
		argv[i] = runData->argv[i];
	}
	argv[runData->argc] = NULL;

	// apply rlimit
	// TODO

	// create new cgroup
	// TODO

	_exit(0);
}

void run(RunData* runData){
	int32_t r = 0;

	// fork
	int pid = fork();
	if(pid < 0) {
		snprintf(runData->err, ERR_MAX, "Service Unavailable");
		return;
	}
	if(!pid) {
		// child process
		childProcess(runData);
		return;
	}

	// parent process
	if(waitpid(pid, &r, 0) == 255 || WIFSIGNALED(r)) {
		snprintf(runData->err, ERR_MAX, "Service Unavailable");
		return;
	}
	int32_t code = WEXITSTATUS(r);
	if(code) {
		if(code >= 15) code = 15;
		snprintf(runData->err, ERR_MAX, "%s", childProcessErr[code]);
		return;
	}
}
