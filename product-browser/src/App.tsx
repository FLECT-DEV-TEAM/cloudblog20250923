import '@chatscope/chat-ui-kit-styles/dist/default/styles.min.css';
import HomePage from './features/home/HomePage'
import { CssBaseline, ThemeProvider, createTheme, Container } from '@mui/material'

const theme = createTheme()

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl">
        <HomePage />
      </Container>
    </ThemeProvider>
  )
}