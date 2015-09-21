struct cgroupPrefix_t {
	int ready;
	char cpuset[FILENAME_MAX + 1];
	char cpuacct[FILENAME_MAX + 1];
	char memory[FILENAME_MAX + 1];
	char freezer[FILENAME_MAX + 1];
	char devices[FILENAME_MAX + 1];
};
struct cgroupPrefix_t cgroupPrefix;

// cgroup settings helper
int cgroupGet(const char* cgid, const char* type, const char* key, char* value){
	//if(strcmp(type, cpu))
	return 0;
}
int cgroupSet(const char* cgid, const char* type, const char* key, const char* value){
	return 0;
}

// cgroup destroy with process killed
int cgroupDestroyType(const char* cgid, const char* prefix){
	char path[FILENAME_MAX + 1];
	int pid;
	snprintf(path, sizeof(path), "%s/%s/tasks", prefix, cgid);
	FILE* fp = fopen(path, "re");
	if(fp == NULL) return -1;
	while(fscanf(fp, "%d", &pid) != EOF) {
		kill(pid, SIGKILL);
	}
	fclose(fp);
	snprintf(path, sizeof(path), "%s/%s", prefix, cgid);
	if(rmdir(path)) return -1;
	return 0;
}
int cgroupDestroy(const char* cgid){
	int ret = 0;
	if(cgroupDestroyType(cgid, cgroupPrefix.cpuset)) ret = -1;
	if(cgroupDestroyType(cgid, cgroupPrefix.cpuacct)) ret = -1;
	if(cgroupDestroyType(cgid, cgroupPrefix.memory)) ret = -1;
	if(cgroupDestroyType(cgid, cgroupPrefix.freezer)) ret = -1;
	return ret;
}

// cgroup creation for current process
int cgroupCreateType(const char* cgid, const char* prefix){
	char path[FILENAME_MAX + 1];
	snprintf(path, sizeof(path), "%s/%s", prefix, cgid);
	if(mkdir(path, 0700)) return -1;
	pid_t pid = getpid();
	snprintf(path, sizeof(path), "%s/%s/tasks", prefix, cgid);
	FILE* fp = fopen(path, "we");
	if(fp == NULL || fprintf(fp, "%d", pid) < 0) {
		if(fp != NULL) fclose(fp);
		snprintf(path, sizeof(path), "%s/%s", prefix, cgid);
		rmdir(path);
		return -1;
	}
	fclose(fp);
	return 0;
}
int cgroupCreate(const char* cgid){
	if(!cgroupPrefix.ready) return -1;
	if(cgroupCreateType(cgid, cgroupPrefix.cpuset)) return -1;
	if(cgroupCreateType(cgid, cgroupPrefix.cpuacct)) return -1;
	if(cgroupCreateType(cgid, cgroupPrefix.memory)) return -1;
	if(cgroupCreateType(cgid, cgroupPrefix.freezer)) return -1;
	return 0;
}

// locate cgroup mount points
int cgroupInit(){
	char s[FILENAME_MAX + 1];
	char* sp;
	FILE* fp;

	// init with empty
	cgroupPrefix.ready = 0;
	strcpy(cgroupPrefix.cpuset, "");
	strcpy(cgroupPrefix.cpuacct, "");
	strcpy(cgroupPrefix.memory, "");
	strcpy(cgroupPrefix.freezer, "");
	strcpy(cgroupPrefix.devices, "");

	// read /proc/mounts
	fp = fopen("/proc/mounts", "r");
	if(fp) {
		while(fgets(s, FILENAME_MAX + 1, fp)) {
			if(strncmp(s, "cgroup ", 7)) continue;
			// find mount attr
			sp = strstr(s+7, " ");
			sp[0] = '\0';
			// match which cgroup controller
			sp += 7;
			sp[0] = ',';
			strstr(sp, " ")[0] = ',';
			if(strstr(sp, ",cpuset,")) strcpy(cgroupPrefix.cpuset, s+7);
			if(strstr(sp, ",cpuacct,")) strcpy(cgroupPrefix.cpuacct, s+7);
			if(strstr(sp, ",memory,")) strcpy(cgroupPrefix.memory, s+7);
			if(strstr(sp, ",freezer,")) strcpy(cgroupPrefix.freezer, s+7);
			if(strstr(sp, ",devices,")) strcpy(cgroupPrefix.devices, s+7);
		}
		fclose(fp);
	}
	if(!cgroupPrefix.cpuset[0] || !cgroupPrefix.cpuacct[0] || !cgroupPrefix.memory[0] || !cgroupPrefix.freezer[0] || !cgroupPrefix.devices[0])
		return -1;

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
			if(strstr(s, "devices:"))
				strncat(cgroupPrefix.devices, sp, FILENAME_MAX - strlen(cgroupPrefix.devices));
		}
		fclose(fp);
	}

	cgroupPrefix.ready = 1;
	return 0;
}
