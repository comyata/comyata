import { DataNode, DataNodeObject, ExtractExprFn } from '@comyata/run/DataNode'
import { NodeParserError } from '@comyata/run/Errors'
import jsonpointer from 'json-pointer'

function escapeRegex(string: string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')
}

export class Parser<TNode extends typeof DataNode> {
    readonly nodes: TNode[]
    private readonly matchNode: (text: string) => [TNode, ExtractExprFn] | undefined
    public readonly options: {
        /**
         * If comments are enabled
         */
        comments?: boolean
        /**
         * Parenthesis for node matching, start and end
         */
        paren: [string, string]
    }

    constructor(
        nodesTypes: TNode[] = [],
        options: Partial<Parser<TNode>['options']> = {},
    ) {
        this.nodes = nodesTypes
        this.options = {
            ...options,
            paren: options.paren || ['{', '}'],
        }

        // todo refactor matcher and extract-expr for a better usage outside of runtime,
        //      maybe add a `comyata-utils` for these universal field utils?

        const tagPattern = new RegExp(
            `^(?<engine>${nodesTypes.map(tag => escapeRegex(tag.engine as string)).join('|')})${escapeRegex(this.options.paren[0])}`,
        )

        const offsetParenStart = this.options.paren[0].length
        const offsetParenEnd = this.options.paren[1].length

        const getTagExpExtract =
            offsetParenEnd
                ? (tag: string) => {
                    const offsetStart = tag.length + offsetParenStart
                    return (value: string) => {
                        return value.slice(offsetStart, -offsetParenEnd)
                    }
                }
                : (tag: string) => {
                    const offsetStart = tag.length + offsetParenStart
                    return (value: string) => {
                        return value.slice(offsetStart)
                    }
                }

        const nodesMap = this.nodes.reduce<Map<string, [TNode, ExtractExprFn]>>(
            (nodesMap, nodeType) => {
                if(nodeType.engine) {
                    nodesMap.set(nodeType.engine, [nodeType, getTagExpExtract(nodeType.engine)])
                }
                return nodesMap
            },
            new Map(),
        )

        const matchText = (text: string) => {
            const match = text.match(tagPattern)
            if(match?.groups?.engine) {
                const tagName = match.groups.engine
                const engine = nodesMap.get(tagName)
                if(!engine) throw new Error(`Missing DataNodeType for "${tagName}" at ${JSON.stringify(text)}`)
                return engine
            }
            return undefined
        }

        if(this.options.paren[1] === '') {
            this.matchNode = matchText
        } else {
            this.matchNode = (text) => {
                if(!text.endsWith(this.options.paren[1])) return undefined
                return matchText(text)
            }
        }
    }

    /**
     * @todo refactor parsers for stricter types, requires refactor of parseData to use respective type guards
     */
    private dataNodeParsers: {
        [k: string]: (
            currentValue: any,
            currentPath: (string | number)[],
            parent: DataNodeObject | undefined,
        ) => [InstanceType<TNode> | DataNode, undefined?] | [DataNodeObject, (unknown[] | object)]
    } = {
        null: (currentValue: null, currentPath, parent) => {
            return [new DataNode(parent, currentPath, 'null', currentValue)
                .withHydrate(() => currentValue)]
        },
        array: (currentValue: unknown[], currentPath, parent) => {
            const valueLength = currentValue.length
            const dataNode = new DataNodeObject(parent, currentPath, 'array', currentValue)
                // todo: for cacheable DataNode, the hydrate itself must be serializable, including the array length
                .withHydrate(() => new Array(valueLength))
            return [dataNode, currentValue]
        },
        object: (currentValue: object, currentPath, parent) => {
            const dataNode = new DataNodeObject(parent, currentPath, 'object', currentValue)
                .withHydrate(() => ({}))
            return [dataNode, currentValue]
        },
        generic: (currentValue, currentPath, parent) => {
            return [new DataNode(parent, currentPath, typeof currentValue, currentValue)
                // todo: for cacheable DataNode, the hydrate itself must be serializable, including `undefined` values!
                .withHydrate(() => currentValue)]
        },
    }

    private parseData = (
        currentValue: unknown,
        currentPath: (string | number)[],
        parent: DataNodeObject | undefined,
    ): [InstanceType<TNode> | DataNode, undefined?] | [DataNodeObject, (unknown[] | object)] => {
        let parseType: string
        let nodeTag: [TNode, ExtractExprFn] | undefined

        if(typeof currentValue === 'object') {
            if(currentValue === null) {
                parseType = 'null'
            } else if(Array.isArray(currentValue)) {
                parseType = 'array'
            } else {
                parseType = 'object'
            }
        } else if(typeof currentValue === 'string') {
            nodeTag = this.matchNode(currentValue)
            if(nodeTag) {
                parseType = 'computed'
            } else {
                // parseType = 'string'
                parseType = 'generic'
            }
        } else if(typeof currentValue === 'function') {
            // todo: should be loaded before evaluation?!
            //       is the target for such things would be that the function returns is parsed or that the function is called with the context and run jit?
            throw new Error(`Functions not supported in data template`)
        } else {
            // parseType = typeof currentValue
            parseType = 'generic'
        }

        try {
            if(nodeTag) {
                return [new nodeTag[0](
                    parent, currentPath,
                    '',
                    currentValue,
                    nodeTag[1],
                )]
            }

            const parser = this.dataNodeParsers[parseType]
            return parser(currentValue, currentPath, parent)
        } catch(e) {
            if(e instanceof NodeParserError) throw e
            throw new NodeParserError(
                currentPath, parent,
                `Parse error` +
                ` at ${JSON.stringify(jsonpointer.compile(currentPath as string[]))}` +
                (
                    nodeTag
                        ? ` as ${JSON.stringify(parseType)}${' with ' + JSON.stringify(nodeTag[0].engine)}.`
                        : ` as ${JSON.stringify(parseType)}.`
                ) +
                `${e instanceof Error ? '\n' + e.message : typeof e === 'object' && e && 'message' in e ? '\n' + e.message : ''}`,
                e,
            )
        }
    }

    /**
     * @deprecated create an instance and use it instead
     */
    static parse(objOrEval: unknown) {
        return new Parser([]).parse(objOrEval)
    }

    parse(objOrEval: unknown) {
        const [rootNode, nextObject] = this.parseData(
            objOrEval, [], undefined,
        )

        const openParser: [DataNodeObject, object | unknown[]][] = nextObject ? [[rootNode, nextObject]] : []

        while(openParser.length) {
            const [dataNode, currentObject] = openParser.pop()!

            if(Array.isArray(currentObject)) {
                for(const [key, val] of currentObject.entries()) {
                    const [nextDataNode, nextObject] = this.parseData(
                        val, [...dataNode.path, key],
                        dataNode,
                    )
                    dataNode.append(key, nextDataNode)
                    // only adding them to the current parent, thus still needs traversing or calling all parents for each registration
                    // it is only possible to collect all globally here, which aids most computations but doesn't help reducing re-collecting at partial computations
                    // if(nextDataNode.hooks) {
                    //     dataNode.hooks.push(...nextDataNode.hooks)
                    // }
                    if(nextObject) {
                        openParser.push([nextDataNode, nextObject])
                    }
                }
            } else {
                for(const key in currentObject) {
                    if(this.options.comments && key.endsWith('!')) continue

                    const [nextDataNode, nextObject] = this.parseData(
                        currentObject[key], [...dataNode.path, key],
                        dataNode,
                    )

                    dataNode.append(key, nextDataNode)
                    // only adding them to the current parent, thus still needs traversing or calling all parents for each registration
                    // it is only possible to collect all globally here, which aids most computations but doesn't help reducing re-collecting at partial computations
                    // if(nextDataNode.hooks) { // the alternative to pre-collect all in parser and not runtime
                    //     dataNode.hooks.push(...nextDataNode.hooks)
                    // }
                    if(nextObject) {
                        openParser.push([nextDataNode, nextObject])
                    }
                }
            }
        }

        return rootNode
    }
}
