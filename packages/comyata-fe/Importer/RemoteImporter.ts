import { convert, GenericConvert, GenericConverter } from '@comyata/fe/Converter'
import { Resolver } from '@comyata/fe/FileEngine'
import { extname } from '@comyata/fe/Helpers/extname'
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
    const importerId = 'remote'
    const convertDefault = converterDefault ||= (value) => yaml.parse(value)

    const resolveContextWithRelative: Resolver['resolveDirectory'] = (baseUrl: string) => {
        const base = new URL(baseUrl)
        const baseNormalized = base.origin + base.pathname
        // (base.pathname.endsWith('/') ?
        //     base.pathname :
        //     base.pathname + '/')
        return {
            importer: importerId,
            resolveRelative: (relPath) => {
                return new URL(relPath, baseNormalized).href
            },
        }
    }

    const resolveContext: Resolver['resolveDirectory'] =
        noRelativeResolve
            ? () => ({importer: importerId})
            : resolveContextWithRelative

    const resolveFileContext: Resolver['resolveFile'] = (fileUrl) => {
        const uri = new URL(fileUrl)
        return {
            load: async() => await fetch(fileUrl)
                .then(b => {
                    return b.status >= 200 && b.status < 400 ?
                        b.text().then(t => ({text: t, contentType: b.headers.get('content-type')})) :
                        b.text().then(t => Promise.reject({text: t, contentType: b.headers.get('content-type')}))
                })
                .then(b => {
                    const contentTypeInfo = b.contentType?.split(';')
                    return convert(
                        converter, convertDefault,
                        {
                            ext: extname(uri.pathname).toLowerCase(),
                            mime: contentTypeInfo?.[0],
                            url: fileUrl,
                        },
                    )(b.text, contentTypeInfo?.[1])
                }),
            ...resolveContext(fileUrl),
        }
    }

    return {
        id: importerId,
        // todo: support adding url bases via scopes??
        scopes: ['http://', 'https://'],
        resolveDirectory: resolveContext,
        resolveFile: resolveFileContext,
    }
}
