import { DataFile } from '@comyata/fe/DataFile'
import { DataFileRegistry, DataRef } from '@comyata/fe/DataFileRegistry'
import { CircularFileDependencyError, CircularProcessingDependencyError, ComputableFetchError } from '@comyata/fe/Errors'
import { Importers } from '@comyata/fe/Importers'
import { ComputableError } from '@comyata/run/Errors'
import { isRelative } from '@comyata/fe/Helpers/isRelative'
import { timer } from '@comyata/run/Helpers/Timer'
import { Parser } from '@comyata/run/Parser'
import { DataNode, IDataNode } from '@comyata/run/DataNode'
import { ComputeStats, runtime, IComputeStatsBase, NodeRuntimeBaggage, NodeRuntimeBaggageComplete, NodeComputeEngines, ComputeFn } from '@comyata/run/Runtime'

export interface Resolver {
    id: string
    /**
     * @todo most pure-loaders shouldn't need to specify resolveRelative,
     *       but only with real-data, for filtering/sorting, (and not just a string as $load arg) something like 'genFileIdFromArgs" would make sense
     */
    scopes: string[]
    resolveDirectory?: (baseUrl: string) => ResolveContext
    resolveFile: (fileUrl: string) => FileResolveContext
    // todo: maybe specify at importer what is allowed with them?
    // importer: false,
    // loader: true,
}

export interface ResolveContext {
    /**
     * @todo maybe support a Symbol based id, to distinguish importers with same ID
     * @todo make import context required? would make the in-memory files complexer - or depending on their actual importer
     */
    importer?: string
    resolveRelative?: ((relPath: string) => string)
}

export interface FileResolveContext extends ResolveContext {
    load: () => Promise<unknown> | unknown
    // todo: it should be possible to transiently load data, which isn't cached after its current usages are done
    // todo: allow per file control what is allowed to do with it? would need to be persisted at the respective DataFile
    // supports?: ('load' | 'import')[] // or `capabilities`, `enabled`, `can`
}

export interface FileComputeStats extends IComputeStatsBase {
    step: 'computeFile'
    file: string
    stats: (FileComputeStats | ComputeStats)[]
    cached?: 0 | 1 | 2
    usages?: Map<DataFile, Set<IDataNode>>
}

export type ImportContext = ResolveContext | FileResolveContext

export type RuntimeContext<TNode extends IDataNode = IDataNode> = {
    registry: DataFileRegistry<TNode>
    //refs: Map<DataFile, DataRef<DataNode>>
    //fileLoader: Map<DataFile, () => Promise<unknown>>
    //fileLoaderListener: Map<DataFile, ((fileValue: unknown, err?: any) => void)[]>
    // fileLoader: Map<DataFile, () => Promise<DataTemplate>>
    // fileLoaderListener: Map<DataFile, ((dataEval: DataTemplate | undefined, err?: any) => void)[]>
    /**
     * Either an object containing the computed result for an file in the current run,
     * or a subscriber function if currently already running computations, which resolves with the computed data.
     *
     * Used as a runtime cache, as each file will always be executed with the same "context" the resulted computations are expected to be stable within one run.
     * This guarantees that multiple `$import/$load` on the same URL will always have the same data inside a single run.
     */
    fileEvals: Map<DataFile, { result: unknown } | ((requestingFilesChain: Set<DataFile>, requestingNodesChain: Set<IDataNode>) => Promise<unknown>)>
    fileEvalsAwaiter: Map<DataFile, Set<DataFile>>
    fileListener: Map<DataFile, ((result, err?: any) => void)[]>
    /**
     * map which DataFile is used by which DataFile in which DataNode
     */
    usages: Map<DataFile, Map<DataFile, Set<IDataNode>>>
}

export interface FileRuntimeBaggage<TNode extends IDataNode> extends NodeRuntimeBaggage<TNode> {
    dataFile: DataFile<TNode | IDataNode>
    filesChain: Set<DataFile<TNode | IDataNode>>
    computeStats: FileComputeStats
    runtimeContext: RuntimeContext<TNode | IDataNode>
    fileEngine: Pick<FileEngine<any>, 'run' | 'fetchFile'>
}

export type FileComputeFn<TNode extends IDataNode, C = unknown, TBaggage extends FileRuntimeBaggage<TNode> = FileRuntimeBaggage<TNode>> =
    ComputeFn<TNode, C, TBaggage & NodeRuntimeBaggageComplete<TNode | IDataNode>>

export type FileComputeFn2<TNode extends IDataNode, C = unknown> = (
    dataNode: TNode,
    context: C,
    parentData: unknown[],
    runtimeBaggage: FileRuntimeBaggage<TNode | IDataNode> & NodeRuntimeBaggageComplete<TNode | IDataNode>,
) => Promise<unknown>

type FileComputeEngines<TNode extends IDataNode, C = unknown, TBaggage extends FileRuntimeBaggage<TNode> = FileRuntimeBaggage<TNode>> =
    NodeComputeEngines<TNode, C, TBaggage>

type MapValueChanges<K, V> =
    {
        add: ((key: K, value: V) => void)[]
        delete: ((deletedKey: K) => void)[]
    }

class SubscribeMap<K, V> extends Map<K, V> {
    private readonly listeners: MapValueChanges<K, V> = {
        add: [],
        delete: [],
    }

    set(key: K, value: V): this {
        const map = super.set(key, value)
        this.listeners.add.slice().forEach(l => l(key, value))
        return map
    }

    delete(key: K): boolean {
        const deleted = super.delete(key)
        if(deleted) {
            this.listeners.delete.slice().forEach(l => l(key))
        }
        return deleted
    }

    clear(): void {
        let keys: K[] | undefined
        if(this.listeners.delete.length) {
            keys = Array.from(this.keys())
        }
        super.clear()
        if(keys) {
            this.listeners.delete.slice().forEach(l => keys?.forEach(key => l(key)))
        }
    }

    onAdd(cb: (key: K, value: V) => void) {
        this.listeners.add.push(cb)
        return () => {
            const i = this.listeners.add.indexOf(cb)
            if(i === -1) return
            this.listeners.add.splice(i, 1)
        }
    }

    onDelete(cb: (deletedKey: K) => void) {
        this.listeners.delete.push(cb)
        return () => {
            const i = this.listeners.delete.indexOf(cb)
            if(i === -1) return
            this.listeners.delete.splice(i, 1)
        }
    }
}

export class FileEngine<TNode extends typeof DataNode> {
    readonly parser: Parser<TNode>
    readonly files: SubscribeMap<string, DataFile<InstanceType<TNode>>> = new SubscribeMap()
    readonly compute: FileComputeEngines<InstanceType<TNode>>
    readonly processorOptions: Parameters<typeof runtime>[3]
    private readonly importer: Importers | undefined

    constructor(
        {
            nodes,
            compute,
            importer,
            processorOptions,
            parserOptions,
        }: {
            nodes: TNode[]
            compute: FileComputeEngines<InstanceType<TNode>>
            // todo: these Importers, especially the whole loader, converter, caching, woud be useful in pipe,
            //       that is the most interesting part, which is not only for remote-execution engines, but also any other file based/datanode collections computing,
            //       including the standardized usages collector and updatable caches
            importer?: Importers
            processorOptions?: Parameters<typeof runtime>[3]
            parserOptions?: Partial<Parser<TNode>['options']>
        },
    ) {
        this.compute = compute
        this.parser = new Parser<TNode>(nodes, parserOptions)
        this.importer = importer
        this.processorOptions = processorOptions
    }

    /**
     * @todo risky method, only use outside of computations/runs, to not accidentally access the wrong files cache,
     *       safe to use outside of runs
     */
    contextOf(contextBaseUrl: string): ResolveContext {
        if(isRelative(contextBaseUrl)) {
            // this is the special case, which depends on parent file or global resolve
            throw new ComputableError(`Relative file not supported as ref: ${contextBaseUrl}`)
        }

        const source = this.files.get(contextBaseUrl)
        if(source) {
            if(source.importContext) {
                const resolveRelative = source.importContext.resolveRelative
                if(resolveRelative) {
                    return {resolveRelative: resolveRelative, importer: source.importContext.importer}
                }
                throw new ComputableError(`Source has no importContext for ${contextBaseUrl}`)
            }
            throw new ComputableError(`No source registered for ${contextBaseUrl}`)
        }

        const importer = this.importer?.match(contextBaseUrl)
        if(importer) {
            if(!('resolveDirectory' in importer) || !importer?.resolveDirectory) {
                throw new ComputableError(`Importer ${importer.id} does not support directory context, required to load ${contextBaseUrl}`)
            }
            return importer.resolveDirectory(contextBaseUrl)
        }

        throw new ComputableError(`No importer registered for ${contextBaseUrl}`)
    }

    /**
     * @todo maybe move into registry?
     * @todo risky method, only use outside of computations/runs, to not accidentally access the wrong files cache;
     *       safe to use outside of runs
     */
    fileRef(file: string, importContext?: ImportContext): DataFile<InstanceType<TNode>> {
        if(isRelative(file)) {
            if(importContext?.resolveRelative) {
                file = importContext.resolveRelative(file)
            } else {
                // todo: here it would be helpful to get the parentId,
                //       which could be undefined for in-memory register without parents that exist in registers
                throw new ComputableError(`Relative file not supported for: ${JSON.stringify(file)}`)
            }
        }
        const sourceRefExisting = this.files.get(file)
        if(sourceRefExisting) return sourceRefExisting

        if(!this.importer) {
            throw new ComputableError(`No importer registered, can not reference file: ${JSON.stringify(file)}`)
        }

        const importer = this.importer.match(file)
        if(!importer) {
            throw new ComputableError(`No importer matched for file: ${JSON.stringify(file)}`)
        }

        const fileContext: FileResolveContext = importer.resolveFile(file)
        return this.newFile(file, fileContext)
    }

    register(
        id: string,
        objOrEval: unknown,
        importContext?: ImportContext,
    ): DataFile<InstanceType<TNode>> {
        const newFile = this.newFile(id, importContext)
        newFile.value = {current: objOrEval}
        newFile.node = this.parser.parse(objOrEval)

        return newFile
    }

    private newFile(id: string, importContext?: ImportContext): DataFile<InstanceType<TNode>> {
        if(this.files.has(id)) {
            throw new Error(`File already exists, can not overwrite ${id}`)
        }
        const dataFileRef = new DataFile<InstanceType<TNode>>(id, importContext)
        this.files.set(id, dataFileRef)
        return dataFileRef
    }

    async fetchFile(
        dataFile: DataFile<InstanceType<TNode>>,
        //runtimeContext: Pick<RuntimeContext, 'refs' | 'fileLoader' | 'fileLoaderListener'>,
        registry: DataFileRegistry<InstanceType<TNode>>,
        statsList: any[] = [],
        // onLoaded: () => TNode,
    ): Promise<unknown> {
        const dataRef = registry.refs.get(dataFile)
        const stats: any = {
            dur: 0,
            step: 'load',
            file: dataFile.fileId,
        }
        statsList.push(stats)
        if(dataRef?.value) {
            stats.cached = 2
            return dataRef.value.current
        }
        // when all other caches work correctly, this should never happen
        // if(dataRef && dataFile?.value) {
        //     stats.cached = 3
        //     dataRef.value = dataFile?.value
        //     return dataRef.value.current
        // }
        const cached = registry.fileLoader.get(dataFile)
        if(cached) {
            const start = timer.start()
            const r = await cached()
            stats.cached = 1
            stats.dur = timer.end(start)
            return r
        }

        const loader =
            dataFile.importContext && 'load' in dataFile.importContext && dataFile.importContext.load ?
                dataFile.importContext.load : undefined

        if(loader) {
            registry.fileLoader.set(dataFile, () => new Promise<unknown>((resolve, reject) => {
                let listener = registry.fileLoaderListener.get(dataFile)
                if(!listener) {
                    listener = []
                    registry.fileLoaderListener.set(dataFile, listener)
                }
                listener.push((result, err) => result ? resolve(result) : reject(err))
            }))

            const start = timer.start()

            try {
                const loaded = await loader()
                const dataRef = DataRef.withValue<InstanceType<TNode>>(dataFile, loaded)
                dataFile.value = dataRef.value
                registry.refs.set(dataFile, dataRef)
                registry.fileLoader.delete(dataFile)
                registry.fileLoaderListener.get(dataFile)?.forEach(l => l(dataRef.value?.current))
                registry.fileLoaderListener.delete(dataFile)
                stats.dur = timer.end(start)
                stats.cached = 0
                return dataRef.value?.current
            } catch(e) {
                registry.fileLoaderListener.get(dataFile)?.forEach(l => l(undefined, e))
                registry.fileLoaderListener.delete(dataFile)
                throw e
            }
        }

        throw new ComputableFetchError(dataFile, `File empty and without loader ${JSON.stringify(dataFile.fileId)}`)
    }

    run(
        dataFile: DataFile<InstanceType<TNode>>,
        context: unknown = {},
        // todo: combine baggage with this runtimeContext
        runtimeContext: RuntimeContext<InstanceType<TNode>> = {
            // todo: to support full temporary runs, without global cache,
            //       the fileRef must be reversed
            registry: new DataFileRegistry<InstanceType<TNode>>(
                this.fileRef.bind(this),
                [dataFile],
            ),
            fileEvals: new Map(),
            fileEvalsAwaiter: new Map(),
            fileListener: new Map(),
            usages: new Map(),
        },
        {
            filesChain = new Set(),
            nodesChain = new Set(),
            ...baggage
        }: {
            filesChain?: Set<DataFile<InstanceType<TNode>>>
            nodesChain?: Set<InstanceType<TNode>>
            abort?: AbortSignal
        } = {},
    ): Promise<[unknown, FileComputeStats, RuntimeContext<InstanceType<TNode>>]> {
        const computeStats: FileComputeStats = {
            step: 'computeFile',
            file: dataFile.fileId,
            stats: [],
            dur: 0,
            usages: new Map(),
        }
        const start = timer.start()

        if(filesChain.has(dataFile)) {
            throw new CircularFileDependencyError(
                filesChain, dataFile,
                `File import "${dataFile.fileId}" causes an import loop, not resolvable:\n\n` +
                Array
                    .from(filesChain)
                    .map((f, i) => (i + 1) + '. ' + JSON.stringify(f.fileId))
                    .join('\n'),
            )
        }

        const tryCached = (): Promise<[unknown, FileComputeStats, RuntimeContext<InstanceType<TNode>>]> | [unknown, FileComputeStats, RuntimeContext<InstanceType<TNode>>] | undefined => {
            const cached = runtimeContext.fileEvals.get(dataFile)
            if(cached) {
                if(typeof cached === 'function') {
                    return cached(filesChain, nodesChain)
                        .then((result) => {
                            computeStats.cached = 1
                            computeStats.dur = timer.end(start)
                            return [result, computeStats, runtimeContext]
                        })
                }
                computeStats.cached = 2
                computeStats.dur = timer.end(start)
                return [cached.result, computeStats, runtimeContext]
            }
            return undefined
        }
        const cachedRes = tryCached()
        if(cachedRes) return Promise.resolve(cachedRes)

        const lockFile = (lockingDataFile: DataFile, dataEvalNode: IDataNode) => {
            if(runtimeContext.fileEvals.has(lockingDataFile)) {
                throw new ComputableError(`Eval context corrupted, fileEval already defined for ${JSON.stringify(lockingDataFile.fileId)}`)
            }

            runtimeContext.fileEvals.set(lockingDataFile, (requestingFilesChain) => new Promise<unknown>((resolve, reject) => {
                const lockingEvalAwaiter = runtimeContext.fileEvalsAwaiter.get(lockingDataFile)
                for(const lastParentFile of requestingFilesChain) {
                    if(lockingEvalAwaiter?.has(lastParentFile)) {
                        reject(new CircularProcessingDependencyError(
                            lastParentFile, lockingDataFile,
                            `Circular file processing, target ${JSON.stringify(lockingDataFile.fileId)} already depends on ${JSON.stringify(lastParentFile.fileId)}`,
                        ))
                        return
                    }
                }

                if(requestingFilesChain?.has(lockingDataFile)) {
                    reject(new CircularFileDependencyError(requestingFilesChain, lockingDataFile, `requesting-circular XX-1 ${JSON.stringify(lockingDataFile.fileId)}\n\n`))
                    return
                }

                let listener = runtimeContext.fileListener.get(lockingDataFile)
                if(!listener) {
                    listener = []
                    runtimeContext.fileListener.set(lockingDataFile, listener)
                }
                listener.push((result, err) => {
                    // if(lastParentFile) fileAwaiter.delete(lastParentFile)
                    return err ? reject(err) : resolve(result)
                })
            }))

            return dataEvalNode
        }

        const runProcess = (dataEvalNode: InstanceType<TNode> | IDataNode) => {
            const p = runtime<InstanceType<TNode> | IDataNode, unknown, unknown, FileRuntimeBaggage<InstanceType<TNode>>>(
                dataEvalNode as InstanceType<TNode>,
                context,
                this.compute,
                this.processorOptions,
                {
                    nodesChain,
                    dataFile: dataFile,
                    ...baggage,
                    filesChain: new Set(filesChain).add(dataFile),
                    fileEngine: this,
                    computeStats: computeStats,
                    runtimeContext: runtimeContext,
                },
            )

            return p.compute().then(fileRes => {
                computeStats.stats.push(...p.stats)
                computeStats.dur = timer.end(start)
                computeStats.cached = 0
                return fileRes
            })
        }

        // todo: when .fileEvals is set, it must listen to all finishers and re-check caching,
        //       as multiple processors can currently come to `fetchFile`, leading to corrupted states
        const handleRelease = (prom: Promise<unknown>) => {
            return prom
                .then((result) => {
                    runtimeContext.fileEvals.set(dataFile, {result: result})
                    runtimeContext.fileListener.get(dataFile)?.forEach(l => l(result))
                    runtimeContext.fileListener.delete(dataFile)
                    return [result, computeStats, runtimeContext] as [unknown, FileComputeStats, RuntimeContext<InstanceType<TNode>>]
                })
                .catch((e) => {
                    runtimeContext.fileEvals.delete(dataFile)
                    runtimeContext.fileListener.get(dataFile)?.forEach(l => l(undefined, e))
                    runtimeContext.fileListener.delete(dataFile)
                    return Promise.reject(e)
                })
        }

        const dataRef = (() => {
            let dataRef = runtimeContext.registry.refs.get(dataFile)
            if(dataRef) {
                // dataRef.node ||= dataFile.node
                // dataRef.value ||= dataFile.value
                return dataRef
            }
            dataRef = new DataRef<InstanceType<TNode>>(dataFile)
            runtimeContext.registry.refs.set(dataFile, dataRef)
            return dataRef
        })()

        return (
            dataRef.node ?
                // this will always be in sync, thus doesn't need cache check
                handleRelease(runProcess(lockFile(dataFile, dataRef.node))) :
                this.fetchFile(dataFile, runtimeContext.registry, computeStats.stats)
                    .then((value) => {
                        // todo: maybe different tryCached for fetch and process, to not have deadlocks here?
                        const cachedRes = tryCached()
                        if(cachedRes) {
                            // console.log('after-fetch-cached', dataFile.fileId)
                            return cachedRes
                        }
                        // todo: parse must only be done when locked? or as sync just this hard check?
                        const statsParse: any = {
                            dur: 0,
                            step: 'parse',
                            file: dataFile.fileId,
                            cached: 1,
                        }
                        computeStats.stats.push(statsParse)
                        if(!dataRef.node) {
                            const startParse = timer.start()
                            dataRef.node = this.parser.parse(value)
                            dataFile.node = dataRef.node
                            statsParse.dur = timer.end(startParse)
                            statsParse.cached = 0
                        }
                        return handleRelease(runProcess(lockFile(dataFile, dataRef.node)))
                    })
        )
    }
}
