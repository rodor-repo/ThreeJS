"use client"

import { useQuery } from "@tanstack/react-query"
import { getWsRooms } from "@/server/getWsRooms"
import type { WsRooms } from "@/types/erpTypes"

/**
 * React Query keys for wsRooms data
 */
export const wsRoomsQueryKeys = {
  wsRooms: ["wsRooms"] as const,
}

/**
 * Custom hook for fetching wsRooms config from Firestore using React Query.
 *
 * Returns:
 * - wsRooms: The wsRooms config data
 * - isLoading: Whether the query is in initial loading state
 * - isError: Whether the query encountered an error
 * - error: The error object if any
 */
export function useWsRoomsQuery() {
  return useQuery<WsRooms, Error>({
    queryKey: wsRoomsQueryKeys.wsRooms,
    queryFn: async () => {
      const data = await getWsRooms()
      return data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: Infinity, // Never garbage collect wsRooms data
  })
}
