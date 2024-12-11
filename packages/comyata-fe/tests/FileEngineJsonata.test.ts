import { it, expect, describe } from '@jest/globals'
import { FileEngine, FileComputeStats, RuntimeContext } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
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
        })
        const dataFile = fileEngine.register('document', {
            helloResult: '${ $hello() }',
        }, {})
        const [r] = await fileEngine.run(dataFile, {}) as [any, FileComputeStats, RuntimeContext]

        expect(r.helloResult).toBe('world')
    })

    it('fileEngineJsonata custom process', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {
                [DataNodeJSONata.engine]: fileEngineJsonata(),
            },
        })

        fileEngine.register('documentB', '${ val }', {})

        const dataFile = fileEngine.register('document', {
            valA: '${ val }',
            valB: '${ $process("documentB", {"val": val + 1 }) }',
        }, {})
        const [r] = await fileEngine.run(dataFile, {val: 1}) as [any, FileComputeStats, RuntimeContext]

        expect(r).toStrictEqual({
            valA: 1,
            valB: 2,
        })
    })

    it.each([
        {tpl: '${$load({})}', fn: '$load'},
        {tpl: '${$import({})}', fn: '$import'},
        {tpl: '${$process({})}', fn: '$process'},
    ])('fileEngineJsonata invalid argument: $tpl', async({tpl, fn}) => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {
                [DataNodeJSONata.engine]: fileEngineJsonata(),
            },
        })

        const dataFile = fileEngine.register('document', tpl, {})
        await expect(() => fileEngine.run(dataFile))
            .rejects.toThrow('Compute failure at "" with "$".\n' + fn + ' requires as string as file')
    })
})
