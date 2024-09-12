import { IDataNode } from '@comyata/run/DataNode'

export class ComputableError extends Error {
}

export class NodeParserError extends ComputableError {
    targetPath: (string | number)[]
    parent: IDataNode | undefined
    originalError?: Error | unknown

    constructor(
        targetPath: (string | number)[],
        parent: IDataNode | undefined,
        message?: string,
        originalError?: Error | unknown,
    ) {
        super(message)
        this.targetPath = targetPath
        this.parent = parent
        this.originalError = originalError
    }
}

export class NodeComputeError extends ComputableError {
    target: IDataNode | undefined
    originalError?: Error | unknown

    constructor(
        target: IDataNode,
        message?: string,
        originalError?: Error | unknown,
    ) {
        super(message)
        this.target = target
        this.originalError = originalError
    }
}

export class CircularNodeDependencyError extends ComputableError {
    parents: Set<IDataNode>
    target: IDataNode

    constructor(parents: Set<IDataNode>, target: IDataNode, message?: string) {
        super(message)
        this.parents = parents
        this.target = target
    }
}