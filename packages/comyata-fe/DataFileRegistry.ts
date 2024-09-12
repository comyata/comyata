import { DataFile } from '@comyata/fe/DataFile'
import { IDataNode } from '@comyata/run/DataNode'
import { DataRef, ImportContext } from '@comyata/fe/FileEngine'

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
