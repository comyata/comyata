import { convert, GenericConvert, GenericConverter } from '@comyata/fe/Converter'
import { Resolver } from '@comyata/fe/FileEngine'
import fs from 'fs'
import path from 'node:path'
import util from 'node:util'
import url from 'url'
import yaml from 'yaml'

const readFile = util.promisify(fs.readFile)

export const fileImporter = (
    {
        basePath, converter, converterDefault,
    }: {
        basePath: string
        converter?: GenericConverter
        converterDefault?: GenericConvert
    },
): Resolver => {
    const convertDefault = converterDefault ||= yaml.parse

    const resolveContext: Resolver['resolveDirectory'] = (dir: string) => {
        const absPath = url.fileURLToPath(dir)
        const relPath = path.relative(basePath, absPath)
        if(relPath.startsWith('../') || relPath.startsWith('..\\')) {
            throw new Error(`File import ${JSON.stringify(dir)} not relative to ${JSON.stringify(basePath)}`)
        }
        return {
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
                                ext: path.extname(relPath).toLowerCase(),
                                url: fileUrl,
                            },
                        )(b.toString()),
                    )
            },
            ...resolveContext(url.pathToFileURL(path.dirname(filePath)).href),
        }
    }
    return {
        id: 'file',
        scopes: ['file://'],
        resolveDirectory: resolveContext,
        resolveFile: resolveFileContext,
    }
}
