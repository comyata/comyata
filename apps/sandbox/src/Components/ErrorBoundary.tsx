import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import MuiLink from '@mui/material/Link'
import Typography from '@mui/material/Typography'
import { Component, PropsWithChildren } from 'react'

export interface ErrorBoundaryProps {
    resetError?: unknown
    allowRemount?: boolean
    flexGrow?: boolean
}

export class ErrorBoundary extends Component<PropsWithChildren<ErrorBoundaryProps>> {
    readonly state: { hasError: boolean, error: any }

    constructor(props) {
        super(props)
        this.state = {hasError: false, error: null}
    }

    static getDerivedStateFromError(error) {
        console.error('ErrorBoundary', error)
        return {hasError: true, error: error}
    }

    componentDidCatch(error, info) {
        console.error('ErrorBoundary', error, info.componentStack)
    }

    componentDidUpdate(prevProps: ErrorBoundaryProps) {
        if(prevProps.resetError !== this.props.resetError && this.state.hasError) {
            this.setState({hasError: false, error: null})
        }
    }

    render() {
        if(this.state.hasError) {
            return <Alert severity={'error'} sx={{flexGrow: this.props.flexGrow ? 1 : undefined}}>
                <AlertTitle>App Crashed</AlertTitle>
                <Typography>
                    {'An error has caused the app to crash. Please '}
                    <MuiLink href={'#'} onClick={(e) => {
                        e.preventDefault()
                        window.location.reload()
                    }}>reload it</MuiLink>
                    {' to continue.'}
                </Typography>
                {this.props.allowRemount ?
                    <Typography>
                        {'Or try to only '}
                        <MuiLink href={'#'} onClick={(e) => {
                            e.preventDefault()
                            this.setState({hasError: false, error: null})
                        }}>refresh the failed element</MuiLink>
                        {'.'}
                    </Typography> : null}
                {this.state.error ?
                    this.state.error instanceof Error ?
                        <Box mt={1} sx={{opacity: 0.5, '&:hover': {opacity: 1}}}>
                            <Typography variant={'subtitle2'}>{this.state.error.name}</Typography>
                            <Typography variant={'body2'} whiteSpace={'pre-line'}>{this.state.error.message}</Typography>
                        </Box> :
                        <pre><code>{JSON.stringify(this.state.error || null, undefined, 4)}</code></pre> : null}
            </Alert>
        }

        return this.props.children
    }
}
