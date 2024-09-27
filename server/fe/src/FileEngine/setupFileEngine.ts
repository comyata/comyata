import { GenericConverter } from '@comyata/fe/Converter'
import { FileEngine } from '@comyata/fe/FileEngine'
import { fileEngineJsonata } from '@comyata/fe/FileEngineJsonata'
import { serializeUsages } from '@comyata/fe/Helpers/serializeUsages'
import { fileImporter } from '@comyata/fe/Importer/FileImporter'
import { remoteImporter } from '@comyata/fe/Importer/RemoteImporter'
import { Importers } from '@comyata/fe/Importers'
import { DataNodeJSONata, DataNodeJSONataEscaped } from '@comyata/run/DataNodeJSONata'
import express from 'express'
import { nanoid } from 'nanoid'
import path from 'node:path'
import url from 'node:url'
import fs from 'node:fs/promises'
import yaml from 'yaml'
import { parse } from 'csv-parse'
import { OnHaltHandler } from '../Lib/bindHalt.js'
import { Watcher } from '../Lib/Watcher.js'

const csvSeekDelimFirstLine = (csv: string) => {
    let delim: string | undefined
    for(const char of csv) {
        if(char === ',') {
            delim = ','
            break
        }
        if(char === '\t') {
            delim = '\t'
            break
        }
        if(char === ';') {
            delim = ';'
            break
        }
        if(char === '\n') {
            break
        }
    }
    return delim
}

const converter = {
    '.yml': (rawText) => yaml.parse(rawText),
    '.yaml': (rawText) => yaml.parse(rawText),
    '.csv': (rawText) => new Promise((resolve, reject) => {
        const delim = csvSeekDelimFirstLine(rawText)
        if(!delim) return undefined
        parse(
            rawText,
            {
                columns: true,
                comment: '#',
                delimiter: delim,
                cast: true,
            },
            (err, records) => {
                if(err) {
                    return reject(err)
                }
                resolve(records)
            },
        )
    }),
} satisfies GenericConverter

export const setupFileEngine = (
    {
        onHalt,
        dataFolder,
        publicPath,
    }: {
        onHalt: OnHaltHandler
        dataFolder: string
        publicPath: string
    },
) => {
    const fileEngine = new FileEngine({
        nodes: [DataNodeJSONata, DataNodeJSONataEscaped],
        compute: {
            [DataNodeJSONata.engine]: fileEngineJsonata(() => ({
                // specify custom functions for JSONata,
                // e.g. use like: ${ $hello() }
                hello: () => 'world',
            })),
        },
        importer: new Importers()
            .use(fileImporter({
                basePath: dataFolder,
                converter: converter,
            }))
            .use(remoteImporter({
                converter: converter,
            })),
    })

    const watcherComyata = Watcher()
    watcherComyata.add(dataFolder)
    watcherComyata.watch((change) => {
        const importUrl = url.pathToFileURL(change.path).href
        const deleted = fileEngine.files.delete(importUrl)
        if(deleted) console.debug(`${new Date().toISOString()} files-cached cleared ${JSON.stringify(importUrl)}`)
    })

    onHalt.push(async function onHaltWatcher() {
        await watcherComyata.close()
    })

    const router = express.Router()

    router.get(
        `${publicPath}cache`,
        async(_req, res) => {
            res.status(200).send({
                size: fileEngine.files.size,
                files: Array.from(fileEngine.files.entries()).map(([fileId, file]) => {
                    if(!file) throw new Error()
                    return {
                        file: fileId,
                        hasValue: Boolean(file.value),
                        isParsed: Boolean(file.node),
                        isLoadable: Boolean(file.importContext && 'load' in file.importContext && file.importContext.load),
                        canResolveRelative: Boolean(file.importContext?.resolveRelative),
                        canCreateRelativeResolver: Boolean(file.importContext && 'resolveDirectory' in file.importContext && file.importContext.resolveDirectory),
                    }
                }),
            })
        },
    )

    router.post(
        `${publicPath}cache/clear`,
        async(_req, res) => {
            const keys = Array.from(fileEngine.files.keys())
            fileEngine.files.clear()
            res.status(200).send({cleared: keys})
        },
    )

    const changes: any[] = []
    fileEngine.files.onAdd((fileId) => changes.push({id: nanoid(), change: 'add', ts: Date.now(), file: fileId}))
    fileEngine.files.onDelete((fileId) => changes.push({id: nanoid(), change: 'delete', ts: Date.now(), file: fileId}))

    router.get(
        `${publicPath}cache/changes`,
        async(_req, res) => {
            res.status(200).send({
                changes: changes,
            })
        },
    )

    const apiFolder = path.join(dataFolder, 'api')

    router.get(
        `${publicPath}api-files`,
        async(_req, res) => {
            const folderContent = await fs.readdir(apiFolder)
            res.send({
                files: folderContent.filter(f => f.endsWith('.yaml')),
            })
        },
    )

    router.get(
        `${publicPath}api/:apiFile`,
        async(req, res) => {
            const context = {
                query: req.query,
                body: req.body,
            }
            const importUrl = url.pathToFileURL(path.join(apiFolder, req.params.apiFile + '.yaml')).href
            const dataRef = fileEngine.fileRef(importUrl)
            try {

                const result = await fileEngine.run(dataRef, context)
                    .then(([o, s, rc]) => {
                        return {
                            output: o,
                            stats: s,
                            usages: serializeUsages(rc.usages),
                        }
                    })

                res
                    .status(200)
                    .setHeader('Content-Type', 'application/json')
                    // Beautified JSON output for better DX, such as in CodeSandbox examples.
                    .send(JSON.stringify(result, undefined, 4))
            } catch(e) {
                if(e instanceof Error && e.message.startsWith('ENOENT:')) {
                    res.status(404).send({
                        error: 'File not found',
                    })
                } else {
                    res.status(501).send({
                        error: 'Fatal Error in compute.',
                        details: e instanceof Error ? e.message : e,
                    })
                }
            }
        },
    )

    return router
}
