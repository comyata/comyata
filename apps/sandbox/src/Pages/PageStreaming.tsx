import { Transaction } from '@codemirror/state'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import ButtonBase from '@mui/material/ButtonBase'
import Collapse from '@mui/material/Collapse'
import Paper from '@mui/material/Paper'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import { CodeMirrorOnChange } from '@ui-schema/kit-codemirror'
import { useCallback, useMemo, useState } from 'react'
import yaml from 'yaml'
import jsonpointer from 'json-pointer'
import { ComyataStats } from '../Components/ComyataStats'
import { CustomCodeMirror } from '../Components/CustomCodeMirror'
import { ProgressInfo } from '../Components/ProgressInfo'
import { useComyataParser } from '../Components/useComyata'
import { IProgressEvent, useComyataRuntime } from '../Components/useComyataRuntime'

const exampleTemplate = {
    sleepShort: '${ $sleep(100) }',
    sleepLong: '${ $sleep(1200) }',
    sleepLonger: '${ $sleep(2000) }',
    calc: '${ 5 + 7 }',
}

export const PageStreaming = () => {
    const [state, setState] = useState<{
        templateError?: Error
        template?: unknown
        templateRaw: string
    }>(() => ({
        templateRaw: yaml.stringify(exampleTemplate).trimEnd(),
        template: exampleTemplate,
    }))

    const [showStats, setShowStats] = useState(false)

    const [progressHistory, setProgressHistory] = useState<IProgressEvent[]>([])

    const onInputChange: CodeMirrorOnChange = useCallback((view, nextValue, prevValue) => {
        if(!view.docChanged || typeof nextValue !== 'string' || prevValue === nextValue) return
        const isFromRemote = view.transactions.some(t => t.annotation(Transaction.remote))
        if(isFromRemote) return
        let templateData: any
        let templateError: Error | undefined
        try {
            templateData = yaml.parse(nextValue, {prettyErrors: true})
        } catch(e) {
            templateError = e instanceof Error ? e : new Error('Unknown error')
        }
        setState(s => ({
            ...s,
            templateRaw: nextValue,
            template: templateError ? s.template : templateData,
            templateError: templateError,
        }))
    }, [setState])

    const parser = useComyataParser()
    const {evalOut, evalOutError, parserError, processing} = useComyataRuntime(
        parser, state.template,
        useMemo(() => null, []),
        {
            onProgress: useCallback((progress) => {
                console.log('progress', progress)
                if(progress.type === 'start') {
                    // clear existing progress history on a new start
                    setProgressHistory(() => [progress])
                } else {
                    setProgressHistory((h) => [...h, progress])
                }
            }, []),
        },
    )

    return (
        <Box sx={{
            display: 'flex', gap: 1,
            flexWrap: {xs: 'wrap', md: 'nowrap'},
            alignContent: 'stretch',
            overflow: {md: 'auto'},
            // maxHeight: '100%',
            flexGrow: 1,
        }}>
            <Paper sx={{display: 'flex', flexDirection: 'column', width: {xs: '100%', md: '50%'}, mb: {xs: 'auto', md: 0}, px: 1, pb: 1, overflow: {md: 'auto'}}}>
                <Box px={1} py={0.5}>
                    <Typography variant={'caption'} color={'secondary'}>{'Template'}</Typography>
                </Box>
                <CustomCodeMirror
                    value={state.templateRaw}
                    onChange={onInputChange}
                    style={{flexGrow: 1, display: 'flex'}}
                    lang={'yaml'}
                />
                {state.templateError ?
                    <Alert severity={'error'}>
                        <AlertTitle>{'Invalid Input'}</AlertTitle>
                        <Typography whiteSpace={'pre-line'}>{state.templateError.message}</Typography>
                    </Alert> : null}
                {!state.templateError && parserError ?
                    <Alert severity={'error'}>
                        <AlertTitle>{'Parser Error'}</AlertTitle>
                        <Typography whiteSpace={'pre-line'}>{parserError.message}</Typography>
                    </Alert> : null}
            </Paper>
            <Paper sx={{display: 'flex', flexDirection: 'column', width: {xs: '100%', md: '50%'}, px: 1, pb: 1, overflow: {md: 'auto'}}}>
                <Box px={1} py={0.5} sx={{display: 'flex', alignItems: 'center'}}>
                    <Typography variant={'caption'} color={'secondary'}>{'Output'}</Typography>
                    <Box ml={'auto'}><ProgressInfo progress={processing}/></Box>
                </Box>
                {evalOutError ?
                    <Alert severity={'error'}>
                        <AlertTitle>{'Eval Error'}</AlertTitle>
                        <Typography whiteSpace={'pre-line'}>{evalOutError instanceof Error ? evalOutError.message : JSON.stringify(evalOutError.error)}</Typography>
                    </Alert> : null}
                {evalOutError ? null :
                    <CustomCodeMirror
                        value={JSON.stringify(evalOut?.output, undefined, 4) || ''}
                        lang={'json'}
                        style={{flexGrow: 1, display: 'flex'}}
                    />}

                <Box ml={'auto'}>
                    <Tooltip title={`${showStats ? 'hide' : 'show'} stats`} disableInteractive>
                        <ButtonBase
                            sx={{
                                borderRadius: 1,
                                color: 'textSecondary',
                                typography: 'caption',
                                px: 0.5, py: 0.25,
                            }}
                            onClick={() => setShowStats(s => !s)}
                        >
                            {evalOut?.stats?.reduce((t, s) => t + (s.dur || 0), 0) || 0}{'ms'}
                        </ButtonBase>
                    </Tooltip>
                </Box>

                <Collapse in={showStats} sx={{flexShrink: 0}}>
                    {evalOut?.stats ?
                        <ComyataStats
                            stats={evalOut?.stats}
                        /> : '-'}
                </Collapse>
            </Paper>
            <Paper sx={{display: 'flex', flexDirection: 'column', width: {xs: '100%', md: '50%'}, px: 1, pb: 1, overflow: {md: 'auto'}}}>
                <Box py={0.5} sx={{display: 'flex'}}>
                    <Typography variant={'caption'} color={'secondary'}>{'Progress History'}</Typography>
                </Box>
                {progressHistory?.map((evt, i) => {
                    return <Box sx={{borderBottom: '1px solid transparent', borderBottomColor: 'divider'}} py={1} key={i}>
                        <Typography variant={'caption'} color={(evt.type === 'done' || evt.type === 'node_done') && evt.error ? 'error.main' : 'textSecondary'} gutterBottom component={'p'}>
                            {'Event: '}{evt.type}
                        </Typography>
                        {evt.type === 'node_start' || evt.type === 'node_done' ?
                            <Typography variant={'caption'} color={'textSecondary'} gutterBottom component={'p'}>
                                {'Node: '}
                                <code>{jsonpointer.compile(evt.nodePath as string[])}</code>
                            </Typography> : null}
                        {evt.type === 'done' || evt.type === 'node_done' ?
                            evt.error ?
                                // note: most likely you want to show the errors in a better way, this is just a demo!
                                //       BUT you can not use JSON.stringify, as error objects may contain cyclic values
                                <Typography variant={'body2'} gutterBottom component={'p'}>{evt?.error?.message}</Typography> :
                                <CustomCodeMirror
                                    value={JSON.stringify(evt?.output, undefined, 4) || ''}
                                    lang={'json'}
                                    style={{flexGrow: 1, display: 'flex', fontSize: '0.825rem'}}
                                /> : null}
                    </Box>
                })}
            </Paper>
        </Box>
    )
}
