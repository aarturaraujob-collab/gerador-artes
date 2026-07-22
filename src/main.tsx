import { createRoot } from 'react-dom/client';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import "@fontsource/prompt/400.css";
import "@fontsource/prompt/400-italic.css";
import "@fontsource/prompt/600.css";
import "@fontsource/prompt/700.css";
import "@fontsource/prompt/800.css";
import "@fontsource/prompt/900.css";

import App from './App';

import './index.css';

createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <App />
    <Toaster position="top-right" richColors closeButton />
  </ThemeProvider>
);

import "@fontsource/inter/400.css";

import "@fontsource/inter/600.css";

import "@fontsource/inter/700.css";

import "@fontsource/inter/800.css";

import "@fontsource/inter/900.css";