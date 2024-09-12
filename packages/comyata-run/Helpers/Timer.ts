export const timer = {
    start: () => {
        if(typeof process === 'undefined' || typeof process.hrtime !== 'function') {
            return new Date().getTime()
        }
        return process.hrtime()
    },
    end: (start: number | [number, number]): number => {
        if(typeof start === 'number') {
            return new Date().getTime() - start
        }
        const elapsedTimeExpr = process.hrtime(start)
        return parseInt(((elapsedTimeExpr[0] * 1e9 + elapsedTimeExpr[1]) / 1e6).toFixed(0))
    },
}
