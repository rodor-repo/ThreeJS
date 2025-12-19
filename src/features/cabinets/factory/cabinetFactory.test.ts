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

  it("getDefaultDimensions returns appliance defaults", () => {
    const dims = getDefaultDimensions("appliance")
    expect(dims.width).toBe(600)
    expect(dims.height).toBe(820)
    expect(dims.depth).toBe(600)
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

  it("createCabinet creates appliance cabinet with correct config", () => {
    const cab = createCabinet("appliance", "dishwasher", { productId })
    expect(cab.group).toBeInstanceOf(THREE.Group)
    expect(cab.carcass).toBeInstanceOf(CarcassAssembly)
    expect(cab.cabinetType).toBe("appliance")
    expect(cab.carcass.config.applianceType).toBe("dishwasher")
    expect(cab.carcass.config.applianceTopGap).toBe(0)
    expect(cab.carcass.config.applianceLeftGap).toBe(0)
    expect(cab.carcass.config.applianceRightGap).toBe(0)
  })

  it("createCabinet appliance has shell and visual parts", () => {
    const cab = createCabinet("appliance", "dishwasher", { productId })
    expect(cab.carcass._applianceShell).toBeDefined()
    expect(cab.carcass._applianceVisual).toBeDefined()
  })

  it("getDefaultDimensions returns benchtop defaults", () => {
    const dims = getDefaultDimensions("benchtop")
    expect(dims.width).toBe(600)  // Default length
    expect(dims.height).toBe(38)  // Thickness
    expect(dims.depth).toBe(560)  // Depth
  })

  it("createCabinet creates benchtop cabinet with correct config", () => {
    const cab = createCabinet("benchtop", "standard", { productId })
    expect(cab.group).toBeInstanceOf(THREE.Group)
    expect(cab.carcass).toBeInstanceOf(CarcassAssembly)
    expect(cab.cabinetType).toBe("benchtop")
    expect(cab.carcass.config.benchtopFrontOverhang).toBe(20)
    expect(cab.carcass.config.benchtopLeftOverhang).toBe(0)
    expect(cab.carcass.config.benchtopRightOverhang).toBe(0)
  })

  it("createCabinet benchtop has benchtop part", () => {
    const cab = createCabinet("benchtop", "standard", { productId })
    expect(cab.carcass._benchtop).toBeDefined()
    expect(cab.carcass.benchtop).toBeDefined()
  })
})
