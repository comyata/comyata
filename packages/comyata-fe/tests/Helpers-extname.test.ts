import { extname } from '@comyata/fe/Helpers/extname'
import { it, describe, expect } from '@jest/globals'
import path from 'node:path'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=Helpers-extname

describe('Helpers-extname', () => {
    it.each([
        // Basic cases
        ['/path/to/file.txt', '.txt'],
        ['file.txt', '.txt'],
        ['/path/to/file', ''],
        ['/path.to/file', ''],
        ['/path.to/file.ext', '.ext'],
        ['', ''],
        ['.hiddenfile', ''],
        ['/directory/.hiddenfile', ''],
        ['\\directory\\.hiddenfile', ''],
        ['file.with.many.dots.ext', '.ext'],

        // Ending with a slash
        ['/path/to/file.txt/', '.txt'],
        ['file.txt/', '.txt'],
        ['\\path\\to\\file.txt\\', '.txt'],
        ['file.txt\\', '.txt'],
        ['file.txt//', '.txt'],
        ['file.txt\\\\', '.txt'],

        // Files starting with multiple dots
        ['..hiddenfile', '.hiddenfile'],
        ['../.hiddenfile', ''],
        ['/path/.hidden.file', '.file'],
        ['/path/..hidden.file', '.file'],

        // Trailing dots
        ['/path/to/file.', '.'],
        ['file.', '.'],
        ['/path/.hiddenfile.', '.'],
        ['/path/to/.hidden.file.', '.'],

        // Path with trailing slash
        ['/path/to/', ''],
        ['/path/to/.hiddenfile/', ''],

        // Only slashes
        ['/', ''],
        ['\\', ''],
        ['////', ''],
        ['\\\\', ''],

        // Mixed slash types
        ['/path\\to\\file.txt', '.txt'],
        ['\\path/to/file.txt', '.txt'],

        // Extensions with uncommon characters
        ['/path/to/file.name@1.0.zip', '.zip'],
        ['/path/to/file.name-v1.2.3.tar.gz', '.gz'],
        ['/path/to/file+name-1.0~alpha.beta', '.beta'],

        // Cases with no basename
        ['/path/to/.', ''],
        ['/.', ''],
        ['/.hiddenfile', ''],

        // todo: `path.extname` is not intended for URIs, resulting in unexpected behavior for users,
        //       yet would need an opinionated handling in `extname`,
        //       workaround in `RemoteImporter`: only using the `uri.pathname` for getting the extension
        // URLs
        ['https://example.org/file.txt', '.txt'],
        ['https://example.org/path/to/file.tar.gz', '.gz'],
        ['https://example.org/path/to/.hiddenfile', ''],
        ['https://example.org/.hiddenfile.txt', '.txt'],
        ['https://example.org/', '.org'],
        ['https://example.org/file.', '.'],

        // Edge cases for paths with query strings or fragments (URI-specific)
        ['https://example.org/file.txt?query=1', '.txt?query=1'],
        ['https://example.org/file.tar.gz#fragment', '.gz#fragment'],
        ['https://example.org/path/.hiddenfile?query=1#fragment', ''],
        ['https://example.org/file.name-v1.2?query=string', '.2?query=string'],
        ['https://example.org/path/to.file?query.string.gz', '.gz'],

        // Cases with UNC paths (Windows-specific)
        ['\\\\server\\share\\file.txt', '.txt'],
        ['\\\\server\\share\\.hiddenfile', ''],
        ['\\\\server\\share\\file.', '.'],
    ])(
        '%p : %p',
        (file, ext) => {
            expect(extname(file)).toBe(ext)
            // ensure same behaviour as Node.js native
            expect(path.extname(file)).toBe(ext)
        },
    )

    it.each([
        // URLs
        ['https://example.org/file.txt', '.txt'],
        ['https://example.org/path/to/file.tar.gz', '.gz'],
        ['https://example.org/path/to/.hiddenfile', ''],
        ['https://example.org/.hiddenfile.txt', '.txt'],
        ['https://example.org/', ''],
        ['https://example.org/file.', '.'],

        // Edge cases for paths with query strings or fragments (URI-specific)
        ['https://example.org/file.txt?query=1', '.txt'],
        ['https://example.org/file.tar.gz#fragment', '.gz'],
        ['https://example.org/path/.hiddenfile?query=1#fragment', ''],
        ['https://example.org/file.name-v1.2?query=string', '.2'],
        ['https://example.org/path/to.file?query.string.gz', '.file'],
    ])(
        '%p : %p (parsed URL)',
        (file, ext) => {
            const pathname = new URL(file).pathname
            expect(extname(pathname)).toBe(ext)
            // ensure same behaviour as Node.js native
            expect(path.extname(pathname)).toBe(ext)
        },
    )
})
