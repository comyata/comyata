import { IDataNode } from '@comyata/run/DataNode'

export const walkNode = (rootNode: IDataNode, path: (string | number)[]) => {
    let currentNode: IDataNode = rootNode
    for(const segment of path) {
        const c = currentNode.children
        if(c) {
            const nextNode = c.get(segment)
            if(nextNode) {
                currentNode = nextNode
            } else {
                // todo: if previous nodes just don't exist, return a resolver function
                throw new Error(`No DataNode for ${JSON.stringify(path)}`)
            }
        }
    }
    return currentNode
}
