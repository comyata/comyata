import { FileComputeStats } from '@comyata/fe/FileEngine'
import jsonpointer from 'json-pointer'

export const usagesToObject = (fileComputeStats: FileComputeStats) => {
    if(!fileComputeStats.usages?.size) return null
    const usages: { [fileId: string]: string[] } = {}
    for(const [file, nodes] of fileComputeStats.usages.entries()) {
        usages[file.fileId] = Array.from(nodes).map(node => jsonpointer.compile(node.path as string[]))
    }

    return usages
}

export const usagesToDependencies = (
    fileComputeStats: FileComputeStats,
    collectedUsages: {
        [fileIdContainer: string]: { [fileId: string]: string[] }
    } = {},
) => {
    const fileUsages = usagesToObject(fileComputeStats)
    if(fileUsages) {
        collectedUsages[fileComputeStats.file] = fileUsages
    }
    const statsList = fileComputeStats.stats.slice(0)
    while(statsList.length) {
        const statsEntry = statsList.shift()!
        if(statsEntry.step === 'computeFile') {
            collectedUsages = usagesToDependencies(statsEntry as any, collectedUsages)
        } else if('stats' in statsEntry) {
            statsList.push(...statsEntry.stats as any[])
        }
    }
    return collectedUsages
}
