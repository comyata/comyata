import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import { timer } from '@comyata/run/Helpers/Timer'
import { ComputeFn } from '@comyata/run/Runtime'
import { customAlphabet, nanoid } from 'nanoid'
import yaml from 'yaml'

const nanoidSimple = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
const nanoidSimpleLower = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz')
const nanoidAlpha = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
const nanoidAlphaLower = customAlphabet('abcdefghijklmnopqrstuvwxyz')

export const cachedUrlGlobal = new Map<string, { value: any } | { pending: Promise<any> }>()


export const jsonataCompute: (...args: [...Parameters<ComputeFn<DataNodeJSONata>>, { bindings?: Record<string, any>, cachedUrl?: typeof cachedUrlGlobal, abort?: AbortSignal }?]) => Promise<any> = (
    computedNode, context, parentData,
    {stats: nodeComputeStats},
    {
        bindings = {},
        cachedUrl = cachedUrlGlobal,
        abort,
    } = {},
) => {
    const load = (file: string) => {
        const cached = cachedUrl.get(file)
        const stats = {
            dur: 0,
            step: 'loadFile',
            file: file,
            cached: 0,
        }
        const start = timer.start()
        nodeComputeStats.stats.push(stats)
        if(cached) {
            if('pending' in cached) {
                stats.cached = 1
                return (async() => {
                    const r = await cached.pending
                    stats.dur = timer.end(start)
                    return r
                })()
            }
            stats.cached = 2
            return cached.value
        }
        const url = new URL(file)
        const p = fetch(url)
            .then(r =>
                r.text().then(text => ({
                    text: text,
                    headers: r.headers,
                })),
            )
            .then(r => {
                try {
                    const loaded = yaml.parse(r.text)
                    cachedUrl.set(file, {value: loaded})
                    stats.dur = timer.end(start)
                    return loaded
                } catch(e) {
                    // todo: throw for requests where sure to expect yaml or json, based on path or response header
                    return r.text
                }
            })
        cachedUrl.set(file, {pending: p})
        return p
    }
    return computedNode.expr.evaluate(
        context,
        {
            self: () => parentData[0],
            parent: () => parentData.slice(1),
            root: () => parentData[parentData.length - 1] || null,
            toYAML: (value: unknown) => yaml.stringify(value, {indent: 4 /*lineWidth: 0, minContentWidth: 0*/}),
            fromYAML: (text: string) => yaml.parse(text),
            nanoid: (size: number) => nanoid(size),
            nanoidSimple: (size: number) => nanoidSimple(size),
            nanoidSimpleLower: (size: number) => nanoidSimpleLower(size),
            nanoidAlpha: (size: number) => nanoidAlpha(size),
            nanoidAlphaLower: (size: number) => nanoidAlphaLower(size),
            sleep: async(delay) => {
                await new Promise<void>((resolve) => {
                    const timer = window.setTimeout(() => resolve(), delay || 0)
                    abort?.addEventListener('abort', () => {
                        window.clearTimeout(timer)
                        resolve()
                    })
                })
                return delay || 0
            },
            load: load,
            import: load,
            ...bindings,
        },
    )
}
