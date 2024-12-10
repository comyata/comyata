import { NodeComputeError } from '@comyata/run/Errors'
import { createValueProxy, isProxy } from '@comyata/run/ValueProxy'
import { ValueSubscriberPromise } from '@comyata/run/ValueSubscriberPromise'
import { it, expect, describe } from '@jest/globals'
import { DataNodeJSONata, UnresolvedJSONataExpression } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { ComputeFn, runtime } from '@comyata/run/Runtime'

// npm run tdd -- --selectProjects=test-@comyata/run
// npm run tdd -- --selectProjects=test-@comyata/run --testPathPattern=Runtime-CrossResolving.test

describe('Runtime-CrossResolving', () => {
    const jsonataCompute: ComputeFn<DataNodeJSONata> = (computedNode, context, parentData, {getNodeContext}) => {
        return computedNode.expr.evaluate(
            context,
            {
                // todo: rethink how to provide access to data
                //       - especially `$parent()` is complex and not nice for proxy handling
                //       - having multiple ways adds more complexity
                //       - having multiple ways makes it easy to miss adding needed proxies
                self: () => createValueProxy(parentData[0], computedNode, getNodeContext, computedNode.path.slice(0, -1)),
                root: () => createValueProxy(parentData[parentData.length - 1], computedNode, getNodeContext),
                // self: () => parentData[0],
                // parent: () => parentData.slice(1),
                // root: () => parentData[parentData.length - 1],
                sleep: (timeout?: number) =>
                    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), timeout || 50)),
            },
        )
    }

    // note: using a string-concat, as this doesn't throw - like arithmetic does if it's not a number
    const templateDependencyBefore = {
        name: 'Surfboard',
        price: 70.25,
        color: '${ "blue" }',
        tag: '${"color-" & $self().color}',
    }

    const templateDependencyAfter = {
        name: 'Surfboard',
        price: 70.25,
        tag: '${"color-" & $self().color}',
        color: '${ "blue" }',
    }

    // note: using sleep to force that the dependency can't be computed when the dependent property is computed
    const templateDependencyBeforeSleep = {
        name: 'Surfboard',
        price: 70.25,
        color: '${ $sleep() ? "blue" : "" }',
        tag: '${"color-" & $self().color}',
    }

    const templateDependencyAfterSleep = {
        name: 'Surfboard',
        price: 70.25,
        tag: '${"color-" & $self().color}',
        color: '${ $sleep() ? "blue" : "" }',
    }

    const templateDependencyBeforeSleep500 = {
        name: 'Surfboard',
        price: 70.25,
        color: '${ $sleep(500) ? "blue" : "" }',
        tag: '${"color-" & $self().color}',
    }

    const templateDependencyAfterSleep500 = {
        name: 'Surfboard',
        price: 70.25,
        tag: '${"color-" & $self().color}',
        color: '${ $sleep(500) ? "blue" : "" }',
    }

    const expectedOutput = {
        'name': 'Surfboard',
        'price': 70.25,
        tag: undefined,
        color: 'blue',
    }

    it.each([
        {
            name: 'dependencyBefore - disabled cross-resolve',
            template: templateDependencyBefore,
            expected: {
                ...expectedOutput,
                tag: 'color-{}',// `{}` means it tried to concat with the `UnresolvedPromise` error
            },
            options: {
                __unsafeAllowCrossResolving: false,
            },
        },
        {
            name: 'dependencyAfter - disabled cross-resolve',
            template: templateDependencyAfter,
            expected: {
                ...expectedOutput,
                tag: 'color-{}',
            },
            options: {
                __unsafeAllowCrossResolving: false,
            },
        },
        {
            name: 'dependencyBefore - enable cross-resolve',
            template: templateDependencyBefore,
            expected: {
                ...expectedOutput,
                tag: 'color-blue',
            },
            options: {
                __unsafeAllowCrossResolving: true,
            },
        },
        {
            name: 'dependencyAfter - enable cross-resolve',
            template: templateDependencyAfter,
            expected: {
                ...expectedOutput,
                tag: 'color-blue',
            },
            options: {
                __unsafeAllowCrossResolving: true,
            },
        },
        {
            name: 'dependencyBefore - disabled cross-resolve w/ sleep',
            template: templateDependencyBeforeSleep,
            expected: {
                ...expectedOutput,
                tag: 'color-{}',
            },
            options: {
                __unsafeAllowCrossResolving: false,
            },
        },
        {
            name: 'dependencyAfter - disabled cross-resolve w/ sleep',
            template: templateDependencyAfterSleep,
            expected: {
                ...expectedOutput,
                tag: 'color-{}',
            },
            options: {
                __unsafeAllowCrossResolving: false,
            },
        },
        {
            name: 'dependencyBefore - enable cross-resolve w/ sleep',
            template: templateDependencyBeforeSleep,
            expected: {
                ...expectedOutput,
                tag: 'color-blue',
            },
            options: {
                __unsafeAllowCrossResolving: true,
            },
        },
        {
            name: 'dependencyAfter - enable cross-resolve w/ sleep',
            template: templateDependencyAfterSleep,
            expected: {
                ...expectedOutput,
                tag: 'color-blue',
            },
            options: {
                __unsafeAllowCrossResolving: true,
            },
        },
        {
            name: 'dependencyBefore - enable cross-resolve w/ sleep 500ms',
            template: templateDependencyBeforeSleep500,
            expected: {
                ...expectedOutput,
                tag: 'color-blue',
            },
            options: {
                __unsafeAllowCrossResolving: true,
            },
        },
        {
            name: 'dependencyAfter - enable cross-resolve w/ sleep 500ms',
            template: templateDependencyAfterSleep500,
            expected: {
                ...expectedOutput,
                tag: 'color-blue',
            },
            options: {
                __unsafeAllowCrossResolving: true,
            },
        },
    ])(
        '$# $name',
        async(testCase) => {
            const dataNode = new Parser([DataNodeJSONata]).parse(testCase.template)

            const runner = runtime(
                dataNode,
                {basePercentage: 2},
                {[DataNodeJSONata.engine]: jsonataCompute},
                testCase.options,
            )

            expect(runner.output()).toStrictEqual({
                name: 'Surfboard',
                price: 70.25,
                tag: new UnresolvedJSONataExpression(),
                color: new UnresolvedJSONataExpression(),
            })
            try {
                await runner.compute()
            } catch(e) {
                console.error('compute failure', e)
                expect(false).toBe(true)
            }

            expect(runner.output()).toStrictEqual(testCase.expected)
        },
    )

    it(
        'exception - single',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                name: 'Surfboard',
                price: 70.25,
                tag: '${$self().color ? $error("custom error") : null}',
                color: '${ $sleep(50) ? "blue" : "" }',
            })

            const runner = runtime(
                dataNode,
                {basePercentage: 2},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            expect(runner.output()).toStrictEqual({
                name: 'Surfboard',
                price: 70.25,
                tag: new UnresolvedJSONataExpression(),
                color: new UnresolvedJSONataExpression(),
            })

            await expect(runner.compute()).rejects.toThrow(new Error('Compute failure at "/tag" with "$".\ncustom error'))
            expect((runner.output() as any)?.tag.message).toBe('Compute failure at "/tag" with "$".\ncustom error')
            expect((runner.output() as any)?.tag).toBeInstanceOf(NodeComputeError)
            expect((runner.output() as any)?.color).toBe('blue')
        },
    )

    it(
        // testing ValuePromise rejects via cached deferred `then`
        'exception - multiple deferred',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                name: 'Surfboard',
                price: 70.25,
                color: '${ $sleep(50) ? $error("custom error") : "" }',
                tag: '${ $self().color }',
            })

            const runner = runtime(
                dataNode,
                {basePercentage: 2},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            expect(runner.output()).toStrictEqual({
                name: 'Surfboard',
                price: 70.25,
                tag: new UnresolvedJSONataExpression(),
                color: new UnresolvedJSONataExpression(),
            })

            const error = new Error(
                'Multiple failures during compute, 2 nodes failed.',
            )
            await expect(runner.compute()).rejects.toThrow(error)
            expect((runner.output() as any)?.tag.message).toBe('Compute failure at "/tag" with "$".\nCompute failure at "/color" with "$".\ncustom error')
            expect((runner.output() as any)?.tag).toBeInstanceOf(NodeComputeError)
            expect((runner.output() as any)?.color.message).toBe('Compute failure at "/color" with "$".\ncustom error')
            expect((runner.output() as any)?.color).toBeInstanceOf(NodeComputeError)
        },
    )

    it(
        // testing ValuePromise rejects via cached `this.result.error`
        'exception - multiple cached',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                name: 'Surfboard',
                price: 70.25,
                color: '${ $error("custom error") }',
                tag: '${ $sleep(50) ? $self().color : null }',
            })

            const runner = runtime(
                dataNode,
                {basePercentage: 2},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            expect(runner.output()).toStrictEqual({
                name: 'Surfboard',
                price: 70.25,
                tag: new UnresolvedJSONataExpression(),
                color: new UnresolvedJSONataExpression(),
            })

            const error = new Error(
                'Multiple failures during compute, 2 nodes failed.',
            )
            await expect(runner.compute()).rejects.toThrow(error)
            expect((runner.output() as any)?.tag.message).toBe('Compute failure at "/tag" with "$".\nCompute failure at "/color" with "$".\ncustom error')
            expect((runner.output() as any)?.tag).toBeInstanceOf(NodeComputeError)
            expect((runner.output() as any)?.color.message).toBe('Compute failure at "/color" with "$".\ncustom error')
            expect((runner.output() as any)?.color).toBeInstanceOf(NodeComputeError)
        },
    )

    it(
        'exception - single, manual',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                tag: '${$self().color ? $error("custom error") : null}',
                color: '${ $sleep(50) ? "blue" : "" }',
            })

            const runner = runtime(
                dataNode,
                {basePercentage: 2},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            expect(runner.output()).toStrictEqual({
                tag: new UnresolvedJSONataExpression(),
                color: new UnresolvedJSONataExpression(),
            })

            const pCompute = runner.compute()

            // the promises can only be accessed after starting `.compute`
            const dataNodeTag = runner.getValue(dataNode.children!.get('tag')!)
            const dataNodeColor = runner.getValue(dataNode.children!.get('color')!)
            expect(dataNodeTag).toBeInstanceOf(ValueSubscriberPromise)
            expect(dataNodeColor).toBeInstanceOf(ValueSubscriberPromise)

            const pTag = (dataNodeTag as ValueSubscriberPromise<any>).catch(() => 'caught')
            const pColor = (dataNodeColor as ValueSubscriberPromise<any>).catch(() => 'caught')

            await expect(pCompute).rejects.toThrow(new Error('Compute failure at "/tag" with "$".\ncustom error'))

            await expect(pTag).resolves.toBe('caught')
            await expect((dataNodeTag as ValueSubscriberPromise<any>).catch(() => 'caught')).resolves.toBe('caught')

            await expect(pColor).resolves.toBe('blue')
            await expect((dataNodeColor as ValueSubscriberPromise<any>).catch(() => 'caught')).resolves.toBe('blue')

            expect((runner.output() as any)?.tag.message).toBe('Compute failure at "/tag" with "$".\ncustom error')
            expect((runner.output() as any)?.tag).toBeInstanceOf(NodeComputeError)
            expect((runner.output() as any)?.color).toBe('blue')
        },
    )

    it(
        'exception - circular nodeDependency, direct',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                // `tag` > `color` > `tag`
                tag: '${"color-" & $self().color}',
                color: '${ "blue" & $self().tag }',
            })

            const runner = runtime(
                dataNode,
                {},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            await expect(runner.compute()).rejects.toThrow('Multiple failures during compute, 2 nodes failed.')
            // todo: improve that the error messages are not combined endlessly
            // todo: improve error messages
            expect((runner.output() as any)?.tag.message).toBe('Compute failure at "/tag" with "$".\nCompute failure at "/color" with "$".\nCircular dependency between data-nodes "/color" and "/tag".')
            expect((runner.output() as any)?.tag).toBeInstanceOf(NodeComputeError)
            // expect((runner.output() as any)?.tag).toBeInstanceOf(CircularNodeDependencyError)
            expect((runner.output() as any)?.color.message).toBe('Compute failure at "/color" with "$".\nCircular dependency between data-nodes "/color" and "/tag".')
            expect((runner.output() as any)?.color).toBeInstanceOf(NodeComputeError)
            // expect((runner.output() as any)?.color).toBeInstanceOf(CircularNodeDependencyError)
        },
    )

    it(
        'exception - circular nodeDependency, indirect',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                // `tag` > `color` > `material` > `tag`
                tag: '${"color-" & $self().color}',
                color: '${"blue-" & $self().material}',
                material: '${"fiber-" & $self().tag}',
            })

            const runner = runtime(
                dataNode,
                {},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            await expect(runner.compute()).rejects.toThrow('Multiple failures during compute, 3 nodes failed.')
            // todo: improve that the error messages are not combined endlessly
            // todo: improve error messages
            expect((runner.output() as any)?.tag.message).toBe('Compute failure at "/tag" with "$".\nCompute failure at "/color" with "$".\nCompute failure at "/material" with "$".\nCircular dependency between data-nodes "/color" and "/tag".')
            expect((runner.output() as any)?.tag).toBeInstanceOf(NodeComputeError)
            // expect((runner.output() as any)?.tag).toBeInstanceOf(CircularNodeDependencyError)
            expect((runner.output() as any)?.color.message).toBe('Compute failure at "/color" with "$".\nCompute failure at "/material" with "$".\nCircular dependency between data-nodes "/color" and "/tag".')
            expect((runner.output() as any)?.color).toBeInstanceOf(NodeComputeError)
            // expect((runner.output() as any)?.color).toBeInstanceOf(CircularNodeDependencyError)
            expect((runner.output() as any)?.material.message).toBe('Compute failure at "/material" with "$".\nCircular dependency between data-nodes "/color" and "/tag".')
            expect((runner.output() as any)?.material).toBeInstanceOf(NodeComputeError)
            // expect((runner.output() as any)?.material).toBeInstanceOf(CircularNodeDependencyError)
        },
    )

    it(
        'exception - circular nodeDependency, recursion on self',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                // `tag` > `tag`
                tag: '${$self().tag}',
            })

            const runner = runtime(
                dataNode,
                {},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            await runner.compute()
            // due to omitting own key, self-references are `null` atm. and not throwing exceptions
            expect((runner.output() as any)?.tag).toBe(null)
            // await expect(runner.compute()).rejects.toThrow('Compute failure at "/tag" with "$".\nCircular dependency between data-nodes "/tag" and "/tag".')
            // // todo: improve error messages
            // expect((runner.output() as any)?.tag.message).toBe('Compute failure at "/tag" with "$".\nCircular dependency between data-nodes "/tag" and "/tag".')
            // expect((runner.output() as any)?.tag).toBeInstanceOf(NodeComputeError)
            // expect((runner.output() as any)?.tag).toBeInstanceOf(CircularNodeDependencyError)
        },
    )

    it(
        'reference in nested, with same property on computed field and dependency',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                y: {
                    a: 1,
                    z: '${"ab" & "c"}',
                },
                x: {
                    c: 2,
                    z: '${$root().y.z}',
                },
            })

            const runner = runtime(
                dataNode,
                {},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            await runner.compute()
            expect(runner.output()).toStrictEqual({
                y: {
                    a: 1,
                    z: 'abc',
                },
                x: {
                    c: 2,
                    z: 'abc',
                },
            })
        },
    )

    it(
        'reference in nested, circular on property level',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                y: {
                    a: 1,
                    b: '${$root().x.d}',
                },
                x: {
                    c: 2,
                    d: '${$root().y.b}',
                },
            })

            const runner = runtime(
                dataNode,
                {},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            await expect(runner.compute()).rejects.toThrow('Multiple failures during compute, 2 nodes failed.')
        },
    )

    it(
        'circular in root level',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse('${$root()}')

            const runner = runtime(
                dataNode,
                {},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            await expect(runner.compute()).rejects.toThrow('Compute failure at "" with "$".\nCircular dependency between data-nodes "" and "".')
        },
    )

    it(
        'circular on object level',
        async() => {
            const dataNode = new Parser([DataNodeJSONata]).parse({
                // a: '${$self()}',
                // b: '${$self()}',
                a: '${$root()}',
                b: '${$root()}',
                // x: 123,
            })

            const runner = runtime(
                dataNode,
                {},
                {[DataNodeJSONata.engine]: jsonataCompute},
                {__unsafeAllowCrossResolving: true},
            )

            await runner.compute()
            const output = runner.output() as any
            expect(output.a === output.b).toBe(true)
        },
    )

    // todo: support tracking object level dependencies for detecting references like these:
    // it(
    //     'circular over object level',
    //     async() => {
    //         const dataNode = new Parser([DataNodeJSONata]).parse({
    //             a: '${$root().b}',
    //             b: {b1: '${$root().a}'},
    //         })
    //
    //         const runner = runtime(
    //             dataNode,
    //             {},
    //             {[DataNodeJSONata.engine]: jsonataCompute},
    //             {__unsafeAllowCrossResolving: true},
    //         )
    //
    //         await runner.compute()
    //         const output = runner.output() as any
    //         // expect(output.a === output.b).toBe(true)
    //     },
    // )

    it('createValueProxy prototype', () => {
        expect(isProxy(createValueProxy({}, undefined as any, undefined as any))).toBe(true)
    })

    it('createValueProxy readonly', () => {
        expect(() => createValueProxy({x: false}, undefined as any, undefined as any).x = true).toThrow('Value is readonly, can not set x')
    })
})
