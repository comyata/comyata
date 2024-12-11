import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

export const ErrorInfo = (
    {error}: {
        error: Error | { error: any }
    },
) => {
    return <>
        <Typography whiteSpace={'pre-line'}>{error instanceof Error ? error.message : JSON.stringify(error.error)}</Typography>
        {error instanceof Error && 'errors' in error ?
            <Box
                mt={1}
                sx={{display: 'flex', flexDirection: 'column', gap: 1}}
            >
                {/* @ts-expect-error */}
                {error.errors.map((nodeError, i) =>
                    <Box key={i}>
                        <Typography whiteSpace={'pre-line'}>
                            {nodeError.message}
                        </Typography>
                    </Box>,
                )}
            </Box> : null}
    </>
}
