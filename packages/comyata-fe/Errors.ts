import { DataFile } from '@comyata/fe/DataFile'
import { ComputableError } from '@comyata/run/Errors'

export class ComputableFetchError extends Error {
    target: DataFile

    constructor(target: DataFile, message?: string) {
        super(message)
        this.target = target
    }
}

export class CircularProcessingDependencyError extends ComputableError {
    parent: DataFile
    target: DataFile

    constructor(parent: DataFile, target: DataFile, message?: string) {
        super(message)
        this.parent = parent
        this.target = target
    }
}

export class CircularFileDependencyError extends ComputableError {
    parents: Set<DataFile>
    target: DataFile

    constructor(parents: Set<DataFile>, target: DataFile, message?: string) {
        super(message)
        this.parents = parents
        this.target = target
    }
}
