import * as React from 'react';
import { useGetAllJsonPathsQuery } from '../../services/filesApiCf';
import { Box, Typography, Button, Fab } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import Grid from '@mui/material/Grid';
import ProductCard from './ProductCard';
import ChatWidget from '../chat/ChatWidget';

function shuffle<T>(arr: T[], rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function HomePage() {
  const { data: allPaths, isLoading, isError } = useGetAllJsonPathsQuery();
  const [seed] = React.useState(() => {
    const buf = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(buf);
      return buf[0] / 2**32;
    }
    return Math.random();
  });

  const [chatOpen, setChatOpen] = React.useState(false);

  const pick20 = React.useMemo(() => {
    if (!allPaths) return [];
    const shuffled = shuffle(allPaths, () => {
      let s = Math.sin(seed * 1e6) * 1e4;
      return (s - Math.floor(s));
    });
    return shuffled.slice(0, 20);
  }, [allPaths, seed]);

  if (isLoading) {
    return <Box p={2}><Typography>Loading products…</Typography></Box>;
  }
  if (isError || !allPaths) {
    return <Box p={2}><Typography color="error">Failed to load product list.</Typography></Box>;
  }

  return (
    <Box p={2} position="relative">
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h5">Featured products</Typography>
        <Button variant="outlined" onClick={() => window.location.reload()}>
          Refresh selection
        </Button>
      </Box>

      <Grid container spacing={2}>
        {pick20.map((jsonPath) => (
          // @ts-expect-error: temporarily ignore Grid prop mismatch here
          <Grid item key={jsonPath} xs={12} sm={6} md={4} lg={3}>
            <ProductCard jsonPath={jsonPath} />
          </Grid>
        ))}
      </Grid>

      {/* Floating Action Button */}
      <Fab
        color={chatOpen ? 'default' : 'primary'}
        aria-label={chatOpen ? 'Close chat' : 'Open chat'}
        onClick={() => setChatOpen((v) => !v)}
        sx={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: (t) => t.zIndex.modal + 2,
        }}
      >
        {chatOpen ? <CloseIcon /> : <ChatIcon />}
      </Fab>

      {/* Overlay chat window */}
      {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />}
    </Box>
  );
}