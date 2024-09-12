export const notRelativeUpwards = (urlOrPath: string) => {
    if(urlOrPath.startsWith('../') || urlOrPath.startsWith('..\\')) {
        throw new Error('Error: Traversing upwards using \'../\' is not permitted in this context.')
    }
}
