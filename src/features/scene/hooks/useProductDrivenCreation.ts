import { useEffect, type MutableRefObject } from "react"
import type { Subcategory } from "@/components/categoriesData"
import type { WsProducts } from "@/types/erpTypes"
import type { CabinetType } from "@/features/carcass"
import type { CabinetData } from "../types"
import type * as THREE from "three"

type UseProductDrivenCreationOptions = {
  selectedSubcategory: { category: { id: string; name: string }; subcategory: Subcategory } | null | undefined
  selectedProductId?: string
  wsProducts?: WsProducts | null
  sceneRef: MutableRefObject<THREE.Scene | null>
  createCabinet: (
    cabinetType: CabinetType,
    subcategoryId: string,
    productId?: string
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
  useEffect(() => {
    if (!selectedSubcategory || !sceneRef.current) return

    console.log(
      "Subcategory selected:",
      selectedSubcategory.category.name,
      ">",
      selectedSubcategory.subcategory.name
    )

    if (!wsProducts) throw new Error("WsProducts data is required to create cabinets.")

    const productEntry = wsProducts.products[selectedProductId || ""]
    const designId = productEntry?.designId
    const designEntry = wsProducts.designs[designId || ""]
    if (!designEntry) {
      throw new Error(`Design entry not found for designId: ${designId}`)
    }

    const { type3D, design } = designEntry

    if (!type3D) {
      throw new Error(`3D type not specified in design entry for design: ${design}`)
    }

    const legacyCategoryMap: Record<
      NonNullable<WsProducts["designs"][string]["type3D"]>,
      CabinetType
    > = {
      base: "base",
      overhead: "top",
      tall: "tall",
    }

    const cabinetType = legacyCategoryMap[type3D] || "base"

    const cabinetData = createCabinet(
      cabinetType,
      selectedSubcategory.subcategory.id,
      selectedProductId
    )
    if (cabinetData) setSelectedCabinet(cabinetData)
  }, [
    createCabinet,
    sceneRef,
    selectedProductId,
    selectedSubcategory,
    setSelectedCabinet,
    wsProducts,
  ])
}
