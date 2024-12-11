import { IDataNode } from '@comyata/run/DataNode'

/**
 * @internal
 */
export class ValueSubscriberPromise<T> extends Promise<T> {
    readonly dataNode: () => IDataNode
    #dependents: Set<IDataNode> = new Set()
    #subscribers: ((result: T, err?: any) => void)[]
    #result: undefined | { error?: any, value?: any } = undefined

    constructor(
        subscribers: ((result: T, err?: any) => void)[],
        dataNode: IDataNode,
    ) {
        super((resolve) => {
            // throwing here may lead to uncaught errors in react but not nodejs somehow,
            // in react it is only used to know when to show progress loaders in e.g. JSONView, but not awaited
            // as anything which tries to listen, will receive rejects below and the actual exception is handled at another position,
            // it should be best and safe to just set to undefined on errors
            subscribers.push((nodeResult, err) => {
                this.#result = err ? {error: err} : {value: nodeResult}
                resolve((err ? undefined : nodeResult) as any)
            })
        })
        this.#subscribers = subscribers
        this.dataNode = () => dataNode
    }

    addDependent(n: IDataNode) {
        this.#dependents.add(n)
    }

    hasDependent(n: IDataNode) {
        return this.#dependents.has(n)
    }

    getDependents() {
        return Array.from(this.#dependents)
    }

    then<TResult1 = T, TResult2 = never>(
        onfulfilled?: ((value: T) => (PromiseLike<TResult1> | TResult1)) | undefined | null,
        onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null,
    ): Promise<TResult1 | TResult2> {
        if(this.#result) {
            return (this.#result.error ? Promise.reject(this.#result.error) : Promise.resolve(this.#result.value))
                .then(onfulfilled, onrejected)
        }
        return new Promise<T>((resolve, reject) => {
            this.#subscribers.push((result, err) => {
                if(err) {
                    reject(err)
                    return
                }
                resolve(result)
            })
        })
            .then(onfulfilled, onrejected)
    }

    catch<TResult = never>(onrejected?: ((reason: any) => (PromiseLike<TResult> | TResult)) | undefined | null): Promise<T | TResult> {
        if(this.#result) {
            return (this.#result.error ? Promise.reject(this.#result.error) : Promise.resolve(this.#result.value))
                .catch(onrejected)
        }
        return new Promise<T>((resolve, reject) => {
            this.#subscribers.push((result, err) => {
                if(err) {
                    reject(err)
                    return
                }
                resolve(result)
            })
        })
            .catch(onrejected)
    }
}
