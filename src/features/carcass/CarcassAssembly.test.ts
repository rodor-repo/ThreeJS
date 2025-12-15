import * as THREE from "three"
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  CarcassAssembly,
  CarcassDimensions,
  CarcassConfig,
  CabinetType,
} from "./CarcassAssembly"
import { CarcassMaterial } from "./Material"
import { DoorMaterial } from "./DoorMaterial"

// Test fixtures
const createTestDimensions = (
  width = 600,
  height = 720,
  depth = 560
): CarcassDimensions => ({ width, height, depth })

const createTestConfig = (
  overrides: Partial<CarcassConfig> = {}
): Partial<CarcassConfig> => ({
  shelfCount: 2,
  doorEnabled: true,
  doorCount: 2,
  drawerEnabled: false,
  ...overrides,
})

const productId = "test-product-001"
const cabinetId = "test-cabinet-001"

describe("CarcassAssembly", () => {
  let assembly: CarcassAssembly

  afterEach(() => {
    assembly?.dispose()
  })

  // ============================================
  // CONSTRUCTION TESTS - Traditional Cabinet Types
  // ============================================
  describe("Construction - Traditional Cabinets", () => {
    const traditionalTypes: CabinetType[] = ["base", "top", "tall", "wardrobe"]

    traditionalTypes.forEach((type) => {
      describe(`${type} cabinet`, () => {
        beforeEach(() => {
          // Wardrobe needs taller dimensions to fit drawers + shelves
          const dims =
            type === "wardrobe"
              ? createTestDimensions(900, 2100, 600)
              : createTestDimensions()
          const config =
            type === "wardrobe"
              ? createTestConfig({ drawerEnabled: true, drawerQuantity: 3 })
              : createTestConfig()
          assembly = CarcassAssembly.create(
            type,
            dims,
            config,
            productId,
            cabinetId
          )
        })

        it("creates a THREE.Group", () => {
          expect(assembly.group).toBeInstanceOf(THREE.Group)
          expect(assembly.group.name).toBe(`${type}_carcass`)
        })

        it("sets cabinet type correctly", () => {
          expect(assembly.cabinetType).toBe(type)
        })

        it("stores dimensions", () => {
          // Wardrobe uses different dimensions (900x2100x600) to fit drawers + shelves
          if (type === "wardrobe") {
            expect(assembly.dimensions.width).toBe(900)
            expect(assembly.dimensions.height).toBe(2100)
            expect(assembly.dimensions.depth).toBe(600)
          } else {
            expect(assembly.dimensions.width).toBe(600)
            expect(assembly.dimensions.height).toBe(720)
            expect(assembly.dimensions.depth).toBe(560)
          }
        })

        it("creates left and right end panels", () => {
          expect(assembly.leftEnd).toBeDefined()
          expect(assembly.rightEnd).toBeDefined()
          expect(assembly.leftEnd.mesh).toBeInstanceOf(THREE.Mesh)
          expect(assembly.rightEnd.mesh).toBeInstanceOf(THREE.Mesh)
        })

        it("creates back panel", () => {
          expect(assembly.back).toBeDefined()
          expect(assembly.back.mesh).toBeInstanceOf(THREE.Mesh)
        })

        it("creates bottom panel", () => {
          expect(assembly.bottom).toBeDefined()
          expect(assembly.bottom.mesh).toBeInstanceOf(THREE.Mesh)
        })

        it("creates top panel", () => {
          expect(assembly.top).toBeDefined()
          expect(assembly.top.mesh).toBeInstanceOf(THREE.Mesh)
        })

        it("creates shelves based on config", () => {
          expect(assembly.shelves.length).toBe(2)
          assembly.shelves.forEach((shelf) => {
            expect(shelf.mesh).toBeInstanceOf(THREE.Mesh)
          })
        })

        if (type === "base" || type === "tall" || type === "wardrobe") {
          it("creates 4 legs for floor-standing cabinet", () => {
            expect(assembly.legs.length).toBe(4)
            assembly.legs.forEach((leg) => {
              expect(leg.mesh).toBeInstanceOf(THREE.Mesh)
            })
          })
        }

        if (type === "top") {
          it("has no legs for wall cabinet", () => {
            expect(assembly.legs.length).toBe(0)
          })
        }

        it("creates doors when enabled", () => {
          expect(assembly.doors.length).toBeGreaterThan(0)
        })
      })
    })
  })

  // ============================================
  // CONSTRUCTION TESTS - Special Cabinet Types
  // ============================================
  describe("Construction - Panel Cabinet", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "panel",
        createTestDimensions(100, 720, 560),
        {},
        productId,
        cabinetId
      )
    })

    it("creates panel cabinet with panel part", () => {
      expect(assembly.cabinetType).toBe("panel")
      expect(assembly.panel).toBeDefined()
    })

    it("does not create traditional carcass parts", () => {
      // Panel cabinets are simple single panels
      expect(assembly.shelves.length).toBe(0)
      expect(assembly.legs.length).toBe(0)
    })
  })

  describe("Construction - Filler Cabinet", () => {
    it("creates linear filler", () => {
      assembly = CarcassAssembly.create(
        "filler",
        createTestDimensions(100, 720, 560),
        { fillerType: "linear" },
        productId,
        cabinetId
      )
      expect(assembly.cabinetType).toBe("filler")
      expect(assembly.config.fillerType).toBe("linear")
      // Linear fillers use panel property (not frontPanel)
      expect(assembly.panel).toBeDefined()
    })

    it("creates L-shape filler with return position", () => {
      assembly = CarcassAssembly.create(
        "filler",
        createTestDimensions(100, 720, 560),
        { fillerType: "l-shape" },
        productId,
        cabinetId,
        { fillerReturnPosition: "right" }
      )
      expect(assembly.cabinetType).toBe("filler")
      expect(assembly.config.fillerType).toBe("l-shape")
      expect(assembly.config.fillerReturnPosition).toBe("right")
    })
  })

  describe("Construction - Kicker Cabinet", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "kicker",
        createTestDimensions(600, 150, 560),
        {},
        productId,
        cabinetId
      )
    })

    it("creates kicker with kickerFace", () => {
      expect(assembly.cabinetType).toBe("kicker")
      expect(assembly.kickerFace).toBeDefined()
    })
  })

  describe("Construction - UnderPanel Cabinet", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "underPanel",
        createTestDimensions(600, 50, 560),
        {},
        productId,
        cabinetId
      )
    })

    it("creates underPanel with underPanelFace", () => {
      expect(assembly.cabinetType).toBe("underPanel")
      expect(assembly.underPanelFace).toBeDefined()
    })
  })

  describe("Construction - Bulkhead Cabinet", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "bulkhead",
        createTestDimensions(600, 300, 560),
        {},
        productId,
        cabinetId
      )
    })

    it("creates bulkhead with bulkheadFace", () => {
      expect(assembly.cabinetType).toBe("bulkhead")
      expect(assembly.bulkheadFace).toBeDefined()
    })
  })

  // ============================================
  // CONFIGURATION DEFAULTS
  // ============================================
  describe("Configuration Defaults", () => {
    it("applies default material when not specified", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        {},
        productId,
        cabinetId
      )
      expect(assembly.config.material).toBeDefined()
      expect(assembly.config.material.getThickness()).toBeGreaterThan(0)
    })

    it("defaults shelfCount to 2", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        {},
        productId,
        cabinetId
      )
      expect(assembly.config.shelfCount).toBe(2)
    })

    it("defaults doorEnabled to true", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        {},
        productId,
        cabinetId
      )
      expect(assembly.config.doorEnabled).toBe(true)
    })

    it("defaults drawerEnabled to false", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        {},
        productId,
        cabinetId
      )
      expect(assembly.config.drawerEnabled).toBe(false)
    })

    it("sets overhangDoor true for top cabinets by default", () => {
      assembly = CarcassAssembly.create(
        "top",
        createTestDimensions(),
        {},
        productId,
        cabinetId
      )
      expect(assembly.config.overhangDoor).toBe(true)
    })

    it("sets overhangDoor false for base cabinets by default", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        {},
        productId,
        cabinetId
      )
      expect(assembly.config.overhangDoor).toBe(false)
    })

    it("respects explicit config overrides", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        { shelfCount: 5, doorEnabled: false },
        productId,
        cabinetId
      )
      expect(assembly.config.shelfCount).toBe(5)
      expect(assembly.config.doorEnabled).toBe(false)
    })
  })

  // ============================================
  // DIMENSION UPDATES
  // ============================================
  describe("Dimension Updates", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(600, 720, 560),
        createTestConfig(),
        productId,
        cabinetId
      )
    })

    it("updates dimensions property", () => {
      const newDims = createTestDimensions(800, 900, 600)
      assembly.updateDimensions(newDims)

      expect(assembly.dimensions.width).toBe(800)
      expect(assembly.dimensions.height).toBe(900)
      expect(assembly.dimensions.depth).toBe(600)
    })

    it("updates part geometries after dimension change", () => {
      const originalLeftEndGeom = assembly.leftEnd.mesh
        .geometry as THREE.BoxGeometry
      const originalHeight = originalLeftEndGeom.parameters.height

      assembly.updateDimensions(createTestDimensions(600, 900, 560))

      const updatedLeftEndGeom = assembly.leftEnd.mesh
        .geometry as THREE.BoxGeometry
      expect(updatedLeftEndGeom.parameters.height).toBe(900)
      expect(updatedLeftEndGeom.parameters.height).not.toBe(originalHeight)
    })
  })

  // ============================================
  // DOOR OPERATIONS
  // ============================================
  describe("Door Operations", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        createTestConfig({ doorEnabled: true, doorCount: 2 }),
        productId,
        cabinetId
      )
    })

    it("toggleDoors removes doors when disabled", () => {
      expect(assembly.doors.length).toBeGreaterThan(0)
      assembly.toggleDoors(false)
      expect(assembly.config.doorEnabled).toBe(false)
    })

    it("toggleDoors adds doors when enabled", () => {
      assembly.toggleDoors(false)
      assembly.toggleDoors(true)
      expect(assembly.config.doorEnabled).toBe(true)
    })

    it("updateDoorConfiguration changes door count", () => {
      assembly.updateDoorConfiguration(1)
      expect(assembly.config.doorCount).toBe(1)
    })

    it("updateOverhangDoor updates overhang setting (top cabinets only)", () => {
      // Overhang is only supported on top cabinets
      assembly.dispose()
      assembly = CarcassAssembly.create(
        "top",
        createTestDimensions(),
        createTestConfig({ doorEnabled: true, doorCount: 2 }),
        productId,
        cabinetId
      )
      assembly.updateOverhangDoor(true)
      expect(assembly.config.overhangDoor).toBe(true)
      assembly.updateOverhangDoor(false)
      expect(assembly.config.overhangDoor).toBe(false)
    })
  })

  // ============================================
  // DRAWER OPERATIONS
  // ============================================
  describe("Drawer Operations", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        createTestConfig({
          drawerEnabled: true,
          drawerQuantity: 3,
          doorEnabled: false,
        }),
        productId,
        cabinetId
      )
    })

    it("creates drawers when enabled", () => {
      expect(assembly.drawers.length).toBe(3)
    })

    it("updateDrawerEnabled toggles drawer visibility", () => {
      expect(assembly.drawers.length).toBe(3)
      assembly.updateDrawerEnabled(false)
      expect(assembly.config.drawerEnabled).toBe(false)
    })

    it("updateDrawerQuantity changes number of drawers", () => {
      assembly.updateDrawerQuantity(4)
      expect(assembly.config.drawerQuantity).toBe(4)
    })

    it("getDrawerHeights returns array of heights", () => {
      const heights = assembly.getDrawerHeights()
      expect(Array.isArray(heights)).toBe(true)
      expect(heights.length).toBe(assembly.drawers.length)
    })

    it("getTotalDrawerHeight returns sum of heights", () => {
      const heights = assembly.getDrawerHeights()
      const total = assembly.getTotalDrawerHeight()
      const expectedSum = heights.reduce((a, b) => a + b, 0)
      expect(total).toBe(expectedSum)
    })

    it("validateDrawerHeights returns validation result", () => {
      const result = assembly.validateDrawerHeights()
      expect(result).toBeDefined()
    })
  })

  // ============================================
  // WARDROBE-SPECIFIC DRAWER HANDLING
  // ============================================
  describe("Wardrobe Drawers", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "wardrobe",
        createTestDimensions(900, 2100, 600),
        { drawerEnabled: true, drawerQuantity: 4 },
        productId,
        cabinetId
      )
    })

    it("creates wardrobe with drawers enabled by default", () => {
      expect(assembly.config.drawerEnabled).toBe(true)
    })

    it("uses fixed drawer height for wardrobe drawers", () => {
      const heights = assembly.getDrawerHeights()
      const expectedHeight = assembly.config.wardrobeDrawerHeight || 220
      heights.forEach((h) => {
        expect(h).toBe(expectedHeight)
      })
    })

    it("updateDrawerQuantity recreates wardrobe drawers", () => {
      const initialCount = assembly.drawers.length
      assembly.updateDrawerQuantity(2)
      expect(assembly.config.drawerQuantity).toBe(2)
    })
  })

  // ============================================
  // MATERIAL OPERATIONS
  // ============================================
  describe("Material Operations", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        createTestConfig(),
        productId,
        cabinetId
      )
    })

    it("updateMaterial changes the material", () => {
      const newMaterial = CarcassMaterial.getDefaultMaterial()
      assembly.updateMaterial(newMaterial)
      expect(assembly.config.material).toBe(newMaterial)
    })

    it("updateKickerHeight updates leg heights", () => {
      const newHeight = 200
      assembly.updateKickerHeight(newHeight)
      assembly.legs.forEach((leg) => {
        expect(leg.height).toBe(newHeight)
      })
    })
  })

  // ============================================
  // BULKHEAD RETURNS
  // ============================================
  describe("Bulkhead Returns", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "bulkhead",
        createTestDimensions(600, 300, 560),
        {},
        productId,
        cabinetId
      )
    })

    it("addBulkheadReturn creates left return", () => {
      expect(assembly.bulkheadReturnLeft).toBeUndefined()
      assembly.addBulkheadReturn("left", 300, 200, 100)
      expect(assembly.bulkheadReturnLeft).toBeDefined()
    })

    it("addBulkheadReturn creates right return", () => {
      expect(assembly.bulkheadReturnRight).toBeUndefined()
      assembly.addBulkheadReturn("right", 300, 200, 100)
      expect(assembly.bulkheadReturnRight).toBeDefined()
    })

    it("removeBulkheadReturn removes the return", () => {
      assembly.addBulkheadReturn("left", 300, 200, 100)
      expect(assembly.bulkheadReturnLeft).toBeDefined()
      assembly.removeBulkheadReturn("left")
      expect(assembly.bulkheadReturnLeft).toBeUndefined()
    })

    it("addBulkheadReturn is no-op for non-bulkhead types", () => {
      assembly.dispose()
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        {},
        productId,
        cabinetId
      )
      assembly.addBulkheadReturn("left", 300, 200, 100)
      expect(assembly.bulkheadReturnLeft).toBeUndefined()
    })
  })

  // ============================================
  // PART DIMENSIONS EXPORT
  // ============================================
  describe("Part Dimensions Export", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        createTestConfig({ shelfCount: 2 }),
        productId,
        cabinetId
      )
    })

    it("getPartDimensions returns array of part dimensions", () => {
      const parts = assembly.getPartDimensions()
      expect(Array.isArray(parts)).toBe(true)
      expect(parts.length).toBeGreaterThan(0)
    })

    it("part dimensions include structural parts", () => {
      const parts = assembly.getPartDimensions()
      const partNames = parts.map((p) => p.partName)

      expect(partNames).toContain("Left Panel")
      expect(partNames).toContain("Right Panel")
      expect(partNames).toContain("Back Panel")
    })

    it("part dimensions include shelves", () => {
      const parts = assembly.getPartDimensions()
      const shelfParts = parts.filter((p) => p.partName.startsWith("Shelf"))
      expect(shelfParts.length).toBe(2)
    })

    it("part dimensions have valid numeric values", () => {
      const parts = assembly.getPartDimensions()
      parts.forEach((part) => {
        expect(part.dimX).toBeGreaterThan(0)
        expect(part.dimY).toBeGreaterThan(0)
        expect(part.dimZ).toBeGreaterThan(0)
      })
    })
  })

  // ============================================
  // DISPOSAL
  // ============================================
  describe("Disposal", () => {
    it("dispose clears the group", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        createTestConfig(),
        productId,
        cabinetId
      )
      expect(assembly.group.children.length).toBeGreaterThan(0)
      assembly.dispose()
      expect(assembly.group.children.length).toBe(0)
    })

    it("dispose handles all cabinet types without error", () => {
      const types: CabinetType[] = [
        "base",
        "top",
        "tall",
        "wardrobe",
        "panel",
        "filler",
        "kicker",
        "underPanel",
        "bulkhead",
      ]

      types.forEach((type) => {
        const testAssembly = CarcassAssembly.create(
          type,
          createTestDimensions(),
          type === "wardrobe" ? { drawerEnabled: true } : {},
          productId,
          cabinetId
        )
        expect(() => testAssembly.dispose()).not.toThrow()
      })
    })
  })

  // ============================================
  // STATIC FACTORY METHOD
  // ============================================
  describe("Static Factory Method", () => {
    const dims = createTestDimensions()
    const config = {}

    it("create works for all cabinet types", () => {
      const types: CabinetType[] = [
        "base",
        "top",
        "tall",
        "wardrobe",
        "panel",
        "filler",
        "kicker",
        "underPanel",
        "bulkhead",
      ]

      types.forEach((type) => {
        const testAssembly = CarcassAssembly.create(
          type,
          dims,
          config,
          productId,
          cabinetId
        )
        expect(testAssembly.cabinetType).toBe(type)
        testAssembly.dispose()
      })
    })

    it("create handles filler types with options", () => {
      // Linear filler
      const linearFiller = CarcassAssembly.create(
        "filler",
        dims,
        { fillerType: "linear" },
        productId,
        cabinetId
      )
      expect(linearFiller.config.fillerType).toBe("linear")
      linearFiller.dispose()

      // L-shape filler with return position
      const lShapeFiller = CarcassAssembly.create(
        "filler",
        dims,
        { fillerType: "l-shape" },
        productId,
        cabinetId,
        { fillerReturnPosition: "right" }
      )
      expect(lShapeFiller.config.fillerType).toBe("l-shape")
      expect(lShapeFiller.config.fillerReturnPosition).toBe("right")
      lShapeFiller.dispose()
    })

    it("create handles wardrobe with drawer options", () => {
      assembly = CarcassAssembly.create(
        "wardrobe",
        createTestDimensions(900, 2100, 600),
        { drawerEnabled: true, drawerQuantity: 3 },
        productId,
        cabinetId
      )
      expect(assembly.cabinetType).toBe("wardrobe")
      expect(assembly.config.drawerEnabled).toBe(true)
    })
  })

  // ============================================
  // POSITION PRESERVATION
  // ============================================
  describe("Position Preservation", () => {
    beforeEach(() => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        createTestConfig(),
        productId,
        cabinetId
      )
    })

    it("updateConfig preserves group position", () => {
      assembly.group.position.set(100, 200, 300)
      assembly.updateConfig({ shelfCount: 4 })
      expect(assembly.group.position.x).toBe(100)
      expect(assembly.group.position.y).toBe(200)
      expect(assembly.group.position.z).toBe(300)
    })

    it("updateMaterial preserves group position", () => {
      assembly.group.position.set(100, 200, 300)
      assembly.updateMaterial(CarcassMaterial.getDefaultMaterial())
      expect(assembly.group.position.x).toBe(100)
      expect(assembly.group.position.y).toBe(200)
      expect(assembly.group.position.z).toBe(300)
    })
  })

  // ============================================
  // EDGE CASES
  // ============================================
  describe("Edge Cases", () => {
    it("handles zero shelves", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        { shelfCount: 0 },
        productId,
        cabinetId
      )
      expect(assembly.shelves.length).toBe(0)
    })

    it("handles many shelves", () => {
      assembly = CarcassAssembly.create(
        "tall",
        createTestDimensions(600, 2100, 560),
        { shelfCount: 10 },
        productId,
        cabinetId
      )
      expect(assembly.shelves.length).toBe(10)
    })

    it("handles single door configuration", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(),
        { doorEnabled: true, doorCount: 1 },
        productId,
        cabinetId
      )
      expect(assembly.config.doorCount).toBe(1)
    })

    it("handles narrow cabinet dimensions", () => {
      assembly = CarcassAssembly.create(
        "base",
        createTestDimensions(300, 720, 560),
        createTestConfig(),
        productId,
        cabinetId
      )
      expect(assembly.dimensions.width).toBe(300)
    })
  })
})
