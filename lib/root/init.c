#include <unistd.h>

int main(){
	char s[4096];
	int c;

	while( (c = read(STDIN_FILENO, s, 4096)) > 0 ){
		write(STDOUT_FILENO, s, c);
	}

	return 0;
}