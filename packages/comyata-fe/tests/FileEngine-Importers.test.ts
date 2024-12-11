import { ComputableError, NodeComputeError } from '@comyata/run/Errors'
import { jest, it, expect, describe } from '@jest/globals'
import { FileEngine } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { fileImporter } from '@comyata/fe/Importer/FileImporter'
import { remoteImporter } from '@comyata/fe/Importer/RemoteImporter'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import path from 'node:path'
import url from 'node:url'
import yaml from 'yaml'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=FileEngine-Importers

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const mocksDir = path.join(__dirname, 'mocks')

const mockApiHost = 'http://localhost:8082'

global.fetch = jest.fn<typeof fetch>((input) => {
    let res: Response

    // Mocking responses based on the URL
    if(input === 'http://localhost:8082/templated') {
        const jsonResponse = {
            title: 'Remote Template',
            stats: '${$import(\'./static-result\').views}',
            calc: '${10 + 5}',
        }
        res = new Response(JSON.stringify(jsonResponse), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        })
    } else if(input === 'http://localhost:8082/templated-context') {
        const jsonResponse = {
            title: 'Remote Template with Context',
            parsed: '${$fromJSON(jsonString)}',
            viewsAvg: '${$average(views)}',
        }
        res = new Response(JSON.stringify(jsonResponse), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        })
    } else if(input === 'http://localhost:8082/static-result') {
        const jsonResponse = {
            title: 'Static Result',
            views: 123,
            content: 'Lorem Ipsum',
        }
        res = new Response(JSON.stringify(jsonResponse), {
            status: 200,
            headers: {'Content-Type': 'application/json'},
        })
    } else if(input === 'http://localhost:8082/invalid-result') {
        const jsonResponse = {
            error: 'Generic Error Message',
        }
        res = new Response(JSON.stringify(jsonResponse), {
            status: 400,
            headers: {'Content-Type': 'application/json'},
        })
    } else if(input === 'http://localhost:8082/content-type-missing') {
        const jsonResponse = {
            title: 'Missing Content Type',
        }
        res = new Response(JSON.stringify(jsonResponse), {
            status: 200,
            // @ts-expect-error by default adds text/plain content-type
            headers: {
                'Content-Type': undefined,
            },
        })
    } else if(input === 'http://localhost:8082/content-type-with-parameters') {
        const jsonResponse = {
            title: 'Static Result',
            views: 123,
            content: 'Lorem Ipsum',
        }
        res = new Response(JSON.stringify(jsonResponse), {
            status: 200,
            headers: {
                'Content-Type': 'application/json;charset=UTF-8',
            },
        })
    } else if(input === 'http://localhost:8082/md-frontmatter') {
        const mdContent = `---
meta:
    title: "Lorem Ipsum"
    description: "Markdown with frontmatter data."
---

# Lorem Ipsum

Pizza, spaghetti, cannelloni, lasagna, ravioli, risotto, gnocchi, fettuccine, tortellini.
`
        res = new Response(mdContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/markdown',
            },
        })
    } else {
        res = new Response(null, {
            status: 404,
            statusText: 'Not Found',
        })
    }

    return Promise.resolve(res)
})

const converterMarkdown = (value: string) => {
    // a very simple and naive MD-FM parser
    const parsed = value
        .split('\n')
        .reduce((parsed, line, i) => {
            if(i === 0 && line === '---') {
                parsed.hasFm = true
                parsed.openFm = true
            } else if(parsed.openFm && line === '---') {
                parsed.openFm = false
            } else if(parsed.openFm) {
                parsed.fm.push(line)
            } else {
                parsed.content.push(line)
            }
            return parsed
        }, {
            fm: [] as string[],
            hasFm: false,
            openFm: false,
            content: [] as string[],
        })
    let data: any = null
    if(parsed.fm.length) {
        data = yaml.parse(parsed.fm.join('\n'))
    }
    return {
        data: data,
        content: parsed.content.join('\n').trimStart(),
    }
}

describe('FileEngine', () => {

    it('FileEngine HTTP resolver', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter()),
        })

        const quotesResolver = fileEngine.contextOf('https://dummyjson.com/quotes/')
        expect(quotesResolver).toBeInstanceOf(Object)
        expect(quotesResolver.resolveRelative).toBeInstanceOf(Function)
        expect(quotesResolver.importer).toBe('remote')
        const pokeResolver = fileEngine.contextOf('https://pokeapi.co/api/v2/')
        expect(pokeResolver).toBeInstanceOf(Object)
        expect(pokeResolver.resolveRelative).toBeInstanceOf(Function)
        expect(pokeResolver.importer).toBe('remote')

        const quote1Ref = fileEngine.fileRef('./1', quotesResolver)
        expect(fileEngine.files.has(quote1Ref.fileId)).toBe(true)
        expect(quote1Ref.fileId).toBe('https://dummyjson.com/quotes/1')
        const recipesRef = fileEngine.fileRef('../recipes', quotesResolver)
        expect(fileEngine.files.has(recipesRef.fileId)).toBe(true)
        expect(recipesRef.fileId).toBe('https://dummyjson.com/recipes')
        const pokeRef = fileEngine.fileRef('./ability', pokeResolver)
        expect(fileEngine.files.has(pokeRef.fileId)).toBe(true)
        expect(pokeRef.fileId).toBe('https://pokeapi.co/api/v2/ability')
    })

    it('FileEngine HTTP run w/ static result', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({})),
        })

        const mockApiResolver = fileEngine.contextOf(mockApiHost)
        expect(mockApiResolver).toBeInstanceOf(Object)
        expect(mockApiResolver.resolveRelative).toBeInstanceOf(Function)
        expect(mockApiResolver.importer).toBe('remote')

        const staticResultFile = fileEngine.fileRef('./static-result', mockApiResolver)
        expect(staticResultFile.fileId).toBe(mockApiHost + '/static-result')

        const [r] = await fileEngine.run(staticResultFile, {})
        expect(fileEngine.files.has(staticResultFile.fileId)).toBe(true)
        expect(r).toStrictEqual({
            'title': 'Static Result',
            'views': 123,
            'content': 'Lorem Ipsum',
        })
    })

    it('FileEngine HTTP run w/ missing content-type header', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({})),
        })

        const mockApiResolver = fileEngine.contextOf(mockApiHost)
        expect(mockApiResolver).toBeInstanceOf(Object)
        expect(mockApiResolver.resolveRelative).toBeInstanceOf(Function)
        expect(mockApiResolver.importer).toBe('remote')

        const staticResultFile = fileEngine.fileRef('./content-type-missing', mockApiResolver)
        expect(staticResultFile.fileId).toBe(mockApiHost + '/content-type-missing')

        const [r] = await fileEngine.run(staticResultFile, {})
        expect(fileEngine.files.has(staticResultFile.fileId)).toBe(true)
        expect(r).toStrictEqual({
            title: 'Missing Content Type',
        })
    })

    it('FileEngine HTTP run w/ invalid status code', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({})),
        })

        const mockApiResolver = fileEngine.contextOf(mockApiHost)
        expect(mockApiResolver).toBeInstanceOf(Object)
        expect(mockApiResolver.resolveRelative).toBeInstanceOf(Function)
        expect(mockApiResolver.importer).toBe('remote')

        const staticResultFile = fileEngine.fileRef('./invalid-result', mockApiResolver)
        expect(staticResultFile.fileId).toBe(mockApiHost + '/invalid-result')

        await expect(() => fileEngine.run(staticResultFile, {}))
            .rejects
            .toStrictEqual({
                contentType: 'application/json',
                text: '{"error":"Generic Error Message"}',
            })
        expect(fileEngine.files.has(staticResultFile.fileId)).toBe(true)
    })

    it('FileEngine HTTP run w/ remote template', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({})),
        })

        const mockApiResolver = fileEngine.contextOf(mockApiHost)
        expect(mockApiResolver).toBeInstanceOf(Object)
        expect(mockApiResolver.resolveRelative).toBeInstanceOf(Function)
        expect(mockApiResolver.importer).toBe('remote')

        const templatedFile = fileEngine.fileRef('./templated', mockApiResolver)
        expect(templatedFile.fileId).toBe(mockApiHost + '/templated')
        expect(fileEngine.files.has(templatedFile.fileId)).toBe(true)
        expect(fileEngine.files.has(mockApiHost + '/static-result')).toBe(false)

        const [r] = await fileEngine.run(templatedFile, {})
        expect(fileEngine.files.has(templatedFile.fileId)).toBe(true)
        expect(fileEngine.files.has(mockApiHost + '/static-result')).toBe(true)
        expect(r).toStrictEqual({
            'title': 'Remote Template',
            'stats': 123,
            'calc': 15,
        })
    })

    it('FileEngine HTTP run w/ remote template noRelativeResolve ', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({
                    noRelativeResolve: true,
                })),
        })

        const mockApiResolver = fileEngine.contextOf(mockApiHost)
        expect(mockApiResolver).toBeInstanceOf(Object)
        expect(mockApiResolver.resolveRelative).toBe(undefined)
        expect(mockApiResolver.importer).toBe('remote')

        expect(() => fileEngine.fileRef('./templated', mockApiResolver)).toThrow(ComputableError)
        expect(() => fileEngine.fileRef('./templated', mockApiResolver)).toThrow(`Relative file not supported for: ${JSON.stringify('./templated')}`)

        const templatedFile = fileEngine.fileRef(mockApiHost + '/templated')
        expect(templatedFile.fileId).toBe(mockApiHost + '/templated')
        expect(fileEngine.files.has(templatedFile.fileId)).toBe(true)
        expect(fileEngine.files.has(mockApiHost + '/static-result')).toBe(false)

        const run = fileEngine.run(templatedFile, {})
        await expect(run).rejects.toThrow(NodeComputeError)
        await expect(run).rejects.toThrow('Compute failure at "/stats" with "$".\nRelative file not supported for: "./static-result"')

        expect(fileEngine.files.has(templatedFile.fileId)).toBe(true)
        expect(fileEngine.files.has(mockApiHost + '/static-result')).toBe(false)
    })

    it('FileEngine HTTP run w/ remote template with context', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({})),
        })

        const mockApiResolver = fileEngine.contextOf(mockApiHost)
        expect(mockApiResolver).toBeInstanceOf(Object)
        expect(mockApiResolver.resolveRelative).toBeInstanceOf(Function)
        expect(mockApiResolver.importer).toBe('remote')

        const templatedFile = fileEngine.fileRef('./templated-context', mockApiResolver)
        expect(templatedFile.fileId).toBe(mockApiHost + '/templated-context')
        expect(fileEngine.files.has(templatedFile.fileId)).toBe(true)

        const [r] = await fileEngine.run(templatedFile, {
            jsonString: JSON.stringify({
                title: 'Context JSON',
                content: 'A stringified JSON value, which the remote template parses into JSON.',
            }),
            views: [10, 20, 30, 40],
        })
        expect(fileEngine.files.has(templatedFile.fileId)).toBe(true)
        expect(r).toStrictEqual({
            title: 'Remote Template with Context',
            parsed: {
                title: 'Context JSON',
                content: 'A stringified JSON value, which the remote template parses into JSON.',
            },
            viewsAvg: 25,
        })
    })

    it('FileEngine HTTP run w/ custom converter', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({
                    converter: {
                        'text/markdown': converterMarkdown,
                    },
                })),
        })

        const mockApiResolver = fileEngine.contextOf(mockApiHost)
        expect(mockApiResolver).toBeInstanceOf(Object)
        expect(mockApiResolver.resolveRelative).toBeInstanceOf(Function)
        expect(mockApiResolver.importer).toBe('remote')

        const staticResultFile = fileEngine.fileRef('./md-frontmatter', mockApiResolver)
        expect(staticResultFile.fileId).toBe(mockApiHost + '/md-frontmatter')

        const [r] = await fileEngine.run(staticResultFile, {})
        expect(fileEngine.files.has(staticResultFile.fileId)).toBe(true)
        expect(r).toStrictEqual({
            data: {
                meta: {
                    title: 'Lorem Ipsum',
                    description: 'Markdown with frontmatter data.',
                },
            },
            content: '# Lorem Ipsum\n\nPizza, spaghetti, cannelloni, lasagna, ravioli, risotto, gnocchi, fettuccine, tortellini.\n',
        })
    })

    it('FileEngine HTTP run w/ custom converter + mimeParameters', async() => {
        let calledMimeParameters: string | undefined = undefined
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({
                    converter: {
                        'application/json': (value, mimeParameters) => {
                            calledMimeParameters = mimeParameters
                            return JSON.parse(value)
                        },
                    },
                })),
        })

        const mockApiResolver = fileEngine.contextOf(mockApiHost)
        expect(mockApiResolver).toBeInstanceOf(Object)
        expect(mockApiResolver.resolveRelative).toBeInstanceOf(Function)
        expect(mockApiResolver.importer).toBe('remote')

        const staticResultFile = fileEngine.fileRef('./content-type-with-parameters', mockApiResolver)
        expect(staticResultFile.fileId).toBe(mockApiHost + '/content-type-with-parameters')

        expect(calledMimeParameters).toBe(undefined)

        const [r] = await fileEngine.run(staticResultFile, {})
        expect(fileEngine.files.has(staticResultFile.fileId)).toBe(true)
        expect(calledMimeParameters).toBe('charset=UTF-8')
        expect(r).toStrictEqual({
            title: 'Static Result',
            views: 123,
            content: 'Lorem Ipsum',
        })
    })

    it('FileEngine file resolver', async() => {
        const fileEngine = new FileEngine({
            nodes: [],
            compute: {},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })

        const mocksResolver = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)
        expect(mocksResolver).toBeInstanceOf(Object)
        expect(mocksResolver.resolveRelative).toBeInstanceOf(Function)
        expect(mocksResolver.importer).toBe('file')
    })

    it('FileEngine file resolver w/ custom converter by ext', async() => {
        let called = false
        const fileEngine = new FileEngine({
            nodes: [],
            compute: {},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                    converter: {
                        '.yml': (value) => {
                            called = true
                            return yaml.parse(value)
                        },
                    },
                })),
        })

        const mocksResolver = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)
        const dataFile = fileEngine.fileRef('./cards/quote_1.yml', mocksResolver)
        expect(called).toBe(false)
        const [r] = await fileEngine.run(dataFile, {})
        expect(fileEngine.files.has(dataFile.fileId)).toBe(true)
        expect(called).toBe(true)
        expect(r).toStrictEqual({
            id: 1,
            quote: 'Lorem ipsum quotum',
        })
    })

    it('FileEngine file resolver w/ custom converter, no extension or mime', async() => {
        // testing that converterDefault is used when none of `converter` matches and there is not even a file extension or mime
        let called = false
        const fileEngine = new FileEngine({
            nodes: [],
            compute: {},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                    converter: {},
                    converterDefault: (value) => {
                        called = true
                        return yaml.parse(value)
                    },
                })),
        })

        const mocksResolver = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href)
        const dataFile = fileEngine.fileRef('./cards/quote_3', mocksResolver)
        expect(called).toBe(false)
        const [r] = await fileEngine.run(dataFile, {})
        expect(fileEngine.files.has(dataFile.fileId)).toBe(true)
        expect(called).toBe(true)
        expect(r).toStrictEqual({
            id: 3,
            quote: 'Quia non numquam',
        })
    })

    it('FileEngine file invalid path access', async() => {
        const fileEngine = new FileEngine({
            nodes: [],
            compute: {},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })

        // todo: test both cases, for when it returns an async (during run) and when directly a sync result
        expect(() =>
            fileEngine.fileRef(
                '../../SomeFile.yml',
                fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href),
            ),
        )
            .toThrow(new Error(`File import ${JSON.stringify(url.pathToFileURL(path.resolve(mocksDir, '../../SomeFile.yml')))} not relative to ${JSON.stringify(path.resolve(mocksDir))}`))
    })

    it('FileEngine file invalid path access for content', async() => {
        const fileEngine = new FileEngine({
            nodes: [],
            compute: {},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })

        expect(() =>
            fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir, '../../SomeFile.yml')).href),
        )
            .toThrow(new Error(`File import ${JSON.stringify(url.pathToFileURL(path.resolve(mocksDir, '../../SomeFile.yml')))} not relative to ${JSON.stringify(path.resolve(mocksDir))}`))
    })
})
