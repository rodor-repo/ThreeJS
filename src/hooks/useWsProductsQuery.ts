"use client"

import { useQuery } from "@tanstack/react-query"
import { getWsProducts } from "@/server/getWsProducts"
import type { WsProducts } from "@/types/erpTypes"

/**
 * React Query keys for wsProducts data
 */
export const wsProductsQueryKeys = {
  wsProducts: ["wsProducts"] as const,
}

/**
 * Custom hook for fetching wsProducts (categories, products, designs) from the webshop API.
 *
 * Returns:
 * - wsProducts: The wsProducts data
 * - isLoading: Whether the query is in initial loading state
 * - isError: Whether the query encountered an error
 * - error: The error object if any
 */
export function useWsProductsQuery() {
  return useQuery<WsProducts, Error>({
    queryKey: wsProductsQueryKeys.wsProducts,
    queryFn: async () => {
      const data = await getWsProducts()
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: Infinity, // Never garbage collect products data
  })
}
