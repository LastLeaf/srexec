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
#include <signal.h>

#define ERR_MAX 255

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
	int timeLimit;
	int memLimit;
	int totalTimeLimit;
	int fileSizeLimit;
	// result part
	int err;
	char error[ERR_MAX+1];
	int status;
	int signal;
	int time;
	int memory;
} RunData;

#include "cgroup.c"
#include "run.c"

int main(int argc, char* argv[]){
	RunData runData;

	runData.id = argv[1];
	runData.chroot = argv[2];
	runData.workingDir = argv[3];
	runData.user = argv[4];
	runData.group = argv[5];
	runData.inputFile = argv[6];
	runData.outputFile = argv[7];
	runData.errFile = argv[8];
	sscanf(argv[9], "%d", &runData.timeLimit);
	sscanf(argv[10], "%d", &runData.totalTimeLimit);
	sscanf(argv[11], "%d", &runData.memLimit);
	sscanf(argv[12], "%d", &runData.fileSizeLimit);
	runData.argv = argv + 13;
	runData.argc = argc - 13;

	if(cgroupInit()) return -1;
	cgroupCreate(runData.id);
	run(&runData);
	cgroupDestroy(runData.id);

	return 0;
}
