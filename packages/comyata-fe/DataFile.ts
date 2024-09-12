import { IDataNode } from '@comyata/run/DataNode'
import { ImportContext } from '@comyata/fe/FileEngine'

export class DataFile<TNode extends IDataNode = IDataNode> {
    /**
     * The parsed data to use for computing.
     */
    node?: TNode | IDataNode
    /**
     * The loaded data value to use for parsing.
     * used as global cache, while dataRef will get populated from here
     */
    value?: { current: unknown }
    fileId: string
    importContext?: ImportContext

    constructor(
        fileId: string,
        importContext?: ImportContext,
    ) {
        this.fileId = fileId
        this.importContext = importContext
    }
}
