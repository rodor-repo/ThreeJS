import { useQuery } from "@tanstack/react-query"
import { useEffect } from "react"
import {
  calculateWsProductPrice,
  type CalculatePriceRequest,
} from "@/server/calculateWsProductPrice"
import type { MaterialSelections } from "../utils/materialUtils"

/**
 * Price data returned by the query
 */
export interface PriceData {
  amount: number
}

/**
 * Options for the price query hook
 */
export interface UsePriceQueryOptions {
  /** Product ID for the price calculation */
  productId: string | undefined
  /** Whether the panel is visible (query disabled when not visible) */
  isVisible: boolean
  /** Whether the wsProduct data has loaded (must be true for query to run) */
  wsProductLoaded: boolean
  /** Debounced dimension values */
  dims: Record<string, number | string>
  /** Debounced material selections */
  materialSelections: MaterialSelections
  /** Callback when price updates */
  onPriceUpdate?: (price: PriceData | undefined) => void
}

/**
 * Return value from the price query hook
 */
export interface UsePriceQueryReturn {
  /** Price data if available */
  priceData: PriceData | undefined
  /** Whether the query is currently fetching */
  isPriceFetching: boolean
  /** Whether the query errored */
  isPriceError: boolean
  /** Query status */
  queryStatus: "pending" | "error" | "success"
  /** Fetch status */
  fetchStatus: "idle" | "fetching" | "paused"
}

/**
 * Hook for price calculation with React Query
 * Handles debounced inputs and query lifecycle
 */
export function usePriceQuery(
  options: UsePriceQueryOptions
): UsePriceQueryReturn {
  const {
    productId,
    isVisible,
    wsProductLoaded,
    dims,
    materialSelections,
    onPriceUpdate,
  } = options

  const {
    data: priceData,
    isFetching: isPriceFetching,
    isError: isPriceError,
    status: queryStatus,
    fetchStatus,
  } = useQuery({
    queryKey: ["wsProductPrice", productId, dims, materialSelections],
    queryFn: async () => {
      if (!productId) throw new Error("No productId")

      const payload: CalculatePriceRequest = {
        productId,
        dims,
        materialSelections,
      }

      const res = await calculateWsProductPrice(payload)
      return { amount: res.price }
    },
    // The query MUST be disabled until wsProduct is loaded
    // Even if selectedCabinet has a productId, wsProduct needs to be fetched first
    // because that's what drives the inputs (dims/materials) used in the price calculation
    enabled: !!isVisible && !!productId && wsProductLoaded,
    staleTime: 10 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // Notify on price updates
  useEffect(() => {
    if (!isPriceFetching && !isPriceError && priceData) {
      onPriceUpdate?.(priceData)
    }
  }, [priceData, isPriceFetching, isPriceError, onPriceUpdate])

  return {
    priceData,
    isPriceFetching,
    isPriceError,
    queryStatus,
    fetchStatus,
  }
}

/**
 * Simplified price display helper
 * Returns formatted price string or status message
 */
export function getPriceDisplay(
  priceReturn: UsePriceQueryReturn,
  loading?: boolean
): { text: string; variant: "loading" | "error" | "success" | "calculating" } {
  if (loading) {
    return { text: "Loading Product...", variant: "loading" }
  }

  if (priceReturn.isPriceFetching) {
    return { text: "Updating Price…", variant: "loading" }
  }

  if (priceReturn.isPriceError) {
    return { text: "Price N/A", variant: "error" }
  }

  if (
    priceReturn.priceData &&
    priceReturn.queryStatus === "success" &&
    priceReturn.priceData.amount > 0
  ) {
    return {
      text: `$${priceReturn.priceData.amount.toFixed(2)}`,
      variant: "success",
    }
  }

  return { text: "Calculating...", variant: "calculating" }
}
