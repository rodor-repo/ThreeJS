import { useEffect, useRef } from "react"
import type { WsProduct } from "@/types/erpTypes"
import type { GDMapping } from "./useGDMapping"
import { findDimIdByGDType } from "../utils/dimensionUtils"

/**
 * Options for the dimension sync hook
 */
export interface UseDimensionSyncOptions {
  /** Cabinet ID - sync is disabled if undefined */
  cabinetId: string | undefined
  /** Current cabinet width from selectedCabinet.dimensions.width */
  cabinetWidth: number | undefined
  /** WsProduct dims for finding width dimension ID */
  dims: WsProduct["dims"] | undefined
  /** GD mapping for width detection */
  gdMapping: GDMapping
  /** Callback to update values when width changes externally */
  onWidthSync: (widthDimId: string, newWidth: number) => void
  /** Callback to update persisted values */
  onPersistedWidthSync?: (widthDimId: string, newWidth: number) => void
}

/**
 * Hook to sync panel values when cabinet dimensions change externally
 *
 * This handles cases like:
 * - Width changes from group rules
 * - External modifications to cabinet dimensions
 *
 * Uses a ref to track the last synced width to detect external changes
 */
export function useDimensionSync(options: UseDimensionSyncOptions): void {
  const {
    cabinetId,
    cabinetWidth,
    dims,
    gdMapping,
    onWidthSync,
    onPersistedWidthSync,
  } = options

  const lastSyncedWidthRef = useRef<number | null>(null)

  // Reset sync ref when cabinet changes
  useEffect(() => {
    lastSyncedWidthRef.current = null
  }, [cabinetId])

  // Sync values with current cabinet dimensions when they change externally
  useEffect(() => {
    if (!dims || !cabinetId || cabinetWidth === undefined) return

    const currentWidth = cabinetWidth

    // Check if width has changed externally
    if (
      lastSyncedWidthRef.current === null ||
      lastSyncedWidthRef.current !== currentWidth
    ) {
      // Find width dimension ID
      const widthDimId = findDimIdByGDType(dims, gdMapping.widthGDIds)

      // If we found the width dimension ID and the width has changed, update it
      if (
        widthDimId &&
        (lastSyncedWidthRef.current === null ||
          Math.abs(lastSyncedWidthRef.current - currentWidth) > 0.1)
      ) {
        // Width changed externally - sync the values state
        onWidthSync(widthDimId, currentWidth)
        onPersistedWidthSync?.(widthDimId, currentWidth)

        // Update ref to track the synced width
        lastSyncedWidthRef.current = currentWidth
      }
    }
  }, [
    cabinetWidth,
    cabinetId,
    dims,
    gdMapping.widthGDIds,
    onWidthSync,
    onPersistedWidthSync,
  ])
}

/**
 * Options for full dimension sync (width, height, depth)
 */
export interface UseFullDimensionSyncOptions {
  cabinetId: string | undefined
  cabinetDimensions:
    | {
        width: number
        height: number
        depth: number
      }
    | undefined
  dims: WsProduct["dims"] | undefined
  gdMapping: GDMapping
  onDimensionsSync: (updates: Record<string, number>) => void
}

/**
 * Hook to sync all primary dimensions (width, height, depth) from cabinet
 * Use this when you need to sync more than just width
 */
export function useFullDimensionSync(
  options: UseFullDimensionSyncOptions
): void {
  const { cabinetId, cabinetDimensions, dims, gdMapping, onDimensionsSync } =
    options

  const lastSyncedRef = useRef<{
    width: number
    height: number
    depth: number
  } | null>(null)

  // Reset sync ref when cabinet changes
  useEffect(() => {
    lastSyncedRef.current = null
  }, [cabinetId])

  // Sync all dimensions
  useEffect(() => {
    if (!dims || !cabinetId || !cabinetDimensions) return

    const { width, height, depth } = cabinetDimensions
    const last = lastSyncedRef.current

    // Check if any dimension has changed
    const widthChanged = !last || Math.abs(last.width - width) > 0.1
    const heightChanged = !last || Math.abs(last.height - height) > 0.1
    const depthChanged = !last || Math.abs(last.depth - depth) > 0.1

    if (!widthChanged && !heightChanged && !depthChanged) return

    const updates: Record<string, number> = {}

    if (widthChanged) {
      const widthDimId = findDimIdByGDType(dims, gdMapping.widthGDIds)
      if (widthDimId) updates[widthDimId] = width
    }

    if (heightChanged) {
      const heightDimId = findDimIdByGDType(dims, gdMapping.heightGDIds)
      if (heightDimId) updates[heightDimId] = height
    }

    if (depthChanged) {
      const depthDimId = findDimIdByGDType(dims, gdMapping.depthGDIds)
      if (depthDimId) updates[depthDimId] = depth
    }

    if (Object.keys(updates).length > 0) {
      onDimensionsSync(updates)
      lastSyncedRef.current = { width, height, depth }
    }
  }, [cabinetDimensions, cabinetId, dims, gdMapping, onDimensionsSync])
}
