import { NodeComputeError } from '@comyata/run/Errors'
import { it, expect, describe } from '@jest/globals'
import { DataNodeJSONata, UnresolvedJSONataExpression } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { ComputeFn, runtime } from '@comyata/run/Runtime'

// npm run tdd -- --selectProjects=test-@comyata/run
// npm run tdd -- --selectProjects=test-@comyata/run --testPathPattern=Runtime-CrossResolving.test

describe('Runtime-CrossResolving', () => {
    const jsonataCompute: ComputeFn<DataNodeJSONata> = (computedNode, context, parentData) => {
        return computedNode.expr.evaluate(
            context,
            {
                self: () => parentData[0],
                parent: () => parentData.slice(1),
                root: () => parentData[parentData.length - 1],
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
        // todo: nothing implemented to prevent dead locks
        // {
        //     name: 'dependency circular - enable cross-resolve w/ sleep 500ms',
        //     template: {
        //         name: 'Surfboard',
        //         price: 70.25,
        //         tag: '${"color-" & $self().color}',
        //         color: '${ $sleep(500) ? "blue" & $self().tag : "" }',
        //     },
        //     expected: {
        //         ...expectedOutput,
        //         tag: 'color-blue',
        //     },
        //     options: {
        //         __unsafeAllowCrossResolving: true,
        //     },
        // },
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
})
