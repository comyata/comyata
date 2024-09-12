import React from 'react'
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { customTheme } from './theme'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

const rootElement = document.getElementById('root')!
const root = ReactDOM.createRoot(rootElement)

const themes = customTheme()

root.render(
    <React.StrictMode>
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={themes.dark}>
                <CssBaseline/>
                <BrowserRouter>
                    <App/>
                </BrowserRouter>
            </ThemeProvider>
        </StyledEngineProvider>
    </React.StrictMode>,
)
