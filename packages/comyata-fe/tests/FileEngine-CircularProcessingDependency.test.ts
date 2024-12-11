import { CircularProcessingDependencyError } from '@comyata/fe/Errors'
import { NodeComputeError } from '@comyata/run/Errors'
import { it, expect, describe } from '@jest/globals'
import { FileEngine } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=FileEngine-CircularProcessingDependency.test

describe('CircularProcessingDependencyError', () => {
    it('FileEngine concurrent circular (in-memory)', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
        })
        // concurrent evaluations with circular loops, which isn't detected through fileChain,
        // but knowing which file already depends on another, as fileChain would be too late and already cause a deadlock.
        //
        // if `A` + `B` are started, both will be parsed and evaluated,
        // only when either one of them would be finished, it would go further and the loop would be detected by `fileChain`,
        // which is impossible due to internal deduplication and waiting that one of them finished.
        //
        // (assumed order/unpredictable)
        // `A` will first try to import `B`, which succeeds, thus `A` will wait for `B`
        // yet `B` will also try to import `A`, as `A` already waits for `B` it must cause both to fail.

        // `documentC` > `documentA` + `documentB`
        // `documentA` > `documentB` > `documentA`
        // `documentB` > `documentA` > `documentB`
        fileEngine.register('documentA', {
            title: 'D-A',
            'b': '${$import("documentB").title}',
        })
        fileEngine.register('documentB', {
            title: 'D-B',
            'a': '${$import("documentA").title}',
        })
        const dataFileC = fileEngine.register('documentC', {
            title: 'D-C',
            'c_a': '${$import("documentA").title}',
            'c_b': '${$import("documentB").title}',
        })

        const run = fileEngine.run(dataFileC, {})
        await expect(run).rejects.toThrow('Multiple failures during compute, 2 nodes failed.')
        // todo: improve errors to include file references, atm. not possible for `NodeComputeError` from `/run`
        await expect(run).rejects.toMatchObject({
            errors: [
                new Error(
                    `Compute failure at "/c_b" with "$".
Compute failure at "/a" with "$".
Circular file processing, target "documentA" already depends on "documentB"`,
                ),
                new Error(
                    `Compute failure at "/c_a" with "$".
Compute failure at "/b" with "$".
Compute failure at "/a" with "$".
Circular file processing, target "documentA" already depends on "documentB"`,
                ),
            ],
        })
        await run.catch((error) => {
            expect(error.errors[0]).toBeInstanceOf(NodeComputeError)
            expect(error.errors[0].originalError).toBeInstanceOf(NodeComputeError)
            expect(error.errors[0].originalError.originalError).toBeInstanceOf(CircularProcessingDependencyError)
            expect(error.errors[1]).toBeInstanceOf(NodeComputeError)
            expect(error.errors[1].originalError).toBeInstanceOf(NodeComputeError)
            expect(error.errors[1].originalError.originalError).toBeInstanceOf(NodeComputeError)
            expect(error.errors[1].originalError.originalError.originalError).toBeInstanceOf(CircularProcessingDependencyError)
        })
    })

    it('FileEngine concurrent circular indirect (in-memory)', async() => {
        const fileEngine = new FileEngine({
            nodes: [DataNodeJSONata],
            compute: {[DataNodeJSONata.engine]: fileEngineJsonata()},
        })

        // `documentC` > `documentA` + `documentB`
        // `documentA` > `documentX` > `documentB` > `documentA`
        fileEngine.register('documentA', {
            title: 'D-A',
            'x': '${$import("documentX").title}',
        })
        fileEngine.register('documentX', {
            title: 'D-X',
            'b': '${$import("documentB").title}',
        })
        fileEngine.register('documentB', {
            title: 'D-B',
            'a': '${$import("documentA").title}',
        })
        const dataFileC = fileEngine.register('documentC', {
            title: 'D-C',
            'c_a': '${$import("documentA").title}',
            'c_b': '${$import("documentB").title}',
        })

        const run = fileEngine.run(dataFileC, {})
        await expect(run).rejects.toThrow('Multiple failures during compute, 2 nodes failed.')
        await expect(run).rejects.toMatchObject({
            errors: [
                new Error(
                    `Compute failure at "/c_a" with "$".
Compute failure at "/x" with "$".
Compute failure at "/b" with "$".
Circular file processing, target "documentB" already depends on "documentA"`,
                ),
                new Error(
                    `Compute failure at "/c_b" with "$".
Compute failure at "/a" with "$".
Compute failure at "/x" with "$".
Compute failure at "/b" with "$".
Circular file processing, target "documentB" already depends on "documentA"`,
                ),
            ],
        })
    })
})
