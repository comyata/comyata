import express from 'express'

export function corsMiddleware(_req: express.Request, res: express.Response, next: () => void) {
    // using a custom cors middleware, as the `express.cors` isn't CDN compatible (doesn't send headers when not needed)
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET, PUT, PATCH, POST, DELETE, HEAD, OPTIONS')
    res.header('Access-Control-Allow-Headers', [
        'Content-Type',
        'Cache-Control',
        'Origin',
        'Accept',
        'Authorization',
        'Audience',
        'X-Cloud-Trace-Context',
        'X-Performance',
    ].join(', '))
    res.header('Access-Control-Expose-Headers', [
        'X-Cloud-Trace-Context',
        'X-Trace-Id',
        'X-Lb-Id',
        'X-Performance',
    ].join(', '))

    next()
}
