import { DataNode, IDataNode } from '@comyata/run/DataNode'
import { NodeComputeError } from '@comyata/run/Errors'
import { createValueProxy } from '@comyata/run/ValueProxy'
import { it, expect, describe } from '@jest/globals'
import { DataNodeJSONata, UnresolvedJSONataExpression } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { ComputeFn, IComputeStatsBase, NodeComputeStats, runtime } from '@comyata/run/Runtime'

// npm run tdd -- --selectProjects=test-@comyata/run
// npm run tdd -- --selectProjects=test-@comyata/run --testPathPattern=Runtime.test

const mockData = {
    name: 'Surfboard',
    tags: ['sports', 'surfing'],
    selection: {
        amount: 1,
        price: 70.25,
    },
    fastShipping: null,
    exclusive: true,
}

describe('Runtime', () => {
    const jsonataCompute: ComputeFn<DataNodeJSONata> = (computedNode, context, parentData, runtimeBaggage) => {
        return computedNode.expr.evaluate(
            context,
            {
                self: () => createValueProxy(parentData[0], computedNode, runtimeBaggage.getNodeContext, computedNode.path.slice(0, -1)),
                root: () => createValueProxy(parentData[parentData.length - 1] || null, computedNode, runtimeBaggage.getNodeContext),
                aborted: () => runtimeBaggage.abort?.aborted,
            },
        )
    }

    it('Runtime Data Only', async() => {
        const dataNode = new Parser([]).parse(mockData)
        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue'}},
            {},
        )
        const dataA = runner.output()
        expect(dataA).toStrictEqual(mockData)
        expect(dataA === mockData).toBe(false)

        const dataC = await runner.compute()
        expect(dataC).toStrictEqual(mockData)
        expect(dataC === dataA).toBe(true)

        const dataB = runner.output()
        expect(dataB).toStrictEqual(mockData)
        expect(dataB === dataC).toBe(true)
    })

    it('Runtime Data Only - ordered output', async() => {
        const dataNode = new Parser([]).parse(mockData)
        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue'}},
            {},
        )

        const output = await runner.compute() as typeof mockData

        const orgFieldsOrder = Object.keys(mockData)
        let i = 0
        for(const key in output) {
            expect(orgFieldsOrder.indexOf(key)).toBe(i)
            i++
        }

        const orgSelectionFieldsOrder = Object.keys(mockData.selection)
        let iSelection = 0
        for(const key in output.selection) {
            expect(orgSelectionFieldsOrder.indexOf(key)).toBe(iSelection)
            iSelection++
        }
    })

    it('Runtime Only Expression', async() => {
        const dataNode = new DataNodeJSONata(undefined, [], '', '${ "Surfboard " & variant.name_short }', v => v.slice(2, -1))
        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue'}},
            {[DataNodeJSONata.engine]: jsonataCompute},
        )
        expect(runner.output()).toStrictEqual(new UnresolvedJSONataExpression())
        expect(await runner.compute()).toBe('Surfboard Blue')
        expect(runner.getValue(dataNode)).toBe('Surfboard Blue')
        expect(runner.output()).toBe('Surfboard Blue')
    })

    it('Runtime Only Expression Double Await', async() => {
        const dataNode = new DataNodeJSONata(undefined, [], '', '${ "Surfboard " & variant.name_short }', v => v.slice(2, -1))
        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue'}},
            {[DataNodeJSONata.engine]: jsonataCompute},
        )
        expect(runner.output()).toStrictEqual(new UnresolvedJSONataExpression())
        expect(await Promise.all([
            runner.compute(),
            runner.compute(),
        ])).toStrictEqual([
            'Surfboard Blue',
            'Surfboard Blue',
        ])
    })

    const objectTemplate = {
        name: '${ "Surfboard " & variant.name_short }',
        price: 70.25,
        tags: '${ $append(["sports", "surfing"], ["color_" & $replace(variant.color, " ", "_")]) }',
        checkout: {
            priceOriginal: '${ $root().price * $self().amount }',
            amount: 3,
        },
    }

    const expectedOutput = {
        'name': 'Surfboard Blue',
        'price': 70.25,
        'tags': [
            'sports',
            'surfing',
            'color_blue',
        ],
        'checkout': {
            'priceOriginal': 210.75,
            'amount': 3,
        },
    }

    it('Runtime Object With Expression', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse(objectTemplate)

        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue', color: 'blue'}},
            {[DataNodeJSONata.engine]: jsonataCompute},
        )

        expect(runner.output()).toStrictEqual({
            name: new UnresolvedJSONataExpression(),
            price: 70.25,
            tags: new UnresolvedJSONataExpression(),
            checkout: {
                priceOriginal: new UnresolvedJSONataExpression(),
                amount: 3,
            },
        })
        await runner.compute()
        expect(runner.output()).toStrictEqual(expectedOutput)
        // data context with original dataNode:
        expect(runner.getValue(dataNode.children?.get('name') as IDataNode)).toBe('Surfboard Blue')
        // but not for not-computed nodes:
        expect(() => runner.getValue(dataNode)).toThrow('Missing Data Context')

        // no data context without original dataNode:
        expect(() => runner.getValue(new DataNode(undefined, ['price'], 'number', 70.25))).toThrow('Missing Data Context')

        // no data context for not-computed nodes:
        expect(() => runner.getValue(dataNode.children?.get('price') as IDataNode)).toThrow('Missing Data Context')
    })

    it('Runtime Object With Expression - ordered output', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse(objectTemplate)

        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue', color: 'blue'}},
            {[DataNodeJSONata.engine]: jsonataCompute},
        )

        const output = await runner.compute() as typeof expectedOutput

        const orgFieldsOrder = Object.keys(expectedOutput)
        let i = 0
        for(const key in output) {
            expect(orgFieldsOrder.indexOf(key)).toBe(i)
            i++
        }

        const orgCheckoutFieldsOrder = Object.keys(expectedOutput.checkout)
        let iCheckout = 0
        for(const key in output.checkout) {
            expect(orgCheckoutFieldsOrder.indexOf(key)).toBe(iCheckout)
            iCheckout++
        }
    })

    // todo: not possible, as missing dataChain when passing only a nested node to `runtime`,
    //       see notes in runtime for a possible future implementation
    // it('Runtime Object With Expression - partial recompute', async() => {
    //     const dataNode = new Parser([DataNodeJSONata]).parse(objectTemplate)
    //
    //     const runner = runtime(
    //         dataNode,
    //         {variant: {name_short: 'Blue', color: 'blue'}},
    //         {[DataNodeJSONata.engine]: jsonataCompute},
    //     )
    //
    //     expect(runner.output()).toStrictEqual({
    //         name: new UnresolvedJSONataExpression(),
    //         price: 70.25,
    //         tags: new UnresolvedJSONataExpression(),
    //         checkout: {
    //             priceOriginal: new UnresolvedJSONataExpression(),
    //             amount: 3,
    //         },
    //     })
    //     await runner.compute()
    //     expect(runner.output()).toStrictEqual(expectedOutput)
    //
    //     const dataNodeCheckout = dataNode.children?.get('checkout') as IDataNode | DataNodeJSONata
    //     const runner2 = runtime(
    //         dataNodeCheckout,
    //         {variant: {name_short: 'Blue', color: 'blue'}},
    //         {[DataNodeJSONata.engine]: jsonataCompute},
    //     )
    //
    //     await runner2.compute()
    //     console.log('runner2.output()', runner2.output())
    //     expect((runner2.output() as any).checkout).toStrictEqual(expectedOutput.checkout)
    //     expect(
    //         (runner.output() as any).checkout === (runner2.output() as any).checkout,
    //     ).toBe(false)
    // })

    it('Runtime Object With Hooks', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse(objectTemplate)

        const onComputeHistory: IDataNode[] = []
        const onComputedHistory: [
            dataNode: IDataNode,
            result: any,
            meta: {
                statsNode: NodeComputeStats
                statsRun: IComputeStatsBase
            },
        ][] = []

        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue', color: 'blue'}},
            {[DataNodeJSONata.engine]: jsonataCompute},
            {
                onCompute: (dataNode) => onComputeHistory.push(dataNode),
                onComputed: (dataNode, result, meta) => {
                    onComputedHistory.push([dataNode, result, meta])
                },
            },
        )

        await runner.compute()
        expect(runner.output()).toStrictEqual(expectedOutput)
        expect(onComputeHistory.length).toBe(3)
        expect(onComputedHistory.length).toBe(3)
    })

    it('Runtime Object With Hooks async', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse(objectTemplate)

        const onComputeHistory: IDataNode[] = []
        const onComputedHistory: [
            dataNode: IDataNode,
            result: any,
            meta: {
                statsNode: NodeComputeStats
                statsRun: IComputeStatsBase
            },
        ][] = []

        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue', color: 'blue'}},
            {[DataNodeJSONata.engine]: jsonataCompute},
            {
                onCompute: (dataNode) => onComputeHistory.push(dataNode),
                onComputed: async(dataNode, result, meta) => {
                    onComputedHistory.push([dataNode, result, meta])
                },
            },
        )

        await runner.compute()
        expect(runner.output()).toStrictEqual(expectedOutput)
        expect(onComputeHistory.length).toBe(3)
        expect(onComputedHistory.length).toBe(3)
    })

    it('Runtime Object With Hooks - onComputedError', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse({
            ...objectTemplate,
            failing: '${$error("custom error")}',
        })

        const onComputeHistory: IDataNode[] = []
        const onComputedHistory: [
            dataNode: IDataNode,
            resultOrError: any,
            meta: {
                statsNode: NodeComputeStats
                statsRun: IComputeStatsBase
            },
        ][] = []

        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue', color: 'blue'}},
            {[DataNodeJSONata.engine]: jsonataCompute},
            {
                onCompute: (dataNode) => onComputeHistory.push(dataNode),
                onComputed: (dataNode, result, meta) => {
                    onComputedHistory.push([dataNode, result, meta])
                },
                onComputedError: (dataNode, error, meta) => {
                    onComputedHistory.push([dataNode, error, meta])
                },
            },
        )

        try {
            await runner.compute()
        } catch(e) {
            // noop
        }

        expect(onComputeHistory.length).toBe(4)
        expect(onComputedHistory.length).toBe(4)

        const dataNodeName = dataNode.children?.get('name')
        expect(onComputedHistory.find(history => history[0] === dataNodeName)?.[1]).toBe('Surfboard Blue')

        const dataNodeCheckoutOriginal = dataNode.children?.get('checkout')?.children?.get('priceOriginal')
        expect(onComputedHistory.find(history => history[0] === dataNodeCheckoutOriginal)?.[1]).toBe(210.75)

        const dataNodeTag = dataNode.children?.get('tags')
        expect(onComputedHistory.find(history => history[0] === dataNodeTag)?.[1]).toStrictEqual([
            'sports',
            'surfing',
            'color_blue',
        ])

        const dataNodeFailing = dataNode.children?.get('failing')
        expect(onComputedHistory.find(history => history[0] === dataNodeFailing)?.[1]).toBeInstanceOf(NodeComputeError)
        expect(onComputedHistory.find(history => history[0] === dataNodeFailing)?.[1].message).toBe('Compute failure at "/failing" with "$".\ncustom error')
        expect(onComputedHistory.find(history => history[0] === dataNodeFailing)?.[1].originalError).toMatchObject({
            message: 'custom error',
            token: 'error',
        })
    })

    it('Runtime Baggage w/ AbortSignal - aborted', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse('${$aborted()}')
        const abortController = new AbortController()
        const runner = runtime(
            dataNode,
            {},
            {[DataNodeJSONata.engine]: jsonataCompute},
            {},
            {
                abort: abortController.signal,
                nodesChain: new Set(),
            },
        )
        abortController.abort()
        await runner.compute()
        expect(runner.output()).toBe(true)
    })

    it('Runtime Baggage w/ AbortSignal - not aborted', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse('${$aborted()}')
        const abortController = new AbortController()
        const runner = runtime(
            dataNode,
            {},
            {[DataNodeJSONata.engine]: jsonataCompute},
            {},
            {
                abort: abortController.signal,
                nodesChain: new Set(),
            },
        )
        await runner.compute()
        expect(runner.output()).toBe(false)
    })
})
