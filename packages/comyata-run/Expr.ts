import jsonata, { Focus } from 'jsonata'

export function toExpr(expr: string, functions: JsonataFn[] = jsonataExtraFunctions): jsonata.Expression {
    const exprEval = jsonata(expr, {
        recover: false,
    })
    exprEval.registerFunction(
        'coalesce',
        (...args) => args.find(arg => typeof arg !== 'undefined' && arg !== null),
    )
    for(const fn of functions) {
        exprEval.registerFunction(fn.name, fn.fn, fn.signature)
    }
    return exprEval
}

export interface JsonataFn {
    name: string
    fn: (this: Focus, ...args: any[]) => any
    signature?: string
    // todo: add the documentation here? would increase all bundle sizes without option to tree-shake
    // signatureText?: string
    // description?: string
}

export const jsonataExtraFunctions: JsonataFn[] = [
    {
        name: 'repeat',
        fn: (str: string, count: number) => str.repeat(count),
        signature: '<sn:s>',
    },
    {
        name: 'some',
        fn: async function(arr: unknown[], test: any) {
            if(!arr) return false
            for(const item of arr) {
                const r = await test.apply(this, [item])
                if(r) return true
            }
            return false
        },
        signature: '<af:b>',
    },
    {
        name: 'toJSON',
        fn: (value: unknown) => JSON.stringify(value),
        signature: '<j:s>',
    },
    {
        name: 'fromJSON',
        fn: (text: string) => JSON.parse(text),
        signature: '<s:j>',
    },
    {
        name: 'isNaN',
        fn: (text: string) => Number.isNaN(Number(text)),
        signature: '<s:b>',
    },
]
