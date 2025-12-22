import { describe, it, expect, vi, beforeEach } from "vitest"
import * as THREE from "three"
import {
  updateAllDependentComponents,
  updateChildCabinets,
} from "./dependentComponentsHandler"
import { CabinetData, WallDimensions } from "../../types"
import { updateKickerPosition } from "./kickerPositionHandler"
import { updateBulkheadPosition } from "./bulkheadPositionHandler"
import { updateBenchtopPosition } from "./benchtopPositionHandler"

// Mock the sub-handlers
vi.mock("./kickerPositionHandler", () => ({
  updateKickerPosition: vi.fn(),
}))
vi.mock("./bulkheadPositionHandler", () => ({
  updateBulkheadPosition: vi.fn(),
  updateReturnBulkheads: vi.fn(),
}))
vi.mock("./underPanelPositionHandler", () => ({
  updateUnderPanelPosition: vi.fn(),
}))
vi.mock("./benchtopPositionHandler", () => ({
  updateBenchtopPosition: vi.fn(),
}))

describe("dependentComponentsHandler", () => {
  let mockCabinet: CabinetData
  let allCabinets: CabinetData[]
  let wallDimensions: WallDimensions

  beforeEach(() => {
    vi.clearAllMocks()

    mockCabinet = {
      cabinetId: "parent-1",
      cabinetType: "base",
      group: new THREE.Group(),
      carcass: {
        dimensions: { width: 600, height: 720, depth: 560 },
        config: { overhangDoor: false },
        updateDimensions: vi.fn(),
      } as any,
    } as any
    mockCabinet.group.position.set(100, 150, 0)

    allCabinets = [mockCabinet]
    wallDimensions = { height: 2400, length: 3000 }
  })

  describe("updateAllDependentComponents", () => {
    it("should call updateBenchtopPosition with positionChanged=true when kickerHeightChanged is true", () => {
      updateAllDependentComponents(mockCabinet, allCabinets, wallDimensions, {
        kickerHeightChanged: true,
      })

      expect(updateBenchtopPosition).toHaveBeenCalledWith(
        mockCabinet,
        allCabinets,
        expect.objectContaining({
          positionChanged: true,
        })
      )
    })

    it("should call updateBulkheadPosition with positionChanged=true when kickerHeightChanged is true", () => {
      updateAllDependentComponents(mockCabinet, allCabinets, wallDimensions, {
        kickerHeightChanged: true,
      })

      expect(updateBulkheadPosition).toHaveBeenCalledWith(
        mockCabinet,
        allCabinets,
        wallDimensions,
        expect.objectContaining({
          positionChanged: true,
        })
      )
    })

    it("should call updateKickerPosition with kickerHeightChanged=true when kickerHeightChanged is true", () => {
      updateAllDependentComponents(mockCabinet, allCabinets, wallDimensions, {
        kickerHeightChanged: true,
      })

      expect(updateKickerPosition).toHaveBeenCalledWith(
        mockCabinet,
        allCabinets,
        expect.objectContaining({
          kickerHeightChanged: true,
        })
      )
    })
  })

  describe("updateChildCabinets", () => {
    it("should update child filler position when parent kicker height changes", () => {
      const childFiller: CabinetData = {
        cabinetId: "child-1",
        parentCabinetId: "parent-1",
        cabinetType: "filler",
        hideLockIcons: true,
        group: new THREE.Group(),
        carcass: {
          dimensions: { width: 100, height: 720, depth: 20 },
          updateDimensions: vi.fn(),
        } as any,
      } as any
      childFiller.group.position.set(0, 150, 0)

      allCabinets.push(childFiller)

      // Change parent Y (kicker height)
      mockCabinet.group.position.y = 200

      updateChildCabinets(mockCabinet, allCabinets, {
        kickerHeightChanged: true,
      })

      expect(childFiller.group.position.y).toBe(200)
    })

    it("should update child panel height and position for overhead with overhang", () => {
      mockCabinet.cabinetType = "top"
      mockCabinet.carcass.config.overhangDoor = true
      mockCabinet.group.position.y = 1500

      const childPanel: CabinetData = {
        cabinetId: "child-1",
        parentCabinetId: "parent-1",
        cabinetType: "panel",
        hideLockIcons: true,
        group: new THREE.Group(),
        carcass: {
          dimensions: { width: 16, height: 720, depth: 300 },
          updateDimensions: vi.fn(),
        } as any,
      } as any
      childPanel.group.position.set(100, 1500, 0)

      allCabinets.push(childPanel)

      updateChildCabinets(mockCabinet, allCabinets, {
        heightChanged: true,
      })

      // Height should be parent height (720) + overhang (20) = 740
      expect(childPanel.carcass.updateDimensions).toHaveBeenCalledWith(
        expect.objectContaining({ height: 740 })
      )
      // Y position should be parent Y (1500) - overhang (20) = 1480
      expect(childPanel.group.position.y).toBe(1480)
    })
  })

  describe("upward propagation", () => {
    it("should update parent accessories when a child filler/panel is updated", () => {
      const childFiller: CabinetData = {
        cabinetId: "child-1",
        parentCabinetId: "parent-1",
        cabinetType: "filler",
        hideLockIcons: true,
        group: new THREE.Group(),
        carcass: {
          dimensions: { width: 100, height: 720, depth: 20 },
          updateDimensions: vi.fn(),
        } as any,
      } as any

      allCabinets.push(childFiller)

      updateAllDependentComponents(childFiller, allCabinets, wallDimensions, {
        widthChanged: true,
      })

      // Should update parent kicker
      expect(updateKickerPosition).toHaveBeenCalledWith(
        mockCabinet,
        allCabinets,
        expect.objectContaining({ dimensionsChanged: true })
      )

      // Should update parent benchtop
      expect(updateBenchtopPosition).toHaveBeenCalledWith(
        mockCabinet,
        allCabinets,
        expect.objectContaining({ dimensionsChanged: true, childChanged: true })
      )
    })
  })
})
