import { useState, useCallback, useEffect } from "react"
import type { CarcassDimensions } from "@/features/carcass"
import type { SelectedCabinetSnapshot } from "../../productPanel.types"
import type { CabinetData } from "@/features/scene/types"
import { updateKickerPosition } from "@/features/scene/utils/handlers/kickerPositionHandler"

/**
 * Options for the useOffTheFloor hook
 */
export interface UseOffTheFloorOptions {
  selectedCabinet: SelectedCabinetSnapshot | undefined
  allCabinets: CabinetData[] | undefined
  onDimensionsChange?: (dims: CarcassDimensions) => void
}

/**
 * Return type for the useOffTheFloor hook
 */
export interface UseOffTheFloorReturn {
  offTheFloor: number
  editingOffTheFloor: string
  setEditingOffTheFloor: (value: string) => void
  handleOffTheFloorChange: (value: number) => void
}

/**
 * Hook to manage off-the-floor positioning for fillers and panels.
 *
 * Handles:
 * - Tracking the Y position (off-the-floor height)
 * - Managing editing state for the input field
 * - Updating cabinet position and height when value changes
 * - Updating parent kicker positions
 */
export function useOffTheFloor(
  options: UseOffTheFloorOptions
): UseOffTheFloorReturn {
  const { selectedCabinet, allCabinets, onDimensionsChange } = options

  const [offTheFloor, setOffTheFloor] = useState<number>(0)
  const [editingOffTheFloor, setEditingOffTheFloor] = useState<string>("")

  // Initialize from cabinet position when selected cabinet changes
  useEffect(() => {
    if (
      selectedCabinet &&
      (selectedCabinet.cabinetType === "filler" ||
        selectedCabinet.cabinetType === "panel")
    ) {
      const currentY = selectedCabinet.group.position.y
      setOffTheFloor(Math.max(0, Math.min(1200, currentY)))
      setEditingOffTheFloor("")
    }
  }, [selectedCabinet])

  // Handle off-the-floor value changes
  const handleOffTheFloorChange = useCallback(
    (value: number) => {
      setOffTheFloor(value)
      if (selectedCabinet && allCabinets) {
        const actualCabinet = allCabinets.find(
          (c) => c.cabinetId === selectedCabinet.cabinetId
        )
        if (actualCabinet) {
          const currentY = actualCabinet.group.position.y
          const currentHeight = actualCabinet.carcass.dimensions.height
          const topPosition = currentY + currentHeight
          const newHeight = topPosition - value

          actualCabinet.group.position.set(
            actualCabinet.group.position.x,
            value,
            actualCabinet.group.position.z
          )

          if (onDimensionsChange) {
            onDimensionsChange({
              width: actualCabinet.carcass.dimensions.width,
              height: newHeight,
              depth: actualCabinet.carcass.dimensions.depth,
            })
          }

          // Update parent kicker
          if (actualCabinet.parentCabinetId && allCabinets) {
            const parentCabinet = allCabinets.find(
              (c) => c.cabinetId === actualCabinet.parentCabinetId
            )
            if (
              parentCabinet &&
              (parentCabinet.cabinetType === "base" ||
                parentCabinet.cabinetType === "tall")
            ) {
              updateKickerPosition(parentCabinet, allCabinets, {
                dimensionsChanged: true,
              })
            }
          }
        }
      }
    },
    [selectedCabinet, allCabinets, onDimensionsChange]
  )

  return {
    offTheFloor,
    editingOffTheFloor,
    setEditingOffTheFloor,
    handleOffTheFloorChange,
  }
}
