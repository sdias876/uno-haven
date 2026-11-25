import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App.jsx';
import '@fontsource/lilita-one/latin-400.css';
import '@fontsource-variable/outfit';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/lobster/latin-400.css';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-500.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Respects the OS "reduce motion" setting automatically */}
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
