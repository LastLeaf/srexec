const char* childProcessErr[16] = {
	"",
	"Service Unavailable",
	"Executing Target File Failed",
	"Redirecting Standard I/O Failed",
	"Switching to Virtual Environment Failed",
	"Switching Working Directory Failed",
	"Switching User Failed",
	"Creating Linux CGroups Failed",
	"Applying Process Limits Failed",
	"",
	"Time Limit Exceeded",
	"Memory Limit Exceeded",
	"File Size Limit Exceeded",
	"Runtime Error",
	"",
	""
};

// waitpid in timeout
int waitpidTimeoutInit(){
	sigset_t mask;
	sigemptyset(&mask);
	sigaddset(&mask, SIGCHLD);
	return sigprocmask(SIG_BLOCK, &mask, NULL);
}
int waitpidTimeout(int pid, int* status, int timeMs){
	struct timespec ts;
	ts.tv_sec = timeMs / 1000;
	ts.tv_nsec = timeMs % 1000 * 1000000;
	sigset_t mask;
	sigemptyset(&mask);
	sigaddset(&mask, SIGCHLD);
	int r = sigtimedwait(&mask, NULL, &ts);
	if(r < 0 && errno != EAGAIN) {
		return r;
	}
	r = waitpid(pid, status, WNOHANG);
	if(r <= 0) {
		return r;
	}
	if(!WIFEXITED(*status) && !WIFSIGNALED(*status)) {
		// timeout
		return 0;
	}
	return pid;
}

void returnChildError(int childPipeFd[2], int childErrno){
	if(write(childPipeFd[1], &childErrno, sizeof(childErrno)) < 0) {}
	_exit(-1);
}

int applyLimits(RunData* runData){
	FILE* fp;
	struct rlimit rlim;
	// check cpuacct, memory, freezer
	fp = cgroupGetFile(runData->id, "cpuacct", "cpuacct.usage", "re");
	if(fp == NULL) return -1;
	fclose(fp);
	fp = cgroupGetFile(runData->id, "memory", "memory.max_usage_in_bytes", "re");
	if(fp == NULL) return -1;
	fclose(fp);
	fp = cgroupGetFile(runData->id, "freezer", "freezer.state", "re");
	if(fp == NULL) return -1;
	fclose(fp);
	// cpuset
	if(runData->cpuset[0]) {
		fp = cgroupGetFile(runData->id, "cpuset", "cpuset.cpus", "we");
		if(fp == NULL) return -1;
		fprintf(fp, "%s", runData->cpuset);
		fclose(fp);
	}
	// memory
	if(runData->memLimit) {
		fp = cgroupGetFile(runData->id, "memory", "memory.limit_in_bytes", "we");
		if(fp == NULL) return -1;
		fprintf(fp, "%d", runData->memLimit <= 2147483647 - 1048576*16 ? runData->memLimit + 1048576*16 : runData->memLimit);
		fclose(fp);
	}
	// devices
	fp = cgroupGetFile(runData->id, "devices", "devices.deny", "we");
	if(fp == NULL) return -1;
	fprintf(fp, "a");
	fclose(fp);
	fp = cgroupGetFile(runData->id, "devices", "devices.allow", "we");
	if(fp == NULL) return -1;
	fprintf(fp, "b 1:* rw");
	fclose(fp);
	fp = cgroupGetFile(runData->id, "devices", "devices.allow", "we");
	if(fp == NULL) return -1;
	fprintf(fp, "c 1:* rw");
	fclose(fp);
	// TODO limit network
	// set limit: memory
	if(runData->memLimit) {
		rlim.rlim_cur = rlim.rlim_max = runData->memLimit;
		if(setrlimit(RLIMIT_DATA, &rlim) || setrlimit(RLIMIT_STACK, &rlim))
			return -1;
	}
	// set limit: fork
	if(TASK_MAX) {
		rlim.rlim_cur = rlim.rlim_max = TASK_MAX;
		if(setrlimit(RLIMIT_NPROC, &rlim))
			return -1;
	}
	// set limit: file count
	if(FILE_MAX) {
		rlim.rlim_cur = rlim.rlim_max = FILE_MAX;
		if(setrlimit(RLIMIT_NOFILE, &rlim))
			return -1;
	}
	// set limit: file size
	if(runData->fileSizeLimit) {
		rlim.rlim_cur = rlim.rlim_max = runData->fileSizeLimit;
		if(setrlimit(RLIMIT_FSIZE, &rlim))
			return -1;
	}
	// set limit: cpu time
	if(runData->timeLimit >= 0) {
		rlim.rlim_cur = rlim.rlim_max = (runData->timeLimit-1)/1000 + 2;
		if(setrlimit(RLIMIT_CPU, &rlim))
			return -1;
	}
	return 0;
}

int execChild(RunData* runData, RunResult* runResult){
	// init process
	if(waitpidTimeoutInit()) return 1;

	// build argv array for child
	char* argv[ARG_MAX+1];
	int i;
	for(i=0; i<runData->argc; i++) {
		argv[i] = runData->argv[i];
	}
	argv[runData->argc] = NULL;

	// create pipe, fork and execve
	int childErrno = 0;
	int childPipeFd[2];
	if(pipe2(childPipeFd, O_CLOEXEC) < 0) return 1;
	int childPid = fork();
	if(childPid < 0) return 1;
	if(childPid == 0) {
		// process to execve
		close(childPipeFd[0]);

		// put into cgroup
		if(cgroupCreate(runData->id)) {
			returnChildError(childPipeFd, 7);
		}

		// apply limits
		if(applyLimits(runData)) {
			returnChildError(childPipeFd, 8);
		}

		// redirect std
		if(runData->errFile[0] && freopen(runData->errFile, "w", stderr) == NULL) {
			returnChildError(childPipeFd, 3);
		}
		if(runData->inputFile[0] && freopen(runData->inputFile, "r", stdin) == NULL) {
			returnChildError(childPipeFd, 3);
		}
		if(runData->outputFile[0] && freopen(runData->outputFile, "w", stdout) == NULL) {
			returnChildError(childPipeFd, 3);
		}

		// chroot
		if(runData->chroot[0] && chroot(runData->chroot)) {
			returnChildError(childPipeFd, 4);
		}

		// set working dir
		if(runData->workingDir[0] && chdir(runData->workingDir)) {
			returnChildError(childPipeFd, 5);
		}

		// switch user
		struct passwd* pwd;
		struct group* gr;
		if(runData->group[0]) {
			gr = getgrnam(runData->group);
			if(gr == NULL || setgid(gr->gr_gid)) {
				returnChildError(childPipeFd, 6);
			}
		}
		if(runData->user[0]) {
			pwd = getpwnam(runData->user);
			if(pwd == NULL || setuid(pwd->pw_uid)) {
				returnChildError(childPipeFd, 6);
			}
		}

		// execve
		execvp(argv[0], argv);
		returnChildError(childPipeFd, 2);
		_exit(0);
	}

	// waiting for execve
	close(childPipeFd[1]);
	int len = read(childPipeFd[0], &childErrno, sizeof(childErrno));
	if(len == sizeof(childErrno)) return childErrno;
	close(childPipeFd[0]);

	// wait
	int status;
	int waitResult = waitpidTimeout(childPid, &status, runData->totalTimeLimit);
	if(waitResult < 0) {
		cgroupDestroy(runData->id);
		return 1;
	}
	FILE* fp;
	char line[65];
	fp = cgroupGetFile(runData->id, "freezer", "freezer.state", "we");
	if(fp != NULL) {
		fprintf(fp, "FROZEN");
		fclose(fp);
		for(;;) {
			line[0] = '\0';
			fp = cgroupGetFile(runData->id, "freezer", "freezer.state", "re");
			if(fp == NULL || fscanf(fp, "%64s", line) < 0) break;
			fclose(fp);
			if(!strcmp(line, "FREEZING")) {
				sleep(1);
				continue;
			}
			break;
		}
	}
	if(WIFSIGNALED(status)) runResult->signal = WTERMSIG(status);
	if(WIFEXITED(status)) runResult->status = WEXITSTATUS(status);

	// stat cpu and mem
	long long timeUsage, memUsage;
	fp = cgroupGetFile(runData->id, "cpuacct", "cpuacct.usage", "re");
	if(fp == NULL) return -1;
	if(fscanf(fp, "%lld", &timeUsage)) {}
	fclose(fp);
	fp = cgroupGetFile(runData->id, "memory", "memory.max_usage_in_bytes", "re");
	if(fp == NULL) return -1;
	if(fscanf(fp, "%lld", &memUsage)) {}
	fclose(fp);
	cgroupKill(runData->id);
	fp = cgroupGetFile(runData->id, "freezer", "freezer.state", "we");
	if(fp != NULL) {
		fprintf(fp, "THAWED");
		fclose(fp);
	}
	cgroupDestroy(runData->id);

	// detect result
	runResult->time = timeUsage/1000000;
	runResult->mem = memUsage;
	if(runResult->signal == SIGXFSZ) return 12;
	if(runResult->mem > runData->memLimit) return 11;
	if(runResult->time >= runData->timeLimit || waitResult == 0) return 10;
	if(runResult->signal) return 13;

	return 0;
}

int run(RunData* runData, RunResult* runResult){
	FILE* logFile = fopen(runData->logFile, "a");
	int execResult = execChild(runData, runResult);
	if(execResult) {
		fprintf(logFile, "{\"err\":%d,\"message\":\"%s\",\"status\":%d,\"signal\":%d,\"time\":%d,\"mem\":%d}\n", execResult, childProcessErr[execResult], runResult->status, runResult->signal, runResult->time, runResult->mem);
	} else {
		fprintf(logFile, "{\"status\":%d,\"signal\":%d,\"time\":%d,\"mem\":%d}\n", runResult->status, runResult->signal, runResult->time, runResult->mem);
	}
	fclose(logFile);
	if(execResult) return 1;
	if(runResult->signal) return 2;
	if(runResult->status) return 3;
	return 0;
}
