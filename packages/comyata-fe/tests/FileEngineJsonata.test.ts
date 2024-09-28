import { it, expect, describe } from '@jest/globals'
import { FileEngine, FileComputeStats, RuntimeContext } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=FileEngineJsonata

describe('FileEngineJsonata', () => {
    it('fileEngineJsonata Global Context Variable', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {
                [DataNodeJSONata.engine]: fileEngineJsonata(() => ({
                    text: 'value',
                    list: [1, 2, 3],
                    fields: {
                        field1: 'a',
                    },
                })),
            },
            importer: new Importers(),
        })
        const dataFile = fileEngine.register('document', {
            text: '${ $text }',
            arraySelect: '${ $list[1] }',
            objectSelect: '${ $fields.field1 }',
        }, {})
        const [r] = await fileEngine.run(dataFile, {}) as [any, FileComputeStats, RuntimeContext]

        expect(r.text).toBe('value')
        expect(r.arraySelect).toBe(2)
        expect(r.objectSelect).toBe('a')
    })

    it('fileEngineJsonata Global Context Function', async() => {
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
        }, {})
        const [r] = await fileEngine.run(dataFile, {}) as [any, FileComputeStats, RuntimeContext]

        expect(r.helloResult).toBe('world')
    })
})
