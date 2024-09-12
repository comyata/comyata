import { it, expect, describe } from '@jest/globals'
import { FileEngine, FileComputeStats, RuntimeContext } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { fileImporter } from '@comyata/fe/Importer/FileImporter'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import path from 'node:path'
import url from 'url'

// npm run tdd -- --selectProjects=test-comyata-fe
// npm run tdd -- --selectProjects=test-comyata-fe --testPathPattern=FileEngine.test

const mocksDir = path.resolve('./packages/comyata-fe/tests/mocks/')
describe('FileEngine', () => {

    it('FileEngine', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
            importer: new Importers()
                .use(fileImporter({
                    basePath: mocksDir,
                })),
        })
        const dataFile = fileEngine.register('document', {
            project: '${ $import("./project.yml").id }',
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

        expect(r.project).toBe('comyata')
        expect(r.home).toStrictEqual({title: 'Page of Comyata-JS'})
        expect(r.someImports?.[0]).toBe('en')
        expect(r.someImports?.[1]).toBe('Sample Page')
        expect(r.someImports?.[2]?.title).toBe('Quest')
        // expect(r).toStrictEqual({
        //     project: 'comyata',
        //     home: {title: 'Comyata-JS'},
        //     someImports: [
        //         'en',
        //         'Sample Page',
        //         {
        //             title: 'Quest',
        //             body: 'Advanced data querying **made easy with data loaders**.\n' +
        //                 '\n' +
        //                 'Interoperable data formats with safe to use expressions.\n',
        //             link: 'https://example.org',
        //             quote_of_day: 2,
        //             dir: mocksDir + path.sep,
        //         },
        //         'Adipisci et alum',
        //     ],
        // })
        // expect(fileEngine.node.value).toStrictEqual(orgValue)
    })
})
