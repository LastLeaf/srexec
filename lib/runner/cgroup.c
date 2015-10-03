const char* cgroupPrefix;

// cgroup settings helper
FILE* cgroupGetFile(const char* cgid, const char* key, const char* rw){
	char path[FILENAME_MAX + 1];
	snprintf(path, sizeof(path), "%s/%s/%s", cgroupPrefix, cgid, key);
	return fopen(path, rw);
}

// cgroup destroy with process killed
int cgroupDestroyType(const char* cgid, const char* prefix){
	char path[FILENAME_MAX + 1];
	int pid;
	snprintf(path, sizeof(path), "%s/%s/tasks", prefix, cgid);
	FILE* fp = fopen(path, "re");
	if(fp == NULL) return 1;
	while(fscanf(fp, "%d", &pid) != EOF) {
		kill(pid, SIGKILL);
	}
	fclose(fp);
	snprintf(path, sizeof(path), "%s/%s", prefix, cgid);
	int retries = 5;
	while(rmdir(path) && retries) {
		sleep(1);
	}
	return 0;
}
int cgroupDestroy(const char* cgid){
	if(cgroupDestroyType(cgid, cgroupPrefix)) return -1;
	return 0;
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
	if(cgroupCreateType(cgid, cgroupPrefix)) return -1;
	return 0;
}
