import { it, expect, describe } from '@jest/globals'
import { FileEngine, FileComputeStats, RuntimeContext } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { fileImporter } from '@comyata/fe/Importer/FileImporter'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import path from 'node:path'
import url from 'node:url'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=FileEngine.test

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const mocksDir = path.join(__dirname, 'mocks')

// a general smoke test
describe('FileEngine Smoke', () => {

    it('FileEngine Smoke', async() => {
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
            home: {
                title: '${ "Page of " & $import("./project.yml").name }',
            },
            someImports: [
                // '${ $import("../../Parser.test.ts").none }',
                '${ $import("../page.yml").meta.lang }',
                '${ $import("../page.yml").meta.title }',
                '${ $import("../cards/project_card.yml") }',
                `$\{ $import(${JSON.stringify(url.pathToFileURL(path.join(mocksDir, './cards/quote_2.yml')))}).quote }`,
                // '${ $import("documentB").none }',
            ],
        }, {resolveRelative: (relPath: string) => url.pathToFileURL(path.join(mocksDir, 'project', relPath)).href})
        const [r] = await fileEngine.run(dataFile, {}) as [any, FileComputeStats, RuntimeContext]

        expect(r.project).toBe('Comyata')
        expect(r.home).toStrictEqual({title: 'Page of Comyata'})
        expect(r.someImports?.[0]).toBe('en')
        expect(r.someImports?.[1]).toBe('Sample Page')
        expect(r.someImports?.[2]?.title).toBe('Example Project')
    })
})
