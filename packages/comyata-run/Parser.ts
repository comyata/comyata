import { DataNode, DataNodeObject, ExtractExprFn } from '@comyata/run/DataNode'
import { NodeParserError } from '@comyata/run/Errors'
import jsonpointer from 'json-pointer'

function escapeRegex(string: string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')
}

type DataParser<TNode extends typeof DataNode, TValue = unknown> = (
    currentValue: TValue,
    currentPath: (string | number)[],
    parent: DataNodeObject | undefined,
) => [InstanceType<TNode> | DataNode, undefined?] | [DataNodeObject, (unknown[] | object)]

type DataParserTypes = {
    null: null
    string: string
    number: number
    boolean: boolean
    undefined: undefined
    array: unknown[]
    object: object
}

type DataParsers<TNode extends typeof DataNode> = {
    [Type in keyof DataParserTypes]: DataParser<TNode, DataParserTypes[Type]>
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
            `^(?<engine>${this.nodes.filter(tag => tag.engine).map(tag => escapeRegex(tag.engine as string)).join('|')})${escapeRegex(this.options.paren[0])}`,
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
                return nodesMap.get(tagName)!
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

    private static dataNodeParsers: DataParsers<typeof DataNode> = {
        null: (currentValue: null, currentPath, parent) => {
            return [new DataNode(parent, currentPath, 'null', currentValue)
                .withHydrate(() => currentValue)]
        },
        array: (currentValue: unknown[], currentPath, parent) => {
            const valueLength = currentValue.length
            const dataNode = new DataNodeObject(parent, currentPath, 'array', currentValue)
                .withHydrate(() => new Array(valueLength))
            return [dataNode, currentValue]
        },
        object: (currentValue: object, currentPath, parent) => {
            const dataNode = new DataNodeObject(parent, currentPath, 'object', currentValue)
                .withHydrate(() => ({}))
            return [dataNode, currentValue]
        },
        number: (currentValue, currentPath, parent) => {
            return [new DataNode(parent, currentPath, 'number', currentValue)
                .withHydrate(() => currentValue)]
        },
        string: (currentValue, currentPath, parent) => {
            return [new DataNode(parent, currentPath, 'string', currentValue)
                .withHydrate(() => currentValue)]
        },
        boolean: (currentValue, currentPath, parent) => {
            return [new DataNode(parent, currentPath, 'boolean', currentValue)
                .withHydrate(() => currentValue)]
        },
        undefined: (_currentValue, currentPath, parent) => {
            return [new DataNode(parent, currentPath, 'undefined', undefined)
                .withHydrate(() => undefined)]
        },
    }

    private parseData = (
        currentValue: unknown,
        currentPath: (string | number)[],
        parent: DataNodeObject | undefined,
    ): [InstanceType<TNode> | DataNode, undefined?] | [DataNodeObject, (unknown[] | object)] => {
        if(typeof currentValue === 'string') {
            const nodeTag = this.matchNode(currentValue)

            if(nodeTag) {
                try {
                    return [new nodeTag[0](
                        parent, currentPath,
                        '',
                        currentValue,
                        nodeTag[1],
                    )]
                } catch(e) {
                    if(e instanceof NodeParserError) throw e
                    throw new NodeParserError(
                        currentPath, parent,
                        `Parse error` +
                        ` at ${JSON.stringify(jsonpointer.compile(currentPath as string[]))}` +
                        ` with ${JSON.stringify(nodeTag[0].engine)}.` +
                        `${e instanceof Error ? '\n' + e.message : typeof e === 'object' && e && 'message' in e ? '\n' + e.message : ''}`,
                        e,
                    )
                }
            }

            return Parser.dataNodeParsers.string(currentValue, currentPath, parent)
        } else if(typeof currentValue === 'object') {
            if(currentValue === null) {
                return Parser.dataNodeParsers.null(currentValue, currentPath, parent)
            } else if(Array.isArray(currentValue)) {
                return Parser.dataNodeParsers.array(currentValue, currentPath, parent)
            }

            return Parser.dataNodeParsers.object(currentValue, currentPath, parent)
        }

        const type = typeof currentValue
        if(type in Parser.dataNodeParsers) {
            return Parser.dataNodeParsers[type as keyof DataParserTypes](
                // @ts-expect-error not possible to type guard value
                currentValue,
                currentPath, parent,
            )
        }

        throw new NodeParserError(
            currentPath, parent,
            `Parse error` +
            ` at ${JSON.stringify(jsonpointer.compile(currentPath as string[]))}` +
            ` unsupported value in data, no supported parser for type ${JSON.stringify(type)}.`,
        )
    }

    /**
     * @deprecated create an instance and use it instead
     */

    /* istanbul ignore next */
    static parse(objOrEval: unknown) {
        return new Parser([]).parse(objOrEval)
    }

    parse(objOrEval: unknown) {
        const parseComments = this.options.comments

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
                    if(nextObject) {
                        openParser.push([nextDataNode, nextObject])
                    }
                }
            } else {
                for(const [key, val] of Object.entries(currentObject)) {
                    if(parseComments && key.endsWith('!')) continue

                    const [nextDataNode, nextObject] = this.parseData(
                        val, [...dataNode.path, key],
                        dataNode,
                    )

                    dataNode.append(key, nextDataNode)
                    if(nextObject) {
                        openParser.push([nextDataNode, nextObject])
                    }
                }
            }
        }

        return rootNode
    }
}
