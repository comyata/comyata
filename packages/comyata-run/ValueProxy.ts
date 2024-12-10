import { IDataNode } from '@comyata/run/DataNode'
import { CircularNodeDependencyError } from '@comyata/run/Errors'
import { NodeRuntimeBaggageComplete } from '@comyata/run/Runtime'
import { ValueSubscriberPromise } from '@comyata/run/ValueSubscriberPromise'
import jsonpointer from 'json-pointer'

const PROXY_FLAG = Symbol('ProxyFlag')
const PROXY_VALUE = Symbol('ProxyValue')

/**
 * @todo verify behaviour with arrays, especially for `arr.slice(0, 2)` and similar
 *       e.g. this expression doesn't resolve the second entry:
 *       `l: [1, "${1+1}", 3, "${$root().l[[0..1]]}"]` => `{ "l": [1, 2, 3, [1, {}] ] }`
 *       (which may be that jsonata doesn't support Promise resolving in range-query)
 * @todo this doesn't work if the whole object is accessed, doesn't prevent recursion if accessing a parent object which contains computed fields;
 *       to support that, a tree/graph must be build, which allows checking where computed fields are included and tracking the path during recursive proxy creation
 *       e.g. this doesn't fail but creates a cyclic reference: `{ a: "${$root().b}", b: { b1: "${$root().a}" } }`
 *       but it could be detected:
 *       `a` > `b`
 *       `b.b1` > `a` > `b`
 * @todo support adding to usages graph for transparent reporting on what uses what (interop with `addUsage` of DataFile)
 * @experimental
 */
export function createValueProxy<TData = unknown>(
    data: TData,
    dataNode: IDataNode,
    getNodeContext: NodeRuntimeBaggageComplete<IDataNode>['getNodeContext'],
    path: (string | number)[] = [],
): TData {
    if(data instanceof ValueSubscriberPromise) {
        // check against the dataNode in subscriber promise if it's a circular loop.
        // it must iterate over all dependents and check the whole chain against occurrence of the dataNode
        // in dependencies of the new dependency of `dataNode`.

        // todo: include information about the respective chains for better errors?
        const open = [dataNode]
        while(open.length) {
            const uncheckedDataNode = open.pop()!
            const nodeValue = getNodeContext(uncheckedDataNode)?.[1]() as ValueSubscriberPromise<unknown>
            if(
                dataNode === data.dataNode()
                || nodeValue.hasDependent(data.dataNode())
            ) {
                throw new CircularNodeDependencyError(
                    new Set([uncheckedDataNode]),
                    data.dataNode(),
                    `Circular dependency between data-nodes ${JSON.stringify(jsonpointer.compile(uncheckedDataNode.path as string[]))} and ${JSON.stringify(jsonpointer.compile(data.dataNode().path as string[]))}.`,
                )
            }
            open.push(...nodeValue.getDependents())
        }

        data.addDependent(dataNode)
        return new Promise<TData>((resolve, reject) => {
            data
                .then((value) => {
                    resolve(createValueProxy(value, dataNode, getNodeContext, path))
                })
                .catch(reject)
        }) as TData
    }

    if(data === null || typeof data !== 'object') {
        return data
    }

    return new Proxy(data, {
        get: (target, prop) => {
            // if(typeof prop === 'string' && !['constructor', 'tagName', 'nodeType', 'hasAttribute', 'toJSON', 'sequence', 'then', '_jsonata_lambda'].includes(prop) && !prop.startsWith('@@') && !prop.startsWith('$$')) {
            //     console.log(
            //         'prop',
            //         prop,
            //         path,
            //         dataNode.path,
            //         // e.g. for array `[...arr]`
            //         // prop === Symbol.iterator,
            //         Reflect.get(target, prop) instanceof ValueSubscriberPromise,
            //     )
            // }
            if(prop === PROXY_VALUE) {
                return target
            }
            if(
                // todo: self reference does no longer fail, as it won't reach creating nested proxy
                isSameBranch(path, dataNode.path)
                // `prop` is a `string`, also for arrays, while `.path` has `number`
                && String(dataNode.path[dataNode.path.length - 1]) === prop
            ) {
                // self ref
                return null
            }

            const value = Reflect.get(target, prop)
            if(value !== null && typeof value === 'object' && typeof prop !== 'symbol') {
                return createValueProxy(value, dataNode, getNodeContext, [...path, prop])
            }

            return value
        },
        set: (_target, prop) => {
            throw new TypeError(`Value is readonly, can not set ${String(prop)}`)
        },
        ownKeys: (target) => {
            return Reflect.ownKeys(target)
        },
        has: (target, prop) => {
            return Reflect.has(target, prop)
        },
        getPrototypeOf: () => {
            return {[PROXY_FLAG]: true}
        },
    })
}

function isSameBranch(
    path: (string | number)[],
    dataNodePath: (string | number)[],
) {
    if(path.length !== dataNodePath.length - 1) {
        return false
    }

    for(let i = 0; i < path.length; i++) {
        const a = path[i]
        const b = dataNodePath[i]
        // `path` may be purely from `props`, thus would be an `string` for array indexes,
        // but could also be initialized with a `dataNode.path`, which has `number` for indexes,
        // while `dataNodePath` always will be `number|string`
        if(String(a) !== String(b)) return false
        // if(a !== b) return false
    }

    return true
}

export function isProxy(proxy: unknown): proxy is typeof Proxy {
    return Boolean(proxy && typeof proxy === 'object' && Object.getPrototypeOf(proxy)[PROXY_FLAG] === true)
}

export function toRaw(proxy: typeof Proxy) {
    return proxy[PROXY_VALUE]
}
