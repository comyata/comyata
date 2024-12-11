import { DataFile } from '@comyata/fe/DataFile'
import { DataNode, IDataNode } from '@comyata/run/DataNode'
import { ImportContext } from '@comyata/fe/FileEngine'

export class DataRef<TNode extends IDataNode> {
    file?: DataFile
    /**
     * The parsed data to use for computing.
     */
    node?: TNode | IDataNode
    /**
     * The loaded data value to use for parsing.
     */
    value?: { current: unknown }

    constructor(
        file: DataRef<TNode>['file'],
    ) {
        this.file = file
        this.value = file?.value
        this.node = file?.node
    }

    static withValue<TNode extends DataNode>(
        file: DataRef<TNode>['file'],
        value: unknown,
    ) {
        const ref = new DataRef<TNode>(file)
        ref.value = {current: value}
        return ref
    }
}

export class DataFileRegistry<TNode extends IDataNode> {
    readonly files: Map<string, DataFile<TNode>> = new Map()
    refs: Map<DataFile<TNode>, DataRef<TNode>> = new Map()
    fileLoader: Map<DataFile<TNode>, () => Promise<unknown>> = new Map()
    fileLoaderListener: Map<DataFile<TNode>, ((fileValue: unknown, err?: any) => void)[]> = new Map()
    private readonly resolveFile: (id: string, importContext?: ImportContext) => DataFile<TNode>

    constructor(
        // onFileAdded,
        // onFileUsed,
        // onFileLoaded
        resolveFile: DataFileRegistry<TNode>['resolveFile'],
        initialFiles?: DataFile<TNode>[],
    ) {
        this.resolveFile = resolveFile
        this.files = new Map(initialFiles?.map(f => [f.fileId, f]))
    }

    fileRef(fileUrl: string, importContext?: ImportContext): DataFile<TNode> {
        let fileRef = this.files.get(fileUrl)
        if(fileRef) return fileRef
        // todo: call here fileRef from fileEngine or
        //       mv logic here and only update the global state through some "on file added" hook from here?
        fileRef = this.resolveFile(fileUrl, importContext)
        this.files.set(fileUrl, fileRef)
        return fileRef
    }
}
