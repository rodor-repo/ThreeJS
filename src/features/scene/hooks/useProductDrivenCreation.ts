import { useEffect, type MutableRefObject, useRef } from "react"
import * as THREE from "three"
import _ from "lodash"
import type { Subcategory } from "@/components/categoriesData"
import type { WsProducts } from "@/types/erpTypes"
import type { CabinetType, CarcassDimensions } from "@/features/carcass"
import type { CabinetData } from "../types"
import { Benchtop } from "@/features/carcass/parts/Benchtop"

type CreateCabinetOptions = {
  productId?: string
  productName?: string
  fillerReturnPosition?: "left" | "right"
  customDimensions?: Partial<CarcassDimensions>
  additionalProps?: Partial<
    Omit<
      CabinetData,
      "group" | "carcass" | "cabinetType" | "subcategoryId" | "cabinetId"
    >
  >
}

type UseProductDrivenCreationOptions = {
  selectedSubcategory:
    | { category: { id: string; name: string }; subcategory: Subcategory }
    | null
    | undefined
  selectedProductId?: string
  wsProducts?: WsProducts | null
  sceneRef: MutableRefObject<THREE.Scene | null>
  createCabinet: (
    cabinetType: CabinetType,
    subcategoryId: string,
    options?: CreateCabinetOptions
  ) => CabinetData | undefined
  addCabinetData: (cabinetData: CabinetData) => CabinetData | null
  setSelectedCabinet: (cabinet: CabinetData | null) => void
}

/**
 * Creates a standalone benchtop (from left-hand menu, not attached to a cabinet)
 */
function createStandaloneBenchtop(
  productId: string,
  subcategoryId: string,
  addCabinetData: (cabinetData: CabinetData) => CabinetData | null
): CabinetData | null {
  // Default dimensions for standalone benchtop
  const benchtopLength = 600
  const benchtopThickness = 38
  const benchtopDepth = 560
  const DEFAULT_HEIGHT_FROM_FLOOR = 740 // Default Y position

  // Generate unique cabinet ID
  const benchtopCabinetId = `benchtop-${_.uniqueId()}-${Math.random().toString(36).slice(2, 8)}`

  // Create the Benchtop geometry - simple cube
  const benchtop = new Benchtop(benchtopLength, benchtopThickness, benchtopDepth)

  // Create group to hold the benchtop
  const group = new THREE.Group()
  group.name = `benchtop_${benchtopCabinetId}`
  group.add(benchtop.mesh)
  group.userData.benchtop = benchtop

  // Position at default height from floor (Y = 740mm)
  group.position.set(0, DEFAULT_HEIGHT_FROM_FLOOR, 0)

  // Create minimal CabinetData for the benchtop with config for DynamicPanel compatibility
  const benchtopCabinetData: CabinetData = {
    group,
    carcass: {
      group,
      dimensions: {
        width: benchtopLength,
        height: benchtopThickness,
        depth: benchtopDepth,
      },
      // Minimal config for DynamicPanel compatibility
      config: {
        doorEnabled: false,
        doorCount: 0,
        drawerEnabled: false,
        drawerQuantity: 0,
        shelfCount: 0,
      },
      updateDimensions: (newDims: { width?: number; height?: number; depth?: number }) => {
        if (newDims.width !== undefined) benchtopCabinetData.carcass.dimensions.width = newDims.width
        if (newDims.height !== undefined) benchtopCabinetData.carcass.dimensions.height = newDims.height
        if (newDims.depth !== undefined) benchtopCabinetData.carcass.dimensions.depth = newDims.depth
        
        const bt = group.userData.benchtop as Benchtop
        if (bt) {
          bt.updateDimensions(
            benchtopCabinetData.carcass.dimensions.width,
            benchtopCabinetData.carcass.dimensions.height,
            benchtopCabinetData.carcass.dimensions.depth
          )
        }
      },
      // Stub methods for DynamicPanel/ProductPanel compatibility - benchtops don't have these features
      updateConfig: () => {},
      updateMaterialProperties: () => {},
      updateKickerHeight: () => {},
      toggleDoors: () => {},
      updateDoorMaterial: () => {},
      updateDoorConfiguration: () => {},
      updateOverhangDoor: () => {},
      updateDoorEnabled: () => {},
      updateDoorCount: () => {},
      updateDrawerEnabled: () => {},
      updateDrawerQuantity: () => {},
      updateDrawerHeight: () => {},
      updateDrawerHeights: () => {},
      balanceDrawerHeights: () => {},
      getDrawerHeights: () => [],
      updateShelfCount: () => {},
      dispose: () => {
        const bt = group.userData.benchtop as Benchtop
        if (bt) bt.dispose()
      },
    } as CabinetData["carcass"],
    cabinetType: "benchtop",
    subcategoryId,
    productId,
    cabinetId: benchtopCabinetId,
    // Standalone benchtop - show lock icons for length extension control
    hideLockIcons: false,
    // Default locks: left locked, right unlocked (extend to the right by default)
    leftLock: true,
    rightLock: false,
    // Height from floor for independent benchtops (Y position)
    benchtopHeightFromFloor: DEFAULT_HEIGHT_FROM_FLOOR,
  }

  return addCabinetData(benchtopCabinetData)
}

export const useProductDrivenCreation = ({
  selectedSubcategory,
  selectedProductId,
  wsProducts,
  sceneRef,
  createCabinet,
  addCabinetData,
  setSelectedCabinet,
}: UseProductDrivenCreationOptions) => {
  // Use refs for functions to avoid unnecessary effect triggers
  const createCabinetRef = useRef(createCabinet)
  const addCabinetDataRef = useRef(addCabinetData)
  const setSelectedCabinetRef = useRef(setSelectedCabinet)

  useEffect(() => {
    createCabinetRef.current = createCabinet
  }, [createCabinet])

  useEffect(() => {
    addCabinetDataRef.current = addCabinetData
  }, [addCabinetData])

  useEffect(() => {
    setSelectedCabinetRef.current = setSelectedCabinet
  }, [setSelectedCabinet])

  useEffect(() => {
    if (!selectedSubcategory || !sceneRef.current) return

    console.log(
      "Subcategory selected:",
      selectedSubcategory.category.name,
      ">",
      selectedSubcategory.subcategory.name
    )

    if (!wsProducts)
      throw new Error("WsProducts data is required to create cabinets.")

    const productEntry = wsProducts.products[selectedProductId || ""]
    const productName = productEntry?.product
    const designId = productEntry?.designId
    const designEntry = wsProducts.designs[designId || ""]
    if (!designEntry) {
      throw new Error(`Design entry not found for designId: ${designId}`)
    }

    const { type3D, design } = designEntry

    if (!type3D) {
      throw new Error(
        `3D type not specified in design entry for design: ${design}`
      )
    }

    // Handle benchtop separately - it doesn't go through cabinetFactory
    if (type3D === "benchtop") {
      const benchtopData = createStandaloneBenchtop(
        selectedProductId || "",
        selectedSubcategory.subcategory.id,
        addCabinetDataRef.current
      )
      if (benchtopData) setSelectedCabinetRef.current(benchtopData)
      return
    }

    const legacyCategoryMap: Record<
      NonNullable<WsProducts["designs"][string]["type3D"]>,
      CabinetType
    > = {
      base: "base",
      overhead: "top",
      tall: "tall",
      panel: "panel",
      filler: "filler",
      wardrobe: "wardrobe",
      bulkhead: "bulkhead",
      kicker: "kicker",
      benchtop: "benchtop",
      underPanel: "underPanel",
      appliance: "appliance",
    }

    const cabinetType = legacyCategoryMap[type3D] || "base"

    const cabinetData = createCabinetRef.current(
      cabinetType,
      selectedSubcategory.subcategory.id,
      {
        productId: selectedProductId,
        productName,
      }
    )
    
    if (cabinetData) setSelectedCabinetRef.current(cabinetData)
  }, [
    // createCabinet and setSelectedCabinet are intentionally omitted to prevent infinite loops
    // as they change on every render when a cabinet is added
    sceneRef,
    selectedProductId,
    selectedSubcategory,
    wsProducts,
  ])
}
