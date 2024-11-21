import { getContrastRatio, createTheme, Theme, ThemeOptions } from '@mui/material/styles'

export const fontHeading =
    '"Roboto Slab", "Playfair Display", Didot, Georgia, "Times New Roman", Times, serif'
export const fontBody =
    'Calibri, Candara, Segoe, Segoe UI, Optima, Arial, sans-serif'
export const fontMono =
    '"Fira Code", "SF Mono", "Segoe UI Mono", Menlo, Consolas , Monaco, Liberation Mono, Lucida Console, Courier, monospace'
const universal: Pick<ThemeOptions, 'palette' | 'breakpoints' | 'typography'> = {
    palette: {
        //contrastThreshold: 2,
    },
    breakpoints: {
        values: {
            xs: 0,
            sm: 543,
            // md: 768,
            md: 940,
            lg: 1180,
            xl: 1920,
        },
    },
    typography: {
        fontSize: 14,
        fontFamily: fontBody,
        // fontFamilyCode: fontMono,
        //fontSizeCode: '0.875em',
        h1: {
            fontFamily: fontHeading,
            fontSize: '2.45rem',
        },
        h2: {
            fontFamily: fontHeading,
            fontSize: '2.115rem',
        },
        h3: {
            fontFamily: fontHeading,
            fontSize: '1.95rem',
        },
        h4: {
            fontFamily: fontHeading,
            fontSize: '1.75rem',
        },
        h5: {
            fontFamily: fontHeading,
            fontSize: '1.615rem',
        },
        h6: {
            fontFamily: fontHeading,
            fontSize: '1.25rem',
        },
        body1: {
            fontFamily: fontBody,
            fontSize: '1.0125rem',
            letterSpacing: '0.0195em',
        },
        body2: {
            fontFamily: fontBody,
            fontSize: '0.95rem',
            letterSpacing: '0.021em',
        },
        subtitle1: {
            fontFamily: fontHeading,
            fontSize: '1.25rem',
        },
        subtitle2: {
            fontFamily: fontHeading,
            fontSize: '1rem',
        },
        caption: {
            fontSize: '0.8134rem',
        },
    },
    /*shape: {
          borderRadius: 0,
      },*/
}

export const customTheme = (): {
    dark: Theme
    light: Theme
} => {
    const getContrastText = (background: string) => {
        const contrastText =
            getContrastRatio(background, '#c6c4c4') >= 2
                ? getContrastRatio(background, '#c6c4c4') <= 3
                    ? '#ffffff'
                    : '#c6c4c4'
                : getContrastRatio(background, '#001f29') <= 3
                    ? '#000000'
                    : '#001f29'

        // @ts-ignore
        if(process.env.NODE_ENV !== 'production') {
            const contrast = getContrastRatio(background, contrastText)
            if(contrast < 3) {
                console.error(
                    [
                        `MUI: The contrast ratio of ${contrast}:1 for ${contrastText} on ${background}`,
                        'falls below the WCAG recommended absolute minimum contrast ratio of 3:1.',
                        'https://www.w3.org/TR/2008/REC-WCAG20-20081211/#visual-audio-contrast-contrast',
                    ].join('\n'),
                )
            }
        }

        return contrastText
    }
    const themeDark = createTheme({
        ...universal,
        palette: {
            ...universal.palette,
            mode: 'dark',
            primary: {
                main: '#05aeca',
                dark: '#033944',
            },
            secondary: {
                main: '#bd90e0',
            },
            background: {
                paper: '#04212a',
                default: '#011217',
            },
            text: {
                primary: '#c6c4c4',
                secondary: '#acc9c5',
            },
            info: {
                main: '#1872b9',
            },
            error: {
                main: '#e82c2c',
                //main: '#b71c10',
            },
            warning: {
                main: '#d54600',
            },
            action: {
                hoverOpacity: 0.2,
            },
            getContrastText: getContrastText,
            //divider: 'rgba(65, 194, 194, 0.24)',
        },
        components: {
            MuiPaper: {
                styleOverrides: {root: {backgroundImage: 'unset'}},
            },
            MuiInputLabel: {
                styleOverrides: {
                    root: {
                        '&$error': {
                            color: '#e82c2c',
                        },
                    },
                },
            },
            /*MuiTextField: {
                      defaultProps: {size: 'small'},
                  },*/
        },
    })

    const themeLight = createTheme({
        ...universal,
        palette: {
            ...universal.palette,
            mode: 'light',
            primary: {
                main: '#0590a7',
                dark: '#033944',
            },
            secondary: {
                main: '#513793',
            },
            background: {
                paper: '#eeeeee',
                default: '#e4e4e4',
            },
            text: {
                primary: '#001f29',
                secondary: '#001820',
            },
            success: {
                main: '#50a82d',
            },
            warning: {
                dark: '#cc4c00',
                main: '#f05a00',
            },
            info: {
                main: '#3593dd',
            },
            action: {
                hoverOpacity: 0.2,
            },
            //divider: 'rgba(50, 153, 143, 0.4)',
            getContrastText: getContrastText,
        },
        components: {
            MuiAlert: {
                styleOverrides: {
                    /*standardSuccess: {
                                  backgroundColor: 'green',
                                  color: 'white',
                              },*/
                    outlinedSuccess: {
                        color: '#25790b',
                    },
                },
            },
        },
    })

    return {
        dark: themeDark,
        light: themeLight,
    }
}
