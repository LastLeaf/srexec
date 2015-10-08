const char* cgroupPrefix;

// cgroup settings helper
FILE* cgroupGetFile(const char* cgid, const char* type, const char* key, const char* rw){
	char path[FILENAME_MAX + 1];
	snprintf(path, sizeof(path), "%s/%s/%s/%s", cgroupPrefix, type, cgid, key);
	return fopen(path, rw);
}

// cgroup destroy with process killed
int cgroupDestroyType(const char* cgid, const char* prefix, const char* type){
	char path[FILENAME_MAX + 1];
	int retries = 5;
	snprintf(path, sizeof(path), "%s/%s/%s", prefix, type, cgid);
	while(rmdir(path) && retries) {
		sleep(1);
	}
	return 0;
}
int cgroupDestroy(const char* cgid){
	int ret = 0;
	if(cgroupDestroyType(cgid, cgroupPrefix, "cpuacct")) ret = -1;
	if(cgroupDestroyType(cgid, cgroupPrefix, "cpuset")) ret = -1;
	if(cgroupDestroyType(cgid, cgroupPrefix, "devices")) ret = -1;
	if(cgroupDestroyType(cgid, cgroupPrefix, "freezer")) ret = -1;
	if(cgroupDestroyType(cgid, cgroupPrefix, "memory")) ret = -1;
	if(cgroupDestroyType(cgid, cgroupPrefix, "net_cls")) ret = -1;
	return ret;
}
void cgroupKill(const char* cgid){
	char path[FILENAME_MAX + 1];
	int pid;
	snprintf(path, sizeof(path), "%s/%s/%s/tasks", cgroupPrefix, "freezer", cgid);
	FILE* fp = fopen(path, "re");
	if(fp == NULL) return;
	while(fscanf(fp, "%d", &pid) != EOF) {
		kill(pid, SIGKILL);
	}
	fclose(fp);
}

// cgroup creation for current process
int cgroupCreateInherit(const char* cgid, const char* prefix, const char* type, const char* key){
	char path[FILENAME_MAX + 1];
	char line[65];
	snprintf(path, sizeof(path), "%s/%s/%s", prefix, type, key);
	FILE* fp = fopen(path, "re");
	if(fp == NULL || fscanf(fp, "%64[^\n]", line) != 1) {
		if(fp != NULL) fclose(fp);
		return -1;
	}
	fclose(fp);
	snprintf(path, sizeof(path), "%s/%s/%s/%s", prefix, type, cgid, key);
	fp = fopen(path, "we");
	if(fp == NULL || fprintf(fp, "%s", line) <= 0) {
		if(fp != NULL) fclose(fp);
		return -1;
	}
	fclose(fp);
	return 0;
}
int cgroupCreateType(const char* cgid, const char* prefix, const char* type){
	// create cgroup
	char path[FILENAME_MAX + 1];
	snprintf(path, sizeof(path), "%s/%s/%s", prefix, type, cgid);
	if(mkdir(path, 0700)) return -1;
	// set cpus and mems for type cpuset
	if(!strcmp(type, "cpuset")) {
		if(cgroupCreateInherit(cgid, prefix, type, "cpuset.mems") || cgroupCreateInherit(cgid, prefix, type, "cpuset.cpus")) {
			rmdir(path);
			return -1;
		}
	}
	// set current process
	pid_t pid = getpid();
	snprintf(path, sizeof(path), "%s/%s/%s/tasks", prefix, type, cgid);
	FILE* fp = fopen(path, "we");
	if(fp == NULL || fprintf(fp, "%d", pid) <= 0) {
		if(fp != NULL) fclose(fp);
		snprintf(path, sizeof(path), "%s/%s/%s", prefix, type, cgid);
		rmdir(path);
		return -1;
	}
	fclose(fp);
	// validate
	int rpid = 0;
	fp = fopen(path, "re");
	if(fp == NULL || fscanf(fp, "%d", &rpid) != 1 || rpid != pid) {
		if(fp != NULL) fclose(fp);
		snprintf(path, sizeof(path), "%s/%s/%s", prefix, type, cgid);
		rmdir(path);
		return -1;
	}
	fclose(fp);
	return 0;
}
int cgroupCreate(const char* cgid){
	int ret = 0;
	if(cgroupCreateType(cgid, cgroupPrefix, "cpuacct")) ret = -1;
	if(cgroupCreateType(cgid, cgroupPrefix, "cpuset")) ret = -1;
	if(cgroupCreateType(cgid, cgroupPrefix, "devices")) ret = -1;
	if(cgroupCreateType(cgid, cgroupPrefix, "freezer")) ret = -1;
	if(cgroupCreateType(cgid, cgroupPrefix, "memory")) ret = -1;
	if(cgroupCreateType(cgid, cgroupPrefix, "net_cls")) ret = -1;
	if(ret) cgroupDestroy(cgid);
	return ret;
}
