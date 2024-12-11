import { CircularFileDependencyError } from '@comyata/fe/Errors'
import { FileComputeFn } from '@comyata/fe/FileEngine'
import { DataFile } from '@comyata/fe/DataFile'
import { CircularNodeDependencyError } from '@comyata/run/Errors'
import { IDataNode } from '@comyata/run/DataNode'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import yaml from 'yaml'

export const fileEngineJsonata: (
    globalBindings?: (...computeParams: Parameters<FileComputeFn<DataNodeJSONata>>) => {
        [name: string]: any
    },
) => FileComputeFn<DataNodeJSONata> = (
    globalBindings,
) => (
    dataNode, context, parentData,
    runtimeBaggage,
) => {
    const {
        dataFile, filesChain,
        fileEngine, nodesChain,
        computeStats,
        stats: nodeComputeStats,
        runtimeContext: runtime,
        ...baggage
    } = runtimeBaggage
    const addUsage = (df: DataFile, dn: IDataNode) => {
        // todo: separate usages from stats, that's global runtime resulting state!
        //       but not globally, so not on DataNode, while fileLoaders should even be global! that's where the classes can be split
        let fileUsages = runtime.usages.get(df)
        if(!fileUsages) {
            fileUsages = new Map()
            runtime.usages.set(df, fileUsages)
        }
        let fileUsagesAt = fileUsages.get(dataFile)
        if(!fileUsagesAt) {
            fileUsagesAt = new Set()
            fileUsages.set(dataFile, fileUsagesAt)
        }
        fileUsagesAt.add(dn)
    }
    const addStatsUsage = (df: DataFile, dn: IDataNode) => {
        let fileUsages = computeStats.usages?.get(df)
        if(!fileUsages) {
            fileUsages = new Set()
            computeStats.usages?.set(df, fileUsages)
        }
        fileUsages.add(dn)
    }
    const getAwaiter = () => {
        let fileAwaiter = runtime.fileEvalsAwaiter.get(dataFile)
        if(!fileAwaiter) {
            fileAwaiter = new Set()
            runtime.fileEvalsAwaiter.set(dataFile, fileAwaiter)
        }
        return fileAwaiter
    }

    const bindings = {
        // todo: move the DataNode generic out?
        self: () => parentData[0],
        parent: () => parentData.slice(1),
        root: () => parentData[parentData.length - 1],
        // todo: move the generic function to browser/node/universal modules
        // todo: support functions at then/otherwise
        when: (condition: unknown, then: unknown, otherwise: unknown = undefined) => condition ? then : otherwise,
        // todo: simple functions or using converter?
        toYAML: (value: unknown) => yaml.stringify(value, {indent: 4, lineWidth: 0, minContentWidth: 0}),
        fromYAML: (text: string) => yaml.parse(text),

        // todo: add some util for filepath-to-uri? removed as it is importer specific (and Node.js only)
        // p: {
        //     resolve: (pathOrUrl: string) => isRelative(pathOrUrl) ? dataFile.importContext?.resolveRelative?.(pathOrUrl) : pathOrUrl,
        //     // todo: find a browser compatible version, the new URL doesn't work for windows paths correctly
        //     fromUrl: (urlStr: string) => url.fileURLToPath(urlStr),
        //     toUrl: (pathStr: string) => url.pathToFileURL(pathStr),
        //     // fromUrl: (urlStr: string) => new URL(urlStr).pathname,
        //     // toUrl: (pathStr: string) => new URL(pathStr, 'file://'),
        // },

        // support overwriting anything except those used for loading and processing files
        ...globalBindings?.(dataNode, context, parentData, runtimeBaggage) || {},

        // todo: importer and loader may be separate things, as importer requires more contextual control,
        //       while a loader only wants de-duplication
        // todo: loader and importer can be separate, the $importer must support checking circular-resolving,
        //       while a loader only wants de-duplication
        //       and like redis other control like get/hget/hgetall/json.get/json.mget/ft.search
        load: async(file: unknown) => {
            if(typeof file !== 'string') throw new Error('$load requires as string as file')
            // todo: these fileRef must work on the once-cached runtime-context first
            // const fileRef = fileEngine.fileRef(file, dataFile.importContext)
            const fileRef = runtime.registry.fileRef(file, dataFile.importContext)
            // todo: enable verbose/warnings for this kind of loads
            // if(fileRef === dataFile) console.debug(`circular LOAD: file loads itself ${JSON.stringify(fileRef.fileId)}`)
            // if(filesChain.has(fileRef)) console.debug(`circular LOAD: files load each other ${JSON.stringify(fileRef.fileId)}`)
            // if(parentNodes.has(dataNode)) console.debug(`circular LOAD: data-node already in processing chain ${JSON.stringify(fileRef.fileId)} ${jsonpointer.compile(dataNode.path as string[])}`)
            addUsage(fileRef, dataNode)
            addStatsUsage(fileRef, dataNode)
            return fileEngine.fetchFile(fileRef, runtime.registry, nodeComputeStats.stats)
        },
        import: async(file: unknown) => {
            if(typeof file !== 'string') throw new Error('$import requires as string as file')
            // todo: these fileRef must work on the once-cached runtime-context first
            // const fileRef = fileEngine.fileRef(file, dataFile.importContext)
            const fileRef = runtime.registry.fileRef(file, dataFile.importContext)
            if(fileRef === dataFile) // this check is also included in the next check
                throw new CircularFileDependencyError(filesChain, dataFile, `circular import: file loads itself ${JSON.stringify(fileRef.fileId)}`)
            if(filesChain.has(fileRef)) // checking the to-be-imported file to never even go further when circular on file level
                throw new CircularFileDependencyError(filesChain, dataFile, `circular import: files load each other ${JSON.stringify(fileRef.fileId)}`)
            if(fileRef?.node && nodesChain.has(fileRef.node)) // checking against self-referencing nodes
                throw new CircularNodeDependencyError(nodesChain, dataNode, `circular import: data-node already in processing chain ${JSON.stringify(fileRef.fileId)} ${JSON.stringify(dataNode.path as string[])}`)
            addUsage(fileRef, dataNode)
            addStatsUsage(fileRef, dataNode)
            getAwaiter().add(fileRef)
            const [r2, computeStats2] = await fileEngine.run(
                fileRef, context,
                runtime,
                {
                    filesChain,
                    nodesChain,
                    ...baggage,
                },
            )
            nodeComputeStats.stats.push(computeStats2)
            computeStats2.usages?.forEach((_u, k) => addUsage(k, dataNode))
            return r2
        },
        process: async(file: unknown, objOrEval: any) => {
            if(typeof file !== 'string') throw new Error('$process requires as string as file')
            // const fileRef = fileEngine.fileRef(file, dataFile.importContext)
            const fileRef = runtime.registry.fileRef(file, dataFile.importContext)
            if(fileRef === dataFile)
                throw new CircularFileDependencyError(filesChain, dataFile, `circular process: file loads itself ${JSON.stringify(fileRef.fileId)}`)
            if(filesChain.has(fileRef))
                throw new CircularFileDependencyError(filesChain, dataFile, `circular process: files load each other ${JSON.stringify(fileRef.fileId)}`)
            // if(nodesChain.has(dataNode))
            if(fileRef?.node && nodesChain.has(fileRef.node))
                throw new CircularNodeDependencyError(nodesChain, dataNode, `circular process: data-node already in processing chain ${JSON.stringify(fileRef.fileId)} ${JSON.stringify(dataNode.path as string[])}`)
            addUsage(fileRef, dataNode)
            getAwaiter().add(fileRef)
            const [r2, computeStats2] = await fileEngine.run(
                fileRef, objOrEval,
                {
                    registry: runtime.registry,
                    usages: runtime.usages,
                    // abort: abort,
                    fileEvals: new Map(),
                    fileEvalsAwaiter: new Map(),
                    fileListener: new Map(),
                },
                {
                    // nested proceedings can try to evaluate an object which again leads to circular loops
                    filesChain,
                    nodesChain,
                    ...baggage,
                },
            )
            nodeComputeStats.stats.push(computeStats2)
            computeStats2.usages?.forEach((_u, k) => addUsage(k, dataNode))
            return r2
        },
    }

    return dataNode.expr.evaluate(
        context,
        bindings,
    )
}

export const jsonataFns = {}
