import { CabinetData } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { updateKickerPosition } from "./kickerPositionHandler"

interface ViewManagerResult {
  viewManager: {
    assignCabinetToView: (cabinetId: string, viewId: ViewId) => void
  }
}

export const handleDeleteCabinet = (
  cabinetToDelete: CabinetData,
  params: {
    viewManager: ViewManagerResult
    setCabinetGroups: (
      update: (
        prev: Map<string, Array<{ cabinetId: string; percentage: number }>>
      ) => Map<string, Array<{ cabinetId: string; percentage: number }>>
    ) => void
    deleteCabinet: (id: string) => void
    setCabinetToDelete: (cabinet: CabinetData | null) => void
    allCabinets: CabinetData[] // Add allCabinets to update kicker after deletion
  }
) => {
  const { viewManager, setCabinetGroups, deleteCabinet, setCabinetToDelete, allCabinets } =
    params

  // If deleting a child filler/panel, update parent kicker before deletion
  if (
    cabinetToDelete.parentCabinetId &&
    (cabinetToDelete.cabinetType === 'filler' || cabinetToDelete.cabinetType === 'panel') &&
    cabinetToDelete.hideLockIcons === true
  ) {
    const parentCabinet = allCabinets.find(c => c.cabinetId === cabinetToDelete.parentCabinetId)
    if (parentCabinet && (parentCabinet.cabinetType === 'base' || parentCabinet.cabinetType === 'tall')) {
      // Update kicker before deleting child (child still exists in allCabinets at this point)
      updateKickerPosition(parentCabinet, allCabinets, {
        dimensionsChanged: true
      })
    }
  }

  // Remove from ViewManager if assigned to a view
  if (cabinetToDelete.viewId && cabinetToDelete.viewId !== "none") {
    viewManager.viewManager.assignCabinetToView(
      cabinetToDelete.cabinetId,
      "none"
    )
  }

  // Remove group data for this cabinet
  setCabinetGroups((prev) => {
    const newMap = new Map(prev)
    newMap.delete(cabinetToDelete.cabinetId)

    // Also remove this cabinet from any other cabinet's groups
    newMap.forEach((group, cabinetId) => {
      const updatedGroup = group.filter(
        (g) => g.cabinetId !== cabinetToDelete.cabinetId
      )

      if (updatedGroup.length !== group.length) {
        // Recalculate percentages if a cabinet was removed
        if (updatedGroup.length > 0) {
          const total = updatedGroup.reduce((sum, g) => sum + g.percentage, 0)
          if (total !== 100) {
            updatedGroup.forEach((g) => {
              g.percentage = Math.round((g.percentage / total) * 100)
            })

            // Ensure total is exactly 100 due to rounding
            const finalTotal = updatedGroup.reduce(
              (sum, g) => sum + g.percentage,
              0
            )
            if (finalTotal !== 100) {
              updatedGroup[0].percentage += 100 - finalTotal
            }
          }
          newMap.set(cabinetId, updatedGroup)
        } else {
          // If group is empty after removal, delete the group entry
          newMap.delete(cabinetId)
        }
      }
    })
    return newMap
  })

  // Delete the cabinet
  deleteCabinet(cabinetToDelete.cabinetId)
  setCabinetToDelete(null)
}
