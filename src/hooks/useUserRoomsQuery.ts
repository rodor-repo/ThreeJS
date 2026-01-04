"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { getUserRoomsList } from "@/server/rooms/getUserRoomsList"
import { getUserRoom } from "@/server/rooms/getUserRoom"
import { saveUserRoom, SaveUserRoomData } from "@/server/rooms/saveUserRoom"
import { deleteUserRoom } from "@/server/rooms/deleteUserRoom"
import type { UserRoomListItem, UserSavedRoom } from "@/types/roomTypes"

/**
 * React Query keys for user rooms data
 */
export const userRoomsQueryKeys = {
  all: ["userRooms"] as const,
  list: (email?: string | null) =>
    ["userRooms", "list", email?.toLowerCase().trim() || "self"] as const,
  detail: (id: string) => ["userRooms", "detail", id] as const,
}

/**
 * Hook for fetching a user's saved rooms list.
 *
 * @param email - Optional email used for cache key separation
 * @param options - Optional query options
 * @returns React Query result with rooms list
 */
export function useUserRoomsList(
  email?: string | null,
  options?: { enabled?: boolean }
) {
  const normalizedEmail = email?.toLowerCase().trim()

  return useQuery<UserRoomListItem[], Error>({
    queryKey: userRoomsQueryKeys.list(normalizedEmail),
    queryFn: async () => {
      const data = await getUserRoomsList()
      return data
    },
    enabled: (options?.enabled ?? true),
    staleTime: 2 * 60 * 1000, // 2 minutes - user rooms change more frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
  })
}

/**
 * Mutation hook for saving a user room.
 *
 * On success:
 * - Optimistically updates the list cache with new projectId/projectName when updating existing room
 * - Invalidates the rooms list for refetch
 *
 * @returns Mutation result with save function
 */
export function useSaveUserRoom(cacheKeyEmail?: string | null) {
  const queryClient = useQueryClient()
  const listKey = userRoomsQueryKeys.list(cacheKeyEmail)

  return useMutation({
    mutationFn: async (input: SaveUserRoomData) => {
      const result = await saveUserRoom(input)
      return { ...result, input }
    },
    onSuccess: (data) => {
      // Optimistically update the list cache item with new projectId if updating existing room
      if (data.input.userRoomId && data.input.projectId) {
        const previousRooms = queryClient.getQueryData<UserRoomListItem[]>(listKey)
        if (previousRooms) {
          queryClient.setQueryData<UserRoomListItem[]>(
            listKey,
            previousRooms.map((room) =>
              room.id === data.input.userRoomId
                ? {
                    ...room,
                    projectId: data.input.projectId,
                    projectName: data.input.projectName || room.projectName,
                    updatedAt: data.input.updatedAt || room.updatedAt,
                  }
                : room
            )
          )
        }
      }
      // Invalidate the rooms list for this user to ensure fresh data
      queryClient.invalidateQueries({
        queryKey: listKey,
      })
    },
  })
}

/**
 * Mutation hook for deleting a user room.
 *
 * Optimistically removes the room from the list cache.
 *
 * @returns Mutation result with delete function
 */
export function useDeleteUserRoom(cacheKeyEmail?: string | null) {
  const queryClient = useQueryClient()

  type DeleteVariables = { roomId: string }
  type DeleteContext = { previousRooms?: UserRoomListItem[] }
  type DeleteResult = { success: boolean }

  const listKey = userRoomsQueryKeys.list(cacheKeyEmail)

  return useMutation<DeleteResult, Error, DeleteVariables, DeleteContext>({
    mutationFn: async ({ roomId }) => {
      const result = await deleteUserRoom(roomId)
      return result
    },
    onMutate: async ({ roomId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: listKey,
      })

      // Snapshot previous value
      const previousRooms = queryClient.getQueryData<UserRoomListItem[]>(
        listKey
      )

      // Optimistically update cache
      if (previousRooms) {
        queryClient.setQueryData<UserRoomListItem[]>(
          listKey,
          previousRooms.filter((room) => room.id !== roomId)
        )
      }

      return { previousRooms }
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previousRooms) {
        queryClient.setQueryData(
          listKey,
          context.previousRooms
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      // Refetch after error or success
      if (variables) {
        queryClient.invalidateQueries({
          queryKey: listKey,
        })
      }
    },
  })
}

/**
 * Mutation hook for loading a specific user room.
 *
 * Uses mutation since it's an imperative on-demand action.
 *
 * @returns Mutation result with load function
 */
export function useLoadUserRoom() {
  return useMutation<UserSavedRoom | null, Error, string>({
    mutationFn: async (roomId) => {
      const room = await getUserRoom(roomId)
      return room
    },
  })
}
