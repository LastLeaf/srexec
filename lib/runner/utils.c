#include <stdio.h>
#include <string.h>

struct cgroupPrefix_t {
	char cpuset[FILENAME_MAX + 1];
	char cpuacct[FILENAME_MAX + 1];
	char memory[FILENAME_MAX + 1];
	char freezer[FILENAME_MAX + 1];
};
struct cgroupPrefix_t cgroupPrefix;

void initCgroup(){
	char s[FILENAME_MAX + 1];
	char* sp;
	FILE* fp;

	// init with empty
	strcpy(cgroupPrefix.cpuset, "");
	strcpy(cgroupPrefix.cpuacct, "");
	strcpy(cgroupPrefix.memory, "");
	strcpy(cgroupPrefix.freezer, "");

	// read /proc/mounts
	fp = fopen("/proc/mounts", "r");
	if(fp) {
		while(fgets(s, FILENAME_MAX + 1, fp)) {
			if(strncmp(s, "cgroup ", 7)) continue;
			// find mount attr
			sp = strstr(s+7, " ");
			sp[0] = '\0';
			sp++;
			// match which cgroup controller
			if(strstr(sp, "cpuset,")) strcpy(cgroupPrefix.cpuset, s+7);
			if(strstr(sp, "cpuacct,")) strcpy(cgroupPrefix.cpuacct, s+7);
			if(strstr(sp, "memory,")) strcpy(cgroupPrefix.memory, s+7);
			if(strstr(sp, "freezer,")) strcpy(cgroupPrefix.freezer, s+7);
		}
		fclose(fp);
	}

	// read /proc/self/cgroup
	fp = fopen("/proc/self/cgroup", "r");
	if(fp) {
		while(fgets(s, FILENAME_MAX + 1, fp)) {
			// parse path
			sp = strstr(s, "\n");
			if(!sp) continue;
			sp[0] = '\0';
			sp = strstr(s, ":");
			if(!sp) continue;
			sp = strstr(sp+1, ":");
			if(!sp) continue;
			sp++;
			// match which cgroup controller
			if(strstr(s, "cpuset:"))
				strncat(cgroupPrefix.cpuset, sp, FILENAME_MAX - strlen(cgroupPrefix.cpuset));
			if(strstr(s, "cpuacct:"))
				strncat(cgroupPrefix.cpuacct, sp, FILENAME_MAX - strlen(cgroupPrefix.cpuacct));
			if(strstr(s, "memory:"))
				strncat(cgroupPrefix.memory, sp, FILENAME_MAX - strlen(cgroupPrefix.memory));
			if(strstr(s, "freezer:"))
				strncat(cgroupPrefix.freezer, sp, FILENAME_MAX - strlen(cgroupPrefix.freezer));
		}
		fclose(fp);
	}
}
