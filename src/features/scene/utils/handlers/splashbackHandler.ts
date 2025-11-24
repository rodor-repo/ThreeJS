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

  // Apply the gap to all base/tall and top cabinet pairs in this view
  const cabinetIds = viewManager.getCabinetsInView(viewId as ViewId)
  const viewCabinets = cabinets.filter((c) => cabinetIds.includes(c.cabinetId))

  // Group cabinets by their X position ranges (cabinets that overlap horizontally)
  const xRanges: Array<{
    minX: number
    maxX: number
    baseCabinets: CabinetData[]
    topCabinets: CabinetData[]
  }> = []

  viewCabinets.forEach((cabinet) => {
    const x = cabinet.group.position.x
    const width = cabinet.carcass.dimensions.width
    const minX = x
    const maxX = x + width

    // Find if this cabinet overlaps with any existing X range
    let foundRange = false
    for (const range of xRanges) {
      // Check if there's horizontal overlap
      if (!(maxX < range.minX || minX > range.maxX)) {
        // Overlaps - merge into this range
        range.minX = Math.min(range.minX, minX)
        range.maxX = Math.max(range.maxX, maxX)

        // Add cabinet to appropriate list
        if (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall") {
          if (!range.baseCabinets.includes(cabinet)) {
            range.baseCabinets.push(cabinet)
          }
        } else if (cabinet.cabinetType === "top") {
          if (!range.topCabinets.includes(cabinet)) {
            range.topCabinets.push(cabinet)
          }
        }

        foundRange = true
        break
      }
    }

    if (!foundRange) {
      // Create new X range
      const baseCabinets: CabinetData[] = []
      const topCabinets: CabinetData[] = []

      if (cabinet.cabinetType === "base" || cabinet.cabinetType === "tall") {
        baseCabinets.push(cabinet)
      } else if (cabinet.cabinetType === "top") {
        topCabinets.push(cabinet)
      }

      xRanges.push({ minX, maxX, baseCabinets, topCabinets })
    }
  })

  // For each X range, apply splashback height gap
  xRanges.forEach((range) => {
    // Skip if no top cabinets to position
    if (range.topCabinets.length === 0) return

    // Skip if no base/tall cabinets to measure from
    if (range.baseCabinets.length === 0) return

    // Find the highest base/tall cabinet in this range
    const highestBase = range.baseCabinets.reduce((prev, curr) => {
      const prevTop = prev.group.position.y + prev.carcass.dimensions.height
      const currTop = curr.group.position.y + curr.carcass.dimensions.height
      return currTop > prevTop ? curr : prev
    }, range.baseCabinets[0])

    if (!highestBase) return

    const baseTop =
      highestBase.group.position.y + highestBase.carcass.dimensions.height
    const targetTopBottom = baseTop + height

    // Position all top cabinets so their bottom is at targetTopBottom
    range.topCabinets.forEach((topCabinet) => {
      const newY = targetTopBottom

      // Apply boundary clamping
      const clampedY = Math.max(
        0,
        Math.min(
          wallDimensions.height - topCabinet.carcass.dimensions.height,
          newY
        )
      )

      topCabinet.group.position.set(
        topCabinet.group.position.x,
        clampedY,
        topCabinet.group.position.z
      )
    })
  })
}
