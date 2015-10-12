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

TODO

## LICENSE ##

GNU AFFERO GENERAL PUBLIC LICENSE 3.0
