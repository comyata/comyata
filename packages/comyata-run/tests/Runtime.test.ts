import { it, expect, describe } from '@jest/globals'
import { DataNodeJSONata, UnresolvedJSONataExpression } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { ComputeFn, runtime } from '@comyata/run/Runtime'

// npm run tdd -- --selectProjects=test-comyata-run
// npm run tdd -- --selectProjects=test-comyata-run --testPathPattern=Runtime

describe('Runtime', () => {
    const jsonataCompute: ComputeFn<DataNodeJSONata> = (computedNode, context, parentData) => {
        return computedNode.expr.evaluate(
            context,
            {
                self: () => parentData[0],
                parent: () => parentData.slice(1),
                root: () => parentData[parentData.length - 1],
            },
        )
    }

    it('Runtime Data Only', async() => {
        const orgValue = {
            name: 'Surfboard',
            tags: ['sports', 'surfing'],
            selection: {
                amount: 1,
                price: 70.25,
            },
            fastShipping: null,
            exclusive: true,
        }
        const dataNode = new Parser([]).parse(orgValue)
        const runner = runtime(
            dataNode,
            {variant: {name_short: 'Blue'}},
            {},
        )
        const dataA = runner.output()
        expect(dataA).toStrictEqual(orgValue)
        expect(dataA === orgValue).toBe(false)

        const dataC = await runner.compute()
        expect(dataC).toStrictEqual(orgValue)
        expect(dataC === dataA).toBe(true)

        const dataB = runner.output()
        expect(dataB).toStrictEqual(orgValue)
        expect(dataB === dataC).toBe(true)
    })

    it('Runtime Only Expression', async() => {
        // const dataNode = new Parser([DataNodeJSONata]).parse('${ "Surfboard " & variant.name_short }')
        const runner = runtime(
            new DataNodeJSONata(undefined, [], '', '${ "Surfboard " & variant.name_short }'),
            {variant: {name_short: 'Blue'}},
            {[DataNodeJSONata.engine]: jsonataCompute},
        )
        expect(runner.output()).toStrictEqual(new UnresolvedJSONataExpression())
        expect(await runner.compute()).toBe('Surfboard Blue')
        expect(runner.output()).toBe('Surfboard Blue')
    })

    it('Runtime Object With Expression', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse({
            name: '${ "Surfboard " & variant.name_short }',
            price: 70.25,
            tags: '${ $append(["sports", "surfing"], ["color_" & $replace(variant.color, " ", "_")]) }',
            checkout: {
                priceOriginal: '${ $parent()[0].price * $self().amount }',
                amount: 3,
            },
        })

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
        expect(runner.output()).toStrictEqual({
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
        })
    })
})
