/**
 * @todo add fileId as global root identifier
 */
export interface IDataNode {
    readonly engine?: string
    readonly computed?: boolean

    readonly path: (string | number)[]

    readonly valueType: string
    readonly value: any

    readonly parent: (() => IDataNode) | undefined

    hydrate?: () => any
    children?: IDataNodeChildren
}

export interface IDataNodeComputed extends IDataNode {
    readonly engine: string
    readonly computed?: true
}

export type ExtractExprFn = (value: string) => string

export type IDataNodeChildren<TNode extends IDataNode = IDataNode> = Map<string | number, TNode>

export class DataNode implements IDataNode {
    static readonly engine: IDataNode['engine']
    readonly engine?: IDataNode['engine'] = undefined
    readonly computed?: IDataNode['computed'] = undefined

    readonly path: IDataNode['path']
    // todo: this is mixing "data type" and "internal node type", not needed anymore?
    readonly valueType: IDataNode['valueType']
    readonly value: IDataNode['value']

    readonly parent: IDataNode['parent']
    children?: IDataNode['children']
    hydrate?: IDataNode['hydrate']

    protected readonly extractExpr?: ExtractExprFn

    constructor(
        parent: DataNodeObject | undefined,
        path: IDataNode['path'],
        valueType: IDataNode['valueType'],
        value: IDataNode['value'],
        extractExpr?: ExtractExprFn,
    ) {
        this.path = path
        this.valueType = valueType
        this.value = value
        this.extractExpr = extractExpr
        if(parent) {
            this.parent = () => parent
        }
    }

    withHydrate(hydrate: () => any) {
        if(this.hydrate) {
            throw new Error(`Can not overwrite hydrate in ${JSON.stringify(this.path)}`)
        }
        this.hydrate = hydrate
        return this
    }
}

export class DataNodeObject extends DataNode {
    children: NonNullable<IDataNode['children']> = new Map()

    constructor(
        parent: DataNodeObject | undefined,
        path: IDataNode['path'],
        valueType: IDataNode['valueType'],
        value: IDataNode['value'],
    ) {
        super(parent, path, valueType, value)
    }

    append(key: string | number, dataNode: IDataNode) {
        this.children.set(key, dataNode)
    }
}

export function isComputedNode<TNode extends IDataNode>(node: TNode): node is (TNode extends IDataNodeComputed ? TNode & IDataNodeComputed : never) {
    return Boolean(node.engine && node.computed)
}
