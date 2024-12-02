import { MissingEngineError, NodeComputeError, ResultError } from '@comyata/run/Errors'
import { timer } from '@comyata/run/Helpers/Timer'
import { IComputeTimeHooks, IDataNode, IDataNodeChildren, IDataNodeComputed } from '@comyata/run/DataNode'
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
    setter: (value: unknown) => void,
    // todo: maybe add nodesChain to getter call, to check circular nodes internally at this level
    getter: () => unknown,
    dataChain: unknown[]
]

type ResultState<TOutput = unknown, TNode extends IDataNode = IDataNode> = {
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
        onCompute,
        onComputed,
        onComputedError,
        __unsafeAllowCrossResolving,
        __unsafeDisableResultValidation,
    }: {
        onCompute?: (dataNode: TNode) => void
        onComputed?: (
            dataNode: TNode,
            result: unknown,
            meta: {
                statsNode: NodeComputeStats
                statsRun: IComputeStatsBase
            },
        ) => Promise<void> | void
        onComputedError?: (
            dataNode: TNode,
            error: unknown,
            meta: {
                statsNode: NodeComputeStats
                statsRun: IComputeStatsBase
            },
        ) => void
        /**
         * Allows to resolve other computed nodes from other computed nodes,
         * may lead to promise based deadlocks when cross-accessing computed nodes in the same file
         */
        __unsafeAllowCrossResolving?: boolean
        /**
         * Disables the validation that the value is neither Error nor Promise,
         * checked after the computation of a property, based on the resolved value,
         * but before the value is set to the output data.
         */
        __unsafeDisableResultValidation?: boolean
    } = {},
    // todo: make this baggage compatible to pass through from FileEngine to computeFn,
    //       to support state-independent computeFn even for chaining importing runtimes,
    //       e.g. atm. JSONata for files must be created newly to have the current relative context attached
    // todo: TBaggage can't be typed partial, without hiding potential TS errors for `NodeComputeEngines`,
    //       or introducing strange effects due to TS behaviour (where `new Set()` must be typed, as not interfered anymore)
    {
        nodesChain,
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
    //       but would mean for everything such a Set will be managed, while the File > Eval nesting relies on jit,
    //       and a context/baggage is only created for computed nested fields meaning,
    //       these currently only include computed nodes and not all.
    nodesContexts.set(dataNode, [(v) => resultData = v, () => resultData, []])

    const groups: [IDataNodeChildren<TNode>, any[]][] = dataNode.children ? [
        [dataNode.children as IDataNodeChildren<TNode>, [resultData]],
    ] : []
    // todo: these hooks can be cached per processor
    //       to reduce loops they can be only collected and materialized in first hydrate loop
    const hooks: IComputeTimeHooks<TNode extends IDataNodeComputed ? TNode : never> = [...dataNode.hooks as IComputeTimeHooks<TNode extends IDataNodeComputed ? TNode : never> || []]

    while(groups.length) {
        const [groupChildren, groupDataChain] = groups.pop()!
        const groupData = groupDataChain[0]
        groupChildren.forEach((childNode, childKey) => {
            groupData[childKey] = childNode.hydrate?.()
            // todo: only set nodesContext for computed nodes?
            nodesContexts.set(childNode, [(v) => groupData[childKey] = v, () => groupData[childKey], groupDataChain])
            if(childNode.hooks) {
                hooks.push(...childNode.hooks as IComputeTimeHooks<TNode extends IDataNodeComputed ? TNode : never>)
            }
            if(childNode.children) {
                groups.push([childNode.children as IDataNodeChildren<TNode>, [groupData[childKey], ...groupDataChain]])
            }
        })
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

    // setters to defer output mutation
    // - for usage in react, where the initial output is used and not the fully computed output,
    //   the data should not be mutated, as it violates react rules for state mutation.
    // - setting all nodes to their output, only after the whole compute is done,
    //   while ValuePromise defers and caches each node output result,
    //   to provide cross resolving with the output before it was set to the final output.
    // - which also prevents having different results based on order of dispatching,
    //   where one node could be finished if it was written before it's dependent but not if written after it.
    const setters: [TNode, unknown][] = []

    const dispatchNodeCompute = (
        engineId: NonNullable<TNode['engine']>,
        computedNode: TNode,
        onDone: (nodeResult: unknown, err?: Error) => void,
        computeStatsTotal: IComputeStatsBase,
    ) => {
        const [/*setter*/, /*getter*/, dataChain] = getNodeContext(computedNode)

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
        if(!computeFn) throw new MissingEngineError(
            `Missing compute engine for "${engineId}" at ${JSON.stringify(computedNode.path)}`,
            computedNode,
        )

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
                // todo: added here to reduce looping again over all computedNodes,
                //       this is the has-node-resolved-to-error check for every compute node
                // todo: checking for functions here can allow to postpone and dispatch follow-up functions or break out of the actual jsonata nesting
                if(!__unsafeDisableResultValidation) {
                    // const realValue = getter()
                    if(val instanceof Error) {
                        return Promise.reject(new ResultError(
                            `Computed value resulted in an error` +
                            ` at ${JSON.stringify(jsonpointer.compile(computedNode.path as string[]))}.`,
                            computedNode,
                            val,
                        ))
                    }
                    // todo: this validation is now useless here, as `val` can't ever be not-resolved without using `getter`
                    // if(val instanceof Promise) {
                    //     return Promise.reject(new ResultError(
                    //         `Computed value resulted in an promise` +
                    //         ` at ${JSON.stringify(jsonpointer.compile(computedNode.path as string[]))}.`,
                    //         computedNode,
                    //     ))
                    // }
                }

                computeStats.dur = timer.end(start)
                onDone(val)

                setters.push([computedNode, val])

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
                const error = e instanceof ResultError
                    ? e
                    : new NodeComputeError(
                        computedNode,
                        `Compute failure` +
                        ` at ${JSON.stringify(jsonpointer.compile(computedNode.path as string[]))}` +
                        ` with ${JSON.stringify(engineId)}.` +
                        `${e instanceof Error ? '\n' + e.message : typeof e === 'object' && e && 'message' in e ? '\n' + e.message : ''}`,
                        e,
                    )

                computeStats.dur = timer.end(start)
                onDone(undefined, error)
                setters.push([computedNode, error])
                onComputedError?.(
                    computedNode, error,
                    // todo: this meta should not need global values, as they are accessible from the runtime result state,
                    //       but passing down would make some integrations easier
                    {
                        statsNode: computeStats,
                        statsRun: computeStatsTotal,
                    },
                )
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

        const computationPromises: Promise<unknown>[] = []
        const errors: unknown[] = []
        for(const computedNode of computeHooks) {
            // todo: setting all computed placeholders to their promise allows directly using their results across any other usage in the same document!
            //       but this will never update usages, as this isn't known, thus a full reload is needed to redo all computed fields;
            //       the only solution would be to wrap the relative-data accessors to a Proxy, thus knowing from where something is called,
            //       yet it should only set the Proxy for computed fields,
            //       atm. this is only possible in user-land, e.g. where `$self()` is used,
            //       how could that be accomplished without passing a copied `context` to each compute cycle?
            //       maybe with overwriting the `dataChain` for each compute? and somehow only the computed nodes in it?
            let valuePromise: ValueSubscriberPromise<unknown> | undefined
            let subscribers: ((result: any, err?) => any)[] | undefined
            if(__unsafeAllowCrossResolving) {
                subscribers = []
                valuePromise = new ValueSubscriberPromise(subscribers/*, computedNode*/)
                nodesContexts.get(computedNode)?.[0]?.(valuePromise)
            }
            computationPromises.push(dispatchNodeCompute(
                computedNode.engine,
                computedNode,
                (nodeResult, err) => {
                    // todo: optimize progression information on global stats/log/state
                    //       could lead to simplifications in file-engine
                    computeStatsTotal.dur = timer.end(start)
                    if(subscribers) {
                        subscribers.splice(0, subscribers.length).forEach(subscribers => {
                            subscribers(nodeResult, err)
                        })
                    }
                    if(err) {
                        errors.push(err)
                    }
                },
                computeStatsTotal,
            ))
        }

        await Promise.allSettled(computationPromises)
        computationPromises.splice(0, computationPromises.length)// clean up

        setters.splice(0, setters.length).forEach(([computedNode, valOrError]) => {
            nodesContexts.get(computedNode)?.[0]?.(valOrError)
        })

        computeStatsTotal.dur = timer.end(start)

        if(errors.length) {
            return Promise.reject(errors.length > 1 ? new class ComputeError extends Error {
                errors = errors

                constructor() {
                    super(`Multiple failures during compute, ${errors.length} nodes failed.`)
                }
            } : errors[0])
        }
    }

    let isRunning: boolean = false
    const onDoneRun: ((result: unknown, err: unknown | undefined) => void)[] = []
    return {
        output: () => resultData as D,
        stats: stats,
        getValue: (node: TNode | IDataNode): unknown => {
            const [, getter] = getNodeContext(node)
            return getter()
        },
        compute: async() => {
            if(isRunning) {
                return new Promise<unknown>((resolve, reject) => {
                    onDoneRun.push((result, err) => err ? reject(err) : resolve(result))
                })
            }

            isRunning = true

            try {
                await runCompute()
                onDoneRun.splice(0).forEach(on => on(resultData, undefined))
            } catch(e) {
                onDoneRun.splice(0).forEach(on => on(resultData, e))
                throw e
            } finally {
                isRunning = false
            }

            return resultData
        },
    }
}

class ValueSubscriberPromise<T> extends Promise<T> {
    #subscribers: ((result: T, err?) => void)[]
    // #dataNode: () => IDataNode
    #result: undefined | { error?: any, value?: any } = undefined

    constructor(
        subscribers: ((result: T, err?) => void)[],
        // dataNode: IDataNode,
    ) {
        super((resolve) => {
            // throwing here may lead to uncaught errors in react but not nodejs somehow,
            // in react it is only used to know when to show progress loaders in e.g. JSONView, but not awaited
            // as anything which tries to listen, will receive rejects below and the actual exception is handled at another position,
            // it should be best and safe to just set to undefined on errors
            subscribers.push((nodeResult, err) => {
                this.#result = err ? {error: err} : {value: nodeResult}
                resolve((err ? undefined : nodeResult) as any)
            })
        })
        this.#subscribers = subscribers
        // this.#dataNode = () => dataNode
    }

    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => (PromiseLike<TResult1> | TResult1)) | undefined | null,
        onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null,
    ): Promise<TResult1 | TResult2> {
        if(this.#result) {
            // note: using the approach without another wrapped Promise doesn't correctly handle `.reject`,
            //       it won't be caught in await etc.
            // return this.result.error ? Promise.reject(this.result.error) : Promise.resolve(this.result.value)
            //     .then(onfulfilled, onrejected)
            return new Promise<T>((resolve, reject) => {
                if(this.#result?.error) {
                    reject(this.#result.error)
                    return
                }
                resolve(this.#result?.value)
            })
                .then(onfulfilled, onrejected)
        }
        return new Promise<T>((resolve, reject) => {
            this.#subscribers.push((result, err) => {
                if(err) {
                    reject(err)
                    return
                }
                resolve(result)
            })
        })
            .then(onfulfilled, onrejected)
    }
}
