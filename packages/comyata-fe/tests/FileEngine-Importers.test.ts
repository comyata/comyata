import { it, expect, describe } from '@jest/globals'
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

describe('FileEngine', () => {

    it('FileEngine HTTP resolver', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(remoteImporter({})),
        })
        // console.log('fsResolver', projectsResolver)
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

        // todo: add real HTTP calls in tests with a local running mock server
        //       disabled actual http calls, as due to network latency, it could take a while
        // const loadData = async(dataRef: DataFile<DataNodeJSONata>) => {
        //     await fileEngine.run(dataRef, {})
        //     expect(fileEngine.files.has(dataRef.fileId)).toBe(true)
        // }
        // await loadData(quote1Ref)
        // await loadData(recipesRef)
        // await loadData(pokeRef)
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
