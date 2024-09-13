import React from 'react'
import { useMatch } from 'react-router-dom'
import MuiLink, { LinkProps } from '@mui/material/Link'
import { NavLinkProps, RouterLink } from './MuiLink'

export const MuiNavLink: React.FC<Omit<LinkProps, 'component' | 'underline'> & Pick<NavLinkProps, 'href'> & { exact?: boolean }> = ({children, exact, ...props}) => {
    const match = useMatch(props.href + (exact ? '' : '*'))
    return <MuiLink {...props} underline={match ? 'always' : 'hover'} component={RouterLink}>{children}</MuiLink>
}
