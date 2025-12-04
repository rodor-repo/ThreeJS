import { CabinetData } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"
import { updateChildCabinets } from "./childCabinetHandler"
import { updateKickerPosition } from "./kickerPositionHandler"

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

export const handleKickerHeightChange = (
  viewId: ViewId,
  kickerHeight: number,
  params: {
    cabinets: CabinetData[]
    viewManager: ViewManagerResult
  }
) => {
  const { cabinets, viewManager } = params

  // Get all cabinets in this view
  const cabinetIds = viewManager.getCabinetsInView(viewId as ViewId)
  const viewCabinets = cabinets.filter((c) => cabinetIds.includes(c.cabinetId))

  // Get all base/tall cabinets in the view
  const baseTallCabinets = viewCabinets.filter(
    (c) => c.cabinetType === "base" || c.cabinetType === "tall"
  )

  // Update kicker height for all base/tall cabinets in the view
  baseTallCabinets.forEach((cabinet) => {
    // Update the kicker height which will also update the Y position
    cabinet.carcass.updateKickerHeight(kickerHeight)
    
    // Update child cabinets (fillers/panels) when parent kicker height changes
    updateChildCabinets(cabinet, cabinets, {
      kickerHeightChanged: true
    })
    
    // Update kicker position when parent kicker height changes
    updateKickerPosition(cabinet, cabinets, {
      kickerHeightChanged: true
    })
  })
}

