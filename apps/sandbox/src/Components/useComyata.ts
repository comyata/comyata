import { DataNode } from '@comyata/run/DataNode'
import { DataNodeJSONata } from '@comyata/run/DataNodeJSONata'
import { Parser } from '@comyata/run/Parser'
import { useRef } from 'react'

const nodeTypes = [
    DataNodeJSONata,
]

export const useComyataParser = (parserOptions?: Partial<Parser<typeof DataNode>['options']>) => {
    const parserRef = useRef<[Parser<typeof DataNode | typeof DataNodeJSONata>, typeof parserOptions] | null>(null)
    if(!parserRef.current || parserRef.current[1] !== parserOptions) {
        parserRef.current = [new Parser(nodeTypes, parserOptions), parserOptions]
    }

    return parserRef.current[0]
}
