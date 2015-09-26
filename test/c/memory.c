#include <stdio.h>
int arr[104857600];
int main(){
	int i;
	for(i=0; i<104857600; i++) {
		arr[i] = i;
	}
	for(i=1; i<104857600; i++) {
		arr[i] += arr[i-1];
	}
	printf("%d", arr[104857600-1]);
	return 0;
}
