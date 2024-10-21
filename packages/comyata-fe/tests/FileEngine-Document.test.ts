import { NodeComputeError } from '@comyata/run/Errors'
import { it, expect, describe } from '@jest/globals'
import { FileEngine, FileComputeStats, RuntimeContext } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { fileImporter } from '@comyata/fe/Importer/FileImporter'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import path from 'node:path'
import url from 'node:url'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=FileEngine-Document.test

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const mocksDir = path.join(__dirname, 'mocks')

describe('FileEngine-Document', () => {

    it('FileEngine Document inline', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const dataFile = fileEngine.register('document', {
            static: 'Comyata',
            calc: '${10 + 5}',
            str: '${$lowercase(input.text)}',
        }, {})
        const [r] = await fileEngine.run(dataFile, {input: {text: 'Lorem Ipsum'}}) as [any, FileComputeStats, RuntimeContext]

        expect(r.static).toBe('Comyata')
        expect(r.calc).toBe(15)
        expect(r.str).toBe('lorem ipsum')
    })

    it('FileEngine Document inline, in basePath', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const dataFile = fileEngine.register('document', {
            project: '${ $import("./project/project.yml").name }',
        }, {resolveRelative: (relPath: string) => url.pathToFileURL(path.join(mocksDir, relPath)).href})
        const [r] = await fileEngine.run(dataFile, {}) as [any, FileComputeStats, RuntimeContext]

        expect(r.project).toBe('Comyata')
    })

    it('FileEngine Document inline, different dir', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const dataFile = fileEngine.register('document', {
            project: '${ $import("./project.yml").name }',
        }, {resolveRelative: (relPath: string) => url.pathToFileURL(path.join(mocksDir, 'project', relPath)).href})
        const [r] = await fileEngine.run(dataFile, {}) as [any, FileComputeStats, RuntimeContext]

        expect(r.project).toBe('Comyata')
    })

    it('FileEngine Document, no relative support', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })

        const dataFile = fileEngine.register('document', {
            project: '${ $import("./project.yml").name }',
        }, {})

        const run = fileEngine.run(dataFile, {})
        // based on comment: https://github.com/jestjs/jest/issues/8698#issuecomment-705093586
        // note: the class instance checks allows any base type of the actual thrown error, it also passes with `Error`
        await expect(run).rejects.toThrow(NodeComputeError)
        await expect(run).rejects.toThrow('Compute failure at "/project" with "$".\nRelative file not supported for: ./project.yml')
        await expect(run).rejects.toThrow(expect.objectContaining({target: dataFile.node?.children?.get('project')}))
    })
})
