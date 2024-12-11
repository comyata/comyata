export type GenericConvert = (value: string, mimeParameters?: string) => Promise<unknown> | unknown

/**
 * Map of converters, assign for file extensions and mimetypes the used converter.
 */
export type GenericConverter = {
    [extensionOrMime: string]: GenericConvert
}

export const convert = (
    converter: GenericConverter | undefined,
    converterDefault: GenericConvert,
    file: {
        url: string
        ext?: string
        mime?: string
    },
): GenericConvert => {
    return converter && (
        file?.ext ? converter[file.ext] :
            file?.mime ? converter[file.mime] : converterDefault
    ) || converterDefault
}
