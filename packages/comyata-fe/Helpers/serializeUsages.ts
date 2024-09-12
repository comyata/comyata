import { RuntimeContext } from '@comyata/fe/FileEngine'
import jsonpointer from 'json-pointer'

export const serializeUsages = (usages: RuntimeContext['usages']) => {
    const usedFiles = {}
    for(const [loadedFile, usedInFiles] of usages.entries()) {
        const usedFilesToNodes = usedFiles[loadedFile.fileId] = {}
        for(const [parentFile, usedInNodes] of usedInFiles.entries()) {
            const usedInFile = usedFilesToNodes[parentFile.fileId] = [] as string[]
            for(const node of usedInNodes) {
                usedInFile.push(jsonpointer.compile(node.path as string[]))
            }
        }
    }
    return usedFiles
}