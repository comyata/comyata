import { Resolver } from '@comyata/fe/FileEngine'
import { it, describe, expect } from '@jest/globals'
import { Importers } from '@comyata/fe/Importers'

// npm run tdd -- --selectProjects=test-@comyata/fe
// npm run tdd -- --selectProjects=test-@comyata/fe --testPathPattern=/Importers.test

describe('Importers', () => {
    it('matches most specific', async() => {
        const importers = new Importers()
            .use({
                id: 'http',
                scopes: ['http://'],
            } as Resolver)
            .use({
                id: 'http-example-org',
                scopes: ['http://example.org'],
            } as Resolver)

        expect(importers.match('http://')?.id).toBe('http')
        expect(importers.match('http://example.com')?.id).toBe('http')
        expect(importers.match('http://example.org')?.id).toBe('http-example-org')
        expect(importers.match('http://example.org/api/ping')?.id).toBe('http-example-org')
    })

    it('overwrite conflicting scope', async() => {
        const importers = new Importers()
            .use({
                id: 'http1',
                scopes: ['http://'],
            } as Resolver)
            .use({
                id: 'http2',
                scopes: ['http://'],
            } as Resolver)

        expect(importers.match('http://')?.id).toBe('http2')
    })

    it('no match', async() => {
        const importers = new Importers()
            .use({
                id: 'http',
                scopes: ['http://'],
            } as Resolver)

        expect(importers.match('ftp://')).toBe(null)
    })

    it('non uri match', async() => {
        const importers = new Importers()
            .use({
                id: 'http',
                scopes: ['http://'],
            } as Resolver)
            .use({
                id: 'kv',
                scopes: ['kv/'],
            } as Resolver)

        expect(importers.match('http://example.org')?.id).toBe('http')
        expect(importers.match('kv')).toBe(null)
        expect(importers.match('kv/a')?.id).toBe('kv')
    })
})
