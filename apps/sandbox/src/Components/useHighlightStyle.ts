import React from 'react'
import { tags } from '@lezer/highlight'
import { HighlightStyle } from '@codemirror/language'
import { useTheme } from '@mui/material/styles'

export const useHighlightStyle = (): HighlightStyle => {
    const {palette} = useTheme()
    return React.useMemo(
        () =>
            HighlightStyle.define([
                {
                    tag: tags.link,
                    textDecoration: 'underline',
                },
                {
                    tag: tags.heading,
                    // textDecoration: 'underline',
                    color: palette.mode === 'dark' ? '#e4e7e8' : '#011d24',
                    fontWeight: 'bold',
                },
                {
                    tag: [tags.meta],
                    color: palette.mode === 'dark' ? '#57b1a8' : '#008074',
                },
                {
                    tag: tags.emphasis,
                    fontStyle: 'italic',
                },
                {
                    tag: tags.strong,
                    fontWeight: 'bold',
                },
                {
                    tag: tags.strikethrough,
                    textDecoration: 'line-through',
                },
                {
                    tag: tags.keyword,
                    color: palette.mode === 'dark' ? '#d55d9b' : '#c232ab',
                },
                {
                    tag: [
                        tags.atom,
                        tags.bool,
                        tags.null,
                        tags.url,
                        tags.contentSeparator,
                        tags.labelName,
                    ],
                    // tags.operator,
                    color: palette.mode === 'dark' ? '#b167e4' : '#851cce',
                },
                {
                    tag: [tags.literal], // numbers in json+yaml
                    // tag: [tags.literal, tags.inserted],
                    color: palette.mode === 'dark' ? '#73a3ce' : '#125f77',
                },
                {
                    tag: [tags.inserted],
                    // tag: [tags.literal, tags.inserted],
                    color: palette.mode === 'dark' ? '#1a9544' : '#068248',
                },
                {
                    tag: [tags.deleted],
                    color: palette.mode === 'dark' ? '#d22c2c' : '#aa1111',
                },
                {
                    tag: [tags.brace],
                    color: palette.text.secondary,
                },
                {
                    tag: [tags.bracket],
                    color: palette.mode === 'dark' ? '#608bb1' : '#22758f',
                },
                {
                    tag: [tags.string],
                    color: palette.mode === 'dark' ? '#83ca69' : '#067326',
                },
                {
                    tag: [tags.regexp, tags.escape, tags.special(tags.string)],
                    color: palette.mode === 'dark' ? '#ec7242' : '#ee4400',
                },
                {
                    tag: [
                        tags.definition(tags.variableName),
                        // e.g. sass-vars
                        tags.special(tags.variableName),
                        tags.variableName,
                        tags.attributeName,
                    ],
                    color: palette.mode === 'dark' ? '#6789ec' : '#1a3ab9',
                },
                {
                    tag: tags.local(tags.variableName),
                    color: '#3300aa',
                },
                {
                    tag: [tags.typeName, tags.namespace],
                    color: palette.mode === 'dark' ? '#41aea4' : '#008074',
                    // color: palette.mode === 'dark' ? '#ec4837' : '#b7382b',
                },
                {
                    tag: tags.className,
                    // color: '#116677',
                    color: palette.mode === 'dark' ? '#388c83' : '#207e75',
                },
                {
                    tag: [tags.macroName],
                    color: '#225566',
                },
                /*{
                    tag: tags.definition(tags.propertyName),
                    color: '#0000cc',
                },*/
                {
                    tag: [
                        tags.comment,
                        // tags.blockComment,
                    ],
                    color: palette.mode === 'dark' ? '#738284' : '#6b7677',
                    // backgroundColor: palette.mode === 'dark' ? '#738284' : '#6b7677',
                },
                // {
                //     tag: [
                //         tags.blockComment,
                //     ],
                //     opacity: 0.75,
                //     '&:hover, &:active, &:focus': {
                //         opacity: 1,
                //     },
                //     // backgroundColor: palette.mode === 'dark' ? '#1f2626' : '#e1ebec',
                //     // display: 'block',
                // },
                {
                    tag: tags.invalid,
                    color: palette.error.main,
                    // color: '#ff0000',
                },
            ]),
        [palette],
    )
}
