export type OnHaltHandler = ((signal: string) => Promise<void>)[]

const now = () => {
    const date = new Date()
    return date.getUTCHours().toFixed(0).padStart(2, '0') + ':' +
        date.getUTCMinutes().toFixed(0).padStart(2, '0') + ':' +
        date.getUTCSeconds().toFixed(0).padStart(2, '0')
}

let halting = false
export const handleHalt = (
    onHalt: OnHaltHandler,
    debugShutdown?: boolean,
) => async function handleShutdown(signal: string) {
    if(halting) return
    halting = true
    // first close the server, e.g. so no new connections can be created
    console.debug(now() + ' [' + signal + '] ' + 'halt (' + onHalt.length + ')')
    // copy to be able to remove them inside themself without affecting the loop
    const onHaltCopy = onHalt.slice()

    let hasError = false
    for(const onCloseServer of onHaltCopy) {
        try {
            if(debugShutdown) {
                console.debug(now() + ' [' + signal + '] ' + 'halting: ' + onCloseServer.name)
            }
            await onCloseServer(signal)
            if(debugShutdown) {
                console.debug(now() + ' [' + signal + '] ' + 'halted', onCloseServer.name)
            }
        } catch(e) {
            hasError = true
            console.error(now() + ' [' + signal + '] ' + 'halt failed', onCloseServer.name, e)
        }
    }

    console.debug(now() + ' [' + signal + '] ' + 'fully shutdown')
    // then exit gracefully
    process.exit(hasError ? 81 : 0)
}

export const bindHalt = (
    signals: string[],
    debugShutdown = false,
    allowForceQuit = true,
) => {
    // todo: make this maybe as a class and include the shutdown there to be able to easily use it in server or cli
    const abort = new AbortController()
    const onHalt: OnHaltHandler & { signal: AbortSignal } = new class extends Array {
        signal = abort.signal
    }
    const registerShutdown = (event: string) => {
        process.on(event, () => {
            if(abort.signal.aborted) {
                if(!allowForceQuit) {
                    console.debug(now() + ' [' + event + '] process termination signal - disabled force quit, ignoring')
                    return
                }
                console.debug(now() + ' [' + event + '] process termination signal - force quit')
                process.exit(1)
            }
            console.debug(now() + ' [' + event + '] process termination signal')
            abort.abort()
            handleHalt(onHalt, debugShutdown)(event)
                .then(() => {
                    // noop
                })
        })
    }

    signals.forEach(registerShutdown)

    return onHalt
}
