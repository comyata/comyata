import { it, expect, describe } from '@jest/globals'
import { DataNodeJSONata, DataNodeJSONataEscaped, UnresolvedJSONataExpression } from '@comyata/run/DataNodeJSONata'
import { NodeParserError } from '@comyata/run/Errors'
import { Parser } from '@comyata/run/Parser'
import { DataNode, DataNodeObject, ExtractExprFn, IDataNode } from '@comyata/run/DataNode'

// npm run tdd -- --selectProjects=test-@comyata/run
// npm run tdd -- --selectProjects=test-@comyata/run --testPathPattern=Parser.test

const expressionAst = {
    type: 'binary',
    value: '+',
    position: 4,
    lhs: {value: 10, type: 'number', position: 2},
    rhs: {value: 5, type: 'number', position: 6},
}

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

describe('Parser', () => {
    it('Parser Data Only', async() => {
        const dataNode = new Parser().parse(mockData)

        expect(dataNode).toBeTruthy()
        expect(dataNode.value).toStrictEqual(mockData)
        expect(dataNode.path).toStrictEqual([])
        expect(dataNode.children?.size).toBe(5)

        expect(dataNode.children?.get('name')?.path).toStrictEqual(['name'])
        expect(dataNode.children?.get('name')?.hydrate?.()).toBe('Surfboard')

        expect(dataNode.children?.get('tags')?.valueType).toBe('array')

        // validate that array has `[ <2 empty items> ]`
        const tagsHydrated = dataNode.children?.get('tags')?.hydrate?.()
        // eslint-disable-next-line no-prototype-builtins
        expect(tagsHydrated.hasOwnProperty(0)).toBe(false)
        // eslint-disable-next-line no-prototype-builtins
        expect(tagsHydrated.hasOwnProperty(1)).toBe(false)
        expect(tagsHydrated.length).toBe(2)

        expect(dataNode.children?.get('tags')?.children?.get(0)?.hydrate?.()).toBe('sports')
        expect(dataNode.children?.get('tags')?.children?.get(1)?.hydrate?.()).toBe('surfing')

        expect(dataNode.children?.get('selection')?.valueType).toBe('object')
        expect(dataNode.children?.get('selection')?.hydrate?.()).toStrictEqual({})
        expect(dataNode.children?.get('selection')?.children?.size).toBe(2)
        expect(dataNode.children?.get('selection')?.children?.get('amount')?.valueType).toBe('number')
        expect(dataNode.children?.get('selection')?.children?.get('amount')?.hydrate?.()).toBe(1)
        expect(dataNode.children?.get('selection')?.children?.get('price')?.valueType).toBe('number')
        expect(dataNode.children?.get('selection')?.children?.get('price')?.hydrate?.()).toBe(70.25)

        expect(dataNode.children?.get('fastShipping')?.valueType).toBe('null')
        expect(dataNode.children?.get('fastShipping')?.hydrate?.()).toBe(null)

        expect(dataNode.children?.get('exclusive')?.valueType).toBe('boolean')
        expect(dataNode.children?.get('exclusive')?.hydrate?.()).toBe(true)
    })

    it('Parser Data Only - undefined', async() => {
        const dataNode = new Parser().parse(undefined)

        expect(dataNode).toBeTruthy()
        expect(dataNode.value).toBe(undefined)
        expect(dataNode.valueType).toBe('undefined')
        expect(dataNode.path).toStrictEqual([])
        expect(dataNode.hydrate?.()).toBe(undefined)
    })

    it('Parser Data Only - ordered output', async() => {
        const dataNode = new Parser().parse(mockData)

        const orgFieldsOrder = Object.keys(mockData)
        let i = 0
        for(const key in dataNode.children?.keys()) {
            expect(orgFieldsOrder.indexOf(key)).toBe(i)
            i++
        }

        const orgSelectionFieldsOrder = Object.keys(mockData.selection)
        let iSelection = 0
        for(const key in dataNode.children?.get('selection')?.children?.keys()) {
            expect(orgSelectionFieldsOrder.indexOf(key)).toBe(iSelection)
            iSelection++
        }
    })

    it.each([
        [
            'Standard',
            '${ 10 + 5 }',
            {},
        ],
        [
            'Custom Paren',
            '$" 10 + 5 "',
            {paren: ['"', '"']},
        ],
        [
            'Custom Paren Two Char',
            '${{ 10 + 5 }}',
            {paren: ['{{', '}}']},
        ],
        [
            'Custom Paren Empty Strings',
            '$ 10 + 5',
            {paren: ['', '']},
        ],
        [
            'Custom Paren Empty End Strings',
            '$: 10 + 5',
            {paren: [':', '']},
        ],
    ] satisfies [name: string, template: string, options: Partial<Parser<typeof DataNode>['options']>][])(
        'Parser Only Expression %p',
        (_name, template, options) => {
            const dataNode = new Parser([DataNodeJSONata], options)
                .parse(template)

            expect(typeof dataNode.children).toBe('undefined')
            expect(dataNode.engine).toBe('$')
            expect(dataNode.value).toBe(template)
            expect(dataNode.computed).toBe(true)
            expect(dataNode?.hydrate?.()).toStrictEqual(new UnresolvedJSONataExpression('Unresolved JSONata expression'))
            expect('expr' in dataNode).toBe(true)
            if('expr' in dataNode) {
                expect(dataNode.expr.ast()).toStrictEqual(expressionAst)
            }
        },
    )

    it('Parser Incomplete Expression Paren', async() => {
        const dataNode = new Parser([DataNodeJSONata])
            .parse('${ 10 + 5')

        expect(typeof dataNode.children).toBe('undefined')
        expect(dataNode).toBeInstanceOf(DataNode)
        expect(dataNode.value).toBe('${ 10 + 5')
        expect(dataNode.computed).toBe(undefined)
        expect(dataNode?.hydrate?.()).toBe('${ 10 + 5')
    })

    it('Parser Not Existing Engine - default paren', async() => {
        const dataNode = new Parser([DataNodeJSONata])
            .parse('liq{ 10 + 5 }')

        expect(typeof dataNode.children).toBe('undefined')
        expect(dataNode).toBeInstanceOf(DataNode)
        expect(dataNode.value).toBe('liq{ 10 + 5 }')
        expect(dataNode.computed).toBe(undefined)
        expect(dataNode?.hydrate?.()).toBe('liq{ 10 + 5 }')
    })

    it('Parser Not Existing Engine - empty end paren', async() => {
        const dataNode = new Parser([DataNodeJSONata], {paren: [':', '']})
            .parse('liq: 10 + 5')

        expect(typeof dataNode.children).toBe('undefined')
        expect(dataNode).toBeInstanceOf(DataNode)
        expect(dataNode.value).toBe('liq: 10 + 5')
        expect(dataNode.computed).toBe(undefined)
        expect(dataNode?.hydrate?.()).toBe('liq: 10 + 5')
    })

    it('Parser Object With Expression', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse({
            name: '${ "Surfboard " & variant.name_short }',
            price: 70.25,
            tags: '${ $append(["sports", "surfing"], ["color_" & $replace(variant.color, " ", "_")]) }',
            checkout: {
                priceOriginal: '${ $root().price * $self().amount }',
                amount: 3,
            },
        })

        expect(dataNode).toBeTruthy()
        expect(dataNode.parent).toBe(undefined)
        expect(dataNode.children?.size).toBe(4)

        expect(dataNode.children?.get('name')?.hydrate?.()).toStrictEqual(new UnresolvedJSONataExpression('Unresolved JSONata expression'))
        expect(dataNode.children?.get('name')?.parent?.()).toStrictEqual(dataNode)
    })

    it('Parser nested array objects', async() => {
        const dataNode = new Parser([DataNodeJSONata]).parse({
            'Account Name': 'SurfboardDemoShop',
            'Order': [
                {
                    'OrderID': 'order001',
                    'Product': [
                        {
                            'Product Name': 'Beginner Foam Surfboard',
                            'ProductID': 1001,
                            'SKU': 'SB1001',
                            'Description': {
                                'Colour': 'Blue',
                                'Length': 84,
                                'Width': 21,
                                'Thickness': 3,
                                'Weight': 8.5,
                            },
                            'Price': 199.99,
                            'Quantity': 2,
                        },
                        {
                            'Product Name': 'Performance Shortboard',
                            'ProductID': 1002,
                            'SKU': 'SB1002',
                            'Description': {
                                'Colour': 'Red',
                                'Length': 72,
                                'Width': 18,
                                'Thickness': 2.5,
                                'Weight': 6.8,
                            },
                            'Price': 299.99,
                            'Quantity': 1,
                        },
                    ],
                },
                {
                    'OrderID': 'order002',
                    'Product': [
                        {
                            'Product Name': 'Longboard Cruiser',
                            'ProductID': 1003,
                            'SKU': 'SB1003',
                            'Description': {
                                'Colour': 'Green',
                                'Length': 96,
                                'Width': 23,
                                'Thickness': 3.2,
                                'Weight': 10.2,
                            },
                            'Price': 349.99,
                            'Quantity': 3,
                        },
                        {
                            'Product Name': 'Fish Surfboard',
                            'ProductID': 1004,
                            'SKU': 'SB1004',
                            'Description': {
                                'Colour': 'Yellow',
                                'Length': 70,
                                'Width': 20.5,
                                'Thickness': 2.8,
                                'Weight': 7.4,
                            },
                            'Price': 269.99,
                            'Quantity': 2,
                        },
                    ],
                },
            ],
        })

        expect(dataNode.children?.get('Order')?.children?.get(0)?.hydrate?.()).toStrictEqual({})
        expect(dataNode.children?.get('Order')?.children?.get(1)?.hydrate?.()).toStrictEqual({})
        expect(dataNode.children?.get('Order')?.children?.get(0)?.children?.get('OrderID')?.hydrate?.()).toBe('order001')
        expect(dataNode.children?.get('Order')?.children?.get(1)?.children?.get('OrderID')?.hydrate?.()).toBe('order002')
    })

    it('Parser empty expression', async() => {
        // todo: improve toThrow, in all tests, as it only asserts the message, not even the Error instance type
        //       https://github.com/jestjs/jest/issues/8698
        //       https://github.com/jest-community/eslint-plugin-jest/issues/295#issuecomment-509974545
        //       see workaround with bulky and not fully strict asserts in `FileEngine-Document.test.ts` (only works for async)
        //       > `.rejects.toMatchObject` can be used for promise
        expect(() => {
            new Parser([DataNodeJSONata]).parse({
                invalidExpr: '${ }',
            })
        }).toThrow(new NodeParserError(['invalidExpr'], undefined, `Empty expression at "/invalidExpr"`))
    })

    it('Parser generic parser error', async() => {
        expect(() => {
            new Parser([class extends DataNode {
                static readonly engine = 'mock'
                readonly engine = 'mock'

                constructor(
                    parent: DataNodeObject | undefined,
                    path: IDataNode['path'],
                    valueType: IDataNode['valueType'],
                    value: IDataNode['value'],
                    extractExpr: ExtractExprFn,
                ) {
                    super(parent, path, valueType || 'computed', value, extractExpr)
                    throw new Error(`Generic Error`)
                }
            }]).parse({
                invalidExpr: 'mock{ }',
            })
        }).toThrow('Parse error at "/invalidExpr" with "mock".\nGeneric Error')
    })

    it('Parser generic parser error - simple object', async() => {
        expect(() => {
            new Parser([class extends DataNode {
                static readonly engine = 'mock'
                readonly engine = 'mock'

                constructor(
                    parent: DataNodeObject | undefined,
                    path: IDataNode['path'],
                    valueType: IDataNode['valueType'],
                    value: IDataNode['value'],
                    extractExpr: ExtractExprFn,
                ) {
                    super(parent, path, valueType || 'computed', value, extractExpr)
                    throw {message: `Generic Error`}
                }
            }]).parse({
                invalidExpr: 'mock{ }',
            })
        }).toThrow('Parse error at "/invalidExpr" with "mock".\nGeneric Error')
    })

    it('Parser generic parser error - simple object, no message', async() => {
        expect(() => {
            new Parser([class extends DataNode {
                static readonly engine = 'mock'
                readonly engine = 'mock'

                constructor(
                    parent: DataNodeObject | undefined,
                    path: IDataNode['path'],
                    valueType: IDataNode['valueType'],
                    value: IDataNode['value'],
                    extractExpr: ExtractExprFn,
                ) {
                    super(parent, path, valueType || 'computed', value, extractExpr)
                    throw {code: `err`}
                }
            }]).parse({
                invalidExpr: 'mock{ }',
            })
        }).toThrow('Parse error at "/invalidExpr" with "mock".')
    })

    it('Parser escaped expressions', async() => {
        const dataEval = new Parser([DataNodeJSONataEscaped]).parse({
            'later': '$${ $sum([1, 2, 4]) }',
        })
        expect(dataEval.children?.size).toBe(1)
        expect(dataEval.children?.get('later')?.hydrate?.()).toBe('${ $sum([1, 2, 4]) }')
    })

    it('Parser comment expression', async() => {
        const dataEval = new Parser([], {comments: true}).parse({
            name: 'Max',
            'comment!': 'some property, without data-node',
            desc: 'show profile',
        })
        expect(dataEval.children?.size).toBe(2)
        expect(dataEval.children?.has('name')).toBe(true)
        expect(dataEval.children?.has('desc')).toBe(true)
    })

    it('Parser comment expression disabled', async() => {
        const dataEval = new Parser([], {comments: false}).parse({
            name: 'Max',
            'comment!': 'some property, without data-node',
            desc: 'show profile',
        })
        expect(dataEval.children?.size).toBe(3)
        expect(dataEval.children?.has('name')).toBe(true)
        expect(dataEval.children?.has('comment!')).toBe(true)
        expect(dataEval.children?.has('desc')).toBe(true)
    })

    it('Parser comment expression disabled is default', async() => {
        const dataEval = new Parser([], {}).parse({
            name: 'Max',
            'comment!': 'some property, without data-node',
            desc: 'show profile',
        })
        expect(dataEval.children?.size).toBe(3)
        expect(dataEval.children?.has('name')).toBe(true)
        expect(dataEval.children?.has('comment!')).toBe(true)
        expect(dataEval.children?.has('desc')).toBe(true)
    })

    it('Parser no function', async() => {
        expect(() => {
            new Parser([]).parse({
                someFn: () => null,
            })
        }).toThrow(new Error(
            `Parse error` +
            ` at ${JSON.stringify('/someFn')}` +
            ` unsupported value in data, no supported parser for type ${JSON.stringify('function')}.`,
        ))
    })

    it('Parser no hydrate overwrite function', async() => {
        const dataEval = new Parser([]).parse({})
        expect(() => {
            if(dataEval instanceof DataNode) {
                dataEval.withHydrate(() => null)
            }
        }).toThrow(new Error(`Can not overwrite hydrate in []`))
    })
})
