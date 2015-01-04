#include <node.h>
#include <string>

using namespace v8;

const int32_t ARGV_MAX = 64;
const int32_t USERNAME_MAX = 32;
const int32_t ERR_MAX = 1024;

struct RunData {
	// request part
	char id[FILENAME_MAX+1];
	char chroot[FILENAME_MAX+1];
	char workingDir[FILENAME_MAX+1];
	char user[USERNAME_MAX+1];
	char group[USERNAME_MAX+1];
	int32_t argc;
	char argv[ARGV_MAX][FILENAME_MAX+1];
	char inputFile[FILENAME_MAX+1];
	char outputFile[FILENAME_MAX+1];
	char errFile[FILENAME_MAX+1];
	int32_t timeLimit;
	int32_t memLimit;
	int32_t totalTimeLimit;
	int32_t fileSizeLimit;
	// result part
	Persistent<Function> callback;
	int32_t err;
	char error[ERR_MAX];
	int32_t status;
	int32_t signal;
	int32_t time;
	int32_t memory;
};

extern "C" {
	#include "utils.c"
	#include "run.c"
}

void runEnd(uv_work_t* req){
	HandleScope scope;
	RunData* runData = (RunData*)req->data;

	// generate results
	const unsigned argc = 2;
	Local<Value> err;
	if(runData->error[0]) {
		err = Local<Value>::New( Exception::Error(String::New(runData->error)) );
	} else {
		err = Local<Value>::New( Null() );
	}
	Local<Object> details = Object::New();
	details->Set( String::NewSymbol("status"), Integer::New(runData->status) );
	details->Set( String::NewSymbol("signal"), Integer::New(runData->signal) );
	details->Set( String::NewSymbol("time"), Integer::New(runData->time) );
	details->Set( String::NewSymbol("memory"), Integer::New(runData->memory) );
	Local<Value> argv[argc] = { err, details };
	runData->callback->Call(Context::GetCurrent()->Global(), argc, argv);
	runData->callback.Dispose();

	delete runData;
	scope.Close( Undefined() );
}

void runThread(uv_work_t* req){
	RunData* runData = (RunData*)req->data;
	run(runData);
}

Handle<Value> runStart(const Arguments& args) {
	HandleScope scope;

	// get callback func
	if (!args[1]->IsFunction()) {
		return ThrowException( Exception::TypeError(String::New("Second argument must be a callback function.")) );
	}
	Local<Function> callback = Local<Function>::Cast(args[1]);

	// get options
	Local<Object> options = args[0]->ToObject();
	RunData* runData = new RunData();
	Local<Value> str = options->Get( String::NewSymbol("id") );
	if(str->IsString()) str->ToString()->WriteUtf8(runData->id, FILENAME_MAX);
	else runData->id[0] = '\0';
	str = options->Get( String::NewSymbol("chroot") );
	if(str->IsString()) str->ToString()->WriteUtf8(runData->chroot, FILENAME_MAX);
	else runData->chroot[0] = '\0';
	str = options->Get( String::NewSymbol("workingDir") );
	if(str->IsString()) str->ToString()->WriteUtf8(runData->workingDir, FILENAME_MAX);
	else runData->workingDir[0] = '\0';
	str = options->Get( String::NewSymbol("user") );
	if(str->IsString()) str->ToString()->WriteUtf8(runData->user, FILENAME_MAX);
	else runData->user[0] = '\0';
	str = options->Get( String::NewSymbol("group") );
	if(str->IsString()) str->ToString()->WriteUtf8(runData->group, FILENAME_MAX);
	else runData->group[0] = '\0';
	str = options->Get( String::NewSymbol("inputFile") );
	if(str->IsString()) str->ToString()->WriteUtf8(runData->inputFile, FILENAME_MAX);
	else runData->inputFile[0] = '\0';
	str = options->Get( String::NewSymbol("outputFile") );
	if(str->IsString()) str->ToString()->WriteUtf8(runData->outputFile, FILENAME_MAX);
	else runData->outputFile[0] = '\0';
	str = options->Get( String::NewSymbol("errFile") );
	if(str->IsString()) str->ToString()->WriteUtf8(runData->errFile, FILENAME_MAX);
	else runData->errFile[0] = '\0';
	runData->timeLimit = options->Get( String::NewSymbol("timeLimit") )->ToInteger()->Value();
	runData->memLimit = options->Get( String::NewSymbol("memLimit") )->ToInteger()->Value();
	runData->totalTimeLimit = options->Get( String::NewSymbol("totalTimeLimit") )->ToInteger()->Value();
	runData->fileSizeLimit = options->Get( String::NewSymbol("fileSizeLimit") )->ToInteger()->Value();

	// read argc and argv
	Local<Object> arr = options->Get( String::NewSymbol("argv") )->ToObject();
	int32_t i = 0;
	for(; i<ARGV_MAX; i++) {
		Local<Value> arg = arr->Get(i);
		if(arg->IsUndefined()) break;
		arg->ToString()->WriteUtf8(runData->argv[i], FILENAME_MAX);
	}
	runData->argc = i;

	// set default
	runData->callback = Persistent<Function>::New(callback);
	runData->err = 0;
	runData->error[0] = '\0';
	runData->status = 0;
	runData->signal = 0;
	runData->time = 0;
	runData->memory = 0;

	// run
	uv_work_t *req = new uv_work_t();
	req->data = runData;
	int status = uv_queue_work(uv_default_loop(), req, runThread, (uv_after_work_cb)runEnd);
	if(status) {
		const unsigned argc = 1;
		Local<Value> argv[argc] = {
			Local<Value>::New( Exception::Error(String::New("Service Unavailable")) )
		};
		callback->Call(Context::GetCurrent()->Global(), argc, argv);
		runData->callback.Dispose();
	}

	return scope.Close( Undefined() );
}

void RegisterModule(Handle<Object> target) {
	cgroupInit();
	target->Set(String::NewSymbol("run"), FunctionTemplate::New(runStart)->GetFunction());
}

NODE_MODULE(sruncer_runner, RegisterModule);
