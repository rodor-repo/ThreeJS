import React, { useState, useCallback, useEffect, useMemo } from "react"
import { getPartDataManager } from "@/nesting/PartDataManager"
import type { ProductPanelProps } from "../productPanel.types"
import type { MaterialOptionsResponse, DefaultMaterialSelections } from "@/server/getProductData"
import type { GDThreeJsType } from "@/types/erpTypes"
import type { ViewId } from "../../ViewManager"
import type { MaterialSelections } from "./utils/materialUtils"
import type { GroupCabinet } from "./hooks/useCabinetGroups"

// Import hooks
import {
  useGDMapping,
  usePersistence,
  usePanelState,
  usePriceQuery,
  useDimensionEvents,
  useDimensionSync,
  useInitialization,
  useMaterialSync,
  getPersistedState,
} from "./hooks"
import { useOffTheFloor } from "./hooks/useOffTheFloor"
import { useCabinetGroups } from "./hooks/useCabinetGroups"

// Import components
import {
  PanelHeader,
  DimensionsSection,
  BenchtopSection,
  MaterialsSection,
  ColorPickerModal,
  PairSection,
  SyncSection,
  OffTheFloorControl,
  SimpleColorPicker,
  CollapsibleSection,
  GroupingSection,
} from "./components"

// Import utils
import {
  toNum,
  buildDimsList,
  applyPrimaryDimsTo3D,
  validateDrawerHeightChange,
} from "./utils/dimensionUtils"
import { toastThrottled } from "./utils/toastUtils"

/**
 * Props for the DynamicPanel component
 */
export interface DynamicPanelProps extends ProductPanelProps {
  productId?: string
  loading?: boolean
  error?: boolean
  materialOptions?: MaterialOptionsResponse
  defaultMaterialSelections?: DefaultMaterialSelections
  threeJsGDs: Record<GDThreeJsType, string[]> | undefined
  onGroupChange?: (cabinetId: string, groupCabinets: GroupCabinet[]) => void
  initialGroupData?: GroupCabinet[]
  onSyncChange?: (cabinetId: string, syncCabinets: string[]) => void
  initialSyncData?: string[]
}

/**
 * Main panel component for editing cabinet dimensions and materials.
 * 
 * Uses extracted hooks for:
 * - GD mapping (useGDMapping)
 * - Panel state management (usePanelState)
 * - Persistence (usePersistence)
 * - Off-the-floor positioning (useOffTheFloor)
 * - Cabinet groups and sync (useCabinetGroups)
 * - Price calculation (usePriceQuery)
 * - Dimension events (useDimensionEvents)
 * - Dimension sync (useDimensionSync)
 * - Initialization (useInitialization)
 * - Material sync (useMaterialSync)
 */
export const DynamicPanel: React.FC<DynamicPanelProps> = ({
  productId,
  isVisible,
  onClose,
  wsProduct,
  materialOptions,
  defaultMaterialSelections,
  selectedCabinet,
  onDimensionsChange,
  onMaterialChange,
  loading,
  error,
  threeJsGDs,
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
  const cabinetId = selectedCabinet?.cabinetId

  // UI state (minimal - most state is in hooks)
  const [isExpanded, setIsExpanded] = useState(true)
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null)

  // GD Mapping hook
  const gdMapping = useGDMapping(threeJsGDs)

  // Panel state hook
  const panelState = usePanelState({
    initialDims: wsProduct?.dims,
    initialMaterialColor: selectedCabinet?.material?.getColour?.() || "#ffffff",
  })

  // Persistence hook
  const persistence = usePersistence(cabinetId)

  // Off-the-floor hook (for fillers and panels)
  const offTheFloorState = useOffTheFloor({
    selectedCabinet: selectedCabinet ?? undefined,
    allCabinets,
    onDimensionsChange,
  })

  // Cabinet groups hook
  const groups = useCabinetGroups({
    cabinetId,
    initialGroupData,
    initialSyncData,
    onGroupChange,
    onSyncChange,
  })

  // Build dims list
  const dimsList = useMemo(
    () => buildDimsList(wsProduct?.dims),
    [wsProduct?.dims]
  )

  // Calculate drawer quantity for dependent drawer detection
  const drawerQty = selectedCabinet?.carcass?.config?.drawerQuantity || 0

  // Calculate modal filler/panel status
  const isModalFillerOrPanel =
    (selectedCabinet?.cabinetType === "filler" ||
      selectedCabinet?.cabinetType === "panel") &&
    selectedCabinet?.hideLockIcons === true

  // Apply dimensions to 3D callback
  const applyDimsTo3D = useCallback(
    (vals: Record<string, number | string>, changedId?: string) => {
      if (!selectedCabinet || !onDimensionsChange) return

      applyPrimaryDimsTo3D(
        vals,
        dimsList,
        gdMapping,
        selectedCabinet,
        {
          onDimensionsChange,
          onOverhangDoorToggle,
          onShelfCountChange,
          onDrawerQuantityChange,
          onDoorCountChange,
          onDrawerHeightChange,
        },
        isModalFillerOrPanel,
        changedId
      )
    },
    [
      selectedCabinet,
      dimsList,
      gdMapping,
      isModalFillerOrPanel,
      onDimensionsChange,
      onOverhangDoorToggle,
      onShelfCountChange,
      onDrawerQuantityChange,
      onDoorCountChange,
      onDrawerHeightChange,
    ]
  )

  // Initialization hook
  useInitialization({
    cabinetId,
    wsProduct,
    materialOptions,
    defaultMaterialSelections,
    selectedCabinet: selectedCabinet ?? undefined,
    gdMapping,
    getPersistedState: (id) => getPersistedState(id),
    setPersistedState: (id, state) => persistence.setPersisted(state),
    onInitialized: (result) => {
      panelState.setValues(result.values)
      panelState.setMaterialColor(result.materialColor)
      panelState.setMaterialSelections(result.materialSelections)
    },
    onApply3D: applyDimsTo3D,
    onMaterialSelectionsSync: (id, selections) => {
      const partDataManager = getPartDataManager()
      partDataManager.setMaterialSelections(id, selections)
    },
  })

  // Material sync hook
  useMaterialSync(
    productId,
    cabinetId,
    materialOptions,
    defaultMaterialSelections,
    panelState.materialSelections,
    selectedCabinet ?? undefined
  )

  // Dimension events hook
  useDimensionEvents({
    cabinetId,
    selectedCabinet: selectedCabinet ?? undefined,
    dims: wsProduct?.dims,
    gdMapping,
    onValueUpdate: (id, value) => {
      panelState.updateValue(id, value)
    },
    onPersistedValueUpdate: (id, value) => {
      persistence.updateSingleValue(id, value)
    },
    onValuesSync: (syncedValues) => {
      panelState.setValues((prev) => ({ ...prev, ...syncedValues }))
    },
    onPersistedValuesSync: (syncedValues) => {
      persistence.updateValues({ ...panelState.values, ...syncedValues })
    },
  })

  // Dimension sync hook
  useDimensionSync({
    cabinetId,
    cabinetWidth: selectedCabinet?.dimensions.width,
    dims: wsProduct?.dims,
    gdMapping,
    onWidthSync: (widthDimId, newWidth) => {
      panelState.updateValue(widthDimId, newWidth)
    },
    onPersistedWidthSync: (widthDimId, newWidth) => {
      persistence.updateSingleValue(widthDimId, newWidth)
    },
  })

  // Price query hook
  const priceQuery = usePriceQuery({
    productId: productId || wsProduct?.productId,
    isVisible,
    wsProductLoaded: !!wsProduct,
    dims: panelState.debouncedInputs.dims,
    materialSelections: panelState.debouncedInputs.materialSelections,
    onPriceUpdate: (price) => {
      persistence.updatePrice(price)
    },
  })

  // Initialize material color when cabinet changes
  useEffect(() => {
    panelState.setMaterialColor(
      selectedCabinet?.material.getColour() || "#ffffff"
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCabinet])

  // Apply drawer/door qty on dimsList change
  useEffect(() => {
    let drawerQtyVal: number | undefined =
      selectedCabinet?.carcass?.config?.drawerQuantity
    let doorQtyVal: number | undefined =
      selectedCabinet?.carcass?.config?.doorCount
    dimsList.forEach(([_id, dimObj]) => {
      const gdId = dimObj.GDId
      if (!gdId) return
      if (gdMapping.drawerQtyGDIds.includes(gdId)) {
        drawerQtyVal = toNum(dimObj.defaultValue) || drawerQtyVal
      }
      if (drawerQtyVal) onDrawerQuantityChange?.(drawerQtyVal)
      if (gdMapping.doorQtyGDIds.includes(gdId)) {
        doorQtyVal = toNum(dimObj.defaultValue) || doorQtyVal
      }
      if (doorQtyVal) onDoorCountChange?.(doorQtyVal)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimsList, threeJsGDs])

  // Persist values and price changes
  useEffect(() => {
    if (!cabinetId) return
    persistence.setPersisted({
      values: panelState.values,
      materialColor: panelState.materialColor,
      materialSelections: panelState.materialSelections,
      price: priceQuery.priceData,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    panelState.values,
    panelState.materialColor,
    panelState.materialSelections,
    priceQuery.priceData,
    cabinetId,
  ])

  // Handlers
  const handleValueChange = useCallback(
    (id: string, value: number | string) => {
      const next = { ...panelState.values, [id]: value }
      panelState.setValues(next)
      applyDimsTo3D(next, id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panelState.values, applyDimsTo3D]
  )

  const handleResetAll = useCallback(() => {
    if (!wsProduct?.dims) return
    panelState.resetAllValues(wsProduct.dims)
    applyDimsTo3D(panelState.values)
  }, [wsProduct?.dims, panelState, applyDimsTo3D])

  const handleResetDimension = useCallback(
    (id: string) => {
      const dimObj = wsProduct?.dims?.[id]
      if (!dimObj) return
      panelState.resetValue(id, dimObj)
      applyDimsTo3D({ ...panelState.values, [id]: panelState.values[id] }, id)
    },
    [wsProduct?.dims, panelState, applyDimsTo3D]
  )

  const handleDimensionValidate = useCallback(
    (id: string, value: number): string | undefined => {
      const validation = validateDrawerHeightChange(
        panelState.values,
        id,
        value,
        gdMapping.drawerHeightGDMap,
        dimsList,
        drawerQty
      )
      if (!validation.valid) {
        toastThrottled(validation.error || "Invalid dimension value")
        return validation.error
      }
      return undefined
    },
    [panelState.values, gdMapping.drawerHeightGDMap, dimsList, drawerQty]
  )

  const handleMaterialSelectionChange = useCallback(
    (materialId: string, selection: MaterialSelections[string]) => {
      panelState.updateMaterialSelection(materialId, selection)
    },
    [panelState]
  )

  const handleMaterialColorChange = useCallback(
    (color: string) => {
      panelState.setMaterialColor(color)
      onMaterialChange?.({ colour: color })
    },
    [panelState, onMaterialChange]
  )

  if (!isVisible) return null

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 transition-all duration-300 ease-in-out z-50 productPanel"
      data-product-panel
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsExpanded(!isExpanded)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white rounded-full p-1 hover:bg-blue-700 transition-colors"
      >
        {isExpanded ? "<" : ">"}
      </button>

      <div
        className={`h-full transition-all duration-300 ease-in-out ${isExpanded ? "w-80 sm:w-96 max-w-[90vw]" : "w-0"
          } overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}
      >
        {/* Header */}
        <PanelHeader
          wsProduct={wsProduct}
          sortNumber={selectedCabinet?.sortNumber}
          loading={!!loading}
          error={!!error}
          priceData={priceQuery.priceData}
          isPriceFetching={priceQuery.isPriceFetching}
          isPriceError={priceQuery.isPriceError}
          queryStatus={priceQuery.queryStatus}
          onClose={onClose}
        />

        {/* Loading / Error */}
        {loading ? (
          <div className="p-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-600">Failed to load product</p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Grouping Section (View + Pair + Sync merged) */}
            {viewManager && selectedCabinet && (
              <GroupingSection
                viewManager={viewManager}
                selectedCabinet={{
                  cabinetId: selectedCabinet.cabinetId,
                  sortNumber: selectedCabinet.sortNumber,
                  viewId: selectedCabinet.viewId as ViewId | 'none' | undefined,
                }}
                allCabinets={allCabinets}
                groups={groups}
                onViewChange={onViewChange}
              />
            )}

            {/* Dimensions */}
            <CollapsibleSection
              id="dimensions"
              title="Dimensions"
              icon={
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 3h5v5" />
                  <path d="M8 21H3v-5" />
                  <path d="M21 3l-7 7" />
                  <path d="M3 21l7-7" />
                </svg>
              }
            >
              <DimensionsSection
                dimsList={dimsList}
                values={panelState.values}
                editingValues={panelState.editingValues}
                gdMapping={gdMapping}
                drawerQty={drawerQty}
                isModalFillerOrPanel={isModalFillerOrPanel}
                isChildBenchtop={selectedCabinet?.cabinetType === 'benchtop' && !!selectedCabinet?.benchtopParentCabinetId}
                onValueChange={handleValueChange}
                onEditingChange={panelState.updateEditingValue}
                onReset={handleResetDimension}
                onResetAll={handleResetAll}
                onValidate={handleDimensionValidate}
                noWrapper
              />
            </CollapsibleSection>

            {/* Benchtop Settings - Only for benchtops */}
            {selectedCabinet?.cabinetType === 'benchtop' && (
              <CollapsibleSection
                id="benchtopSettings"
                title="Benchtop Settings"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="8" width="18" height="4" rx="1" />
                    <path d="M5 12v8" />
                    <path d="M19 12v8" />
                  </svg>
                }
              >
                <BenchtopSection
                  isChildBenchtop={!!selectedCabinet.benchtopParentCabinetId}
                  benchtopOverhangs={
                    selectedCabinet.benchtopParentCabinetId
                      ? {
                        front: selectedCabinet.benchtopFrontOverhang ?? 20,
                        left: selectedCabinet.benchtopLeftOverhang ?? 0,
                        right: selectedCabinet.benchtopRightOverhang ?? 0,
                      }
                      : undefined
                  }
                  onOverhangChange={
                    selectedCabinet.benchtopParentCabinetId && onBenchtopOverhangChange
                      ? (type, value) => onBenchtopOverhangChange(selectedCabinet.cabinetId, type, value)
                      : undefined
                  }
                  benchtopThickness={
                    selectedCabinet.benchtopParentCabinetId
                      ? selectedCabinet.benchtopThickness ?? selectedCabinet.carcass?.benchtop?.thickness ?? 38
                      : undefined
                  }
                  onThicknessChange={
                    selectedCabinet.benchtopParentCabinetId && onBenchtopThicknessChange
                      ? (value) => onBenchtopThicknessChange(selectedCabinet.cabinetId, value)
                      : undefined
                  }
                  benchtopHeightFromFloor={
                    !selectedCabinet.benchtopParentCabinetId
                      ? selectedCabinet.benchtopHeightFromFloor ?? 740
                      : undefined
                  }
                  onHeightFromFloorChange={
                    !selectedCabinet.benchtopParentCabinetId && onBenchtopHeightFromFloorChange
                      ? (value) => onBenchtopHeightFromFloorChange(selectedCabinet.cabinetId, value)
                      : undefined
                  }
                  noWrapper
                />
              </CollapsibleSection>
            )}

            {/* Off the Floor - Only for Fillers and Panels */}
            {(selectedCabinet?.cabinetType === "filler" ||
              selectedCabinet?.cabinetType === "panel") && (
                <CollapsibleSection
                  id="offTheFloor"
                  title="Off The Floor"
                  icon={
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                  }
                >
                  <OffTheFloorControl
                    value={offTheFloorState.offTheFloor}
                    editingValue={offTheFloorState.editingOffTheFloor}
                    onValueChange={offTheFloorState.handleOffTheFloorChange}
                    onEditingChange={offTheFloorState.setEditingOffTheFloor}
                  />
                </CollapsibleSection>
              )}

            {/* Materials selection */}
            {wsProduct && (
              <CollapsibleSection
                id="materials"
                title="Materials"
                icon={
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                }
              >
                <MaterialsSection
                  wsProduct={wsProduct}
                  materialOptions={materialOptions}
                  materialSelections={panelState.materialSelections}
                  onSelectionChange={handleMaterialSelectionChange}
                  onOpenColorPicker={(materialId) =>
                    setOpenMaterialId(materialId)
                  }
                  noWrapper
                />
              </CollapsibleSection>
            )}

            {/* Object color selection (simple) */}
            <CollapsibleSection
              id="color"
              title="Object Color"
              icon={
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M14.31 8l5.74 9.94" />
                  <path d="M9.69 8h11.48" />
                  <path d="M7.38 12l5.74-9.94" />
                  <path d="M9.69 16L3.95 6.06" />
                  <path d="M14.31 16H2.83" />
                </svg>
              }
            >
              <SimpleColorPicker
                color={panelState.materialColor}
                onChange={handleMaterialColorChange}
                noWrapper
              />
            </CollapsibleSection>

            {/* Bottom actions */}
            <div className="pt-1.5">
              <button
                onClick={() => {
                  // Debug/log selections
                  console.log("[ProductPanel2] Selections:", {
                    values: panelState.values,
                    materialSelections: panelState.materialSelections,
                    materialColor: panelState.materialColor,
                  })
                }}
                className="w-full text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Log selections
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Color Picker Modal */}
      {openMaterialId &&
        wsProduct?.materials?.[openMaterialId] &&
        materialOptions?.[openMaterialId] && (
          <ColorPickerModal
            isOpen={true}
            materialId={openMaterialId}
            material={wsProduct.materials[openMaterialId]}
            materialOptions={materialOptions[openMaterialId]}
            currentSelection={panelState.materialSelections[openMaterialId]}
            isExpanded={isExpanded}
            priceData={priceQuery.priceData}
            isPriceFetching={priceQuery.isPriceFetching}
            isPriceError={priceQuery.isPriceError}
            onSelectionChange={(selection) => {
              handleMaterialSelectionChange(openMaterialId, selection)
            }}
            onClose={() => setOpenMaterialId(null)}
          />
        )}
    </div>
  )
}
