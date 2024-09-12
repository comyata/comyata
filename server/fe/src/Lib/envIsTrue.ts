export const envIsTrue = (value: string | undefined | null | number | boolean): boolean | undefined => {
    if(typeof value === 'string') {
        value = value?.toLowerCase()
    }
    return typeof value === 'undefined' || value === null ? undefined :
        typeof value === 'boolean' ? value :
            Boolean(
                value === 'on' ||
                value === '1' ||
                value === 'true' ||
                value === 'yes' ||
                (typeof value === 'number' && value >= 1),
            )
}
