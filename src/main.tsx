import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import App from './App';

import './index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <App />
    <Toaster position="top-right" richColors closeButton />
  </>
);

import "@fontsource/inter/400.css";

import "@fontsource/inter/600.css";

import "@fontsource/inter/700.css";

import "@fontsource/inter/800.css";

import "@fontsource/inter/900.css";