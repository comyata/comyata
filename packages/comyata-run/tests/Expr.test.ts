import { toExpr } from '@comyata/run/Expr'
import { it, expect, describe } from '@jest/globals'

// npm run tdd -- --selectProjects=test-@comyata/run
// npm run tdd -- --selectProjects=test-@comyata/run --testPathPattern=Expr.test

describe('Expr', () => {
    const mockDataContext = {
        name: 'Surfboard',
        tags: ['sports', 'surfing'],
        selection: {
            amount: 1,
            price: 70.25,
        },
        fastShipping: null,
        exclusive: true,
    }

    it('repeat', async() => {
        expect(await toExpr('$repeat("A", 3)').evaluate({}, {})).toBe('AAA')
    })

    it('toJSON', async() => {
        expect(await toExpr('$toJSON($.data)').evaluate({data: mockDataContext}, {})).toBe(JSON.stringify(mockDataContext))
    })

    it('fromJSON', async() => {
        expect(await toExpr('$fromJSON($.data)').evaluate({data: JSON.stringify(mockDataContext)}, {})).toStrictEqual(mockDataContext)
    })

    it('isNaN - true', async() => {
        expect(await toExpr('$isNaN("A")').evaluate({}, {})).toBe(true)
    })
    it('isNaN - true - NaN', async() => {
        expect(await toExpr('$isNaN($.nan)').evaluate({nan: Number.NaN}, {})).toBe(true)
    })

    it('isNaN - false - number', async() => {
        expect(await toExpr('$isNaN(12)').evaluate({}, {})).toBe(false)
    })
    it('isNaN - false - string', async() => {
        expect(await toExpr('$isNaN("12")').evaluate({}, {})).toBe(false)
    })

    it('coalesce', async() => {
        expect(await toExpr('$coalesce(null, 1, 2)').evaluate({}, {})).toBe(1)
        expect(await toExpr('$coalesce(1, null, 2)').evaluate({}, {})).toBe(1)
    })

    it('some', async() => {
        expect(await toExpr('$some([1, 2, 3, 101, 200, 201], function($v) {$v > 100})').evaluate({}, {})).toBe(true)
        expect(await toExpr('$some([1, $cb(2), $cb(3), $cb(101), $cb(200), 201], function($v) {$v > 100} )').evaluate({}, {cb: async(v: any) => v})).toBe(true)

        expect(await toExpr('$some([1, 2, 3, 101, 200, 201], function($v) {$v > 300})').evaluate({}, {})).toBe(false)
        expect(await toExpr('$some([1, $cb(2), $cb(3), $cb(101), $cb(200), 201], function($v) {$v > 300} )').evaluate({}, {cb: async(v: any) => v})).toBe(false)

        expect(await toExpr('$some($cb([1, 2, 3, 101, 200, 201]), function($v) {$v > 100})').evaluate({}, {cb: (v: any) => v})).toBe(true)
        expect(await toExpr('$some($cb([1, 2, 3, 101, 200, 201]), function($v) {$v > 100})').evaluate({}, {cb: async(v: any) => v})).toBe(true)

        expect(await toExpr('$some($cb(null), function($v) {$v > 100})').evaluate({}, {cb: async(v: any) => v})).toBe(false)
        expect(await toExpr('$some(null, function($v) {$v > 100})').evaluate({}, {cb: async(v: any) => v})).toBe(false)
    })
})
