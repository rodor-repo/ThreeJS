import { useEffect, type MutableRefObject, useRef } from "react"
import type { Subcategory } from "@/components/categoriesData"
import type { WsProducts } from "@/types/erpTypes"
import type { CabinetType, CarcassDimensions } from "@/features/carcass"
import type { CabinetData } from "../types"
import type * as THREE from "three"

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
  setSelectedCabinet: (cabinet: CabinetData | null) => void
}

export const useProductDrivenCreation = ({
  selectedSubcategory,
  selectedProductId,
  wsProducts,
  sceneRef,
  createCabinet,
  setSelectedCabinet,
}: UseProductDrivenCreationOptions) => {
  // Use refs for functions to avoid unnecessary effect triggers
  const createCabinetRef = useRef(createCabinet)
  const setSelectedCabinetRef = useRef(setSelectedCabinet)

  useEffect(() => {
    createCabinetRef.current = createCabinet
  }, [createCabinet])

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
