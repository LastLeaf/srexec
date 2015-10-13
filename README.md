# Srexec: source code execution backend #

This is a node module designed for execution simple and untrusted code.
It executes code in limited environments, running in linux with node.js.

It could be used as a judge backend for ACM-ICPC-style contests.

## Features ##

It serves a REST-like server, accepting execution requests from remote machines.
Authorized clients could
* Manage files mounted in /mnt
* Send execution requests that runs untrusted code

The untrusted can read system files, but can write nothing other than stdout, stderr, and temp files.
Some extra limits can also be applied, including CPU time limits, total time limits, memory limits, and file size limits.

## System Requirements ##

It requires CGroups support from linux kernel. Other operating systems are not supported.

It is tested in Ubuntu 14.04 TLS.
It should also support new debian-like systems, but the configuration process might be slightly different.

In Ubuntu, you should have two packages manually installed.

```sh
$ sudo apt-get install build-essential cgroup-lite
```

Then `node.js` with `npm` should also be available.
Ubuntu 14.04 provides nodejs 0.10.x by `apt-get`, but nodejs 4.x is suggested.
You could install it with commands below.

```sh
$ sudo apt-get install -y curl
$ curl -sL https://deb.nodesource.com/setup_4.x | sudo bash -
$ sudo apt-get install -y nodejs
```

## Installation and Run Test Cases ##

You could just clone this repo to get the source code.

```sh
$ git clone https://github.com/LastLeaf/srexec
$ cd srexec
```

Run the test cases to see if it fails in your machine.

```sh
$ npm test
```

## Configuration ##

To run it as a service, create an empty directory for placing data.

```sh
$ mkdir srexec-data
$ cd srexec-data
```

Then put a configuration file `config.json` in it.
There is a sample file in the source code root.

Some key configurations
* `http.htpasswd` the password file to store the HTTP auth data. It could be generated with [htpasswd tool](https://www.npmjs.com/package/htpasswd).
* `runner.parellel` the maximum number of parellel execution requests. It should not exceed the number of CPU cores. If it is a negative number, it is added by the number of CPU cores. i.e. "-1" means allowing CPU cores minus one parellel tasks.
* `runner.queueLength` the maximum number of waiting execution requests in queue.

## API ##

While running, clients could visit services via HTTP.
Each HTTP requests should contain correct auth header, otherwise 401 would be returned.

While running, a storage directory would be mount to "/mnt".
This directory could be visited with GET/PUT/DELETE requests.
* `GET /one/file` would return the file data or 404 when not found.
* `PUT /another/file` would write a file.
* `DELETE /another/file` would delete the file.

For execution requests, each request should be identified with an ID.
* `GET /~/ID` get the execution results for request ID.
* `DELETE /~/ID` delete the execution results for request ID.
* `POST /~/ID` send a request pipeline (described below).

Each execution request is a "pipeline", a.k.a. a list of shell commands.
They could be written as a JSON object. Here is an example.

```json
[
	{"execPath": "echo", "args": ["file content..."]},
	{"execPath": "cat", "stdout": "output_file"}
]
```

This JSON object should be sent as the body of POST request.
Each item in the array is called a pipeline item.
You could describe the command of it.
Each command could contains paths to stdin, stdout, and stderr.
If stdout is not specified, it is served as the stdin of next command (unless stdin is specified in next command).
Stdout and stderr are the only way to modify files in "/mnt".

The execution results (might be partitial) could be visited through GET request later.
The GET body contains multiple lines, each curresponds to a result of a shell commands.

```
{"status":0,"signal":0,"time":1,"mem":163840}
{"status":0,"signal":0,"time":0,"mem":294912}
```

Sometimes there could be errors.

```
{"err":10,"message":"Time Limit Exceeded","status":0,"signal":9,"time":1997,"mem":163840}
```

When error, signaled, or exit status not zero, the pipeline would be interrupted.
To avoid this, set `"forceContinue": true` in the pipeline item.
Here is the full options for each pipeline item.
* `stdin` the file serves as stdin, relative to "/mnt", default to the stdout of previous command (if stdout is not specified in previous command) or "/dev/null".
* `stdout` the file serves as stdout, relative to "/mnt".
* `stderr` the file serves as stderr, relative to "/mnt", default to "/dev/null".
* `forceContinue` whether to force the pipeline continue when abnormal status.
* `timeLimit` the CPU time limit for this item, in milliseconds (the limit set to the process is larger than this value to ensure it has enough time to execute).
* `totalTimeLimit` the total execution time limit for this item, in milliseconds.
* `memLimit` the memory limit for this item, in bytes.
* `fileSizeLimit` the maximum file size that this item could access, in bytes.
* `mnt` the directory in storage mounted to "/mnt", default to "/".
* `workingDir` the working directory, default to "/mnt".
* `execPath` the file to execute, searching as the shell does.
* `execFile` the file to execute, relative to "/mnt".
* `args` an array of arguments sending to the process.

Files specified in "stdin" and "execFile" would be checked before accept pipeline.
If any of them is not existed, 404 would be returned for POST request.

## LICENSE ##

GNU AFFERO GENERAL PUBLIC LICENSE 3.0
