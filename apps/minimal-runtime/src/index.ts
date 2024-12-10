import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { ComputeFn, runtime } from '@comyata/run/Runtime'
import { createValueProxy } from '@comyata/run/ValueProxy'

// 1. Setup Parser with engines nodes

const nodeTypes = [DataNodeJSONata]

const parser = new Parser(nodeTypes)

// 2. Configure Engines

const jsonataCompute: ComputeFn<DataNodeJSONata> = (
    computedNode,
    context,
    parentData,
    {getNodeContext},
) => {
    return computedNode.expr.evaluate(context, {
        // allow access to contained data:
        self: () => createValueProxy(parentData[0], computedNode, getNodeContext, computedNode.path.slice(0, -1)),
        root: () => createValueProxy(parentData[parentData.length - 1] || null, computedNode, getNodeContext),
        // ... add any custom function here ...
    })
}

// 3. Define a template and run a computation with a context

const template = {
    name: '${ "Surfboard " & variant.shortName }',
    price: 70.25,
    discount: 10,
    discountedPrice: '${ $self().price * (100 - $self().discount) / 100 }',
}

// parse the template into a DataNode
const dataNode = parser.parse(template)

const context = {
    variant: {shortName: 'Blue'},
}

// pass all to the runtime
const runner = runtime(
    dataNode,
    context,
    {
        // wire engine tags and their compute function
        [DataNodeJSONata.engine]: jsonataCompute,
    },
    {
        // once a node starts to compute
        onCompute: (dataNode) =>
            console.log(`computing node ${JSON.stringify(dataNode.path.join('.'))} ...`),

        // once a node successfully computed
        onComputed: (dataNode, result, meta) =>
            console.log(`computed node ${JSON.stringify(dataNode.path.join('.'))} in ${meta.statsNode.dur}ms`, result),

        // enable access to computed fields within other computed fields
        __unsafeAllowCrossResolving: true,

        // set `true` to disable node result validation, by default checks that a computed nodes result is not a `Error` or `Promise`
        __unsafeDisableResultValidation: false,
    },
)

// initial output, which contains all static values, and `Promise` placeholders in computed nodes
// const initial = runner.output()

// run compute and get the complete output
const output = await runner.compute()
console.log(output)

// or get the complete output from the runner, after it is computed
// const output1 = runner.output()
