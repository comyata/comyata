import express from 'express'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { setupFileEngine } from './FileEngine/setupFileEngine.js'
import { bindHalt } from './Lib/bindHalt.js'
import { envIsTrue } from './Lib/envIsTrue.js'
import { corsMiddleware } from './Server/CorsMiddleware.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const commandArgs = () => yargs(hideBin(process.argv))
    .option('port', {
        alias: 'p',
        type: 'number',
        default: process.env.PORT ? Number(process.env.PORT) : 3000,
        demandOption: true,
    })
    .option('publicPath', {
        type: 'string',
        default: process.env.PUBLIC_PATH || '/',
        demandOption: true,
    })
    .option('dataFolder', {
        type: 'string',
        default: path.join(__dirname, '..', 'data'),
        demandOption: true,
    })
    .option('cors', {
        type: 'boolean',
        description: 'Enable cors middleware',
        default: envIsTrue(process.env.SERVE_CORS || 'yes'),
    })
    .option('halt-timeout', {
        alias: 'h',
        type: 'number',
        default: process.env.SERVER_HALT_TIMEOUT ? Number(process.env.SERVER_HALT_TIMEOUT) : 30000,
        demandOption: true,
    })

const opts = await commandArgs().parseAsync()

const onHalt = bindHalt(
    ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT'],
    false,
    true,
)

const app = express()
app.disable('x-powered-by')
app.disable('etag')

app.use(express.json({limit: '1.5mb'}))
app.use(express.urlencoded({extended: true}))

if(opts.cors) {
    app.use(opts.publicPath, corsMiddleware)
}

app.get(opts.publicPath, (_, res) => {
    res.send(`<!doctype html>
<html lang="en">
<div>
    <div style="margin-bottom: 16px">
        <h1>Comyata File Engine Server</h1>
        <p>Data folder: <code>${opts.dataFolder}</code></p>
    </div>

    <div style="display: flex; align-items: center; column-gap: 8px; margin-bottom: 8px">
        <h2 style="margin: 0">API Files</h2>
        <button onclick="loadApiFiles()">refresh</button>
    </div>

    <p>YAML files in <code>${path.join(opts.dataFolder, 'api')}</code> are available as API endpoints. Changes to a file clear its cache.</p>

    <ul id="api-files">
    </ul>

    <div style="display: flex; align-items: center; column-gap: 8px; margin-bottom: 16px">
        <h2 style="margin: 0">Cache</h2>
        <button onclick="clearCache()">clear cache</button>
    </div>

    <div style="display: flex; align-items: center; column-gap: 8px; margin-bottom: 8px">
        <h3 style="margin: 0">Cache Status</h3>
        <button onclick="loadCacheStatus()">refresh</button>
    </div>
    <p>Lists the files currently in the cache.</p>
    <pre id="cache-status"><code></code></pre>

    <div style="display: flex; align-items: center; column-gap: 8px; margin-bottom: 8px">
        <h3 style="margin: 0">Cache Changes</h3>
        <button onclick="loadCacheChanges()">refresh</button>
    </div>
    <p>Lists changes to the cache, a file is only added to the cache when it is used, on file changes it is deleted and only added again when used again.</p>
    <pre id="cache-changes"><code></code></pre>
</div>
<script type="application/javascript">
function loadCacheStatus() {
    fetch('${opts.publicPath}cache', {})
        .then((res) => res.json())
        .then((json) => {
            const elem = document.querySelector('#cache-status code')
            if(!elem) return
            elem.innerText = JSON.stringify(json, undefined, 4)
        })
}

function clearCache() {
    fetch('${opts.publicPath}cache/clear', {
        method: 'post'
    })
        .then(() => {
            loadCacheStatus()
            loadCacheChanges()
        })
}

function loadCacheChanges() {
    fetch('${opts.publicPath}cache/changes', {})
        .then((res) => res.json())
        .then((json) => {
            const elem = document.querySelector('#cache-changes code')
            if(!elem) return
            elem.innerText = JSON.stringify(json, undefined, 4)
        })
}

function loadApiFiles() {
    fetch('${opts.publicPath}api-files', {})
        .then((res) => res.json())
        .then(({files}) => {
            const ul = document.querySelector('#api-files')
            if(!ul) return
            while (ul.firstChild) {
                ul.lastChild.remove()
            }
            files.forEach(file=> {
                const li = document.createElement('li')
                const a = document.createElement('a')
                a.href = '${opts.publicPath}api/' + file.slice(0, -'.yaml'.length)
                a.innerText = file
                li.appendChild(a)
                ul.appendChild(li)
            })
        })
}

loadCacheStatus()
loadCacheChanges()
loadApiFiles()
</script>
</html>`)
})

const fileEngineRoutes = setupFileEngine({
    onHalt,
    dataFolder: opts.dataFolder,
    publicPath: opts.publicPath,
})

app.use(fileEngineRoutes)

const server = app.listen(opts.port, () => {
    console.log('server: listening on port ' + opts.port)
})

onHalt.push(function onServerHalt() {
    return new Promise<void>((resolve, reject) => {
        let done = false
        const timer = setTimeout(() => {
            done = true
            console.error('server: closing server timed out')
            resolve()
        }, opts.haltTimeout)

        server.close((err) => {
            if(done) {
                // as resolving, the server may still be closed while other things are closing
                if(err) {
                    console.error('server: closed with error', err)
                }
                return
            }
            done = true
            clearTimeout(timer)
            if(err) {
                console.error('server: closed with error', err)
                reject(err)
                return
            }
            resolve()
        })
    })
})
