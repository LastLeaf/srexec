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
	int pid;
	snprintf(path, sizeof(path), "%s/%s/%s/tasks", prefix, type, cgid);
	FILE* fp = fopen(path, "re");
	if(fp == NULL) return 1;
	while(fscanf(fp, "%d", &pid) != EOF) {
		kill(pid, SIGKILL);
	}
	fclose(fp);
	snprintf(path, sizeof(path), "%s/%s/%s", prefix, type, cgid);
	int retries = 5;
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

// cgroup creation for current process
int cgroupCreateType(const char* cgid, const char* prefix, const char* type){
	char path[FILENAME_MAX + 1];
	snprintf(path, sizeof(path), "%s/%s/%s", prefix, type, cgid);
	if(mkdir(path, 0700)) return -1;
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
	return ret;
}
