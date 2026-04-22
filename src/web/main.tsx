import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';

import { router } from './router';
import './styles/generated.css';

const appElement = document.getElementById('app');

if (!appElement) {
  throw new Error('Cannot find app root element.');
}

createRoot(appElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
