import { DataNode } from '@comyata/run/DataNode'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { ComputeStats, runtime } from '@comyata/run/Runtime'
import { useCallback, useEffect, useRef, useState } from 'react'
import { jsonataCompute } from './ComputeBindings/jsonataCompute'

export type IProgressEvent =
    {
        type: 'start'
    } |
    {
        type: 'done'
        output: unknown
        error?: Error
    } |
    {
        type: 'node_start'
        nodePath: DataNode['path']
    } |
    {
        type: 'node_done'
        nodePath: DataNode['path']
        // contains only the result of the node
        output: unknown
        error?: Error
    }

export type Progress = null | 'processing' | 'finished' | 'error' | 'outdated'

export const useComyataRuntime = (
    parser: Parser<typeof DataNode | typeof DataNodeJSONata>,
    comyataTemplate: unknown,
    data: unknown,
    {
        autoprocessing = true,
        delay = 30,
        delayParsing = 275,
        onProgress,
    }: {
        autoprocessing?: boolean
        delay?: number
        delayParsing?: number
        onProgress?: (progress: IProgressEvent) => void
    } = {},
) => {
    const mountedRef = useRef(false)
    const evalRef = useRef<AbortController | null>(null)
    const timerRef = useRef<undefined | number>(undefined)
    const [processing, setProcessing] = useState<Progress>(null)
    const [evalOut, setEvalOut] = useState<{ stats: ComputeStats[], output: unknown, ts: number } | null>(null)
    const [evalOutError, setEvalOutError] = useState<null | Error | { error: any }>(null)

    const [parserError, setParserError] = useState<Error | undefined>(undefined)
    const [dataNode, setDataNode] = useState<DataNode | DataNodeJSONata | undefined>(undefined)

    useEffect(() => {
        setProcessing('outdated')
        if(typeof comyataTemplate === 'undefined') {
            setParserError(undefined)
            setDataNode(undefined)
            return
        }
        if(comyataTemplate === null) {
            setDataNode(parser.parse(null))
            setParserError(undefined)
            return
        }
        const timer = window.setTimeout(() => {
            try {
                setParserError(undefined)
                // todo: parse stats is included in FileEngine stats, but no concept in parser/runtime,
                //       needs an extra parse stats which only contains parsing, no loading stats
                setDataNode(parser.parse(comyataTemplate))
            } catch(e) {
                if(e instanceof Error) {
                    setParserError(e)
                } else {
                    console.error(e)
                    setParserError(new Error(e && typeof e === 'object' && 'message' in e ? e.message as string : 'Unknown parse error'))
                }
            }
        }, mountedRef.current ? delayParsing : 0)
        return () => {
            window.clearTimeout(timer)
            window.clearTimeout(timerRef.current)
            evalRef.current?.abort()
        }
    }, [comyataTemplate, delayParsing, parser])

    const doProcessing = useCallback(() => {
        window.clearTimeout(timerRef.current)
        evalRef.current?.abort()
        const abort = evalRef.current = new AbortController()
        if(!dataNode || data instanceof Error) {
            setProcessing(null)
            return null
        }
        return () => {
            setEvalOutError(null)
            setProcessing('processing')

            const result = runtime(
                dataNode,
                data,
                {
                    [DataNodeJSONata.engine]: jsonataCompute,
                },
                {
                    __unsafeAllowCrossResolving: true,
                    // use these callbacks to get data once a DataNode starts and is done,
                    // allowing to "stream" data in UIs which support it
                    onCompute: (dataNode) => {
                        if(abort.signal.aborted) return
                        onProgress?.({
                            type: 'node_start',
                            nodePath: dataNode.path,
                        })
                    },
                    onComputed: (dataNode, result/*, meta*/) => {
                        if(abort.signal.aborted) return
                        onProgress?.({
                            type: 'node_done',
                            nodePath: dataNode.path,
                            output: result,
                        })
                    },
                },
                {
                    nodesChain: new Set(),
                    abort: abort.signal,
                },
            )

            onProgress?.({
                type: 'start',
                // note: the `.output` of one compute cycle has the same reference,
                //       this allows to manually apply updates to the initial state or use e.g. immer
                //       but this `.output` data will be the same as at the `done` event, once `done` is reached
                // output: result.output(),
            })

            setEvalOut({
                // the initial `.output` contains `Promise` placeholders for all DataNodes,
                // e.g. use `someData.someNode instanceof Promise` to know if not yet done
                // output: result.output(),
                output: null,
                stats: result.stats,
                ts: Date.now(),
            })

            result.compute()
                .then(() => {
                    if(abort.signal.aborted) return
                    setProcessing('finished')
                    setEvalOut(resultContainer => resultContainer && 'output' in resultContainer ? {
                        ...resultContainer,
                        stats: result.stats,
                        output: result.output(),
                        ts: Date.now(),
                    } : resultContainer)

                    onProgress?.({
                        type: 'done',
                        output: result.output(),
                    })
                })
                .catch((e) => {
                    if(abort.signal.aborted) return
                    setProcessing('error')
                    console.debug('Comyata processor failed', e)

                    onProgress?.({
                        type: 'done',
                        output: result.output(),
                        error: e,
                    })
                    setEvalOut(resultContainer => resultContainer && 'output' in resultContainer ? {
                        ...resultContainer,
                        stats: result.stats,
                        output: result.output(), // updating here to get errors
                        ts: Date.now(),
                    } : resultContainer)
                    setEvalOutError(e instanceof Error ? e : {error: e})
                })
        }
    }, [data, dataNode, onProgress])

    useEffect(() => {
        if(!autoprocessing) return
        const doProcessingFn = doProcessing()
        if(!doProcessingFn) return
        setProcessing('outdated')
        timerRef.current = window.setTimeout(() => {
            doProcessingFn()
        }, mountedRef.current ? delay : 0)
        return () => window.clearTimeout(timerRef.current)
    }, [autoprocessing, setProcessing, delay, doProcessing])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [autoprocessing])

    return {
        parserError,
        dataNode,
        doProcessing,
        processing, setProcessing,
        evalOut,
        evalOutError,
    }
}
