import { convert, GenericConvert, GenericConverter } from '@comyata/fe/Converter'
import { Resolver } from '@comyata/fe/FileEngine'
import { extname } from '@comyata/fe/Helpers/extname'
import fs from 'node:fs'
import path from 'node:path'
import util from 'node:util'
import url from 'node:url'
import yaml from 'yaml'

export const fileImporter = (
    {
        basePath, converter, converterDefault,
        readFile = util.promisify(fs.readFile),
    }: {
        basePath: string
        converter?: GenericConverter
        converterDefault?: GenericConvert
        readFile?: (path: fs.PathOrFileDescriptor) => Promise<Buffer>
    },
): Resolver => {
    const importerId = 'file'
    const convertDefault = converterDefault ||= (value) => yaml.parse(value)

    const resolveContext: Resolver['resolveDirectory'] = (dir: string) => {
        const absPath = url.fileURLToPath(dir)
        const relPath = path.relative(basePath, absPath)
        if(relPath.startsWith('../') || relPath.startsWith('..\\')) {
            throw new Error(`File import ${JSON.stringify(dir)} not relative to ${JSON.stringify(basePath)}`)
        }
        return {
            importer: importerId,
            resolveRelative: (relPath: string) => url.pathToFileURL(path.join(absPath, relPath)).href,
        }
    }

    const resolveFileContext: Resolver['resolveFile'] = (fileUrl: string) => {
        const filePath = url.fileURLToPath(fileUrl)
        const relPath = path.relative(basePath, filePath)
        if(relPath.startsWith('../') || relPath.startsWith('..\\')) {
            throw new Error(`File import ${JSON.stringify(fileUrl)} not relative to ${JSON.stringify(basePath)}`)
        }
        return {
            load: () => {
                return readFile(filePath)
                    .then(b =>
                        convert(
                            converter, convertDefault,
                            {
                                ext: extname(relPath).toLowerCase(),
                                url: fileUrl,
                            },
                        )(b.toString()),
                    )
            },
            ...resolveContext(url.pathToFileURL(path.dirname(filePath)).href),
        }
    }

    return {
        id: importerId,
        // todo: add base path to file scope??
        scopes: ['file://'],
        resolveDirectory: resolveContext,
        resolveFile: resolveFileContext,
    }
}
