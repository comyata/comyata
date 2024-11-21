import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import React from 'react'
import {
    lineNumbers,
    highlightActiveLineGutter,
    highlightSpecialChars,
    drawSelection,
    dropCursor,
    rectangularSelection,
    highlightActiveLine,
    keymap,
    EditorView,
    highlightWhitespace,
    tooltips,
    highlightTrailingWhitespace,
    // crosshairCursor,
} from '@codemirror/view'
import {
    foldGutter,
    indentOnInput,
    syntaxHighlighting,
    defaultHighlightStyle,
    bracketMatching,
    foldKeymap,
    StreamLanguage,
    LanguageDescription,
    LanguageSupport,
    codeFolding,
} from '@codemirror/language'
import {
    history,
    defaultKeymap,
    historyKeymap,
    indentWithTab,
} from '@codemirror/commands'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import {
    closeBrackets,
    autocompletion,
    closeBracketsKeymap,
    completionKeymap,
} from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'
import { Compartment, EditorState, Extension } from '@codemirror/state'
import {
    CodeMirrorComponentProps,
    CodeMirrorProps,
} from '@ui-schema/kit-codemirror/CodeMirror'
import { EditorThemeCustomStyles, useEditorTheme } from './useEditorTheme'
import { useHighlightStyle } from './useHighlightStyle'
import { json } from '@codemirror/lang-json'
import { javascript } from '@codemirror/lang-javascript'
import {
    MariaSQL,
    Cassandra,
    MySQL,
    PostgreSQL,
    MSSQL,
    StandardSQL,
    sql,
} from '@codemirror/lang-sql'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { lezer } from '@codemirror/lang-lezer'
import { yaml } from '@codemirror/legacy-modes/mode/yaml'
import {
    useCodeMirror,
    useEditorClasses,
    useExtension,
} from '@ui-schema/kit-codemirror'

const mdLang0 = markdown({
    base: markdownLanguage,
    codeLanguages: [
        // adding yaml before `languages`, overwrites the included very-basic yaml language
        LanguageDescription.of({
            name: 'YAML',
            alias: ['yaml', 'yml'],
            filename: /.(yaml|yml)$/i,
            extensions: ['yaml', 'yml'],
            support: new LanguageSupport(StreamLanguage.define(yaml)),
        }),
    ],
    extensions: [],
    /*extensions: [
          YAMLFrontMatter,
          Footnote,
      ],*/
})

const mdLang = markdown({
    base: markdownLanguage,
    codeLanguages: [
        // adding yaml before `languages`, overwrites the included very-basic yaml language
        LanguageDescription.of({
            name: 'YAML',
            alias: ['yaml', 'yml'],
            filename: /.(yaml|yml)$/i,
            extensions: ['yaml', 'yml'],
            support: new LanguageSupport(StreamLanguage.define(yaml)),
        }),
        // todo: solve "markdown highlighting in codeblocks inside markdown",
        //       didn't seem possible without adding a further one,
        //       nested fence-codeblocks are impossible due to markdown,
        //       so that should be enough and the nested MD could even be "without nested code support"
        //       except for yaml/frontmatter
        LanguageDescription.of({
            name: 'Markdown',
            alias: ['md', 'markdown'],
            extensions: ['md'],
            support: mdLang0,
        }),
        ...languages,
    ],
    extensions: [],
    /*extensions: [
          YAMLFrontMatter,
          Footnote,
      ],*/
})

export const getHighlight = (
    lang: string | undefined,
): Extension | undefined => {
    switch(lang?.toLowerCase()) {
        case 'json':
        case 'json5':
            return json()
        case 'js':
        case 'node':
        case 'nodejs':
        case 'javascript':
            return javascript()
        case 'jsx':
            return javascript({
                jsx: true,
            })
        case 'ts':
        case 'typescript':
            return javascript({
                typescript: true,
            })
        case 'tsx':
            return javascript({
                jsx: true,
                typescript: true,
            })
        case 'yml':
        case 'yaml':
            return StreamLanguage.define(yaml)
        case 'mysql':
            return sql({dialect: MySQL})
        case 'ms sql':
        case 'mssql':
            return sql({dialect: MSSQL})
        case 'mariasql':
            return sql({dialect: MariaSQL})
        case 'postgresql':
            return sql({dialect: PostgreSQL})
        case 'cassandra':
        case 'cql':
            return sql({dialect: Cassandra})
        case 'bigquery':
        case 'standardsql':
            return sql({dialect: StandardSQL})
        case 'sql':
            return sql()
        case 'md':
        case 'markdown':
            // return markdown()
            return mdLang
        case 'lezer':
            return lezer()
        default:
            return undefined
    }
}

export type CustomCodeMirrorProps = CodeMirrorComponentProps & {
    variant?: 'embed' | 'standard'
    dense?: boolean
    onViewLifecycle?: CodeMirrorProps['onViewLifecycle']
    style?: React.CSSProperties
    // containerRef?: React.MutableRefObject<HTMLDivElement | null>
    lang?: string
    extraMods?: boolean
    /**
     * @todo implement a user notification, if the first tab in the session, remind to use ESC+TAB
     *       needs sessionStorage/localStorage
     */
    enableTabIndent?: boolean
    highlightWhitespaces?: boolean
    autoFocus?: boolean | number
    paddingBottom?: boolean | number | string
    id?: string
    /**
     * @experimental
     */
    enableSpellCheck?: boolean
}

export const CustomCodeMirror: React.FC<CustomCodeMirrorProps> = (
    {
        // values we want to override in this component
        value,
        extensions,
        lang,
        dense,
        variant: customVariant,
        classNamesContent,
        onChange,
        onViewLifecycle,
        effects,
        style,
        highlightWhitespaces,
        autoFocus,
        extraMods = true,
        enableTabIndent = true,
        paddingBottom = false,
        enableSpellCheck = false,
        id,
    },
) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null)
    // containerRef.current ||= containerRefProps?.current || null
    // refs for extensions need to be created before the extension
    const editorAttributesCompartment = React.useRef<Compartment>(
        new Compartment(),
    )
    const contentAttributesCompartment = React.useRef<Compartment>(
        new Compartment(),
    )
    const keymapCompartment = React.useRef<Compartment>(new Compartment())
    const highlightCompartment = React.useRef<Compartment>(new Compartment())
    const highlightWhitespaceCompartment = React.useRef<Compartment>(
        new Compartment(),
    )
    const highlightTrailingWhitespaceCompartment = React.useRef<Compartment>(
        new Compartment(),
    )
    const {palette} = useTheme()

    const customStyles = React.useMemo<Partial<EditorThemeCustomStyles>>(
        () => ({
            activeSelection:
                palette.mode === 'dark' ? '#182f2f' : 'rgba(210,243,239,0.76)',
            activeLine:
                palette.mode === 'dark'
                    ? 'rgba(5, 115, 115, 0.11)'
                    : 'rgba(216,234,231,0.34)',
            paddingBottom: paddingBottom,
            // activeSelection: '#ffffff',
            // activeLine: '#ffffff',
            // textColor: '#ffffff',
        }),
        [palette.mode, paddingBottom],
    )
    const theme = useEditorTheme(
        typeof onChange === 'undefined',
        dense,
        customVariant,
        customStyles as EditorThemeCustomStyles,
    )

    const highlightStyle = useHighlightStyle()
    const {init: initHighlightExt, effects: effectsHighlightExt} = useExtension(
        () =>
            syntaxHighlighting(highlightStyle || defaultHighlightStyle, {
                fallback: true,
            }),
        [highlightStyle],
    )
    const {init: initThemeExt, effects: effectsThemeExt} = useExtension(
        () => theme,
        [theme],
    )
    const effectsRef = React.useRef<((editor: EditorView) => void)[]>(
        effects || [],
    )

    const extensionsAll = React.useMemo(
        () => [
            editorAttributesCompartment.current.of(
                EditorView.editorAttributes.of({}),
            ),
            contentAttributesCompartment.current.of(
                EditorView.contentAttributes.of({}),
            ),
            lineNumbers(),
            EditorView.lineWrapping,
            highlightActiveLineGutter(),
            highlightSpecialChars(),
            history(),
            foldGutter(),
            drawSelection(),
            dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            indentOnInput(),
            bracketMatching(),
            closeBrackets(),
            autocompletion(),
            rectangularSelection(),
            highlightActiveLine(),
            highlightSelectionMatches(),
            keymapCompartment.current.of([]),
            highlightCompartment.current.of([]),
            highlightWhitespaceCompartment.current.of([]),
            highlightTrailingWhitespaceCompartment.current.of([]),
            ...(extraMods
                ? [
                    codeFolding(),
                    // hoverTooltip(),
                    tooltips(),
                ]
                : []),
            // indentUnit.of('    '),
            // todo: csv with tab requires keeping them as is
            new Compartment().of(EditorState.tabSize.of(4)),
            initHighlightExt(),
            initThemeExt(),
            ...(extensions || []),
            // todo: if any unmounting of these extensions is concurrently with an remote change, it may not be registered
            //       refactor the whole extensions to a combined part, which is reconciled "manually" in sync and on effects
        ],
        [extraMods, initHighlightExt, initThemeExt, extensions],
    )

    // attach parent plugin effects first
    React.useMemo(() => {
        if(!effects) return effectsRef.current
        effectsRef.current.push(...effects)
    }, [effects])

    // attach each plugin effect separately (thus only the one which changes get reconfigured)
    React.useMemo(() => {
        if(!effectsHighlightExt) return
        effectsRef.current.push(...effectsHighlightExt)
    }, [effectsHighlightExt])
    React.useMemo(() => {
        if(!effectsThemeExt) return
        effectsRef.current.push(...effectsThemeExt)
    }, [effectsThemeExt])

    const editor = useCodeMirror(
        onChange,
        value,
        extensionsAll,
        effectsRef.current.splice(0, effectsRef.current.length),
        containerRef,
        undefined,
        onViewLifecycle,
    )

    // but extensions need to receive both: Compartment and Editor (and optionally their values)
    // to be able to dispatch the correct effects
    useEditorClasses(
        editorAttributesCompartment.current,
        editor,
        classNamesContent,
    )

    React.useEffect(() => {
        if(!editor || !enableSpellCheck) return
        // todo: spell check is working in e.g. Chrome but uses the device lang instead of app/component
        const contentAttributesCompartmentTmp =
            contentAttributesCompartment.current
        editor.dispatch({
            // https://github.com/codemirror/dev/issues/1020
            effects: contentAttributesCompartmentTmp.reconfigure(
                enableSpellCheck
                    ? EditorView.contentAttributes.of({
                        autocorrect: 'on',
                        autocapitalize: 'on',
                        spellcheck: 'true',
                    })
                    : EditorView.contentAttributes.of({}),
            ),
        })
        return () =>
            editor.dispatch({
                // https://github.com/codemirror/dev/issues/1020
                // ...enableSpellCheck ?
                //     [EditorView.contentAttributes.of({autocorrect: 'on', autocapitalize: 'on', spellcheck: 'true'})] : [],
                effects: contentAttributesCompartmentTmp.reconfigure(
                    EditorView.contentAttributes.of({}),
                ),
            })
    }, [editor, enableSpellCheck])

    React.useEffect(() => {
        if(!editor) return
        editor.dispatch({
            effects: highlightWhitespaceCompartment.current.reconfigure(
                onChange && highlightWhitespaces ? highlightWhitespace() : [],
            ),
        })
    }, [editor, highlightWhitespaceCompartment, highlightWhitespaces, onChange])

    React.useEffect(() => {
        if(!editor) return

        const highlightExt = lang && getHighlight(lang)
        editor.dispatch({
            effects: highlightCompartment.current.reconfigure(
                highlightExt ? [highlightExt] : [],
            ),
        })
    }, [editor, highlightCompartment, lang])

    React.useEffect(() => {
        if(!editor) return

        editor.dispatch({
            effects: keymapCompartment.current.reconfigure([
                keymap.of([
                    ...closeBracketsKeymap,
                    ...defaultKeymap.filter((k) => k.key !== 'Mod-Enter'),
                    ...searchKeymap,
                    ...historyKeymap,
                    ...foldKeymap,
                    ...completionKeymap,
                    ...lintKeymap,
                    ...(enableTabIndent ? [indentWithTab] : []),
                ]),
            ]),
        })
    }, [editor, keymapCompartment, enableTabIndent])

    React.useEffect(() => {
        if(!editor) return
        editor.dispatch({
            effects: highlightTrailingWhitespaceCompartment.current.reconfigure(
                onChange && extraMods ? highlightTrailingWhitespace() : [],
            ),
        })
    }, [editor, highlightTrailingWhitespaceCompartment, onChange, extraMods])

    React.useEffect(() => {
        if(!editor || !autoFocus) return
        const autoFocusDelay = typeof autoFocus === 'number' ? autoFocus : 75
        const setFocus = () => {
            editor.focus()
            if(editor.hasFocus) {
                const length = editor.state.doc.length
                editor.dispatch({selection: {anchor: length, head: length}})
                window.clearInterval(timer)
            }
        }
        const timer = window.setInterval(setFocus, autoFocusDelay)
        return () => window.clearInterval(timer)
    }, [editor, autoFocus])

    return (
        <Box
            id={id}
            ref={containerRef}
            sx={{
                fontSize: '0.913rem',
                ...style,
                position: onChange ? style?.position : 'relative',
                '.cm__actions': {display: 'none'},
                '&:hover .cm__actions': {display: 'flex'},
            }}
        />
    )
}
