import { getProductData, type DefaultMaterialSelections, type MaterialOptionsResponse } from '@/server/getProductData'
import { GDThreeJsType } from '@/types/erpTypes'
import { useQuery } from '@tanstack/react-query'
import _ from 'lodash'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'

import type { ProductPanelProps } from './productPanel.types'
import { ViewSelector } from './ViewSelector'
import type { ViewId } from '../ViewManager'
import { updateKickerPosition } from '@/features/scene/utils/handlers/kickerPositionHandler'

// Import refactored hooks
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
} from './productPanel/hooks'

// Import refactored components
import {
  PanelHeader,
  DimensionsSection,
  MaterialsSection,
  ColorPickerModal,
  PairSection,
  SyncSection,
  OffTheFloorControl,
  SimpleColorPicker,
} from './productPanel/components'

// Import utils
import {
  toNum,
  buildDimsList,
  applyPrimaryDimsTo3D,
  validateDrawerHeightChange,
} from './productPanel/utils/dimensionUtils'

import type { MaterialSelections } from './productPanel/utils/materialUtils'

// Re-export for backward compatibility
export { toNum }
export { cabinetPanelState, type PersistedPanelState } from './productPanel/hooks/usePersistence'

// Throttled toast to prevent spam when user drags sliders rapidly
export const toastThrottled = _.throttle(
  (message: string) => toast.error(message),
  1000,
  { leading: true, trailing: false }
)

interface LocalProductPanelProps extends ProductPanelProps {}

const ProductPanel: React.FC<LocalProductPanelProps> = props => {
  return <DynamicPanelWithQuery {...props} />
}

export default ProductPanel

// -------- Fetcher wrapper + Dynamic Dims-only variant driven by WsProduct --------
const DynamicPanelWithQuery: React.FC<LocalProductPanelProps> = ({
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
}) => {
  const productId = selectedCabinet?.productId
  
  const { data, isLoading, isError } = useQuery({
    queryKey: ['productData', productId],
    queryFn: async () => {
      if (!productId) throw new Error('No productId')
      const data = await getProductData(productId)

      // Apply drawer qty and door qty to all products of this productId in the cabinets state
      if (allCabinets) {
        for (const cabinet of allCabinets) {
          const cabProductId = cabinet.carcass?.productId
          if (cabProductId !== data.product.productId) continue

          const drawerQtyGDIds = data.threeJsGDs?.["drawerQty"] || []
          const doorQtyGDIds = data.threeJsGDs?.["doorQty"] || []
          const wsProduct = data.product
          const dimsList = _.sortBy(Object.entries(wsProduct?.dims || {}), ([, dimObj]) => Number(dimObj.sortNum))

          let drawerQty: number | undefined = selectedCabinet?.carcass?.config?.drawerQuantity
          let doorQty: number | undefined = selectedCabinet?.carcass?.config?.doorCount
          dimsList.forEach(([_id, dimObj]) => {
            const gdId = dimObj.GDId
            if (!gdId) return
            if (drawerQtyGDIds.includes(gdId)) drawerQty = toNum(dimObj.defaultValue) || drawerQty
            if (drawerQty) cabinet.carcass?.updateDrawerQuantity?.(drawerQty)
            if (doorQtyGDIds.includes(gdId)) doorQty = toNum(dimObj.defaultValue) || doorQty
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
      const { getPartDataManager } = require('@/nesting/PartDataManager')
      const partDataManager = getPartDataManager()
      partDataManager.setMaterialOptions(productId, materialOptions)
      partDataManager.setDefaultMaterialSelections(productId, defaultMaterialSelections)
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
      loading={isLoading}
      error={isError}
    />
  )
}

type DynamicPanelProps = LocalProductPanelProps & {
  productId?: string
  loading?: boolean
  error?: boolean
  materialOptions?: MaterialOptionsResponse
  defaultMaterialSelections?: DefaultMaterialSelections
  threeJsGDs: Record<GDThreeJsType, string[]> | undefined
  onGroupChange?: (cabinetId: string, groupCabinets: Array<{ cabinetId: string; percentage: number }>) => void
  initialGroupData?: Array<{ cabinetId: string; percentage: number }>
  onSyncChange?: (cabinetId: string, syncCabinets: string[]) => void
  initialSyncData?: string[]
}

const DynamicPanel: React.FC<DynamicPanelProps> = ({
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
}) => {
  const cabinetId = selectedCabinet?.cabinetId

  // UI state
  const [isExpanded, setIsExpanded] = useState(true)
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null)
  const [groupCabinets, setGroupCabinets] = useState<Array<{ cabinetId: string; percentage: number }>>([])
  const [syncCabinets, setSyncCabinets] = useState<string[]>([])
  const [offTheFloor, setOffTheFloor] = useState<number>(0)
  const [editingOffTheFloor, setEditingOffTheFloor] = useState<string>('')

  // GD Mapping hook
  const gdMapping = useGDMapping(threeJsGDs)

  // Panel state hook
  const panelState = usePanelState({
    initialDims: wsProduct?.dims,
    initialMaterialColor: selectedCabinet?.material.getColour() || '#ffffff',
  })

  // Persistence hook
  const persistence = usePersistence(cabinetId)

  // Build dims list
  const dimsList = useMemo(
    () => buildDimsList(wsProduct?.dims),
    [wsProduct?.dims]
  )

  // Calculate drawer quantity for dependent drawer detection
  const drawerQty = selectedCabinet?.carcass?.config?.drawerQuantity || 0

  // Calculate modal filler/panel status
  const isModalFillerOrPanel =
    (selectedCabinet?.cabinetType === 'filler' ||
      selectedCabinet?.cabinetType === 'panel') &&
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
      const { getPartDataManager } = require('@/nesting/PartDataManager')
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
      panelState.setValues(prev => ({ ...prev, ...syncedValues }))
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

  // Load group/sync data when selected cabinet changes
  useEffect(() => {
    if (selectedCabinet?.cabinetId) {
      if (initialGroupData && initialGroupData.length > 0) {
        setGroupCabinets([...initialGroupData])
      } else {
        setGroupCabinets([])
      }
      if (initialSyncData && initialSyncData.length > 0) {
        setSyncCabinets([...initialSyncData])
      } else {
        setSyncCabinets([])
      }
    }
  }, [selectedCabinet?.cabinetId, initialGroupData, initialSyncData])

  // Initialize material color and off-the-floor
  useEffect(() => {
    panelState.setMaterialColor(selectedCabinet?.material.getColour() || '#ffffff')
    if (
      selectedCabinet &&
      (selectedCabinet.cabinetType === 'filler' ||
        selectedCabinet.cabinetType === 'panel')
    ) {
      const currentY = selectedCabinet.group.position.y
      setOffTheFloor(Math.max(0, Math.min(1200, currentY)))
      setEditingOffTheFloor('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCabinet])

  // Apply drawer/door qty on dimsList change
  useEffect(() => {
    let drawerQtyVal: number | undefined = selectedCabinet?.carcass?.config?.drawerQuantity
    let doorQtyVal: number | undefined = selectedCabinet?.carcass?.config?.doorCount
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
        toastThrottled(validation.error || 'Invalid dimension value')
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

  const handleOffTheFloorChange = useCallback(
    (value: number) => {
      setOffTheFloor(value)
      if (selectedCabinet && allCabinets) {
        const actualCabinet = allCabinets.find(
          (c) => c.cabinetId === selectedCabinet.cabinetId
        )
        if (actualCabinet) {
          const currentY = actualCabinet.group.position.y
          const currentHeight = actualCabinet.carcass.dimensions.height
          const topPosition = currentY + currentHeight
          const newHeight = topPosition - value

          actualCabinet.group.position.set(
            actualCabinet.group.position.x,
            value,
            actualCabinet.group.position.z
          )

          if (onDimensionsChange) {
            onDimensionsChange({
              width: actualCabinet.carcass.dimensions.width,
              height: newHeight,
              depth: actualCabinet.carcass.dimensions.depth,
            })
          }

          // Update parent kicker
          if (actualCabinet.parentCabinetId && allCabinets) {
            const parentCabinet = allCabinets.find(
              (c) => c.cabinetId === actualCabinet.parentCabinetId
            )
            if (
              parentCabinet &&
              (parentCabinet.cabinetType === 'base' ||
                parentCabinet.cabinetType === 'tall')
            ) {
              updateKickerPosition(parentCabinet, allCabinets, {
                dimensionsChanged: true,
              })
            }
          }
        }
      }
    },
    [selectedCabinet, allCabinets, onDimensionsChange]
  )

  const handleGroupChange = useCallback(
    (newGroup: Array<{ cabinetId: string; percentage: number }>) => {
      setGroupCabinets(newGroup)
      if (selectedCabinet?.cabinetId && onGroupChange) {
        onGroupChange(selectedCabinet.cabinetId, newGroup)
      }
    },
    [selectedCabinet?.cabinetId, onGroupChange]
  )

  const handleSyncChange = useCallback(
    (newSyncList: string[]) => {
      setSyncCabinets(newSyncList)
      if (selectedCabinet?.cabinetId && onSyncChange) {
        onSyncChange(selectedCabinet.cabinetId, newSyncList)
      }
    },
    [selectedCabinet?.cabinetId, onSyncChange]
  )

  if (!isVisible) return null

  // Get cabinets in view for pair/sync sections
  const cabinetsInView =
    viewManager && selectedCabinet?.viewId && selectedCabinet.viewId !== 'none'
      ? viewManager.getCabinetsInView(selectedCabinet.viewId as ViewId)
      : []

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
        {isExpanded ? '<' : '>'}
      </button>

      <div
        className={`h-full transition-all duration-300 ease-in-out ${
          isExpanded ? 'w-80 sm:w-96 max-w-[90vw]' : 'w-0'
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
            {/* View Selector */}
            {viewManager && selectedCabinet && (
              <ViewSelector
                selectedViewId={selectedCabinet.viewId as ViewId | undefined}
                activeViews={viewManager.activeViews}
                onViewChange={(viewId) => {
                  if (selectedCabinet?.cabinetId) {
                    if (viewId === 'none') {
                      viewManager.assignCabinetToView(
                        selectedCabinet.cabinetId,
                        'none'
                      )
                      onViewChange?.(selectedCabinet.cabinetId, 'none')
                    } else {
                      viewManager.assignCabinetToView(
                        selectedCabinet.cabinetId,
                        viewId
                      )
                      onViewChange?.(selectedCabinet.cabinetId, viewId)
                    }
                  }
                }}
                onCreateView={() => {
                  const newView = viewManager.createView()
                  if (selectedCabinet?.cabinetId) {
                    viewManager.assignCabinetToView(
                      selectedCabinet.cabinetId,
                      newView.id
                    )
                    onViewChange?.(selectedCabinet.cabinetId, newView.id)
                  }
                }}
                cabinetId={selectedCabinet?.cabinetId}
                allCabinets={allCabinets}
              />
            )}

            {/* Pair Section */}
            {viewManager &&
              selectedCabinet &&
              selectedCabinet.viewId &&
              selectedCabinet.viewId !== 'none' && (
                <PairSection
                  selectedCabinet={{
                    cabinetId: selectedCabinet.cabinetId,
                    sortNumber: selectedCabinet.sortNumber,
                  }}
                  cabinetsInView={cabinetsInView}
                  allCabinets={(allCabinets || []).map((c) => ({
                    cabinetId: c.cabinetId,
                    sortNumber: c.sortNumber,
                  }))}
                  groupCabinets={groupCabinets}
                  onGroupChange={handleGroupChange}
                />
              )}

            {/* Sync Section */}
            {viewManager &&
              selectedCabinet &&
              selectedCabinet.viewId &&
              selectedCabinet.viewId !== 'none' && (
                <SyncSection
                  selectedCabinet={{
                    cabinetId: selectedCabinet.cabinetId,
                    sortNumber: selectedCabinet.sortNumber,
                  }}
                  cabinetsInView={cabinetsInView}
                  allCabinets={(allCabinets || []).map((c) => ({
                    cabinetId: c.cabinetId,
                    sortNumber: c.sortNumber,
                  }))}
                  syncCabinets={syncCabinets}
                  onSyncChange={handleSyncChange}
                />
              )}

            {/* Dimensions */}
            <DimensionsSection
              dimsList={dimsList}
              values={panelState.values}
              editingValues={panelState.editingValues}
              gdMapping={gdMapping}
              drawerQty={drawerQty}
              isModalFillerOrPanel={isModalFillerOrPanel}
              onValueChange={handleValueChange}
              onEditingChange={panelState.updateEditingValue}
              onReset={handleResetDimension}
              onResetAll={handleResetAll}
              onValidate={handleDimensionValidate}
            />

            {/* Off the Floor - Only for Fillers and Panels */}
            {(selectedCabinet?.cabinetType === 'filler' ||
              selectedCabinet?.cabinetType === 'panel') && (
              <OffTheFloorControl
                value={offTheFloor}
                editingValue={editingOffTheFloor}
                onValueChange={handleOffTheFloorChange}
                onEditingChange={setEditingOffTheFloor}
              />
            )}

            {/* Materials selection */}
            {wsProduct && (
              <MaterialsSection
                wsProduct={wsProduct}
                materialOptions={materialOptions}
                materialSelections={panelState.materialSelections}
                onSelectionChange={handleMaterialSelectionChange}
                onOpenColorPicker={(materialId) => setOpenMaterialId(materialId)}
              />
            )}

            {/* Material color selection (simple) */}
            <SimpleColorPicker
              color={panelState.materialColor}
              onChange={handleMaterialColorChange}
            />

            {/* Bottom actions */}
            <div className="pt-1.5">
              <button
                onClick={() => {
                  // Debug/log selections
                  console.log('[ProductPanel2] Selections:', {
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
