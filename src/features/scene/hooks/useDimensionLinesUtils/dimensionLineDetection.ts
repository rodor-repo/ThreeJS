/**
 * Dimension line detection utilities
 * Functions for detecting empty spaces and checking for dimension line penetration
 */
import type { CabinetData } from "../../types"
import type { ViewManager, ViewId } from "../../../cabinets/ViewManager"

// ==================== Empty Space Types ====================

export interface EmptySpaceY {
  bottomY: number
  topY: number
  height: number
  leftmostX: number
  viewId: ViewId
}

export interface EmptySpaceX {
  leftX: number
  rightX: number
  width: number
  topY: number
  y: number
  leftCabinetType: string
  rightCabinetType: string
  baseTopY: number
  viewId: ViewId
}

export interface EmptySpaceXOverhead {
  leftX: number
  rightX: number
  width: number
  topY: number
  viewId: ViewId
}

// ==================== Detection Functions ====================

/**
 * Check if a dimension line drawn on the left side of a cabinet would penetrate/overlap with another cabinet
 */
export function wouldDimensionLinePenetrate(
  cabinet: CabinetData,
  allCabinets: CabinetData[],
  offset: number = 50
): boolean {
  const cabinetX = cabinet.group.position.x
  const cabinetY = cabinet.group.position.y
  const cabinetHeight = cabinet.carcass.dimensions.height
  const cabinetZ = cabinet.group.position.z
  const cabinetDepth = cabinet.carcass.dimensions.depth

  // Dimension line is drawn at x - offset (to the left of the cabinet)
  const dimensionLineX = cabinetX - offset

  // Check if any other cabinet overlaps with the space where the dimension line would be
  for (const other of allCabinets) {
    if (other === cabinet) continue

    const otherX = other.group.position.x
    const otherWidth = other.carcass.dimensions.width
    const otherY = other.group.position.y
    const otherHeight = other.carcass.dimensions.height
    const otherZ = other.group.position.z
    const otherDepth = other.carcass.dimensions.depth

    const otherLeft = otherX
    const otherRight = otherX + otherWidth
    const otherBottom = otherY
    const otherTop = otherY + otherHeight
    const otherFront = otherZ + otherDepth

    // Check if the dimension line X position is within the other cabinet's X range
    const xOverlap = dimensionLineX >= otherLeft && dimensionLineX <= otherRight

    if (xOverlap) {
      // Check if there's vertical overlap (for height dimension) or Z overlap (for depth dimension)
      const heightYOverlap =
        cabinetY < otherTop && cabinetY + cabinetHeight > otherBottom
      const dimensionLineZ = cabinetZ + cabinetDepth + 50
      const depthZOverlap =
        dimensionLineZ >= otherZ && dimensionLineZ <= otherFront

      if (heightYOverlap || depthZOverlap) {
        return true
      }
    }
  }

  return false
}

/**
 * Detect empty spaces in Y-axis (height) between cabinets in the same view
 */
export function detectEmptySpacesY(
  cabinets: CabinetData[],
  viewManager: ViewManager
): EmptySpaceY[] {
  const emptySpaces: EmptySpaceY[] = []

  const activeViews = viewManager.getActiveViews()

  activeViews.forEach((view) => {
    const viewId = view.id
    if (viewId === "none") return

    const cabinetIds = viewManager.getCabinetsInView(viewId)
    const viewCabinets = cabinets.filter((c) =>
      cabinetIds.includes(c.cabinetId) && c.cabinetType !== 'kicker'
    )

    if (viewCabinets.length < 2) return

    // Group cabinets by X position ranges for vertical gaps
    const xRanges: Array<{
      minX: number
      maxX: number
      cabinets: CabinetData[]
    }> = []

    viewCabinets.forEach((cabinet) => {
      const x = cabinet.group.position.x
      const width = cabinet.carcass.dimensions.width
      const minX = x
      const maxX = x + width

      let foundRange = false
      for (const range of xRanges) {
        if (!(maxX < range.minX || minX > range.maxX)) {
          range.minX = Math.min(range.minX, minX)
          range.maxX = Math.max(range.maxX, maxX)
          range.cabinets.push(cabinet)
          foundRange = true
          break
        }
      }

      if (!foundRange) {
        xRanges.push({ minX, maxX, cabinets: [cabinet] })
      }
    })

    // Find vertical gaps in each X range
    xRanges.forEach((range) => {
      const sortedCabinets = [...range.cabinets].sort(
        (a, b) => a.group.position.y - b.group.position.y
      )

      for (let i = 0; i < sortedCabinets.length - 1; i++) {
        const lowerCabinet = sortedCabinets[i]
        const upperCabinet = sortedCabinets[i + 1]

        const lowerType = lowerCabinet.cabinetType
        const upperType = upperCabinet.cabinetType

        const isBaseOrTall = lowerType === "base" || lowerType === "tall"
        const isTop = upperType === "top"

        if (isBaseOrTall && isTop) {
          const lowerTop =
            lowerCabinet.group.position.y +
            lowerCabinet.carcass.dimensions.height
          const upperBottom = upperCabinet.group.position.y

          if (upperBottom > lowerTop) {
            const gapHeight = upperBottom - lowerTop

            if (gapHeight <= 0.1) continue

            const topCabinetsInRange = range.cabinets.filter(
              (c) => c.cabinetType === "top"
            )
            if (topCabinetsInRange.length > 0) {
              let minTopX = Infinity
              let maxTopX = -Infinity
              topCabinetsInRange.forEach((cab) => {
                minTopX = Math.min(minTopX, cab.group.position.x)
                maxTopX = Math.max(
                  maxTopX,
                  cab.group.position.x + cab.carcass.dimensions.width
                )
              })
              const centerX = (minTopX + maxTopX) / 2

              emptySpaces.push({
                bottomY: lowerTop,
                topY: upperBottom,
                height: gapHeight,
                leftmostX: centerX,
                viewId,
              })
            }
          }
        }
      }
    })

    // Check Base/Tall-Top gaps without X overlap requirement
    const baseTallCabinets = viewCabinets.filter(
      (c) => c.cabinetType === "base" || c.cabinetType === "tall"
    )
    const topCabinetsForSplashback = viewCabinets.filter(
      (c) => c.cabinetType === "top"
    )

    baseTallCabinets.forEach((baseTallCabinet) => {
      topCabinetsForSplashback.forEach((topCabinet) => {
        const baseTallTop =
          baseTallCabinet.group.position.y +
          baseTallCabinet.carcass.dimensions.height
        const topBottom = topCabinet.group.position.y

        if (topBottom > baseTallTop) {
          const gapHeight = topBottom - baseTallTop

          if (gapHeight <= 0.1) return

          const alreadyDetected = emptySpaces.some(
            (space) =>
              space.viewId === viewId &&
              Math.abs(space.bottomY - baseTallTop) < 0.1 &&
              Math.abs(space.topY - topBottom) < 0.1 &&
              Math.abs(space.height - gapHeight) < 0.1
          )

          if (alreadyDetected) return

          let centerX: number
          if (topCabinetsForSplashback.length > 0) {
            let minTopX = Infinity
            let maxTopX = -Infinity
            topCabinetsForSplashback.forEach((cab) => {
              minTopX = Math.min(minTopX, cab.group.position.x)
              maxTopX = Math.max(
                maxTopX,
                cab.group.position.x + cab.carcass.dimensions.width
              )
            })
            centerX = (minTopX + maxTopX) / 2
          } else {
            const baseTallCenterX =
              baseTallCabinet.group.position.x +
              baseTallCabinet.carcass.dimensions.width / 2
            const topCenterX =
              topCabinet.group.position.x +
              topCabinet.carcass.dimensions.width / 2
            centerX = (baseTallCenterX + topCenterX) / 2
          }

          emptySpaces.push({
            bottomY: baseTallTop,
            topY: topBottom,
            height: gapHeight,
            leftmostX: centerX,
            viewId,
          })
        }
      })
    })

    // Check Top-Tall gaps
    const topCabinets = viewCabinets.filter((c) => c.cabinetType === "top")
    const tallCabinets = viewCabinets.filter((c) => c.cabinetType === "tall")

    topCabinets.forEach((topCabinet) => {
      tallCabinets.forEach((tallCabinet) => {
        const topCabTop =
          topCabinet.group.position.y + topCabinet.carcass.dimensions.height
        const tallCabTop =
          tallCabinet.group.position.y + tallCabinet.carcass.dimensions.height

        const gapHeight = Math.abs(tallCabTop - topCabTop)

        if (gapHeight <= 0.1) return

        const centerX =
          topCabinet.group.position.x + topCabinet.carcass.dimensions.width / 2
        const bottomY = Math.min(topCabTop, tallCabTop)
        const topY = Math.max(topCabTop, tallCabTop)

        emptySpaces.push({
          bottomY,
          topY,
          height: gapHeight,
          leftmostX: centerX,
          viewId,
        })
      })
    })
  })

  return emptySpaces
}

/**
 * Detect empty spaces in X-axis between cabinets
 */
export function detectEmptySpacesX(
  cabinets: CabinetData[],
  viewManager: ViewManager
): EmptySpaceX[] {
  const emptySpaces: EmptySpaceX[] = []

  const activeViews = viewManager.getActiveViews()

  activeViews.forEach((view) => {
    const viewId = view.id
    if (viewId === "none") return

    const cabinetIds = viewManager.getCabinetsInView(viewId)
    const viewCabinets = cabinets.filter((c) =>
      cabinetIds.includes(c.cabinetId) && c.cabinetType !== 'kicker'
    )

    if (viewCabinets.length < 2) return

    // Group cabinets by Y position ranges
    const yRanges: Array<{
      minY: number
      maxY: number
      cabinets: CabinetData[]
    }> = []

    viewCabinets.forEach((cabinet) => {
      const y = cabinet.group.position.y
      const height = cabinet.carcass.dimensions.height
      const minY = y
      const maxY = y + height

      let foundRange = false
      for (const range of yRanges) {
        if (!(maxY < range.minY || minY > range.maxY)) {
          range.minY = Math.min(range.minY, minY)
          range.maxY = Math.max(range.maxY, maxY)
          range.cabinets.push(cabinet)
          foundRange = true
          break
        }
      }

      if (!foundRange) {
        yRanges.push({ minY, maxY, cabinets: [cabinet] })
      }
    })

    // Find horizontal gaps in each Y range
    yRanges.forEach((range) => {
      const sortedCabinets = [...range.cabinets].sort(
        (a, b) => a.group.position.x - b.group.position.x
      )

      for (let i = 0; i < sortedCabinets.length - 1; i++) {
        const leftCabinet = sortedCabinets[i]
        const rightCabinet = sortedCabinets[i + 1]

        const leftCabinetType = leftCabinet.cabinetType
        const rightCabinetType = rightCabinet.cabinetType

        // Skip Base-to-Top combinations
        if (
          (leftCabinetType === "base" && rightCabinetType === "top") ||
          (leftCabinetType === "top" && rightCabinetType === "base")
        ) {
          continue
        }

        const leftRight =
          leftCabinet.group.position.x + leftCabinet.carcass.dimensions.width
        const rightLeft = rightCabinet.group.position.x

        if (rightLeft > leftRight) {
          const gapWidth = rightLeft - leftRight

          if (gapWidth <= 0.1) continue

          const leftTopY =
            leftCabinet.group.position.y + leftCabinet.carcass.dimensions.height
          const rightTopY =
            rightCabinet.group.position.y +
            rightCabinet.carcass.dimensions.height

          let topY: number
          let baseTopY: number

          const isBaseToBase =
            leftCabinetType === "base" && rightCabinetType === "base"
          const isBaseToTall =
            (leftCabinetType === "base" && rightCabinetType === "tall") ||
            (leftCabinetType === "tall" && rightCabinetType === "base")

          if (isBaseToBase) {
            const baseCabinetsInRange = range.cabinets.filter(
              (c) => c.cabinetType === "base"
            )
            if (baseCabinetsInRange.length > 0) {
              const baseTopYs = baseCabinetsInRange.map(
                (c) => c.group.position.y + c.carcass.dimensions.height
              )
              topY = Math.max(...baseTopYs)
              baseTopY = topY
            } else {
              topY = Math.max(leftTopY, rightTopY)
              baseTopY = topY
            }
          } else if (isBaseToTall) {
            topY = Math.max(leftTopY, rightTopY)
            baseTopY = leftCabinetType === "base" ? leftTopY : rightTopY
          } else {
            topY = Math.max(leftTopY, rightTopY)
            baseTopY = topY
          }

          const leftY = leftCabinet.group.position.y
          const rightY = rightCabinet.group.position.y
          const y = Math.min(leftY, rightY)

          emptySpaces.push({
            leftX: leftRight,
            rightX: rightLeft,
            width: gapWidth,
            topY,
            y,
            leftCabinetType,
            rightCabinetType,
            baseTopY,
            viewId,
          })
        }
      }
    })
  })

  return emptySpaces
}
