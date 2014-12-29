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
#include <sys/select.h>
#include <signal.h>

const char* childProcessErr[16] = {
	"",
	"Service Unavailable",
	"Executing Target File Failed",
	"",
	"",
	"",
	"",
	"",
	"Execution Timed Out",
	"",
	"",
	"",
	"",
	"",
	"",
	""
};

struct RunResult {
	int32_t status;
	int32_t signal;
	int32_t time;
	int32_t memory;
};

// waitpid in timeout
int waitpidTimeoutInit() {
	sigset_t mask;
	sigemptyset(&mask);
	sigaddset(&mask, SIGCHLD);
	return sigprocmask(SIG_BLOCK, &mask, NULL);
}
int waitpidTimeout(int pid, int* status, int timeMs) {
	struct timespec ts;
	ts.tv_sec = timeMs / 1000;
	ts.tv_nsec = timeMs % 1000 * 1000000;
	sigset_t mask;
	sigemptyset(&mask);
	sigaddset(&mask, SIGCHLD);
	int r = sigtimedwait(&mask, NULL, &ts);
	if(r < 0) {
		return r;
	}
	r = waitpid(pid, status, WNOHANG);
	if(r <= 0) {
		return r;
	}
	if(!WIFEXITED(*status) && !WIFEXITED(*status)) {
		// timeout
		return 0;
	}
	return pid;
}

void childProcess(RunData* runData, RunResult* runResult){
	// init process
	if(waitpidTimeoutInit()) _exit(1);
	// reset signal handlers
	struct sigaction act;
	act.sa_handler = SIG_DFL;
	act.sa_flags = SA_NOCLDSTOP;
	for(int i=1; i<32; i++) {
		sigaction(i, &act, NULL);
	}
	// close fds
	// TODO

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
	struct passwd* pwd;
	struct group* gr;
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
	}*/

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

	// apply rlimit
	// TODO

	// create new cgroup
	// TODO

	// build argv array for child
	char* argv[ARGV_MAX+1];
	for(int i=0; i<runData->argc; i++) {
		argv[i] = runData->argv[i];
	}
	argv[runData->argc] = NULL;

	// create pipe, fork and execve
	int childErrno = 0;
	int childPipeFd[2];
	if(pipe2(childPipeFd, O_CLOEXEC) < 0) _exit(1);
	int childPid = fork();
	if(childPid < 0) exit(1);
	if(childPid == 0) {
		// process to execve
		close(childPipeFd[0]);

		// execve
		execvp(argv[0], argv);
		childErrno = 2;
		if(write(childPipeFd[1], &childErrno, sizeof(childErrno)) < 0) {}
		_exit(0);
	}

	// waiting for execve
	close(childPipeFd[1]);
	int len = read(childPipeFd[0], &childErrno, sizeof(childErrno));
	if(len == sizeof(childErrno)) _exit(childErrno);
	close(childPipeFd[0]);

	// wait
	int status;
	int r = waitpidTimeout(childPid, &status, runData->totalTimeLimit);
	if(r < 0) _exit(1);
	if(r == 0) _exit(8);
	if(WIFSIGNALED(status)) runResult->signal = WTERMSIG(status);
	if(WIFEXITED(status)) runResult->status = WEXITSTATUS(status);
}

// create child process
void run(RunData* runData){
	int32_t r = 0;
	struct RunResult runResult;

	// fork with pipe
	int pipeFd[2];
	if(pipe2(pipeFd, O_CLOEXEC) < 0) {
		runData->err = 1;
		snprintf(runData->error, ERR_MAX, "Service Unavailable");
		return;
	}
	int pid = fork();
	if(pid < 0) {
		close(pipeFd[0]);
		close(pipeFd[1]);
		runData->err = 1;
		snprintf(runData->error, ERR_MAX, "Service Unavailable");
		return;
	}
	if(pid == 0) {
		// child process
		close(pipeFd[0]);
		childProcess(runData, &runResult);
		if(write(pipeFd[1], &runResult, sizeof(runResult)) < 0) {}
		_exit(0);
	}
	close(pipeFd[1]);

	// parent process
	if(waitpid(pid, &r, 0) == -1 || WIFSIGNALED(r)) {
		close(pipeFd[0]);
		runData->err = 1;
		snprintf(runData->error, ERR_MAX, "Service Unavailable");
		return;
	}
	int32_t err = (WIFEXITED(r) ? WEXITSTATUS(r) : 16);
	if(err) {
		close(pipeFd[0]);
		if(err >= 16) err = 1;
		runData->err = err;
		snprintf(runData->error, ERR_MAX, "%s", childProcessErr[err]);
		return;
	}
	if(read(pipeFd[0], &runResult, sizeof(runResult)) == sizeof(runResult)) {
		runData->status = runResult.status;
		runData->signal = runResult.signal;
		runData->time = runResult.time;
		runData->memory = runResult.memory;
	} else {
		runData->err = 1;
		snprintf(runData->error, ERR_MAX, "Service Unavailable");
	}
	close(pipeFd[0]);
}
