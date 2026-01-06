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
  useFullDimensionSync,
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
  FormulaSection,
} from "./components"

// Import utils
import {
  toNum,
  buildDimsList,
  applyPrimaryDimsTo3D,
  getDefaultDimValue,
  getDimensionTypeForEditing,
  validateDrawerHeightChange,
} from "./utils/dimensionUtils"
import { toastThrottled } from "./utils/toastUtils"
import { getBenchtopBaseDimensions } from "@/features/scene/utils/benchtopUtils"
import {
  BENCHTOP_FORMULA_DIMENSIONS,
  FILLER_PANEL_FORMULA_DIMENSIONS,
} from "@/types/formulaTypes"

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
  onManualDimensionDeltaChange,
  formulaPieces,
  getFormula,
  onFormulaChange,
  getFormulaLastEvaluatedAt,
}) => {
  const cabinetId = selectedCabinet?.cabinetId

  // UI state (minimal - most state is in hooks)
  const [isExpanded, setIsExpanded] = useState(true)
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null)
  const [hasHydrated, setHasHydrated] = useState(false)

  // GD Mapping hook
  const gdMapping = useGDMapping(threeJsGDs)

  // Panel state hook
  const panelState = usePanelState({
    initialDims: wsProduct?.dims,
    initialMaterialColor: selectedCabinet?.material?.getColour?.() || "#ffffff",
  })

  // Persistence hook
  const persistence = usePersistence(cabinetId)

  useEffect(() => {
    setHasHydrated(false)
  }, [cabinetId])

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

  const formulaDimensions = useMemo(() => {
    const baseDimensions = dimsList.map(([dimId, dimObj]) => ({
      id: dimId,
      label: dimObj.dim || dimId,
    }))

    if (selectedCabinet?.cabinetType === "benchtop") {
      return [
        ...baseDimensions,
        ...BENCHTOP_FORMULA_DIMENSIONS.map((dim) => ({
          id: dim.id,
          label: dim.label,
        })),
      ]
    }

    if (
      selectedCabinet?.cabinetType === "filler" ||
      selectedCabinet?.cabinetType === "panel"
    ) {
      return [
        ...baseDimensions,
        ...FILLER_PANEL_FORMULA_DIMENSIONS.map((dim) => ({
          id: dim.id,
          label: dim.label,
        })),
      ]
    }

    return baseDimensions
  }, [dimsList, selectedCabinet?.cabinetType])
  const lastFormulaEvaluatedAt = cabinetId && getFormulaLastEvaluatedAt
    ? getFormulaLastEvaluatedAt(cabinetId)
    : undefined

  // Calculate modal filler/panel status
  const isModalFillerOrPanel =
    (selectedCabinet?.cabinetType === "filler" ||
      selectedCabinet?.cabinetType === "panel") &&
    selectedCabinet?.hideLockIcons === true

  const fullSelectedCabinet = useMemo(() => {
    if (!allCabinets || !selectedCabinet?.cabinetId) return undefined
    return allCabinets.find((c) => c.cabinetId === selectedCabinet.cabinetId)
  }, [allCabinets, selectedCabinet?.cabinetId])

  // Calculate if off-the-floor should be shown
  // Hide for fillers/panels that are children of "top" cabinets
  const shouldShowOffTheFloor = useMemo(() => {
    if (
      selectedCabinet?.cabinetType !== "filler" &&
      selectedCabinet?.cabinetType !== "panel"
    ) {
      return false
    }

    // If we can't check parent (no allCabinets), default to showing it
    if (!allCabinets || !selectedCabinet.cabinetId) return true

    if (!fullSelectedCabinet?.parentCabinetId) return true

    const parent = allCabinets.find(
      (c) => c.cabinetId === fullSelectedCabinet.parentCabinetId
    )
    // Hide if parent is a "top" cabinet
    return parent?.cabinetType !== "top"
  }, [
    selectedCabinet?.cabinetType,
    fullSelectedCabinet?.parentCabinetId,
    allCabinets,
  ])

  const childDeltaConfig = useMemo<{
    type: string;
    deltaDimensions: readonly ("width" | "height" | "depth")[];
} | undefined
>(() => {
    if (!selectedCabinet) return undefined

    if (
      selectedCabinet.cabinetType === "benchtop" &&
      selectedCabinet.benchtopParentCabinetId
    ) {
      return {
        type: "benchtop",
        deltaDimensions: ["width", "depth"] as const,
      }
    }

    if (
      fullSelectedCabinet?.cabinetType === "panel" &&
      fullSelectedCabinet.parentCabinetId &&
      fullSelectedCabinet.hideLockIcons === true
    ) {
      return {
        type: "panel",
        deltaDimensions: ["height", "depth"] as const,
      }
    }

    return undefined
  }, [
    selectedCabinet?.cabinetType,
    selectedCabinet?.benchtopParentCabinetId,
    fullSelectedCabinet?.cabinetType,
    fullSelectedCabinet?.parentCabinetId,
    fullSelectedCabinet?.hideLockIcons,
  ])

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

  const getDeltaBaseValue = useCallback(
    (dimensionType: "width" | "height" | "depth"): number | null => {
      if (!selectedCabinet) return null

      if (childDeltaConfig?.type === "benchtop") {
        const parentId = selectedCabinet.benchtopParentCabinetId
        const parentCabinet = parentId
          ? allCabinets?.find((cabinet) => cabinet.cabinetId === parentId)
          : undefined

        if (parentCabinet && allCabinets) {
          const base = getBenchtopBaseDimensions(
            parentCabinet,
            allCabinets,
            selectedCabinet.benchtopFrontOverhang
          )
          if (dimensionType === "width") return base.width
          if (dimensionType === "depth") return base.depth
        }
      }

      if (childDeltaConfig?.type === "panel") {
        const childCabinet = fullSelectedCabinet
        const parentCabinet = childCabinet?.parentCabinetId
          ? allCabinets?.find(
              (cabinet) => cabinet.cabinetId === childCabinet.parentCabinetId
            )
          : undefined

        if (childCabinet && parentCabinet) {
          const parentY = parentCabinet.group.position.y
          const parentHeight = parentCabinet.carcass.dimensions.height
          const parentDepth = parentCabinet.carcass.dimensions.depth
          const isOverheadWithOverhang =
            parentCabinet.cabinetType === "top" &&
            parentCabinet.carcass.config.overhangDoor === true
          const overhangAmount = 20

          let newY = parentY
          if (childCabinet.parentYOffset !== undefined) {
            newY = parentY + childCabinet.parentYOffset
          } else if (isOverheadWithOverhang) {
            newY = parentY - overhangAmount
          }

          const baseHeight = parentY + parentHeight - newY
          if (dimensionType === "height") return baseHeight
          if (dimensionType === "depth") return parentDepth
        }
      }

      const currentValue = selectedCabinet.dimensions[dimensionType]
      const existingDelta =
        selectedCabinet.manuallyEditedDelta?.[dimensionType] ?? 0
      return currentValue - existingDelta
    },
    [
      selectedCabinet,
      childDeltaConfig?.type,
      allCabinets,
      fullSelectedCabinet,
    ]
  )

  const getDeltaDimensionType = useCallback(
    (id: string): "width" | "height" | "depth" | null => {
      if (!childDeltaConfig || !wsProduct?.dims) return null

      const dimObj = wsProduct.dims[id]
      if (!dimObj) return null

      const dimensionType = getDimensionTypeForEditing(dimObj, gdMapping)
      if (!dimensionType) return null

      return childDeltaConfig.deltaDimensions.includes(dimensionType)
        ? dimensionType
        : null
    },
    [childDeltaConfig, wsProduct?.dims, gdMapping]
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
      setHasHydrated(true)
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
    cabinetId: childDeltaConfig ? undefined : cabinetId,
    cabinetWidth: childDeltaConfig ? undefined : selectedCabinet?.dimensions.width,
    dims: wsProduct?.dims,
    gdMapping,
    onWidthSync: (widthDimId, newWidth) => {
      panelState.updateValue(widthDimId, newWidth)
    },
    onPersistedWidthSync: (widthDimId, newWidth) => {
      persistence.updateSingleValue(widthDimId, newWidth)
    },
  })

  useFullDimensionSync({
    cabinetId: childDeltaConfig ? cabinetId : undefined,
    cabinetDimensions: childDeltaConfig ? selectedCabinet?.dimensions : undefined,
    dims: wsProduct?.dims,
    gdMapping,
    onDimensionsSync: (updates) => {
      Object.entries(updates).forEach(([id, value]) => {
        panelState.updateValue(id, value)
        persistence.updateSingleValue(id, value)
      })
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
    if (!cabinetId || !hasHydrated) return
    const existing = persistence.getPersisted()
    persistence.setPersisted({
      values: panelState.values,
      materialColor: panelState.materialColor,
      materialSelections: panelState.materialSelections,
      price: priceQuery.priceData,
      formulas: existing?.formulas,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    panelState.values,
    panelState.materialColor,
    panelState.materialSelections,
    priceQuery.priceData,
    cabinetId,
    hasHydrated,
  ])

  // Handlers
  const handleValueChange = useCallback(
    (id: string, value: number | string) => {
      const next = { ...panelState.values, [id]: value }
      panelState.setValues(next)
      const deltaDimensionType = getDeltaDimensionType(id)
      if (
        deltaDimensionType &&
        selectedCabinet &&
        onManualDimensionDeltaChange
      ) {
        const baseValue = getDeltaBaseValue(deltaDimensionType)
        if (baseValue !== null) {
          const nextDelta = toNum(value) - baseValue
          onManualDimensionDeltaChange(
            selectedCabinet.cabinetId,
            deltaDimensionType,
            nextDelta
          )
        }
        return
      }

      applyDimsTo3D(next, id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      panelState.values,
      applyDimsTo3D,
      getDeltaDimensionType,
      getDeltaBaseValue,
      onManualDimensionDeltaChange,
      selectedCabinet,
    ]
  )

  const handleResetAll = useCallback(() => {
    if (!wsProduct?.dims) return
    const nextValues: Record<string, number | string> = {}
    Object.entries(wsProduct.dims).forEach(([id, dimObj]) => {
      nextValues[id] = getDefaultDimValue(dimObj)
    })

    const deltaTypes = new Set<"width" | "height" | "depth">()
    if (childDeltaConfig && selectedCabinet && onManualDimensionDeltaChange) {
      dimsList.forEach(([id]) => {
        const deltaDimensionType = getDeltaDimensionType(id)
        if (!deltaDimensionType) return

        const baseValue = getDeltaBaseValue(deltaDimensionType)
        if (baseValue === null) return

        nextValues[id] = baseValue
        deltaTypes.add(deltaDimensionType)
      })
    }

    panelState.setValues(nextValues)
    panelState.setEditingValues({})

    if (childDeltaConfig && selectedCabinet && onManualDimensionDeltaChange) {
      deltaTypes.forEach((dimensionType) => {
        onManualDimensionDeltaChange(
          selectedCabinet.cabinetId,
          dimensionType,
          0
        )
      })
    }

    applyDimsTo3D(nextValues)
  }, [
    wsProduct?.dims,
    panelState,
    applyDimsTo3D,
    childDeltaConfig,
    selectedCabinet,
    onManualDimensionDeltaChange,
    dimsList,
    getDeltaDimensionType,
    getDeltaBaseValue,
  ])

  const handleResetDimension = useCallback(
    (id: string) => {
      const dimObj = wsProduct?.dims?.[id]
      if (!dimObj) return
      const deltaDimensionType = getDeltaDimensionType(id)
      if (
        deltaDimensionType &&
        selectedCabinet &&
        onManualDimensionDeltaChange
      ) {
        const baseValue = getDeltaBaseValue(deltaDimensionType)
        if (baseValue !== null) {
          panelState.setValues((prev) => ({ ...prev, [id]: baseValue }))
          panelState.clearEditingValue(id)
          onManualDimensionDeltaChange(
            selectedCabinet.cabinetId,
            deltaDimensionType,
            0
          )
        }
        return
      }

      panelState.resetValue(id, dimObj)
      applyDimsTo3D({ ...panelState.values, [id]: panelState.values[id] }, id)
    },
    [
      wsProduct?.dims,
      panelState,
      applyDimsTo3D,
      getDeltaDimensionType,
      getDeltaBaseValue,
      selectedCabinet,
      onManualDimensionDeltaChange,
    ]
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
                childDeltaConfig={childDeltaConfig}
                onValueChange={handleValueChange}
                onEditingChange={panelState.updateEditingValue}
                onReset={handleResetDimension}
                onResetAll={handleResetAll}
                onValidate={handleDimensionValidate}
                noWrapper
              />
            </CollapsibleSection>

            {cabinetId && formulaPieces && onFormulaChange && (
              <CollapsibleSection
                id="formulas"
                title="Formulas"
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
                    <path d="M3 12h6" />
                    <path d="M15 12h6" />
                    <path d="M9 5l6 14" />
                  </svg>
                }
              >
                <FormulaSection
                  cabinetId={cabinetId}
                  dimensions={formulaDimensions}
                  pieces={formulaPieces}
                  getFormula={getFormula}
                  onFormulaChange={onFormulaChange}
                  lastEvaluatedAt={lastFormulaEvaluatedAt}
                />
              </CollapsibleSection>
            )}

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
                    selectedCabinet.benchtopHeightFromFloor ??
                    (selectedCabinet.benchtopParentCabinetId
                      ? selectedCabinet.group.position.y
                      : 740)
                  }
                  heightFromFloorDefault={
                    selectedCabinet.benchtopParentCabinetId
                      ? (selectedCabinet.benchtopHeightFromFloor ??
                          selectedCabinet.group.position.y) -
                        (selectedCabinet.manuallyEditedDelta?.height ?? 0)
                      : 740
                  }
                  onHeightFromFloorChange={
                    onBenchtopHeightFromFloorChange
                      ? (value) => onBenchtopHeightFromFloorChange(selectedCabinet.cabinetId, value)
                      : undefined
                  }
                  noWrapper
                />
              </CollapsibleSection>
            )}

            {/* Off the Floor - Only for Fillers and Panels */}
            {shouldShowOffTheFloor && (
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
