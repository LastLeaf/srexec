#include <stdio.h>
int arr[1048576*64];
int main(){
	int i;
	for(i=0; i<1048576*64; i++) {
		arr[i] = i;
	}
	for(i=1; i<1048576*64; i++) {
		arr[i] += arr[i-1];
	}
	printf("%d", arr[1048576*64-1]);
	return 0;
}
