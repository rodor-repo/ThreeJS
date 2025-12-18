import { CabinetData } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { updateKickerPosition } from "./kickerPositionHandler"
import { Benchtop } from "@/features/carcass/parts/Benchtop"

interface ViewManagerResult {
  viewManager: {
    assignCabinetToView: (cabinetId: string, viewId: ViewId) => void
  }
}

/**
 * Find all child products for a given parent cabinet
 * Child products include: fillers, panels, kickers, bulkheads, underPanels, benchtops
 */
const findChildCabinets = (parentCabinetId: string, allCabinets: CabinetData[]): CabinetData[] => {
  return allCabinets.filter(c =>
    // Fillers and panels attached via modal
    (c.parentCabinetId === parentCabinetId && c.hideLockIcons === true) ||
    // Kickers
    c.kickerParentCabinetId === parentCabinetId ||
    // Bulkheads
    c.bulkheadParentCabinetId === parentCabinetId ||
    // UnderPanels
    c.underPanelParentCabinetId === parentCabinetId ||
    // Benchtops
    c.benchtopParentCabinetId === parentCabinetId
  )
}

/**
 * Dispose child cabinet's geometry based on its type
 */
const disposeChildCabinet = (child: CabinetData): void => {
  // Dispose carcass if it exists
  if (child.carcass && typeof child.carcass.dispose === 'function') {
    child.carcass.dispose()
  }

  // Dispose benchtop-specific geometry
  if (child.cabinetType === 'benchtop' && child.group.userData.benchtop) {
    const benchtop = child.group.userData.benchtop as Benchtop
    if (typeof benchtop.dispose === 'function') {
      benchtop.dispose()
    }
  }

  // Dispose kicker-specific geometry
  if (child.cabinetType === 'kicker' && child.carcass?.kickerFace) {
    if (typeof child.carcass.kickerFace.dispose === 'function') {
      child.carcass.kickerFace.dispose()
    }
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
    allCabinets: CabinetData[]
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

  // If deleting a parent cabinet, delete all its children first
  const childCabinets = findChildCabinets(cabinetToDelete.cabinetId, allCabinets)
  
  childCabinets.forEach(child => {
    // Dispose child geometry
    disposeChildCabinet(child)

    // Remove from ViewManager if assigned to a view
    if (child.viewId && child.viewId !== "none") {
      viewManager.viewManager.assignCabinetToView(child.cabinetId, "none")
    }

    // Remove group data for this child
    setCabinetGroups((prev) => {
      const newMap = new Map(prev)
      newMap.delete(child.cabinetId)
      return newMap
    })

    // Delete the child cabinet
    deleteCabinet(child.cabinetId)
  })

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

  // Delete the parent cabinet
  deleteCabinet(cabinetToDelete.cabinetId)
  setCabinetToDelete(null)
}
