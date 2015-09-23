#define _GNU_SOURCE

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <linux/limits.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <sys/types.h>
#include <pwd.h>
#include <grp.h>
#include <errno.h>
#include <sys/select.h>
#include <sys/time.h>
#include <sys/resource.h>
#include <signal.h>

#define ERR_MAX 255
#define TASK_MAX 0
#define FILE_MAX 256

typedef struct _RunData {
	// request part
	char* id;
	char* chroot;
	char* workingDir;
	char* user;
	char* group;
	int argc;
	char** argv;
	char* inputFile;
	char* outputFile;
	char* errFile;
	char* logFile;
	char* cpuset;
	int timeLimit;
	int memLimit;
	int totalTimeLimit;
	int fileSizeLimit;
} RunData;

typedef struct _RunResult {
	int status;
	int signal;
	int time;
	int mem;
} RunResult;

#include "cgroup.c"
#include "run.c"

int main(int argc, char* argv[]){
	RunData runData;
	RunResult runResult;

	runData.id = argv[1];
	runData.chroot = argv[2];
	runData.workingDir = argv[3];
	runData.user = argv[4];
	runData.group = argv[5];
	runData.inputFile = argv[6];
	runData.outputFile = argv[7];
	runData.errFile = argv[8];
	runData.logFile = argv[9];
	runData.cpuset = argv[10];
	runData.timeLimit = runData.totalTimeLimit = runData.memLimit = runData.fileSizeLimit = 0;
	sscanf(argv[11], "%d", &runData.timeLimit);
	sscanf(argv[12], "%d", &runData.totalTimeLimit);
	sscanf(argv[13], "%d", &runData.memLimit);
	sscanf(argv[14], "%d", &runData.fileSizeLimit);
	runData.argv = argv + 15;
	runData.argc = argc - 15;

	if(cgroupInit()) return -1;
	run(&runData, &runResult);

	return 0;
}
