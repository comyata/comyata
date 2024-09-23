import { NodeComputeError } from '@comyata/run/Errors'
import { timer } from '@comyata/run/Helpers/Timer'
import { IComputeTimeHooks, IDataNode, IDataNodeChildren } from '@comyata/run/DataNode'
import jsonpointer from 'json-pointer'

export interface IComputeStatsBase {
    step: string
    dur?: number
    cached?: number
    stats?: ComputeStats[]
}

export interface NodeComputeStats extends IComputeStatsBase {
    dataNode?: IDataNode['path']
    stats: (ComputeStats)[]
    cached?: 0 | 1 | 2 | 3
    engine?: string
}

export interface NodeRuntimeBaggage<TNode extends IDataNode> {
    nodesChain: Set<TNode | IDataNode>
    abort?: AbortSignal
}

export interface NodeRuntimeBaggageComplete<TNode extends IDataNode> extends NodeRuntimeBaggage<TNode> {
    stats: NodeComputeStats
}

export type ComputeFn<
    TNode extends IDataNode,
    C = unknown,
    TBaggage extends NodeRuntimeBaggageComplete<TNode> = NodeRuntimeBaggageComplete<TNode>,
> = (
    dataNode: TNode,
    context: C,
    parentData: unknown[],
    runtimeBaggage: TBaggage,
) => Promise<unknown>

export type ComputeStats = IComputeStatsBase | NodeComputeStats

type NodeContext = [
    setter: (value: any) => void,
    // todo: maybe add nodesChain to getter call, to check circular nodes internally at this level
    getter: () => unknown,
    dataChain: any[]
]

type ResultState<TOutput = unknown, TNode extends IDataNode = IDataNode> = {
    /**
     * @todo `data` typing should reflect its unvalidated state, while `compute` will always return resolved values
     * @deprecated
     */
    data: () => TOutput
    output: () => TOutput
    stats: ComputeStats[]
    getValue: (node: TNode | IDataNode) => unknown
    compute: () => Promise<TOutput>
}

export type NodeComputeEngines<TNode extends IDataNode, C = unknown, TBaggage extends NodeRuntimeBaggage<TNode> = NodeRuntimeBaggage<TNode>> = {
    [engine in NonNullable<TNode['engine']>]?: TNode extends { engine: engine } ? ComputeFn<TNode, C, TBaggage & NodeRuntimeBaggageComplete<TNode>> : never
}

export const runtime = <TNode extends IDataNode, D = unknown, C = unknown, TBaggage extends NodeRuntimeBaggage<TNode> = NodeRuntimeBaggage<TNode>>(
    dataNode: TNode,
    context: C,
    computeEngines: NodeComputeEngines<TNode, C, TBaggage>,
    {
        onCompute, onComputed,
        __unsafeAllowCrossResolving,
        __unsafeDisableResultValidation,
    }: {
        onCompute?: (dataNode: TNode) => void
        onComputed?: (
            dataNode: TNode, result: any,
            meta: {
                statsNode: NodeComputeStats
                statsRun: IComputeStatsBase
            },
        ) => Promise<void> | void
        /**
         * Allows to resolve other computed nodes from other computed nodes,
         * may lead to promise based deadlocks when cross-accessing computed nodes in the same file
         */
        __unsafeAllowCrossResolving?: boolean
        /**
         * Disables the validation that the value is neither Error nor Promise,
         * checked after the computation based on value from getter, not from result.
         * @todo decide if value from setter or directly the result would make more sense,
         *       as it is not implemented as "check all computed nodes afterwards" but embedded in the compute result handling (loop reduction)
         */
        __unsafeDisableResultValidation?: boolean
    } = {},
    // todo: make this baggage compatible to pass through from FR to computeFn,
    //       to support state-independent computeFn even for chaining importing runtimes,
    //       e.g. atm. JSONata for files must be created newly to have the current relative context attached
    {
        nodesChain = new Set(),
        ...baggage
    }: TBaggage = {
        nodesChain: new Set(),
    } as TBaggage,
): ResultState<D, TNode> => {
    const nodesContexts = new Map<TNode | IDataNode, NodeContext>()
    const stats: ComputeStats[] = []

    const processorStatsHydrate = {
        step: 'hydrate',
        dur: 0,
    }
    stats.push(processorStatsHydrate)
    const startHydrate = timer.start()

    let resultData = dataNode.hydrate?.()
    // todo: tbd: managing the node-parent-import-chain here would make things easier on other sides,
    //       but would mean for every thing such an Set will be managed, while the File > Eval nesting relies on jit and created only a context for computed nested fields
    //       meaning, these currently only include computed nodes and not all
    nodesContexts.set(dataNode, [(v) => resultData = v, () => resultData, []])

    const groups: [IDataNodeChildren<TNode>, any[]][] = dataNode.children ? [
        [dataNode.children as IDataNodeChildren<TNode>, [resultData]],
    ] : []
    // todo: these hooks can be cached per processor
    //       to reduce loops they can be only collected and materialized in first hydrate loop
    const hooks: IComputeTimeHooks<TNode> = [...dataNode.hooks as IComputeTimeHooks<TNode> || []]

    let group = groups.shift()
    while(group) {
        const [groupChildren, groupDataChain] = group
        const groupData = groupDataChain[0]
        groupChildren.forEach((childNode, childKey) => {
            groupData[childKey] = childNode.hydrate?.()
            // todo: for usage in react, where the initial output is used and not the fully computed output,
            //       the data should not be mutated, as a it violates react rules for state mutation
            nodesContexts.set(childNode, [(v) => groupData[childKey] = v, () => groupData[childKey], groupDataChain])
            if(childNode.hooks) {
                hooks.push(...childNode.hooks as IComputeTimeHooks<TNode>)
            }
            if(childNode.children) {
                groups.push([childNode.children as IDataNodeChildren<TNode>, [groupData[childKey], ...groupDataChain]])
            }
        })
        group = groups.shift()
    }

    processorStatsHydrate.dur = timer.end(startHydrate)

    const getNodeContext = (node: TNode | IDataNode) => {
        const nodeContext = nodesContexts.get(node)
        if(!nodeContext) {
            console.error('Missing Data context for:', node)
            throw new Error(`Missing Data Context`)
        }
        return nodeContext
    }

    const dispatchNodeCompute = (
        engineId: NonNullable<TNode['engine']>,
        computedNode: TNode,
        onDone: (nodeResult, err?) => void,
        computeStatsTotal: IComputeStatsBase,
    ) => {
        const [setter, getter, dataChain] = getNodeContext(computedNode)

        const computeStats: NodeComputeStats = {
            step: 'computeNode',
            dur: 0,
            dataNode: computedNode.path,
            stats: [],
            engine: engineId,
        }

        computeStatsTotal.stats?.push(computeStats)

        const start = timer.start()
        const computeFn = computeEngines[engineId]
        if(!computeFn) throw new Error(`Missing compute for "${engineId}" at ${JSON.stringify(computedNode.path)}`)

        onCompute?.(computedNode)
        return computeFn(
            computedNode, context, dataChain,
            {
                ...baggage,
                nodesChain: new Set(nodesChain).add(computedNode),
                stats: computeStats,
            } as TBaggage & NodeRuntimeBaggageComplete<TNode>,
        )
            .then((val) => {
                computeStats.dur = timer.end(start)
                setter(val)
                onDone(val)

                // todo: added here to reduce looping again over all computedNodes,
                //       this is the has-node-resolved-to-error check for every compute node
                // todo: checking for functions here can allow to postpone and dispatch follow-up functions or break out of the actual jsonata nesting
                if(!__unsafeDisableResultValidation) {
                    const realValue = getter()
                    if(realValue instanceof Error) {
                        return Promise.reject(new class ResultError extends Error {
                            message = `Computed value resulted in an error`
                            dataNode = computedNode
                            valueError = realValue
                        })
                    }
                    if(realValue instanceof Promise) {
                        return Promise.reject(new class ResultError extends Error {
                            message = `Computed value resulted in an promise`
                            dataNode = computedNode
                            valueError = realValue
                        })
                    }
                }

                return onComputed?.(
                    computedNode, val,
                    // todo: this meta should not need global values, as they are accessible from the runtime result state,
                    //       but passing down would make some integrations easier
                    {
                        statsNode: computeStats,
                        statsRun: computeStatsTotal,
                    },
                )?.then(() => {
                    return val
                }) || val
            })
            .catch(e => {
                // todo: TBD: abort everything or call `onComputed` with the error?
                //       atm. when one node throws, the whole `.compute` throws, but other nodes will progress further on

                const error = new NodeComputeError(
                    computedNode,
                    `Compute failure` +
                    ` at ${JSON.stringify(jsonpointer.compile(computedNode.path as string[]))}` +
                    ` with ${JSON.stringify(engineId)}.` +
                    `${e instanceof Error ? '\n' + e.message : typeof e === 'object' && e && 'message' in e ? '\n' + e.message : ''}`,
                    // `${typeof e === 'object' && e && 'code' in e ? '\nCode: ' + e.code : ''}`,
                    e,
                )
                computeStats.dur = timer.end(start)
                setter(error) // added this to show errors at nodes in json-view, which would not be compatible with target validation
                onDone(undefined, error)
                return Promise.reject(error)
            })
    }

    const runCompute = async() => {
        const computeHooks = hooks
        const computeStatsTotal = {
            step: 'compute', dur: 0,
            stats: [],
        }
        stats.push(computeStatsTotal)
        const start = timer.start()

        const computationPromises: Promise<any>[] = []
        for(const computedNode of computeHooks) {
            if(!computedNode.engine) continue
            const engineId = computedNode.engine

            // todo: setting all computed placeholders to their promise allows directly using their results across any other usage in the same document!
            //       but this will never update usages, as this isn't known, thus a full reload is needed to redo all computed fields
            let listenerPromise: ForkPromise<unknown> | undefined
            if(__unsafeAllowCrossResolving) {
                listenerPromise = new ForkPromise()
                nodesContexts.get(computedNode)?.[0]?.(listenerPromise)
            }
            computationPromises.push(dispatchNodeCompute(
                engineId,
                computedNode as TNode,
                (nodeResult, err) => {
                    // todo: optimize progression information on global stats/log/state
                    //       could lead to simplifications in file-engine
                    computeStatsTotal.dur = timer.end(start)
                    listenerPromise?.getListener().forEach(listener => {
                        listener(nodeResult, err)
                    })
                },
                computeStatsTotal,
            ))
        }

        await Promise.all(computationPromises)

        computeStatsTotal.dur = timer.end(start)

        return resultData
    }

    let isRunning: boolean = false
    const onDone: ((result, err) => void)[] = []
    return {
        data: () => resultData as D,
        output: () => resultData as D,
        stats: stats,
        getValue: (node: TNode | IDataNode): unknown => {
            const [, getter] = getNodeContext(node)
            return getter()
        },
        compute: async() => {
            if(isRunning) {
                return new Promise((resolve, reject) => {
                    onDone.push((result, err) => err ? reject(err) : resolve(result))
                })
            }

            isRunning = true

            try {
                await runCompute()
                onDone.splice(0).forEach(on => on(resultData, undefined))
            } catch(e) {
                onDone.splice(0).forEach(on => on(resultData, e))
                throw e
            } finally {
                isRunning = false
            }

            return resultData
        },
    }
}

class ForkPromise<T> extends Promise<T> {
    private listener: ((result: T, err?) => void)[]

    constructor() {
        const listener: ForkPromise<T>['listener'] = []
        super((resolve) => {
            // throwing here may lead to uncaught errors in react but not nodejs somehow,
            // in react it is only used to know when to show progress loaders in e.g. JSONView, but not awaited
            // as anything which tries to listen, will receive rejects below and the actual exception is handled at another position,
            // it should be best and safe to just set to undefined on errors
            listener.push((nodeResult, err) => resolve((err ? undefined : nodeResult) as any))
        })
        this.listener = listener
    }

    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => (PromiseLike<TResult1> | TResult1)) | undefined | null,
        onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null,
    ): Promise<TResult1 | TResult2> {
        return new Promise<T>((resolve, reject) => {
            this.listener.push((result, err) => {
                if(err) {
                    reject(err)
                    return
                }
                resolve(result)
            })
        })
            .then(onfulfilled, onrejected)
    }

    getListener() {
        return this.listener
    }
}
