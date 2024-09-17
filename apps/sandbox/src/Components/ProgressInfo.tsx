import { Typography } from '@mui/material'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import IcError from '@mui/icons-material/Error'
import IcPending from '@mui/icons-material/Pending'
import IcDoneOutline from '@mui/icons-material/DoneOutline'
import { Progress } from './useComyataRuntime'

export const ProgressInfo = (
    {progress}: {
        progress: Progress
    },
) => {
    return <Box sx={{display: 'flex', alignItems: 'center'}}>
        <Typography variant={'caption'} color={'textSecondary'} pr={0.5}>
            {progress === null ? <em>{'pending'}</em> : progress}
        </Typography>
        {progress === 'processing' ? <CircularProgress size={18}/> : null}
        {progress === 'error' ? <IcError color={'error'} fontSize={'small'}/> : null}
        {progress === 'finished' ? <IcDoneOutline color={'success'} fontSize={'small'}/> : null}
        {progress === null || progress === 'outdated' ? <IcPending color={'disabled'} fontSize={'small'}/> : null}
    </Box>
}
