import { DataNode, DataNodeObject, ExtractExprFn, IDataNode } from '@comyata/run/DataNode'
import { NodeParserError } from '@comyata/run/Errors'
import jsonpointer from 'json-pointer'
import jsonata from 'jsonata'
import { toExpr } from '@comyata/run/Expr'

export class DataNodeJSONataEscaped extends DataNode {
    static readonly engine = '$$'
    readonly engine = '$$'

    constructor(
        parent: DataNodeObject | undefined,
        path: IDataNode['path'],
        valueType: IDataNode['valueType'],
        value: IDataNode['value'],
    ) {
        super(parent, path, valueType || 'string', value)
        this.withHydrate(() => value.slice(1))
    }
}

export class DataNodeJSONata extends DataNode {
    static readonly engine = '$'
    readonly engine = '$'
    expr: jsonata.Expression

    /**
     * @todo move custom toExpr overwrite out of global
     */
    static toExpr: typeof toExpr = toExpr

    constructor(
        parent: DataNodeObject | undefined,
        path: IDataNode['path'],
        valueType: IDataNode['valueType'],
        value: IDataNode['value'],
        extractExpr: ExtractExprFn,
    ) {
        super(parent, path, valueType || 'computed', value, extractExpr)

        const exprText = extractExpr(value).trim()

        if(exprText === '') {
            throw new NodeParserError(
                path, parent,
                `Empty expression at ${JSON.stringify(jsonpointer.compile(path as string[]))}`,
            )
        }

        this.expr = DataNodeJSONata.toExpr(exprText)

        // todo: setting the hydrate reject when something attaches and disabling the promise-set for computes
        //       should throw a real exception when trying to access computed fields from within other computed fields (circular computation-nodes)
        //       - may allow to fully enforce no-access-to-computed-fields from within JSONata for deadlock-safe $self/$parent/$root access
        //       - which makes the usage of a jsonpointer/node-path $get for access to other computed fields meaningful and explainable
        //       - may require that the actual setters are postponed until one file is parsed, to never access randomly the rejects or the results
        this.withHydrate(() => new UnresolvedJSONataExpression())
        // this.withHydrate(() => Promise.reject(new Error('Unresolved JSONata expression'))) // this always throws

        this.hooks = [this]
    }
}

export class UnresolvedJSONataExpression extends Error {
    constructor(message: string = 'Unresolved JSONata expression') {
        super(message)
    }
}
