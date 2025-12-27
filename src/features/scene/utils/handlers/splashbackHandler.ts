import { CabinetData, WallDimensions } from "../../types"
import { ViewId } from "../../../cabinets/ViewManager"

interface ViewManagerResult {
  getCabinetsInView: (viewId: ViewId) => string[]
}

export const handleSplashbackHeightChange = (
  viewId: ViewId,
  height: number,
  params: {
    cabinets: CabinetData[]
    viewManager: ViewManagerResult
    wallDimensions: WallDimensions
  }
) => {
  const { cabinets, viewManager, wallDimensions } = params

  // Get all cabinets in this view
  const cabinetIds = viewManager.getCabinetsInView(viewId as ViewId)
  const viewCabinets = cabinets.filter((c) => cabinetIds.includes(c.cabinetId))

  // Get all base/tall cabinets
  const baseTallCabinets = viewCabinets.filter(c => c.cabinetType === 'base' || c.cabinetType === 'tall')
  
  // Get all overhead (top) cabinets
  const overheadCabinets = viewCabinets.filter(c => c.cabinetType === 'top')

  // If no base/tall or no overhead cabinets, nothing to do
  if (baseTallCabinets.length === 0 || overheadCabinets.length === 0) return

  // Find the HIGHEST base/tall cabinet top (Y + height) - this is our reference point
  const highestBaseTop = Math.max(
    ...baseTallCabinets.map(c => c.group.position.y + c.carcass.dimensions.height)
  )

  // Calculate target overhead bottom Y position: highest base top + splashback height
  const targetOverheadBottomY = highestBaseTop + height

  // Find the tallest Tall cabinet in the view (if any) to use as constraint
  const tallCabinets = viewCabinets.filter(c => c.cabinetType === 'tall')
  let maxTallTop: number | null = null
  if (tallCabinets.length > 0) {
    maxTallTop = Math.max(
      ...tallCabinets.map(tall => tall.group.position.y + tall.carcass.dimensions.height)
    )
  }

  // Position ALL overhead cabinets so their bottom is at targetOverheadBottomY
  overheadCabinets.forEach((overheadCabinet) => {
    let newY = targetOverheadBottomY

    // Calculate maximum allowed Y position based on constraints
    // 1. Back wall height constraint: overhead top cannot exceed wall height
    // overhead top = newY + overheadHeight <= wallHeight
    // newY <= wallHeight - overheadHeight
    const maxYFromWall = wallDimensions.height - overheadCabinet.carcass.dimensions.height
    
    // 2. Tall cabinet constraint: if Tall cabinet exists, overhead top cannot exceed Tall top
    // overhead top = newY + overheadHeight <= maxTallTop
    // newY <= maxTallTop - overheadHeight
    let maxYFromTall: number | null = null
    if (maxTallTop !== null) {
      maxYFromTall = maxTallTop - overheadCabinet.carcass.dimensions.height
    }

    // Use the most restrictive constraint (smallest max Y)
    let maxY = maxYFromWall
    if (maxYFromTall !== null && maxYFromTall < maxY) {
      maxY = maxYFromTall
    }

    // Apply boundary clamping
    const clampedY = Math.max(0, Math.min(maxY, newY))

    overheadCabinet.group.position.set(
      overheadCabinet.group.position.x,
      clampedY,
      overheadCabinet.group.position.z
    )
  })
}
