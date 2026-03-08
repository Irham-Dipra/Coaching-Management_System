import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 1. Import React Query parts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 2. Create a "Client" (The Cache Manager)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min: cached data shown instantly on revisit
      gcTime: 10 * 60 * 1000,         // 10 min: keep data in memory
      retry: 1,                        // Only retry once on failure
      refetchOnWindowFocus: false,     // Don't refetch on tab switch
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 3. Wrap the App in the Provider */}
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)