import { calculateWsProductPrice, type CalculatePriceRequest } from '@/server/calculateWsProductPrice'
import { getProductData, type DefaultMaterialSelections, type MaterialOptionsResponse } from '@/server/getProductData'
import { GDThreeJsType } from '@/types/erpTypes'
import { useQuery } from '@tanstack/react-query'
import _ from 'lodash'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, X, RefreshCw, RotateCcw } from 'lucide-react'
import type { ProductPanelProps } from './productPanel.types'
import { ViewSelector } from './ViewSelector'
import type { ViewId } from '../ViewManager'

interface LocalProductPanelProps extends ProductPanelProps { }

// In-memory per-cabinet state store to persist last user-edited values across panel reopens
export type PersistedPanelState = {
  values: Record<string, number | string>
  materialColor: string
  materialSelections?: Record<string, { priceRangeId: string, colorId: string, finishId?: string }>
  price?: { amount: number }
}
export const cabinetPanelState = new Map<string, PersistedPanelState>()

const ProductPanel: React.FC<LocalProductPanelProps> = props => {
  // Always render dynamic panel: fetch WsProduct on demand via React Query using cabinet productId
  return <DynamicPanelWithQuery {...props} />
}

export default ProductPanel

// -------- Fetcher wrapper + Dynamic Dims-only variant driven by WsProduct --------
const DynamicPanelWithQuery: React.FC<LocalProductPanelProps> = ({ isVisible, onClose, selectedCabinet, onDimensionsChange, onMaterialChange, onOverhangDoorToggle, onShelfCountChange, onDrawerHeightChange, onDrawerQuantityChange, viewManager, onViewChange, allCabinets, onGroupChange, initialGroupData, onSyncChange, initialSyncData }) => {
  const productId = selectedCabinet?.productId
  const { data, isLoading, isError } = useQuery({
    queryKey: ['productData', productId],
    queryFn: async () => {
      if (!productId) throw new Error('No productId')
      // Call Next.js Server Action directly for type-safe data
      const data = await getProductData(productId)

      // apply drawer qty to all products of this productId in the cabinets state
      if (allCabinets) {
        for (const cabinet of allCabinets) {
          const cabProductId = cabinet.carcass?.productId
          if (cabProductId !== data.product.productId) continue

          const drawerQtyGDIds = data.threeJsGDs?.["drawerQty"] || []
          const wsProduct = data.product
          const dimsList = _.sortBy(Object.entries(wsProduct?.dims || {}), ([, dimObj]) => Number(dimObj.sortNum))

          let drawerQty: number | undefined = selectedCabinet?.carcass?.config?.drawerQuantity
          dimsList.forEach(([id, dimObj]) => {
            const gdId = dimObj.GDId
            if (!gdId) return
            if (drawerQtyGDIds.includes(gdId)) drawerQty = toNum(dimObj.defaultValue) || drawerQty
            if (drawerQty) cabinet.carcass?.updateDrawerQuantity?.(drawerQty)
          })
        }
      }
      return data
    },
    // enabled: !!productId && !!isVisible,
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity
  })

  const wsProduct = data?.product
  const materialOptions = data?.materialOptions
  const defaultMaterialSelections = data?.defaultMaterialSelections
  const threeJsGDs = data?.threeJsGDs

  // Debug: log fetched data shape when visible
  useEffect(() => {
    if (!productId) return
  }, [isVisible, productId, wsProduct, materialOptions, defaultMaterialSelections])

  // if (!isVisible) return null
  if (!productId) return null

  return (
    <DynamicPanel
      key={productId}
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

export const toNum = (v: number | string | undefined) => typeof v === 'number' ? v : Number(v)

type DynamicPanelProps = LocalProductPanelProps & { loading?: boolean, error?: boolean, materialOptions?: MaterialOptionsResponse, defaultMaterialSelections?: DefaultMaterialSelections, threeJsGDs: Record<GDThreeJsType, string[]> | undefined, onGroupChange?: (cabinetId: string, groupCabinets: Array<{ cabinetId: string; percentage: number }>) => void, initialGroupData?: Array<{ cabinetId: string; percentage: number }>, onSyncChange?: (cabinetId: string, syncCabinets: string[]) => void, initialSyncData?: string[] }

const DynamicPanel: React.FC<DynamicPanelProps> = ({ isVisible, onClose, wsProduct, materialOptions, defaultMaterialSelections, selectedCabinet, onDimensionsChange, onMaterialChange, loading, error, threeJsGDs, onOverhangDoorToggle, onShelfCountChange, onDrawerHeightChange, onDrawerQuantityChange, viewManager, onViewChange, allCabinets, onGroupChange, initialGroupData, onSyncChange, initialSyncData }) => {


  const [isExpanded, setIsExpanded] = useState(true)
  const [values, setValues] = useState<Record<string, number | string>>(() => {
    const entries = Object.entries(wsProduct?.dims || {})
    const initial: Record<string, number | string> = {}
    entries.forEach(([id, dimObj]) => { initial[id] = dimObj.defaultValue })
    return initial
  })
  const [materialColor, setMaterialColor] = useState<string>(selectedCabinet?.material.getColour() || '#ffffff')
  const [materialSelections, setMaterialSelections] = useState<Record<string, { priceRangeId: string, colorId: string, finishId?: string }>>({})
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null)
  const [groupCabinets, setGroupCabinets] = useState<Array<{ cabinetId: string; percentage: number }>>([])
  const [selectedCabinetToAdd, setSelectedCabinetToAdd] = useState<string>('')
  const [syncCabinets, setSyncCabinets] = useState<string[]>([])
  const [selectedCabinetToAddSync, setSelectedCabinetToAddSync] = useState<string>('')
  
  // Load group data when selected cabinet changes
  useEffect(() => {
    if (selectedCabinet?.cabinetId) {
      // Load existing group data from parent (ThreeScene)
      if (initialGroupData && initialGroupData.length > 0) {
        setGroupCabinets([...initialGroupData])
      } else {
        setGroupCabinets([])
      }
      // Load existing sync data from parent (ThreeScene)
      if (initialSyncData && initialSyncData.length > 0) {
        setSyncCabinets([...initialSyncData])
      } else {
        setSyncCabinets([])
      }
    }
  }, [selectedCabinet?.cabinetId, initialGroupData, initialSyncData])
  
  // debounced inputs for price calculation
  type MaterialSel = { priceRangeId: string, colorId: string, finishId?: string }
  type PriceInputs = { dims: Record<string, number | string>, materialSelections: Record<string, MaterialSel> }
  const [debouncedInputs, setDebouncedInputs] = useState<PriceInputs>({ dims: {}, materialSelections: {} })
  // const lastInitRef = useRef<string | null>(null)
  const cabinetId = selectedCabinet?.cabinetId
  const hasInitializedRef = useRef<boolean>(false)
  const lastSyncedWidthRef = useRef<number | null>(null)


  useEffect(() => {
    setMaterialColor(selectedCabinet?.material.getColour() || '#ffffff')
  }, [selectedCabinet])

  // add window event listener for productPanel:updateDim
  useEffect(() => {
    if (!cabinetId) return
    // Handler expects a CustomEvent with detail: { id: string, value: number }
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ id: string; value: number }>
      const payload = ev.detail || (e as MessageEvent).data
      if (!payload || typeof payload.id !== 'string') return
      const id = payload.id
      const valNum = Number(payload.value)
      if (isNaN(valNum)) return

      setValues(prev => {
        const next = { ...prev, [id]: valNum }
        return next
      })
      const saved = cabinetPanelState.get(cabinetId)
      if (!saved) throw new Error("Cabinet panel state not found.")
      cabinetPanelState.set(cabinetId, {
        ...saved,
        values: {
          ...saved?.values,
          [id]: valNum,
        },
      })
    }

    window.addEventListener('productPanel:updateDim', handler)
    return () => {
      window.removeEventListener('productPanel:updateDim', handler)
    }
  }, [cabinetId])


  // const envWidthGDIds = process.env.NEXT_PUBLIC_WIDTH_GDID?.split(',') || []
  // const envHeightGDIds = process.env.NEXT_PUBLIC_HEIGHT_GDID?.split(',') || []
  // const envDepthGDIds = process.env.NEXT_PUBLIC_DEPTH_GDID?.split(',') || []
  const widthGDIds = threeJsGDs?.["width"] || []
  const heightGDIds = threeJsGDs?.["height"] || []
  const depthGDIds = threeJsGDs?.["depth"] || []
  const doorOverhangGDIds = threeJsGDs?.["doorOverhang"] || []
  const shelfQtyGDIds = threeJsGDs?.["shelfQty"] || []
  const drawerQtyGDIds = threeJsGDs?.["drawerQty"] || []
  // Drawer height GD mappings (index based)
  const drawerHeightGDMap: Record<number, string[]> = {
    0: threeJsGDs?.drawerH1 || [],
    1: threeJsGDs?.drawerH2 || [],
    2: threeJsGDs?.drawerH3 || [],
    3: threeJsGDs?.drawerH4 || [],
    4: threeJsGDs?.drawerH5 || []
  }

  const dimsList = useMemo(() => {
    const entries = Object.entries(wsProduct?.dims || {})
    return _.sortBy(entries, ([, dimObj]) => Number(dimObj.sortNum))
  }, [wsProduct?.dims])

  useEffect(() => {
    let drawerQty: number | undefined = selectedCabinet?.carcass?.config?.drawerQuantity
    dimsList.forEach(([_id, dimObj]) => {
      const gdId = dimObj.GDId
      if (!gdId) return
      if (drawerQtyGDIds.includes(gdId)) drawerQty = toNum(dimObj.defaultValue) || drawerQty
      if (drawerQty) onDrawerQuantityChange?.(drawerQty)
    })
  }, [dimsList, threeJsGDs])

  // Sync values with current cabinet dimensions when they change externally (e.g., from group rule)
  useEffect(() => {
    if (!selectedCabinet || !wsProduct?.dims || !cabinetId) return
    
    const currentWidth = selectedCabinet.dimensions.width
    
    // Reset ref when cabinet changes
    if (lastSyncedWidthRef.current === null || lastSyncedWidthRef.current !== currentWidth) {
      // Find width dimension ID and sync with current cabinet width
      const widthGDIds = threeJsGDs?.["width"] || []
      let widthDimId: string | null = null
      for (const [dimId, dimObj] of Object.entries(wsProduct.dims)) {
        if (dimObj.GDId && widthGDIds.includes(dimObj.GDId)) {
          widthDimId = dimId
          break
        }
      }
      
      // If we found the width dimension ID and the width has changed, update it
      if (widthDimId && (lastSyncedWidthRef.current === null || Math.abs(lastSyncedWidthRef.current - currentWidth) > 0.1)) {
        // Width changed externally - sync the values state
        setValues(prevValues => {
          const updatedValues = { ...prevValues, [widthDimId!]: currentWidth }
          
          // Also update cabinetPanelState
          const persisted = cabinetPanelState.get(cabinetId)
          if (persisted) {
            cabinetPanelState.set(cabinetId, {
              ...persisted,
              values: updatedValues
            })
          }
          
          return updatedValues
        })
        
        // Update ref to track the synced width
        lastSyncedWidthRef.current = currentWidth
      }
    }
  }, [selectedCabinet?.dimensions.width, selectedCabinet?.cabinetId, wsProduct?.dims, cabinetId, threeJsGDs])
  
  // Reset sync ref when cabinet changes
  useEffect(() => {
    lastSyncedWidthRef.current = null
  }, [cabinetId])

  // Initialize values once data loads or when product changes; also apply primary dims to 3D once
  useEffect(() => {
    if (!wsProduct?.dims || !cabinetId) return
    // if (lastInitRef.current === cabinetId && !_.isEmpty(values)) return


    if (hasInitializedRef.current) return
    hasInitializedRef.current = true

    // [ProductPanel] Initialize
    const entries = Object.entries(wsProduct.dims)
    const defaults: Record<string, number | string> = {}
    entries.forEach(([id, dimObj]) => { defaults[id] = dimObj.defaultValue })
    const saved = cabinetPanelState.get(cabinetId)
    // Sync with current cabinet dimensions if available (prioritize actual dimensions over saved)
    let nextValues = saved?.values ? { ...defaults, ...saved.values } : defaults
    
    // If selectedCabinet has dimensions, sync width/height/depth from actual cabinet
    if (selectedCabinet) {
      const widthGDIds = threeJsGDs?.["width"] || []
      const heightGDIds = threeJsGDs?.["height"] || []
      const depthGDIds = threeJsGDs?.["depth"] || []
      
      for (const [dimId, dimObj] of Object.entries(wsProduct.dims)) {
        if (dimObj.GDId) {
          if (widthGDIds.includes(dimObj.GDId)) {
            nextValues[dimId] = selectedCabinet.dimensions.width
          } else if (heightGDIds.includes(dimObj.GDId)) {
            nextValues[dimId] = selectedCabinet.dimensions.height
          } else if (depthGDIds.includes(dimObj.GDId)) {
            nextValues[dimId] = selectedCabinet.dimensions.depth
          }
        }
      }
    }
    const nextColor = saved?.materialColor ?? (selectedCabinet?.material.getColour() || '#ffffff')

    // Determine initial material selections: prefer saved, else derive from API defaults, else empty
    // Build API defaults map
    const apiDefaults: Record<string, { priceRangeId: string, colorId: string, finishId?: string }> = {}
    if (defaultMaterialSelections && materialOptions) {
      // [ProductPanel] Apply API defaultMaterialSelections
      for (const [materialId, sel] of Object.entries(defaultMaterialSelections)) {
        const mOpts = materialOptions[materialId]
        if (!mOpts) {
          console.warn('No material options for', materialId)
          continue
        }
        const desiredColorId = sel.colorId || undefined
        // find priceRange containing the colorId
        let priceRangeId: string | undefined
        if (desiredColorId) {
          for (const [prId, pr] of Object.entries(mOpts.priceRanges)) {
            if (desiredColorId in pr.colorOptions) { priceRangeId = prId; break }
          }
        }
        if (!priceRangeId) {
          priceRangeId = Object.keys(mOpts.priceRanges)[0]
          // fallback selection chosen
        }
        const pr = priceRangeId ? mOpts.priceRanges[priceRangeId] : undefined
        let colorId = desiredColorId
        if (!colorId) {
          colorId = pr ? Object.keys(pr.colorOptions)[0] : ''
          // fallback color chosen
        }
        // finish
        let finishId = sel.finishId || undefined
        if (!finishId && colorId && pr) {
          const finishes = pr.colorOptions[colorId]?.finishes
          if (finishes) finishId = Object.keys(finishes)[0]
        }
        // default selections computed
        apiDefaults[materialId] = { priceRangeId: priceRangeId || '', colorId: colorId || '', finishId }
      }
      // end Apply API defaults
    }

    // Merge strategy: API defaults provide base, saved selections override where present
    let nextSelections: Record<string, { priceRangeId: string, colorId: string, finishId?: string }>
    if (saved?.materialSelections) {
      const savedEmpty = _.isEmpty(saved.materialSelections)
      if (savedEmpty) {/* Saved materialSelections empty → seeding with API defaults */}
      nextSelections = { ...apiDefaults, ...saved.materialSelections }
    } else {
      nextSelections = { ...apiDefaults }
    }

    setValues(nextValues)
    setMaterialColor(nextColor)
    setMaterialSelections(nextSelections || {})
    // Initialized values and selections
    // Persist initialized state and sync 3D primary dims
    cabinetPanelState.set(cabinetId, { values: nextValues, materialColor: nextColor, materialSelections: nextSelections || {}, price: saved?.price })
    // Persisted state for cabinet
    // lastInitRef.current = cabinetId
    if (!selectedCabinet.carcass?.defaultDimValuesApplied) {
      applyPrimaryDimsTo3D(nextValues)
      selectedCabinet.carcass!.defaultDimValuesApplied = true
    }
    // end Initialize
  }, [wsProduct?.dims, cabinetId, materialOptions, defaultMaterialSelections])

  // Setup debounced updates for price inputs
  useEffect(() => {
    const updater = _.debounce((next: PriceInputs) => {
      setDebouncedInputs(next)
    }, 400)
    updater({ dims: values, materialSelections })
    return () => {
      updater.cancel()
    }
  }, [values, materialSelections])

  // Price calculation via React Query keyed by all affecting inputs
  const { data: priceData, isFetching: isPriceFetching, isError: isPriceError } = useQuery({
    queryKey: ['wsProductPrice', wsProduct?.productId, debouncedInputs.dims, debouncedInputs.materialSelections],
    queryFn: async () => {
      if (!wsProduct?.productId) throw new Error('No productId')
      const payload: CalculatePriceRequest = {
        productId: wsProduct.productId,
        dims: debouncedInputs.dims,
        materialSelections: debouncedInputs.materialSelections
      }
      const res = await calculateWsProductPrice(payload)
      return { amount: res.price }
    },
    enabled: !!isVisible && !!wsProduct?.productId && Object.keys(debouncedInputs.dims || {}).length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  })

  useEffect(() => {
    if (isPriceFetching) return
    if (isPriceError) {
      console.warn('[ProductPanel] Price query error for', wsProduct?.productId)
    } else if (priceData) {
      // Price updated
    }
  }, [priceData, isPriceFetching, isPriceError, wsProduct?.productId])

  // Persist latest price in the in-memory store for the cabinet
  useEffect(() => {
    if (!cabinetId) return
    const persisted = cabinetPanelState.get(cabinetId)
    cabinetPanelState.set(cabinetId, { ...(persisted || { values, materialColor, materialSelections }), price: priceData || persisted?.price })
  }, [priceData, cabinetId])


  const applyPrimaryDimsTo3D = (vals: Record<string, number | string>, changedId?: string) => {
    if (!selectedCabinet || !onDimensionsChange) return
    let width = selectedCabinet.dimensions.width
    let height = selectedCabinet.dimensions.height
    let depth = selectedCabinet.dimensions.depth
    let overhangDoor = selectedCabinet.overhangDoor
    let shelfCount: number | undefined = selectedCabinet.carcass?.config?.shelfCount
    let drawerQty: number | undefined = selectedCabinet.carcass?.config?.drawerQuantity
    // Collect drawer heights by index from GDIds
    const pendingDrawerHeights: Record<number, number> = {}

    dimsList.forEach(([id, dimObj]) => {
      if (!dimObj.GDId) return
      const v = vals[id]
      const gdId = dimObj.GDId
      if (widthGDIds.includes(gdId)) width = toNum(v) || width
      if (heightGDIds.includes(gdId)) height = toNum(v) || height
      if (depthGDIds.includes(gdId)) depth = toNum(v) || depth
      if (doorOverhangGDIds.includes(gdId)) overhangDoor = v.toString().toLowerCase() === 'yes' || v === 1 || v === '1'
      if (shelfQtyGDIds.includes(gdId)) shelfCount = toNum(v) || shelfCount
      if (drawerQtyGDIds.includes(gdId)) drawerQty = toNum(v) || drawerQty
      // Drawer heights
      Object.entries(drawerHeightGDMap).forEach(([drawerIndexStr, gdList]) => {
        const drawerIndex = Number(drawerIndexStr)
        if (gdList.includes(gdId)) {
          const numVal = toNum(v)
          if (!isNaN(numVal)) {
            if (!changedId) { // This is the initial setup of dimensions, apply to all
              pendingDrawerHeights[drawerIndex] = numVal
            } else { // This was a user change, only apply if this is the changed one
              if (id === changedId) {
                pendingDrawerHeights[drawerIndex] = numVal
              }
            }
          }
        }
      })
    })
    onDimensionsChange({ width, height, depth })
    onOverhangDoorToggle?.(overhangDoor || false)
    onShelfCountChange?.(shelfCount || 0)
    // Apply drawer quantity before heights so drawers exist
    if (drawerQty !== undefined && onDrawerQuantityChange && drawerQty > 0) {
      onDrawerQuantityChange(drawerQty)
    }

    // Apply drawer heights only if enabled and callback present
    if (drawerQty && onDrawerHeightChange) {
      Object.entries(pendingDrawerHeights).forEach(([idxStr, h]) => {
        const idx = Number(idxStr)
        if (idx < drawerQty!) onDrawerHeightChange(idx, h, changedId)
      })
    }

    // Applied primary dims to 3D
  }

  // Price is calculated automatically via debounced query

  if (!isVisible) return null

  return (
    <div
      className="fixed right-0 top-0 h-full bg-white shadow-lg border-l border-gray-200 transition-all duration-300 ease-in-out z-50 productPanel"
      data-product-panel
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onMouseUp={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <button
        onClick={e => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
        onMouseDown={e => e.stopPropagation()}
        onMouseUp={e => e.stopPropagation()}
        className="absolute -left-3 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white rounded-full p-1 hover:bg-blue-700 transition-colors"
      >
        {isExpanded ? '<' : '>'}
      </button>

      <div className={`h-full transition-all duration-300 ease-in-out ${isExpanded ? 'w-80 sm:w-96 max-w-[90vw]' : 'w-0'} overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}>
        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Product Panel</h2>
            <div className="ml-2 flex items-center gap-2 text-sm text-gray-700">
              {isPriceFetching ? (
                <span className="text-gray-500">Updating…</span>
              ) : isPriceError ? (
                <span className="text-red-600">Price N/A</span>
              ) : priceData ? (
                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">{`$${priceData.amount.toFixed(2)}`}</span>
              ) : null}
            </div>
            <button onClick={e => { e.stopPropagation(); onClose() }} className="text-gray-500 hover:text-gray-700 transition-colors">×</button>
          </div>
          {wsProduct && <p className="text-sm text-gray-600 mt-1 truncate">{wsProduct.product}</p>}
        </div>

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
                      viewManager.assignCabinetToView(selectedCabinet.cabinetId, 'none')
                      onViewChange?.(selectedCabinet.cabinetId, 'none')
                    } else {
                      viewManager.assignCabinetToView(selectedCabinet.cabinetId, viewId)
                      onViewChange?.(selectedCabinet.cabinetId, viewId)
                    }
                  }
                }}
                onCreateView={() => {
                  const newView = viewManager.createView()
                  if (selectedCabinet?.cabinetId) {
                    viewManager.assignCabinetToView(selectedCabinet.cabinetId, newView.id)
                    onViewChange?.(selectedCabinet.cabinetId, newView.id)
                  }
                }}
                cabinetId={selectedCabinet?.cabinetId}
                allCabinets={allCabinets}
              />
            )}

            {/* Pair Section */}
            {viewManager && selectedCabinet && selectedCabinet.viewId && selectedCabinet.viewId !== 'none' && (
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <h3>Pair</h3>
                </div>
                <div className="space-y-3">
                  {/* Dropdown and Add Button */}
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={selectedCabinetToAdd}
                      onChange={(e) => setSelectedCabinetToAdd(e.target.value)}
                    >
                      <option value="">Select a cabinet...</option>
                      {(() => {
                        const cabinetsInView = viewManager.getCabinetsInView(selectedCabinet.viewId as ViewId)
                        const availableCabinets = (allCabinets || [])
                          .filter(c => 
                            c.cabinetId !== selectedCabinet.cabinetId && 
                            cabinetsInView.includes(c.cabinetId) &&
                            !groupCabinets.find(g => g.cabinetId === c.cabinetId)
                          )
                        return availableCabinets.map(cabinet => (
                          <option key={cabinet.cabinetId} value={cabinet.cabinetId}>
                            {cabinet.sortNumber ? `#${cabinet.sortNumber}` : `Cabinet ${cabinet.cabinetId.slice(0, 8)}...`}
                          </option>
                        ))
                      })()}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedCabinetToAdd && !groupCabinets.find(g => g.cabinetId === selectedCabinetToAdd)) {
                          const newGroup = [...groupCabinets, { cabinetId: selectedCabinetToAdd, percentage: 0 }]
                          // Distribute percentages evenly
                          const totalCabinets = newGroup.length
                          const equalPercentage = 100 / totalCabinets
                          const adjustedGroup = newGroup.map(g => ({ ...g, percentage: Math.round(equalPercentage * 100) / 100 }))
                          // Ensure total is exactly 100%
                          const total = adjustedGroup.reduce((sum, g) => sum + g.percentage, 0)
                          if (total !== 100) {
                            const diff = 100 - total
                            adjustedGroup[0].percentage += diff
                          }
                          setGroupCabinets(adjustedGroup)
                          setSelectedCabinetToAdd('')
                          // Notify parent about group change
                          if (selectedCabinet?.cabinetId && onGroupChange) {
                            onGroupChange(selectedCabinet.cabinetId, adjustedGroup)
                          }
                        }
                      }}
                      disabled={!selectedCabinetToAdd || groupCabinets.find(g => g.cabinetId === selectedCabinetToAdd) !== undefined}
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Add cabinet to pair"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Pair List */}
                  {groupCabinets.length > 0 && (
                    <div className="space-y-2">
                      {groupCabinets.map((groupCabinet, index) => {
                        const cabinet = (allCabinets || []).find(c => c.cabinetId === groupCabinet.cabinetId)
                        return (
                          <div key={groupCabinet.cabinetId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                            <span className="flex-1 text-sm text-gray-700 truncate">
                              {cabinet?.sortNumber ? `#${cabinet.sortNumber}` : (cabinet ? `Cabinet ${cabinet.cabinetId.slice(0, 8)}...` : `Cabinet ${groupCabinet.cabinetId.slice(0, 8)}...`)}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              value={groupCabinet.percentage}
                              onChange={(e) => {
                                const newPercentage = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                                const updatedGroup = groupCabinets.map((g, i) => 
                                  i === index ? { ...g, percentage: newPercentage } : g
                                )
                                // Adjust other percentages to maintain 100% total
                                const total = updatedGroup.reduce((sum, g) => sum + g.percentage, 0)
                                if (total !== 100) {
                                  const diff = 100 - total
                                  const otherIndices = updatedGroup.map((_, i) => i).filter(i => i !== index)
                                  if (otherIndices.length > 0) {
                                    const perCabinet = diff / otherIndices.length
                                    otherIndices.forEach(i => {
                                      updatedGroup[i].percentage = Math.max(0, Math.min(100, updatedGroup[i].percentage + perCabinet))
                                    })
                                    // Final adjustment to ensure exactly 100%
                                    const finalTotal = updatedGroup.reduce((sum, g) => sum + g.percentage, 0)
                                    if (finalTotal !== 100) {
                                      updatedGroup[otherIndices[0]].percentage += (100 - finalTotal)
                                    }
                                  }
                                }
                                setGroupCabinets(updatedGroup)
                                // Notify parent about group change
                                if (selectedCabinet?.cabinetId && onGroupChange) {
                                  onGroupChange(selectedCabinet.cabinetId, updatedGroup)
                                }
                              }}
                            />
                            <span className="text-sm text-gray-600">%</span>
                            <button
                              onClick={() => {
                                const remaining = groupCabinets.filter(g => g.cabinetId !== groupCabinet.cabinetId)
                                if (remaining.length > 0) {
                                  // Redistribute percentages to remaining cabinets
                                  const totalRemaining = remaining.reduce((sum, g) => sum + g.percentage, 0)
                                  const adjusted = remaining.map(g => ({
                                    ...g,
                                    percentage: totalRemaining > 0 ? (g.percentage / totalRemaining) * 100 : 100 / remaining.length
                                  }))
                                  // Ensure total is exactly 100%
                                  const finalTotal = adjusted.reduce((sum, g) => sum + g.percentage, 0)
                                  if (finalTotal !== 100) {
                                    adjusted[0].percentage += (100 - finalTotal)
                                  }
                                  setGroupCabinets(adjusted)
                                  // Notify parent about group change
                                  if (selectedCabinet?.cabinetId && onGroupChange) {
                                    onGroupChange(selectedCabinet.cabinetId, adjusted)
                                  }
                                } else {
                                  setGroupCabinets([])
                                  // Notify parent about group change (empty)
                                  if (selectedCabinet?.cabinetId && onGroupChange) {
                                    onGroupChange(selectedCabinet.cabinetId, [])
                                  }
                                }
                              }}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="Remove from pair"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )
                      })}
                      {/* Total Percentage Display */}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-medium text-gray-700">Total:</span>
                        <span className={`text-sm font-semibold ${groupCabinets.reduce((sum, g) => sum + g.percentage, 0) === 100 ? 'text-green-600' : 'text-red-600'}`}>
                          {groupCabinets.reduce((sum, g) => sum + g.percentage, 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Sync Section */}
            {viewManager && selectedCabinet && selectedCabinet.viewId && selectedCabinet.viewId !== 'none' && (
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
                  <RefreshCw size={20} />
                  <h3>Sync</h3>
                </div>
                <div className="space-y-3">
                  {/* Dropdown and Add Button */}
                  <div className="flex items-center gap-2">
                    <select
                      className="flex-1 text-sm px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      value={selectedCabinetToAddSync}
                      onChange={(e) => setSelectedCabinetToAddSync(e.target.value)}
                    >
                      <option value="">Select a cabinet...</option>
                      {(() => {
                        const cabinetsInView = viewManager.getCabinetsInView(selectedCabinet.viewId as ViewId)
                        const availableCabinets = (allCabinets || [])
                          .filter(c => 
                            c.cabinetId !== selectedCabinet.cabinetId && 
                            cabinetsInView.includes(c.cabinetId) &&
                            !syncCabinets.includes(c.cabinetId)
                          )
                        return availableCabinets.map(cabinet => (
                          <option key={cabinet.cabinetId} value={cabinet.cabinetId}>
                            {cabinet.sortNumber ? `#${cabinet.sortNumber}` : `Cabinet ${cabinet.cabinetId.slice(0, 8)}...`}
                          </option>
                        ))
                      })()}
                    </select>
                    <button
                      onClick={() => {
                        if (selectedCabinetToAddSync && !syncCabinets.includes(selectedCabinetToAddSync)) {
                          const newSyncList = [...syncCabinets, selectedCabinetToAddSync]
                          setSyncCabinets(newSyncList)
                          setSelectedCabinetToAddSync('')
                          // Notify parent about sync change
                          if (selectedCabinet?.cabinetId && onSyncChange) {
                            onSyncChange(selectedCabinet.cabinetId, newSyncList)
                          }
                        }
                      }}
                      disabled={!selectedCabinetToAddSync || syncCabinets.includes(selectedCabinetToAddSync)}
                      className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Add cabinet to sync"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Sync List */}
                  {syncCabinets.length > 0 && (
                    <div className="space-y-2">
                      {syncCabinets.map((syncCabinetId) => {
                        const cabinet = (allCabinets || []).find(c => c.cabinetId === syncCabinetId)
                        return (
                          <div key={syncCabinetId} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                            <span className="flex-1 text-sm text-gray-700 truncate">
                              {cabinet?.sortNumber ? `#${cabinet.sortNumber}` : (cabinet ? `Cabinet ${cabinet.cabinetId.slice(0, 8)}...` : `Cabinet ${syncCabinetId.slice(0, 8)}...`)}
                            </span>
                            <button
                              onClick={() => {
                                const newSyncList = syncCabinets.filter(id => id !== syncCabinetId)
                                setSyncCabinets(newSyncList)
                                // Notify parent about sync change
                                if (selectedCabinet?.cabinetId && onSyncChange) {
                                  onSyncChange(selectedCabinet.cabinetId, newSyncList)
                                }
                              }}
                              className="text-gray-400 hover:text-red-600 transition-colors"
                              title="Remove from sync"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Dimensions */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-2.5 text-gray-700 font-medium">
                <div className="flex items-center space-x-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5" /><path d="M8 21H3v-5" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></svg>
                  <h3>Dimensions</h3>
                </div>
                <button
                  type="button"
                  title="Reset all dimensions"
                  onClick={() => {
                    if (!wsProduct?.dims) return
                    const next: Record<string, number | string> = {}
                    Object.entries(wsProduct.dims).forEach(([id, dimObj]) => {
                      if (dimObj.valueType === 'range') {
                        let defVal = Number(dimObj.defaultValue ?? dimObj.min ?? 0)
                        if (isNaN(defVal)) defVal = 0
                        if (typeof dimObj.min === 'number') defVal = Math.max(dimObj.min, defVal)
                        if (typeof dimObj.max === 'number') defVal = Math.min(dimObj.max, defVal)
                        next[id] = defVal
                      } else {
                        next[id] = String(dimObj.defaultValue ?? dimObj.options?.[0] ?? '')
                      }
                    })
                    setValues(next)
                    if (cabinetId) {
                      const persisted = cabinetPanelState.get(cabinetId)
                      cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values: next, materialColor, materialSelections, price: priceData || persisted?.price })
                    }
                    // Reset all dims
                    applyPrimaryDimsTo3D(next)
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-600 transition-colors px-2 py-1 rounded-md hover:bg-blue-50"
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
              </div>
              <div className="space-y-3">
                {dimsList
                  .filter(([, dimObj]) => dimObj.visible !== false)
                  .map(([id, dimObj]) => {
                    // Resolve drawer height index if GDId matches one of the drawer height GD lists
                    let drawerHeightIndex: number | null = null
                    if (dimObj.GDId) {
                      for (const [idxStr, list] of Object.entries(drawerHeightGDMap)) {
                        if (list.includes(dimObj.GDId)) { drawerHeightIndex = Number(idxStr); break }
                      }
                    }

                    // Calculate default value to check if changed
                    let defVal = Number(dimObj.defaultValue ?? dimObj.min ?? 0)
                    if (isNaN(defVal)) defVal = 0
                    if (typeof dimObj.min === 'number') defVal = Math.max(dimObj.min, defVal)
                    if (typeof dimObj.max === 'number') defVal = Math.min(dimObj.max, defVal)

                    const drawerQty = selectedCabinet?.carcass?.config?.drawerQuantity || 0
                    const isDependentDrawer = drawerHeightIndex !== null && drawerHeightIndex === (drawerQty - 1)

                    return (
                      <div key={id} className={`space-y-2 ${isDependentDrawer ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-gray-700">
                            {dimObj.dim}
                          </label>
                          <div className="flex items-center gap-2">
                            {dimObj.GDId && widthGDIds.includes(dimObj.GDId) && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Width</span>}
                            {dimObj.GDId && heightGDIds.includes(dimObj.GDId) && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Height</span>}
                            {dimObj.GDId && depthGDIds.includes(dimObj.GDId) && <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Depth</span>}
                            {dimObj.GDId && doorOverhangGDIds.includes(dimObj.GDId) && <div className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Door Overhang</div>}
                            {dimObj.GDId && shelfQtyGDIds.includes(dimObj.GDId) && <div className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Shelf Qty</div>}
                            {dimObj.GDId && drawerQtyGDIds.includes(dimObj.GDId) && <div className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Drawer Qty</div>}
                            {drawerHeightIndex !== null && <div className="px-1.5 py-0.5 text-[10px] rounded-full bg-blue-50 text-blue-600">Drawer H{drawerHeightIndex + 1}</div>}
                          </div>
                        </div>

                        {dimObj.valueType === 'range' ? (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <input
                                type="number"
                                disabled={isDependentDrawer}
                                className="w-20 text-center text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                                value={Number(((values[id] ?? dimObj.defaultValue ?? dimObj.min) as any))}
                                min={dimObj.min}
                                max={dimObj.max}
                                onChange={e => {
                                  let val = Number(e.target.value)
                                  if (isNaN(val)) return
                                  // Clamp to min/max
                                  if (typeof dimObj.min === 'number') val = Math.max(dimObj.min, val)
                                  if (typeof dimObj.max === 'number') val = Math.min(dimObj.max, val)

                                  // Validation for drawer heights
                                  if (drawerHeightIndex !== null && !isDependentDrawer) {
                                    const lastDrawerIdx = drawerQty - 1
                                    const lastDrawerDimEntry = dimsList.find(([_, d]) => d.GDId && drawerHeightGDMap[lastDrawerIdx]?.includes(d.GDId))
                                    if (lastDrawerDimEntry) {
                                      const [lastId, lastDimObj] = lastDrawerDimEntry
                                      const lastCurrentVal = Number(values[lastId] ?? lastDimObj.defaultValue ?? lastDimObj.min)
                                      const currentVal = Number(values[id] ?? dimObj.defaultValue ?? dimObj.min)
                                      const delta = val - currentVal
                                      const projectedLastVal = lastCurrentVal - delta

                                      const lastMin = typeof lastDimObj.min === 'number' ? lastDimObj.min : 50
                                      const lastMax = typeof lastDimObj.max === 'number' ? lastDimObj.max : 2000

                                      if (projectedLastVal < lastMin) {
                                        alert(`Cannot increase height: Last drawer would be too small (min ${lastMin}mm).`)
                                        return
                                      }
                                      if (projectedLastVal > lastMax) {
                                        alert(`Cannot decrease height: Last drawer would be too large (max ${lastMax}mm).`)
                                        return
                                      }
                                    }
                                  }

                                  const next = { ...values, [id]: val }
                                  setValues(next)
                                  if (cabinetId) {
                                    const persisted = cabinetPanelState.get(cabinetId)
                                    cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values: next, materialColor, materialSelections, price: priceData || persisted?.price })
                                  }
                                  // Number dim changed
                                  applyPrimaryDimsTo3D(next, id)
                                }}
                              />
                              <button
                                type="button"
                                disabled={isDependentDrawer}
                                title="Reset dimension"
                                onClick={() => {
                                  const next = { ...values, [id]: defVal }
                                  setValues(next)
                                  if (cabinetId) {
                                    const persisted = cabinetPanelState.get(cabinetId)
                                    cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values: next, materialColor, materialSelections, price: priceData || persisted?.price })
                                  }
                                  // Reset dim
                                  applyPrimaryDimsTo3D(next, id)
                                }}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <span className="text-sm text-gray-500">mm</span>
                            </div>
                            <input
                              type="range"
                              disabled={isDependentDrawer}
                              className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                              value={Number(((values[id] ?? dimObj.defaultValue ?? dimObj.min) as any))}
                              min={dimObj.min}
                              max={dimObj.max}
                              onChange={e => {
                                let val = Number(e.target.value)
                                if (isNaN(val)) return
                                if (typeof dimObj.min === 'number') val = Math.max(dimObj.min, val)
                                if (typeof dimObj.max === 'number') val = Math.min(dimObj.max, val)

                                // Validation for drawer heights
                                if (drawerHeightIndex !== null && !isDependentDrawer) {
                                  const lastDrawerIdx = drawerQty - 1
                                  const lastDrawerDimEntry = dimsList.find(([_, d]) => d.GDId && drawerHeightGDMap[lastDrawerIdx]?.includes(d.GDId))
                                  if (lastDrawerDimEntry) {
                                    const [lastId, lastDimObj] = lastDrawerDimEntry
                                    const lastCurrentVal = Number(values[lastId] ?? lastDimObj.defaultValue ?? lastDimObj.min)
                                    const currentVal = Number(values[id] ?? dimObj.defaultValue ?? dimObj.min)
                                    const delta = val - currentVal
                                    const projectedLastVal = lastCurrentVal - delta

                                    const lastMin = typeof lastDimObj.min === 'number' ? lastDimObj.min : 50
                                    const lastMax = typeof lastDimObj.max === 'number' ? lastDimObj.max : 2000

                                    if (projectedLastVal < lastMin) {
                                      alert(`Cannot increase height: Last drawer would be too small (min ${lastMin}mm).`)
                                      return
                                    }
                                    if (projectedLastVal > lastMax) {
                                      alert(`Cannot decrease height: Last drawer would be too large (max ${lastMax}mm).`)
                                      return
                                    }
                                  }
                                }

                                const next = { ...values, [id]: val }
                                setValues(next)
                                if (cabinetId) {
                                  const persisted = cabinetPanelState.get(cabinetId)
                                  cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values: next, materialColor, materialSelections, price: priceData || persisted?.price })
                                }
                                // Range dim changed
                                applyPrimaryDimsTo3D(next, id)
                              }}
                            />
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>{dimObj.min}</span>
                              <span>{dimObj.max}</span>
                            </div>
                          </div>
                        ) : (
                          <select
                            disabled={isDependentDrawer}
                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                            value={String(values[id] ?? dimObj.defaultValue ?? (dimObj.options?.[0] ?? ''))}
                            onChange={e => {
                              const val = e.target.value
                              const next = { ...values, [id]: val }
                              setValues(next)
                              if (cabinetId) {
                                const persisted = cabinetPanelState.get(cabinetId)
                                cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values: next, materialColor, materialSelections, price: priceData || persisted?.price })
                              }
                              // Select dim changed
                              applyPrimaryDimsTo3D(next, id)
                            }}
                          >
                            {dimObj.options.map(opt => (
                              <option key={String(opt)} value={String(opt)}>{String(opt)}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>

            {/* Materials selection */}
            {wsProduct && (
              <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                  <h3>Materials</h3>
                </div>
                <div className="space-y-4">
                  {_(wsProduct.materials)
                    .toPairs()
                    .filter(([, m]) => m.visible !== false)
                    .sortBy(([, m]) => Number(m.sortNum))
                    .map(([materialId, m]) => {
                      const mOpts = materialOptions?.[materialId]
                      const prPairs = mOpts ? Object.entries(mOpts.priceRanges) : []
                      const selected = materialSelections[materialId]
                      const selectedPriceRangeId = selected?.priceRangeId || m.priceRangeIds?.[0] || prPairs?.[0]?.[0]
                      const selectedPriceRange = selectedPriceRangeId && mOpts ? mOpts.priceRanges[selectedPriceRangeId] : undefined
                      const colorPairs = selectedPriceRange ? Object.entries(selectedPriceRange.colorOptions) : []
                      const selectedColorId = selected?.colorId || colorPairs?.[0]?.[0]
                      const selectedColor = selectedColorId && selectedPriceRange ? selectedPriceRange.colorOptions[selectedColorId] : undefined
                      const selectedFinishId = selected?.finishId || (selectedColor ? Object.keys(selectedColor.finishes)[0] : undefined)
                      const selectedFinish = selectedFinishId && selectedColor ? selectedColor.finishes[selectedFinishId] : undefined

                      return (
                        <div key={materialId} className="border border-gray-200 rounded-md p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium text-gray-800 capitalize">{m.material}</div>
                              <div className="mt-2">
                                <label className="block text-xs text-gray-600 mb-1">Price range</label>
                                <select
                                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                                  value={selectedPriceRangeId || ''}
                                  onChange={e => {
                                    const priceRangeId = e.target.value
                                    setMaterialSelections(prev => {
                                      const next = { ...prev }
                                      const firstColorId = mOpts?.priceRanges?.[priceRangeId] ? Object.keys(mOpts.priceRanges[priceRangeId].colorOptions)[0] : undefined
                                      const firstFinishId = firstColorId && mOpts?.priceRanges?.[priceRangeId]?.colorOptions?.[firstColorId] ? Object.keys(mOpts.priceRanges[priceRangeId].colorOptions[firstColorId].finishes)[0] : undefined
                                      next[materialId] = { priceRangeId, colorId: firstColorId || '', finishId: firstFinishId }
                                      // Main list price range changed
                                      if (cabinetId) {
                                        const persisted = cabinetPanelState.get(cabinetId)
                                        cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                                      }
                                      return next
                                    })
                                  }}
                                >
                                  {prPairs.map(([prId, pr]) => (
                                    <option key={prId} value={prId}>{pr.priceRange}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="min-w-[140px] text-right">
                              <button
                                className="inline-flex items-center gap-2 text-sm px-3 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-900 disabled:opacity-50"
                                disabled={!mOpts || prPairs.length === 0}
                                onClick={() => { setOpenMaterialId(materialId) }}
                              >
                                <span>Select Colour</span>
                              </button>
                              <div className="mt-2 text-xs text-gray-600 truncate">
                                {selectedColor ? (
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-6 h-6 rounded bg-gray-100 overflow-hidden border border-gray-200">
                                      {selectedColor.imageUrl ? (
                                        <img src={selectedColor.imageUrl} alt={selectedColor.color} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full bg-gray-200" />
                                      )}
                                    </div>
                                    <div className="max-w-[120px] text-right">
                                      <div className="text-gray-800">{selectedColor.color}</div>
                                      {selectedFinish && <div className="text-gray-500">{selectedFinish.finish}</div>}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-gray-500">No color selected</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                    .value()}
                </div>
              </div>
            )}

            {/* Material color selection (simple) */}
            <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2 mb-2.5 text-gray-700 font-medium">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M14.31 8l5.74 9.94" /><path d="M9.69 8h11.48" /><path d="M7.38 12l5.74-9.94" /><path d="M9.69 16L3.95 6.06" /><path d="M14.31 16H2.83" /></svg>
                <h3>Material</h3>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  className="w-10 h-8 border border-gray-300 rounded-md cursor-pointer"
                  value={materialColor}
                  onChange={e => {
                    const color = e.target.value
                    setMaterialColor(color)
                    onMaterialChange?.({ colour: color })
                    if (cabinetId) {
                      const persisted = cabinetPanelState.get(cabinetId)
                      cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values, materialColor: color, materialSelections, price: priceData || persisted?.price })
                    }
                  }}
                />
                <input
                  type="text"
                  className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent leading-tight"
                  value={materialColor}
                  onChange={e => {
                    const color = e.target.value
                    setMaterialColor(color)
                    onMaterialChange?.({ colour: color })
                    if (cabinetId) {
                      const persisted = cabinetPanelState.get(cabinetId)
                      cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values, materialColor: color, materialSelections, price: priceData || persisted?.price })
                    }
                  }}
                />
              </div>
            </div>

            {/* Bottom actions */}
            <div className="pt-1.5">
                <button
                onClick={() => {
                  // Intentional: debug/log selections button pressed
                }}
                className="w-full text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Log selections
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Secondary side panel for Color Select (left of main ProductPanel) */}
      {openMaterialId && (() => {
        const m = wsProduct?.materials?.[openMaterialId]
        const mOpts = materialOptions?.[openMaterialId]
        if (!m || !mOpts) return null
        const prPairs = Object.entries(mOpts.priceRanges)
        const sel = materialSelections[openMaterialId]
        const priceRangeId = sel?.priceRangeId || m.priceRangeIds?.[0] || prPairs?.[0]?.[0]
        const priceRange = priceRangeId ? mOpts.priceRanges[priceRangeId] : undefined
        const colorPairs = priceRange ? Object.entries(priceRange.colorOptions) : []
        const colorId = sel?.colorId || colorPairs?.[0]?.[0]
        const selectedColor = colorId && priceRange ? priceRange.colorOptions[colorId] : undefined
        const finishId = sel?.finishId || (selectedColor ? Object.keys(selectedColor.finishes)[0] : undefined)

        const commit = () => {
          const currentSel = materialSelections[openMaterialId]
          const next = {
            ...materialSelections,
            [openMaterialId]: {
              priceRangeId: currentSel?.priceRangeId || priceRangeId || '',
              colorId: currentSel?.colorId || colorId || '',
              finishId: currentSel?.finishId || finishId || undefined
            }
          }
          setMaterialSelections(next)
          // Modal commit
          if (cabinetId) {
            const persisted = cabinetPanelState.get(cabinetId)
            cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
          }
          setOpenMaterialId(null)
        }

        return (
          <div
            className={`fixed top-0 h-full bg-white shadow-lg border-r border-gray-200 transition-all duration-300 ease-in-out z-[55] ${isExpanded ? 'right-80 sm:right-96' : 'right-0'} w-80 sm:w-96`}
            data-color-panel
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
            onMouseUp={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div className="text-base font-medium truncate">Select color – {m.material}</div>
                <div className="ml-2 text-sm flex items-center gap-2">
                  {isPriceFetching ? (
                    <span className="text-gray-500">Updating…</span>
                  ) : isPriceError ? (
                    <span className="px-2 py-0.5 rounded bg-red-50 text-red-700">Price N/A</span>
                  ) : priceData ? (
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">${priceData.amount.toFixed(2)}</span>
                  ) : null}
                </div>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => commit()}>×</button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4">
                {/* Price range select */}
                <div className="flex items-center gap-2 mb-4">
                  <label className="text-sm text-gray-600">Price range</label>
                  <select
                    className="text-sm px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={priceRangeId || ''}
                    onChange={e => {
                      const prId = e.target.value
                      const firstColor = Object.keys(mOpts.priceRanges[prId].colorOptions)[0]
                      const firstFinish = firstColor ? Object.keys(mOpts.priceRanges[prId].colorOptions[firstColor].finishes)[0] : ''
                      const next = { ...materialSelections, [openMaterialId]: { priceRangeId: prId, colorId: firstColor || '', finishId: firstFinish || undefined } }
                      setMaterialSelections(next)
                      // Color panel price range changed
                      if (cabinetId) {
                        const persisted = cabinetPanelState.get(cabinetId)
                        cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                      }
                    }}
                  >
                    {prPairs.map(([prId, pr]) => (
                      <option key={prId} value={prId}>{pr.priceRange}</option>
                    ))}
                  </select>
                </div>

                {/* 2-column color grid */}
                <div className="grid grid-cols-2 gap-4">
                  {colorPairs.map(([cId, c]) => {
                    const isSelectedColor = cId === (materialSelections[openMaterialId]?.colorId || colorId)
                    const currentSel = materialSelections[openMaterialId]
                    const currentFinishId = currentSel?.finishId
                    return (
                      <div
                        key={cId}
                        role="button"
                        tabIndex={0}
                        className={`group relative rounded-lg overflow-hidden border ${isSelectedColor ? 'border-blue-600 ring-2 ring-blue-200' : 'border-gray-200'} hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-300`}
                        onClick={() => {
                          const nextFinishId = Object.keys(c.finishes)[0] || ''
                          const next = { ...materialSelections, [openMaterialId]: { priceRangeId: priceRangeId || '', colorId: cId, finishId: nextFinishId || undefined } }
                          setMaterialSelections(next)
                          // Color panel color picked
                          if (cabinetId) {
                            const persisted = cabinetPanelState.get(cabinetId)
                            cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            const nextFinishId = Object.keys(c.finishes)[0] || ''
                            const next = { ...materialSelections, [openMaterialId]: { priceRangeId: priceRangeId || '', colorId: cId, finishId: nextFinishId || undefined } }
                            setMaterialSelections(next)
                            // Color panel color picked via keyboard
                            if (cabinetId) {
                              const persisted = cabinetPanelState.get(cabinetId)
                              cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                            }
                          }
                        }}
                      >
                        <div className="aspect-square w-full bg-gray-100">
                          {c.imageUrl ? (
                            <img src={c.imageUrl} alt={c.color} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-200" />
                          )}
                        </div>
                        <div className="p-2 text-left">
                          <div className="text-sm text-gray-800 truncate">{c.color}</div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {Object.entries(c.finishes).map(([fId, f]) => {
                              const isSelectedFinish = isSelectedColor && fId === currentFinishId
                              return (
                                <button
                                  key={fId}
                                  className={`px-2 py-1 rounded border text-xs ${isSelectedFinish ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                                  onClick={e => {
                                    e.stopPropagation()
                                    const next = { ...materialSelections, [openMaterialId]: { priceRangeId: priceRangeId || '', colorId: cId, finishId: fId } }
                                    setMaterialSelections(next)
                                    // Color panel finish picked
                                    if (cabinetId) {
                                      const persisted = cabinetPanelState.get(cabinetId)
                                      cabinetPanelState.set(cabinetId, { ...(persisted || {} as any), values, materialColor, materialSelections: next, price: priceData || persisted?.price })
                                    }
                                  }}
                                >
                                  {f.finish}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-end">
                <button className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => commit()}>Close</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
