export const stripRelative = (urlOrPath: string) => {
    return urlOrPath.replace(/^(\.\/|\.\.\/|\.\\|\.\.\\)/, '')
}
