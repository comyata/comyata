import { Route, Routes } from 'react-router'
import { MuiNavLink } from './Components/MuiNavLink'
import { PageHome } from './Pages/PageHome'
import IcGitHub from '@mui/icons-material/GitHub'
import Link from '@mui/material/Link'
import Box from '@mui/material/Box'
import { PageStreaming } from './Pages/PageStreaming'

export default function App() {
    return (
        <Box
            style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'auto',
                maxHeight: '100%',
            }}
        >
            <Box px={2} py={1} sx={{display: 'flex', alignItems: 'center', columnGap: 1, textAlign: 'left'}}>
                <MuiNavLink
                    href={'/'}
                >home</MuiNavLink>
                <MuiNavLink
                    href={'/streaming'}
                >streaming</MuiNavLink>
                <Link
                    href={'https://github.com/comyata/comyata'}
                    target={'_blank'}
                    rel="noreferrer noopener"
                    sx={{display: 'flex', ml: 'auto'}}
                >
                    <IcGitHub fontSize={'small'}/>
                </Link>
            </Box>
            <Box
                style={{display: 'flex', flexDirection: 'column', overflow: 'auto'}}
            >
                <Routes>
                    <Route path={''} element={<PageHome/>}/>
                    <Route path={'streaming'} element={<PageStreaming/>}/>
                </Routes>
            </Box>
        </Box>
    )
}
