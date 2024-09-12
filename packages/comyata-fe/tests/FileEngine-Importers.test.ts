import { it, expect, describe } from '@jest/globals'
import { FileEngine } from '@comyata/fe/FileEngine'
import { DataFile } from '@comyata/fe/DataFile'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { fileImporter } from '@comyata/fe/Importer/FileImporter'
import { remoteImporter } from '@comyata/fe/Importer/RemoteImporter'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import path from 'node:path'
import url from 'url'

// npm run tdd -- --selectProjects=test-comyata-fe
// npm run tdd -- --selectProjects=test-comyata-fe --testPathPattern=FileEngine-Importers

const mocksDir = path.resolve('./packages/comyata-fe/tests/mocks')
describe('FileEngine', () => {
    it('FileEngine fs load', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                }))
                .use(remoteImporter({})),
        })
        const projectsResolver = fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir, 'project')).href)
        // console.log('fsResolver', projectsResolver)
        const quotesResolver = fileEngine.contextOf('https://dummyjson.com/quotes/')
        // console.log('quotesResolver', quotesResolver)
        const pokeResolver = fileEngine.contextOf('https://pokeapi.co/api/v2/')
        // console.log('pokeResolver', pokeResolver)

        const fsRefProject = fileEngine.fileRef('./project.yml', projectsResolver)
        // console.log('fsRef1', fsRefProject)
        const fsRefNonExisting = fileEngine.fileRef('./nested/main.yml', projectsResolver)
        // console.log('fsRef2', fsRef2)
        const fsRefPageRelative = fileEngine.fileRef('../page.yml', projectsResolver)
        // console.log('fsRef3', fsRef3)

        const quote1Ref = fileEngine.fileRef('./1', quotesResolver)
        // console.log('quote1Ref', quote1Ref)
        const recipesRef = fileEngine.fileRef('../recipes', quotesResolver)
        // console.log('recipesRef', recipesRef)
        const pokeRef = fileEngine.fileRef('./ability', pokeResolver)
        // console.log('pokeRef', pokeRef)

        const loadData = async(dataRef: DataFile<DataNodeJSONata>) => {
            await fileEngine.run(dataRef, {})
            expect(fileEngine.files.has(dataRef.fileId)).toBe(true)
        }
        const dataFile = fileEngine.fileRef(url.pathToFileURL(path.join(mocksDir, 'page.yml')).href)
        await loadData(dataFile)
        await loadData(fsRefProject)
        await expect(loadData(fsRefNonExisting)).rejects.toThrow(new Error(`ENOENT: no such file or directory, open '${path.join(mocksDir, './project/nested/main.yml')}'`))
        await loadData(fsRefPageRelative)
        await loadData(quote1Ref)
        await loadData(recipesRef)
        await loadData(pokeRef)

        expect(dataFile).toBeTruthy()

        // due to network latency, this test can take a while
        // todo: replace HTTP calls in tests with a local running mock server
    }, 20000)

    it('FileEngine fs load file', async() => {
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const fileEngine = new FileEngine({
            nodes: [],
            compute: {},
        })

        // const dataFile = fileEngine.parse(fsLoader(path.join(mocksDir, 'page.yml')))

        expect(true).toBeTruthy()
    })

    it('FileEngine invalid path access', async() => {
        const fileEngine = new FileEngine({
            nodes: [],
            compute: {},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })

        // todo: test both cases, for when it returns an async and when directly a sync result
        expect(true).toBeTruthy()

        expect(() =>
            fileEngine.fileRef(
                '../../Parser.test.ts',
                fileEngine.contextOf(url.pathToFileURL(path.join(mocksDir)).href),
            ),
        )
            .toThrow(new Error(`File import ${JSON.stringify(url.pathToFileURL(path.resolve(mocksDir, '../../Parser.test.ts')))} not relative to ${JSON.stringify(path.resolve(mocksDir))}`))

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
