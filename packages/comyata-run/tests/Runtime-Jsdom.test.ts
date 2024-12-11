/**
 * @jest-environment jsdom
 */
import { createValueProxy } from '@comyata/run/ValueProxy'
import { it, expect, describe, beforeAll } from '@jest/globals'
import { DataNodeJSONata, UnresolvedJSONataExpression } from '@comyata/run/DataNodeJSONata'
import { ComputeFn, runtime } from '@comyata/run/Runtime'

// npm run tdd -- --selectProjects=test-@comyata/run
// npm run tdd -- --selectProjects=test-@comyata/run --testPathPattern=Runtime-Jsdom.test

beforeAll(() => {
    // overwrite `hrtime` to force `Timers` to use `Date`
    // as there seems to be no other way to disable "Node.js apis", which are still available in jsdom
    // @ts-ignore
    global.process.hrtime = undefined
})

describe('Runtime jsdom', () => {
    const jsonataCompute: ComputeFn<DataNodeJSONata> = (computedNode, context, parentData, {getNodeContext}) => {
        return computedNode.expr.evaluate(
            context,
            {
                self: () => createValueProxy(parentData[0], computedNode, getNodeContext, computedNode.path.slice(0, -1)),
                root: () => createValueProxy(parentData[parentData.length - 1] || null, computedNode, getNodeContext),
            },
        )
    }

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
})
