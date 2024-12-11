import { it, expect, describe } from '@jest/globals'
import { FileEngine } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { fileImporter } from '@comyata/fe/Importer/FileImporter'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import path from 'node:path'
import url from 'node:url'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=FileEngine-Context.test

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const mocksDir = path.join(__dirname, 'mocks')

describe('FileEngine-Context', () => {
    it('contextOf - no relative', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
        })

        expect(() => fileEngine.contextOf('./someFile.yml')).toThrow('Relative file not supported as ref: ./someFile.yml')
    })

    it('contextOf - of existing file w/ importContext', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
        })

        fileEngine.register('document', {}, {
            importer: 'custom',
            resolveRelative: (relPath: string) => url.pathToFileURL(path.join(mocksDir, relPath)).href,
        })

        expect(fileEngine.contextOf('document').importer).toBe('custom')
    })

    it('contextOf - of existing file w/ importContext w/o resolveRelative', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
        })

        fileEngine.register('document', {}, {
            importer: 'custom',
        })

        expect(() => fileEngine.contextOf('document')).toThrow('Source has no importContext for document')
    })

    it('contextOf - of existing file w/o importContext', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
        })

        fileEngine.register('document', {})

        expect(() => fileEngine.contextOf('document')).toThrow('No source registered for document')
    })

    it('contextOf - none matching', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
        })

        expect(() => fileEngine.contextOf('document')).toThrow('No importer registered for document')
    })

    it('contextOf - w/o resolveDirectory', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use({
                    ...fileImporter({
                        basePath: mocksDir,
                    }),
                    // disabling resolveDirectory to disable contextOf/for supporting only fully resolved import/load
                    resolveDirectory: undefined,
                }),
        })

        const fileHref = url.pathToFileURL(path.join(mocksDir)).href
        expect(() => fileEngine.contextOf(fileHref)).toThrow(`Importer file does not support directory context, required to load ${fileHref}`)
    })
})
