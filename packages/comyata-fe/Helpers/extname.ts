/**
 * Replacement for `path.extname`, with the difference that it supports windows or posix style paths consistently.
 * For same behaviour as `path.posix` set `strictPosix` to `true`.
 */
export function extname(path: string, strictPosix = false) {
    let dotIndex = -1
    let slashIndex = -1
    let nameEnd = 0

    for(let i = path.length - 1; i >= 0; i--) {
        const char = path[i]
        if(char === '.' && dotIndex === -1) {
            dotIndex = i
        } else if((char === '/' || (!strictPosix && char === '\\')) && (nameEnd === path.length - i - 1)) {
            // remove trailing slashes
            nameEnd++
        } else if((char === '/' || (!strictPosix && char === '\\')) && slashIndex === -1) {
            // break once a directory is encountered
            slashIndex = i
            break
        }
    }

    if(dotIndex === -1 || (slashIndex !== -1 && dotIndex < slashIndex)) {
        return ''
    }

    if(dotIndex === 0 || dotIndex === slashIndex + 1) {
        return ''
    }

    if(nameEnd) {
        return path.slice(dotIndex, -nameEnd)
    }

    return path.slice(dotIndex)
}
