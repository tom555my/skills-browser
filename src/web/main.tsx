import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { queryClient } from './query-client';
import { router } from './router';
import { TooltipProvider } from '@/web/components/ui/tooltip';

const appElement = document.getElementById('app');

if (!appElement) {
  throw new Error('Cannot find app root element.');
}

createRoot(appElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);
