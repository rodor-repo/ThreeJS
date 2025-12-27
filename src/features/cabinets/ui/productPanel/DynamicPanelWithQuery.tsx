import React, { useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import _ from "lodash"
import { getProductData } from "@/server/getProductData"
import { getPartDataManager } from "@/nesting/PartDataManager"
import { toNum } from "./utils/dimensionUtils"
import { priceQueryKeys } from "./utils/queryKeys"
import { DynamicPanel } from "./DynamicPanel"
import type { ProductPanelProps } from "../productPanel.types"

/**
 * Wrapper component that fetches product data and passes it to DynamicPanel.
 * 
 * Responsibilities:
 * - Fetches product data via React Query based on productId
 * - Syncs material options to PartDataManager for nesting
 * - Initializes drawer/door quantities from product defaults
 * - Passes fetched data to DynamicPanel
 */
export const DynamicPanelWithQuery: React.FC<ProductPanelProps> = ({
  isVisible,
  onClose,
  selectedCabinet,
  onDimensionsChange,
  onMaterialChange,
  onOverhangDoorToggle,
  onShelfCountChange,
  onDrawerHeightChange,
  onDrawerQuantityChange,
  onDoorCountChange,
  viewManager,
  onViewChange,
  allCabinets,
  onGroupChange,
  initialGroupData,
  onSyncChange,
  initialSyncData,
  onBenchtopOverhangChange,
  onBenchtopThicknessChange,
  onBenchtopHeightFromFloorChange,
}) => {
  const productId = selectedCabinet?.productId

  const { data, isLoading, isError } = useQuery({
    queryKey: priceQueryKeys.productData(productId ?? ""),
    queryFn: async () => {
      if (!productId) throw new Error("No productId")
      const data = await getProductData(productId)

      // Apply drawer qty and door qty to all products of this productId in the cabinets state
      if (allCabinets) {
        for (const cabinet of allCabinets) {
          const cabProductId = cabinet.carcass?.productId
          if (cabProductId !== data.product.productId) continue

          const drawerQtyGDIds = data.threeJsGDs?.["drawerQty"] || []
          const doorQtyGDIds = data.threeJsGDs?.["doorQty"] || []
          const wsProduct = data.product
          const dimsList = _.sortBy(
            Object.entries(wsProduct?.dims || {}),
            ([, dimObj]) => Number(dimObj.sortNum)
          )

          let drawerQty: number | undefined =
            selectedCabinet?.carcass?.config?.drawerQuantity
          let doorQty: number | undefined =
            selectedCabinet?.carcass?.config?.doorCount
          dimsList.forEach(([_id, dimObj]) => {
            const gdId = dimObj.GDId
            if (!gdId) return
            if (drawerQtyGDIds.includes(gdId))
              drawerQty = toNum(dimObj.defaultValue) || drawerQty
            if (drawerQty) cabinet.carcass?.updateDrawerQuantity?.(drawerQty)
            if (doorQtyGDIds.includes(gdId))
              doorQty = toNum(dimObj.defaultValue) || doorQty
            if (doorQty) cabinet.carcass?.updateDoorConfiguration?.(doorQty)
          })
        }
      }
      return data
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  })

  const wsProduct = data?.product
  const materialOptions = data?.materialOptions
  const defaultMaterialSelections = data?.defaultMaterialSelections
  const threeJsGDs = data?.threeJsGDs

  // Sync materialOptions and defaultMaterialSelections to PartDataManager
  useEffect(() => {
    if (productId && materialOptions && defaultMaterialSelections) {
      const partDataManager = getPartDataManager()
      partDataManager.setMaterialOptions(productId, materialOptions)
      partDataManager.setDefaultMaterialSelections(
        productId,
        defaultMaterialSelections
      )
    }
  }, [productId, materialOptions, defaultMaterialSelections])

  if (!productId) return null

  return (
    <DynamicPanel
      key={productId}
      productId={productId}
      isVisible={isVisible}
      onClose={onClose}
      wsProduct={wsProduct}
      materialOptions={materialOptions}
      threeJsGDs={threeJsGDs}
      defaultMaterialSelections={defaultMaterialSelections}
      selectedCabinet={selectedCabinet}
      onDimensionsChange={onDimensionsChange}
      onOverhangDoorToggle={onOverhangDoorToggle}
      onShelfCountChange={onShelfCountChange}
      onMaterialChange={onMaterialChange}
      onDrawerHeightChange={onDrawerHeightChange}
      onDrawerQuantityChange={onDrawerQuantityChange}
      onDoorCountChange={onDoorCountChange}
      viewManager={viewManager}
      onViewChange={onViewChange}
      allCabinets={allCabinets}
      onGroupChange={onGroupChange}
      initialGroupData={initialGroupData}
      onSyncChange={onSyncChange}
      initialSyncData={initialSyncData}
      onBenchtopOverhangChange={onBenchtopOverhangChange}
      onBenchtopThicknessChange={onBenchtopThicknessChange}
      onBenchtopHeightFromFloorChange={onBenchtopHeightFromFloorChange}
      loading={isLoading}
      error={isError}
    />
  )
}
