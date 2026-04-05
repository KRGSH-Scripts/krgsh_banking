import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  MantineProvider,
  createTheme,
  defaultCssVariablesResolver,
  type CSSVariablesResolver,
} from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter, createMemoryHistory } from '@tanstack/react-router';
import '@mantine/core/styles.css';
import '@mantine/charts/styles.css';
import './index.css';

import { routeTree } from './routeTree.gen';

// ─── Mantine Theme ────────────────────────────────────────────────────────────
const theme = createTheme({
  fontFamily: '"IBM Plex Sans", sans-serif',
  fontFamilyMonospace: '"IBM Plex Mono", monospace',
  headings: { fontFamily: '"Manrope", sans-serif' },
  primaryColor: 'pink',
  defaultRadius: 'md',
  colors: {
    dark: [
      '#C1C2C5', // 0 – text
      '#A6A7AB', // 1
      '#909296', // 2
      '#5C5F66', // 3
      '#373A40', // 4
      '#2C2E33', // 5
      '#25262B', // 6
      '#1A1B1E', // 7
      '#141517', // 8
      '#101113', // 9
    ],
  },
  components: {
    AppShell: {
      styles: {
        root: { background: 'transparent' },
        main: { background: 'transparent' },
      },
    },
  },
});

/** FiveM NUI: Mantine würde sonst body über --mantine-color-body schwarz färben */
const nuiCssVariablesResolver: CSSVariablesResolver = (t) => {
  const base = defaultCssVariablesResolver(t);
  return {
    ...base,
    dark: { ...base.dark, '--mantine-color-body': 'transparent' },
    light: { ...base.light, '--mantine-color-body': 'transparent' },
  };
};

// ─── TanStack Query ───────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

// ─── TanStack Router (memory history – perfect for FiveM NUI) ─────────────────
const memHistory = createMemoryHistory({ initialEntries: ['/'] });

const router = createRouter({
  routeTree,
  history: memHistory,
  context: { queryClient },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider
        theme={theme}
        defaultColorScheme="dark"
        forceColorScheme="dark"
        cssVariablesResolver={nuiCssVariablesResolver}
      >
        <RouterProvider router={router} />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
