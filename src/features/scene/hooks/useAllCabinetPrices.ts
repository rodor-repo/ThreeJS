import { useMemo, useState, useEffect, useRef } from "react"
import { useQueries } from "@tanstack/react-query"
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

        return {
          cabinetId: cabinet.cabinetId,
          productId: cabinet.productId!,
          dims,
          materialSelections,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
    // Use debouncedVersion as a dependency to only recalculate inputs after debounce
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, priceableCabinets, productDataMap, debouncedVersion])

  // Fetch all prices
  const priceQueries = useQueries({
    queries: priceQueryInputs.map((input) => ({
      queryKey: priceQueryKeys.wsProductPrice(
        input.productId,
        input.dims,
        input.materialSelections
      ),
      queryFn: async () => {
        const res = await calculateWsProductPrice({
          productId: input.productId,
          dims: input.dims,
          materialSelections: input.materialSelections,
        })
        return { cabinetId: input.cabinetId, amount: res.price }
      },
      enabled: enabled,
      staleTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  })

  // Collect results from queries
  const cabinetPrices = useMemo(() => {
    const prices = new Map<string, number>()
    priceQueries.forEach((query) => {
      if (query.data) {
        prices.set(query.data.cabinetId, query.data.amount)
      }
    })
    return prices
  }, [priceQueries])

  // Sync back to cabinetPanelState for consistency
  useEffect(() => {
    cabinetPrices.forEach((amount, cabinetId) => {
      const current = getPersistedState(cabinetId)
      if (current?.price?.amount !== amount) {
        updatePersistedPrice(cabinetId, { amount })
      }
    })
  }, [cabinetPrices])

  // Collect loading and error states
  const isCabinetCalculating = useMemo(() => {
    const map = new Map<string, boolean>()
    priceQueries.forEach((query, index) => {
      const input = priceQueryInputs[index]
      if (input) {
        map.set(input.cabinetId, query.isFetching)
      }
    })
    return map
  }, [priceQueries, priceQueryInputs])

  const cabinetErrors = useMemo(() => {
    const map = new Map<string, boolean>()
    priceQueries.forEach((query, index) => {
      const input = priceQueryInputs[index]
      if (input) {
        map.set(input.cabinetId, query.isError)
      }
    })
    return map
  }, [priceQueries, priceQueryInputs])

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

  const isCalculating = priceQueries.some((q) => q.isFetching)

  return {
    priceVersion: debouncedVersion,
    isCalculating,
    totalPrice,
    cabinetPrices,
    isCabinetCalculating,
    cabinetErrors,
  }
}
