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
    } else {
        res = new Response(null, {
            status: 404,
            statusText: 'Not Found',
        })
    }

    return Promise.resolve(res)
})

describe('FileEngine', () => {

    it('FileEngine HTTP resolver', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({})),
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

    it('FileEngine file invalid path access', async() => {
        const fileEngine = new FileEngine({
            nodes: [],
            compute: {},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })

        // todo: test both cases, for when it returns an async and when directly a sync result
        expect(() =>
            fileEngine.fileRef(
                '../../SomeFile.yml',
                fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href),
            ),
        )
            .toThrow(new Error(`File import ${JSON.stringify(url.pathToFileURL(path.resolve(mocksDir, '../../SomeFile.yml')))} not relative to ${JSON.stringify(path.resolve(mocksDir))}`))

        // const dataFile = fileEngine.register('document', {
        //     objOrEval: {
        //         someImport: '${ $import("../../../Parser.test.ts").none }',
        //         // le.resolveFromBase
        //     },
        // }, fileEngine.fileRefContext(url.pathToFileURL(path.join(mocksDir)).href))
        //
        // try {
        //     await fileEngine.run(dataFile, {}).catch(() => console.log('in-catch-cb'))
        // } catch(e) {
        //     console.log('in-catch-try', e)
        // }
        // await expect(fileEngine.run(dataFile, {}))
        //     .rejects
        //     .toThrow(new Error(`File import ${JSON.stringify(url.pathToFileURL(path.resolve(mocksDir, '../../Parser.test.ts')))} not relative to ${JSON.stringify(path.resolve(mocksDir))}`))
    })
})
