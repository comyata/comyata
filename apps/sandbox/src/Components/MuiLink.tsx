import React from 'react'
import { Link as LinkBase } from 'react-router-dom'
import MuiLinkBase, { LinkProps } from '@mui/material/Link'

export interface NavLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string
    className?: string
}

export const RouterLink = React.forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink({href, ...props}, ref) {
    return <LinkBase ref={ref} {...props} to={href}/>
})

export const MuiLink = React.forwardRef<HTMLAnchorElement, Omit<LinkProps, 'component'> & { href: string }>(function MuiLink({children, ...props}, ref) {
    return <MuiLinkBase {...props} component={RouterLink} ref={ref}>{children}</MuiLinkBase>
})
