import Typography from '@mui/material/Typography'
import { ComputeStats } from '@comyata/run/Runtime'
import jsonpointer from 'json-pointer'
import { FC } from 'react'

const printStats = (
    statsEntry: ComputeStats,
    hierarchy = {level: 0},
    logs: string[] = [],
) => {
    const {level} = hierarchy

    logs.push(
        '  '.repeat(level) +
        `· ${statsEntry.step}` +
        `${
            'file' in statsEntry
                ? ' ' + JSON.stringify(statsEntry.file)
                : 'dataNode' in statsEntry && statsEntry.dataNode
                    ? ' ' + JSON.stringify(jsonpointer.compile(statsEntry.dataNode as string[]))
                    : ''}` +
        ` ${typeof statsEntry.dur === 'number' ? statsEntry.dur : -1}ms` +
        `${'engine' in statsEntry ? ' with ' + statsEntry.engine : ''}` +
        `${typeof statsEntry.cached === 'number' ? ' cache-layer ' + statsEntry.cached : ''}`,
    )

    if(statsEntry.stats) {
        statsEntry.stats.forEach(furtherEntry => {
            logs = printStats(furtherEntry as any, {
                ...hierarchy,
                level: level + 1,
            }, logs)
        })
    }

    return logs
}

export interface ComyataStatsProps {
    stats: (ComputeStats)[]
}

export const ComyataStats: FC<ComyataStatsProps> = ({stats}) => {
    return <>
        {stats.map(s => printStats(s)).flat().map((line, i) =>
            line.split('\n').map((l, i2) =>
                <Typography
                    key={i + '-' + i2}
                    variant={'body2'} gutterBottom
                    sx={{pl: Math.ceil((line.match(/^\s*/)?.[0].length || 0) / 2)}}
                >
                    {l}
                </Typography>))}
    </>
}
