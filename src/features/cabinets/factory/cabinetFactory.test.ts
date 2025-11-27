import * as THREE from "three"
import { describe, it, expect } from "vitest"
import { createCabinet, getDefaultDimensions } from "./cabinetFactory"
import { CarcassAssembly } from "@/features/carcass"

describe("cabinetFactory", () => {
  const productId = "test-product"

  it("getDefaultDimensions returns sensible defaults per type", () => {
    expect(getDefaultDimensions("top").width).toBeGreaterThan(0)
    expect(getDefaultDimensions("base").depth).toBeGreaterThan(0)
    expect(getDefaultDimensions("tall").height).toBeGreaterThan(0)
  })

  it("createCabinet returns group and CarcassAssembly for base standard", () => {
    const cab = createCabinet("base", "standard", { productId })
    expect(cab.group).toBeInstanceOf(THREE.Group)
    expect(cab.carcass).toBeInstanceOf(CarcassAssembly)
    expect(cab.cabinetType).toBe("base")
  })

  it("createCabinet supports drawer subcategory with drawers enabled", () => {
    const cab = createCabinet("base", "drawer", { productId })
    // drawers are enabled in drawer base variant
    expect(cab.carcass["config"].drawerEnabled).toBe(true)
    expect(cab.carcass.group.position.x).toBeTypeOf("number")
  })
})
