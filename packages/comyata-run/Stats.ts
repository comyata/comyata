export interface ExprEvalStats {
    /**
     * List of each import directly inside the pointer,
     * with all other imports in hierarchical order.
     */
    imports: FileEvalStats[]
    /**
     * All files imported at this pointer
     */
    files: Set<string>
    dur: number
    totalExpressions: number
}

export interface FileEvalStats {
    file: string
    dur: number
    expressions: number
    totalExpressions: number
    /**
     * Files and in which expression pointers the file is used
     */
    files: Map<string, Set<string>>
    /**
     * For each expression in this file the detailed evaluation stats.
     * The key is the current json-pointer of where the expression was defined in this file.
     */
    evaluated: Map<string, ExprEvalStats>
}

export const walkStats = (
    fileEvalStats: FileEvalStats,
    parents: [sourcePointer: string, fileEvalStats: FileEvalStats][] = [],
) => {
    let lines: string[] = []
    lines.push(`evaluated file ${JSON.stringify(fileEvalStats.file)} with ${fileEvalStats.files.size} imports and ${fileEvalStats.totalExpressions} expressions in ${fileEvalStats.dur}ms`)
    if(parents.length) {
        lines.push(`  import chain: ${parents.map(([p, ps]) => JSON.stringify(`${ps.file}#${p}`)).join(' ⮞ ')} ⮞ .`)
    }
    // keeping file stats belonging together in the same output, first print only the own file expr stats
    for(const [exprPointer, exprStats] of fileEvalStats.evaluated.entries()) {
        lines.push(`  expression at ${JSON.stringify(exprPointer)} with ${exprStats.imports.length} imports and ${exprStats.totalExpressions} expressions was evaluated in ${exprStats.dur}ms`)
    }
    // then print stats for all import by each expr
    for(const [exprPointer, exprStats] of fileEvalStats.evaluated.entries()) {
        if(exprStats.imports.length) {
            exprStats.imports.forEach((importEvalStats) => {
                lines = lines.concat(
                    walkStats(importEvalStats, [...parents, [exprPointer, fileEvalStats]]),
                )
            })
        }
    }
    return lines
}
