import { it, expect, describe } from '@jest/globals'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { runtime } from '@comyata/run/Runtime'
import { DataNode, DataNodeObject, IDataNode } from '../DataNode'
import { MissingEngineError, NodeComputeError, ResultError } from '../Errors'

// npm run tdd -- --selectProjects=test-@comyata/run
// npm run tdd -- --selectProjects=test-@comyata/run --testPathPattern=Runtime-Errors.test

class DataNodeError extends DataNode {
    static readonly engine = 'e'
    readonly engine = 'e'

    constructor(
        parent: DataNodeObject | undefined,
        path: IDataNode['path'],
        valueType: IDataNode['valueType'],
        value: IDataNode['value'],
    ) {
        super(parent, path, valueType || 'string', value)
        this.withHydrate(() => new Error('Some Error'))
        this.hooks = [this]
    }
}

class DataNodeErrorNoClass extends DataNode {
    static readonly engine = 'e'
    readonly engine = 'e'

    constructor(
        parent: DataNodeObject | undefined,
        path: IDataNode['path'],
        valueType: IDataNode['valueType'],
        value: IDataNode['value'],
    ) {
        super(parent, path, valueType || 'string', value)
        this.withHydrate(() => ({message: 'Some Error'}))
        this.hooks = [this]
    }
}

describe('Runtime Errors', () => {
    it('Runtime Missing Engine', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse({
            name: '${ 10 + 5 }',
        })

        const runner = runtime(
            dataNode,
            {},
            {},
        )
        const dataNodeName = dataNode.children?.get('name')
        expect(dataNodeName).toBeInstanceOf(DataNodeJSONata)

        await expect(runner.compute()).rejects.toThrow(new MissingEngineError(
            `Missing compute engine for "$" at ["name"]`,
            dataNodeName as IDataNode,
        ))
    })

    it('Runtime Failure - Error class', async() => {
        const dataNode = new Parser([DataNodeError]).parse({
            name: 'e{}',
        })

        const runner = runtime(
            dataNode,
            {},
            {[DataNodeError.engine]: async(computedNode) => Promise.reject(computedNode.hydrate?.())},
        )

        const dataNodeName = dataNode.children?.get('name')
        expect(dataNodeName).toBeInstanceOf(DataNodeError)
        await expect(runner.compute()).rejects.toThrow(
            new NodeComputeError(
                dataNodeName as IDataNode,
                `Compute failure at "/name" with "e".\nSome Error`,
                new Error('Some Error'),
            ),
        )
    })

    it('Runtime Failure - no Error class', async() => {
        const dataNode = new Parser([DataNodeErrorNoClass]).parse({
            name: 'e{}',
        })

        const runner = runtime(
            dataNode,
            {},
            {[DataNodeError.engine]: async(computedNode) => Promise.reject(computedNode.hydrate?.())},
        )

        const dataNodeName = dataNode.children?.get('name')
        expect(dataNodeName).toBeInstanceOf(DataNodeErrorNoClass)
        await expect(runner.compute()).rejects.toThrow(
            new NodeComputeError(
                dataNodeName as IDataNode,
                `Compute failure at "/name" with "e".\nSome Error`,
                {message: 'Some Error'},
            ),
        )
    })

    it('Runtime Failure - no object', async() => {
        const dataNode = new Parser([DataNodeErrorNoClass]).parse({
            name: 'e{}',
        })

        const runner = runtime(
            dataNode,
            {},
            {[DataNodeError.engine]: async() => Promise.reject('Some Error')},
        )

        const dataNodeName = dataNode.children?.get('name')
        expect(dataNodeName).toBeInstanceOf(DataNodeErrorNoClass)
        await expect(runner.compute()).rejects.toThrow(
            new NodeComputeError(
                dataNodeName as IDataNode,
                `Compute failure at "/name" with "e".`,
                'Some Error',
            ),
        )
    })

    it('Runtime Invalid Result Error', async() => {
        const dataNode = new Parser([DataNodeError]).parse({
            name: 'e{}',
        })

        const runner = runtime(
            dataNode,
            {},
            {[DataNodeError.engine]: async(computedNode) => computedNode.hydrate?.()},
        )

        const dataNodeName = dataNode.children?.get('name')
        expect(dataNodeName).toBeInstanceOf(DataNodeError)
        await expect(runner.compute()).rejects.toThrow(
            new ResultError(
                `Computed value resulted in an error at "/name".`,
                dataNodeName as IDataNode,
                new Error('Some Error'),
            ),
        )
    })

    it('Runtime Invalid Result Error Disabled Validation', async() => {
        const dataNode = new Parser([DataNodeError]).parse({
            name: 'e{}',
        })

        const runner = runtime(
            dataNode,
            {},
            {[DataNodeError.engine]: async(computedNode) => computedNode.hydrate?.()},
            {
                __unsafeDisableResultValidation: true,
            },
        )

        const dataNodeName = dataNode.children?.get('name')
        expect(dataNodeName).toBeInstanceOf(DataNodeError)
        const output = await runner.compute()
        expect(output).toStrictEqual({name: new Error('Some Error')})
    })

    it('Runtime Invalid Result Error Double Await', async() => {
        const dataNode = new Parser([DataNodeError]).parse({
            name: 'e{}',
        })

        const runner = runtime(
            dataNode,
            {},
            {[DataNodeError.engine]: async(computedNode) => computedNode.hydrate?.()},
        )

        const dataNodeName = dataNode.children?.get('name')
        expect(dataNodeName).toBeInstanceOf(DataNodeError)
        const res = await Promise.allSettled([
            runner.compute(),
            runner.compute(),
        ])
        expect(res[0].status).toBe('rejected')
        expect(res[1].status).toBe('rejected')
        expect(
            res[0].status === 'rejected'
            && res[1].status === 'rejected'
                // both errors must have the same reference
                ? res[0].reason === res[1].reason
                : null,
        ).toBe(true)
    })
})
