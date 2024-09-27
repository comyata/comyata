import { it, expect, describe } from '@jest/globals'
import { FileEngine, FileComputeStats, RuntimeContext } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import path from 'node:path'
import url from 'url'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=FileEngineJsonata

const mocksDir = path.resolve('./packages/comyata-fe/tests/mocks/')
describe('FileEngineJsonata', () => {
    it('fileEngineJsonata Custom Function', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {
                [DataNodeJSONata.engine]: fileEngineJsonata(() => ({
                    hello: () => 'world',
                })),
            },
            importer: new Importers(),
        })
        const dataFile = fileEngine.register('document', {
            helloResult: '${ $hello() }',
        }, {resolveRelative: (relPath: string) => url.pathToFileURL(path.join(mocksDir, 'project', relPath)).href})
        const [r] = await fileEngine.run(dataFile, {}) as [any, FileComputeStats, RuntimeContext]

        expect(r.helloResult).toBe('world')
    })
})
