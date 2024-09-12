export const isRelative = (urlOrPath: string) => {
    return (
        urlOrPath.startsWith('./') || urlOrPath.startsWith('../') ||
        urlOrPath.startsWith('.\\') || urlOrPath.startsWith('..\\')
    )
}
