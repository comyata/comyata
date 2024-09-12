import { DataNode } from '@comyata/run/DataNode'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { ComputeStats, runtime } from '@comyata/run/Runtime'
import { useCallback, useEffect, useRef, useState } from 'react'
import { jsonataCompute } from './ComputeBindings/jsonataCompute'

export const useComyataRuntime = (
    parser: Parser<typeof DataNode | typeof DataNodeJSONata>,
    comyataTemplate: unknown,
    data: unknown,
    {
        autoprocessing = true,
        delay = 30,
        delayParsing = 275,
    }: {
        autoprocessing?: boolean
        delay?: number
        delayParsing?: number
    } = {},
) => {
    const mountedRef = useRef(false)
    const evalRef = useRef(0)
    const timerRef = useRef<undefined | number>(undefined)
    const [processing, setProcessing] = useState<null | 'processing' | 'finished' | 'error' | 'outdated'>(null)
    const [evalOut, setEvalOut] = useState<{ stats: ComputeStats[], output: unknown } | null>(null)
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
        return () => window.clearTimeout(timer)
    }, [comyataTemplate, delayParsing, parser])

    const doProcessing = useCallback(() => {
        window.clearTimeout(timerRef.current)
        const pid = evalRef.current += 1
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
                    // allowing to "stream" data in UIs which support it (the demo uses plain JSON, thus doesn't make much sense)
                    // onCompute: () => undefined,
                    // onComputed: () => undefined,
                },
            )

            setEvalOut({
                // the initial `.output` contains `Promise` placeholders for all DataNodes,
                // e.g. use `someData.someNode instanceof Promise` to know if not yet done
                // output: result.output(),
                output: null,
                stats: result.stats,
            })

            result.compute()
                .then(() => {
                    if(evalRef.current !== pid) return
                    setProcessing('finished')
                    setEvalOut(resultContainer => resultContainer && 'output' in resultContainer ? {
                        ...resultContainer,
                        stats: result.stats,
                        output: result.output(),
                    } : resultContainer)
                })
                .catch((e) => {
                    if(evalRef.current !== pid) return
                    setProcessing('error')
                    console.debug('Comyata processor failed', e)
                    setEvalOut(resultContainer => resultContainer && 'output' in resultContainer ? {
                        ...resultContainer,
                        stats: result.stats,
                        output: result.output(), // updating here to get errors
                    } : resultContainer)
                    setEvalOutError(e instanceof Error ? e : {error: e})
                })
        }
    }, [data, dataNode])

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
