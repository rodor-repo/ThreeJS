import React, { useEffect } from "react"
import _ from "lodash"
import { getPartDataManager } from "@/nesting/PartDataManager"
import { toNum } from "./utils/dimensionUtils"
import { DynamicPanel } from "./DynamicPanel"
import type { ProductPanelProps } from "../productPanel.types"
import { useProductData } from "@/features/cabinets/hooks/useProductData"

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
  onViewKickerHeightChange,
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
  onManualDimensionDeltaChange,
  formulaPieces,
  getFormula,
  onFormulaChange,
  getFormulaLastEvaluatedAt,
}) => {
  const productId = selectedCabinet?.productId

  const { data, isLoading, isError } = useProductData(productId)

  // Apply drawer qty and door qty to all products of this productId in the cabinets state
  useEffect(() => {
    if (data && allCabinets && productId) {
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
  }, [data, allCabinets, productId, selectedCabinet?.carcass?.config?.drawerQuantity, selectedCabinet?.carcass?.config?.doorCount])

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
      onViewKickerHeightChange={onViewKickerHeightChange}
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
      onManualDimensionDeltaChange={onManualDimensionDeltaChange}
      formulaPieces={formulaPieces}
      getFormula={getFormula}
      onFormulaChange={onFormulaChange}
      getFormulaLastEvaluatedAt={getFormulaLastEvaluatedAt}
      loading={isLoading}
      error={isError}
    />
  )
}
