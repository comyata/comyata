import { convert, GenericConvert, GenericConverter } from '@comyata/fe/Converter'
import { Resolver } from '@comyata/fe/FileEngine'
import path from 'node:path'
import yaml from 'yaml'


export const remoteImporter = (
    {
        converter, converterDefault,
        noRelativeResolve,
    }: {
        converter?: GenericConverter
        converterDefault?: GenericConvert
        noRelativeResolve?: boolean
    } = {},
): Resolver => {
    const convertDefault = converterDefault ||= yaml.parse

    const resolveContextWithRelative: Resolver['resolveDirectory'] = (baseUrl: string) => {
        const base = new URL(baseUrl)
        const baseNormalized = base.origin + base.pathname
        // (base.pathname.endsWith('/') ?
        //     base.pathname :
        //     base.pathname + '/')
        return {
            resolveRelative: (relPath) => {
                return new URL(relPath, baseNormalized).href
            },
        }
    }

    const resolveContext: Resolver['resolveDirectory'] = noRelativeResolve ? () => ({}) : resolveContextWithRelative

    const resolveFileContext: Resolver['resolveFile'] = (fileUrl) => {
        return {
            load: async() => await fetch(fileUrl)
                .then(b => {
                    return b.status >= 200 && b.status < 400 ?
                        b.text().then(t => ({text: t, contentType: b.headers.get('content-type')})) :
                        b.text().then(t => Promise.reject({text: t, contentType: b.headers.get('content-type')}))
                })
                .then(b => {
                    return convert(
                        converter, convertDefault,
                        {
                            ext: path.extname(fileUrl).toLowerCase(),
                            mime: b.contentType || undefined,
                            url: fileUrl,
                        },
                    )(b.text)
                }),
            ...resolveContext(fileUrl),
        }
    }

    return {
        id: 'remote',
        scopes: ['http://', 'https://'],
        resolveDirectory: resolveContext,
        resolveFile: resolveFileContext,
    }
}
