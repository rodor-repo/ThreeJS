"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

let client: QueryClient | null = null

const getClient = () => {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: 5 * 60 * 1000,
          refetchOnWindowFocus: false,
          retry: 1
        }
      }
    })
  }
  return client
}

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = getClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
