import { useMemo, useState, useEffect, useRef } from "react"
import { useQueries, useQueryClient } from "@tanstack/react-query"
import debounce from "lodash/debounce"
import type { CabinetData } from "../types"
import { getProductData } from "@/server/getProductData"
import { calculateWsProductPrice } from "@/server/calculateWsProductPrice"
import {
  cabinetPanelState,
  getPersistedState,
  updatePersistedPrice,
  onPriceNeedsInvalidation,
} from "@/features/cabinets/ui/productPanel/hooks/usePersistence"
import {
  buildDefaultValues,
  syncCabinetDimensionsToValues,
} from "@/features/cabinets/ui/productPanel/utils/dimensionUtils"
import { buildApiDefaults } from "@/features/cabinets/ui/productPanel/utils/materialUtils"
import { priceQueryKeys } from "@/features/cabinets/ui/productPanel/utils/queryKeys"
import { getGDMapping } from "@/features/cabinets/ui/productPanel/hooks/useGDMapping"

const MAX_CONCURRENT_PRICE_REQUESTS = 4

const pruneMap = <T,>(
  map: Map<string, T>,
  allowed: Set<string>
): Map<string, T> => {
  let changed = false
  const next = new Map(map)
  for (const key of Array.from(next.keys())) {
    if (!allowed.has(key)) {
      next.delete(key)
      changed = true
    }
  }
  return changed ? next : map
}

/**
 * Options for the useAllCabinetPrices hook
 */
export interface UseAllCabinetPricesOptions {
  /** All cabinets in the scene */
  cabinets: CabinetData[]
  /** Whether to enable price calculation (disable during room load) */
  enabled?: boolean
}

/**
 * Return value from the useAllCabinetPrices hook
 */
export interface UseAllCabinetPricesReturn {
  /** Version counter - increment triggers re-render of consumers */
  priceVersion: number
  /** True if any prices are currently being calculated */
  isCalculating: boolean
  /** Pre-calculated total price of all cabinets */
  totalPrice: number
  /** Individual cabinet prices */
  cabinetPrices: Map<string, number>
  /** Individual cabinet loading states */
  isCabinetCalculating: Map<string, boolean>
  /** Individual cabinet error states */
  cabinetErrors: Map<string, boolean>
}

/**
 * Hook to calculate prices for all cabinets in the scene.
 * Centralizes price logic and uses debouncing to avoid excessive recalculations.
 */
export function useAllCabinetPrices(
  options: UseAllCabinetPricesOptions
): UseAllCabinetPricesReturn {
  const { cabinets, enabled = true } = options

  // Internal version counter to track when state changes
  const [internalVersion, setInternalVersion] = useState(0)
  // Debounced version that actually triggers re-calculation
  const [debouncedVersion, setDebouncedVersion] = useState(0)
  const queryClient = useQueryClient()
  const runIdRef = useRef(0)

  const [cabinetPrices, setCabinetPrices] = useState<Map<string, number>>(
    new Map()
  )
  const [isCabinetCalculating, setIsCabinetCalculating] = useState<
    Map<string, boolean>
  >(new Map())
  const [cabinetErrors, setCabinetErrors] = useState<Map<string, boolean>>(
    new Map()
  )
  const [isCalculating, setIsCalculating] = useState(false)

  // Debounce the version update to 1000ms as requested
  const debouncedSetVersion = useRef(
    debounce((v: number) => setDebouncedVersion(v), 1000)
  ).current

  useEffect(() => {
    debouncedSetVersion(internalVersion)
  }, [internalVersion, debouncedSetVersion])

  // Subscribe to changes in persisted state
  useEffect(() => {
    return onPriceNeedsInvalidation(() => {
      setInternalVersion((v) => v + 1)
    })
  }, [])

  // Extract priceable cabinets
  const priceableCabinets = useMemo(() => {
    return cabinets.filter(
      (c) => c.productId && !c.productId.startsWith("appliance-")
    )
  }, [cabinets])

  // Get unique product IDs to fetch product data
  const uniqueProductIds = useMemo(() => {
    return Array.from(
      new Set(priceableCabinets.map((c) => c.productId!))
    ).sort()
  }, [priceableCabinets])

  // Fetch product data for all unique products
  const productDataQueries = useQueries({
    queries: uniqueProductIds.map((productId) => ({
      queryKey: priceQueryKeys.productData(productId),
      queryFn: () => getProductData(productId),
      enabled: enabled && !!productId,
      staleTime: 5 * 60 * 1000,
    })),
  })

  // Map product data for easy lookup
  const productDataMap = useMemo(() => {
    const map = new Map<string, any>()
    productDataQueries.forEach((query, index) => {
      if (query.data) map.set(uniqueProductIds[index], query.data)
    })
    return map
  }, [productDataQueries, uniqueProductIds])

  // Build inputs for price calculation
  const priceQueryInputs = useMemo(() => {
    if (!enabled) return []

    return priceableCabinets
      .map((cabinet) => {
        const productData = productDataMap.get(cabinet.productId!)
        if (!productData) return null

        const persisted = getPersistedState(cabinet.cabinetId)
        const defaultDims = buildDefaultValues(productData.product.dims)
        let dims = persisted?.values
          ? { ...defaultDims, ...persisted.values }
          : defaultDims

        const gdMapping = getGDMapping(productData.threeJsGDs)
        dims = syncCabinetDimensionsToValues(
          dims,
          productData.product.dims,
          gdMapping,
          cabinet.carcass.dimensions
        )

        const materialSelections =
          persisted?.materialSelections ??
          buildApiDefaults(
            productData.defaultMaterialSelections,
            productData.materialOptions
          )
        const materialColor =
          persisted?.materialColor ??
          cabinet.carcass?.config?.material?.getColour?.() ??
          "#ffffff"

        return {
          cabinetId: cabinet.cabinetId,
          productId: cabinet.productId!,
          dims,
          materialSelections,
          materialColor,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    // Use debouncedVersion as a dependency to only recalculate inputs after debounce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, priceableCabinets, productDataMap, debouncedVersion])

  const priceQueryInputsKey = useMemo(() => {
    return priceQueryInputs
      .map((input) =>
        [
          input.cabinetId,
          input.productId,
          JSON.stringify(input.dims),
          JSON.stringify(input.materialSelections),
        ].join("|")
      )
      .join("||")
  }, [priceQueryInputs])

  // Without this, the AddToCartModal would skip some of the cabinets that (presumably) hadn't been opened via the ProductPanel;
  useEffect(() => {
    if (!enabled || priceQueryInputs.length === 0) return

    priceQueryInputs.forEach((input) => {
      if (getPersistedState(input.cabinetId)) return

      cabinetPanelState.set(input.cabinetId, {
        values: input.dims,
        materialColor: input.materialColor,
        materialSelections: input.materialSelections,
      })
    })
  }, [enabled, priceQueryInputs])

  useEffect(() => {
    const activeCabinetIds = new Set(cabinets.map((c) => c.cabinetId))
    setCabinetPrices((prev) => pruneMap(prev, activeCabinetIds))
    setIsCabinetCalculating((prev) => pruneMap(prev, activeCabinetIds))
    setCabinetErrors((prev) => pruneMap(prev, activeCabinetIds))
  }, [cabinets])

  useEffect(() => {
    if (!enabled) {
      setIsCalculating(false)
      return
    }

    if (priceQueryInputs.length === 0) {
      setIsCalculating(false)
      return
    }

    let cancelled = false
    const runId = ++runIdRef.current
    const pending = [...priceQueryInputs]
    const workerCount = Math.min(
      MAX_CONCURRENT_PRICE_REQUESTS,
      pending.length
    )

    const worker = async () => {
      while (pending.length > 0) {
        const nextInput = pending.shift()
        if (!nextInput || cancelled || runIdRef.current !== runId) {
          return
        }

        const { cabinetId, productId, dims, materialSelections } = nextInput

        setIsCabinetCalculating((prev) => {
          const next = new Map(prev)
          next.set(cabinetId, true)
          return next
        })
        setCabinetErrors((prev) => {
          const next = new Map(prev)
          next.set(cabinetId, false)
          return next
        })

        try {
          const data = await queryClient.fetchQuery({
            queryKey: priceQueryKeys.wsProductPrice(
              productId,
              dims,
              materialSelections
            ),
            queryFn: async () => {
              const res = await calculateWsProductPrice({
                productId,
                dims,
                materialSelections,
              })
              return { amount: res.price }
            },
            staleTime: 10 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
          })

          if (cancelled || runIdRef.current !== runId) return

          setCabinetPrices((prev) => {
            const next = new Map(prev)
            next.set(cabinetId, data.amount)
            return next
          })
        } catch {
          if (cancelled || runIdRef.current !== runId) return

          setCabinetErrors((prev) => {
            const next = new Map(prev)
            next.set(cabinetId, true)
            return next
          })
        } finally {
          if (cancelled || runIdRef.current !== runId) return

          setIsCabinetCalculating((prev) => {
            const next = new Map(prev)
            next.set(cabinetId, false)
            return next
          })
        }
      }
    }

    const run = async () => {
      setIsCalculating(true)
      await Promise.all(Array.from({ length: workerCount }, () => worker()))
      if (!cancelled && runIdRef.current === runId) {
        setIsCalculating(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, priceQueryInputsKey, queryClient])

  // Sync back to cabinetPanelState for consistency
  useEffect(() => {
    cabinetPrices.forEach((amount, cabinetId) => {
      const current = getPersistedState(cabinetId)
      if (current?.price?.amount !== amount) {
        updatePersistedPrice(cabinetId, { amount })
      }
    })
  }, [cabinetPrices])

  // Calculate total price
  const totalPrice = useMemo(() => {
    let total = 0
    cabinets.forEach((c) => {
      // Prioritize recently calculated prices from queries, fall back to persisted state
      const price =
        cabinetPrices.get(c.cabinetId) ??
        cabinetPanelState.get(c.cabinetId)?.price?.amount ??
        0
      total += price
    })
    return total
  }, [cabinets, cabinetPrices])

  return {
    priceVersion: debouncedVersion,
    isCalculating,
    totalPrice,
    cabinetPrices,
    isCabinetCalculating,
    cabinetErrors,
  }
}
