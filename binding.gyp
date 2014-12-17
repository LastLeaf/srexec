{
	"targets": [
		{
			"target_name": "sruncer_runner",
			"sources": [ "lib/runner/main.cpp" ],
			"libraries": [
				"-llxc",
				"-L/usr/lib",
				"-L/usr/local/lib"
			],
		}
	]
}