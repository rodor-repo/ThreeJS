import type { MaterialSelections } from "./materialUtils"

/**
 * Centralized query key factories for price-related React Query queries.
 * 
 * Using shared keys ensures:
 * - ProductPanel and useAllCabinetPrices share the same cache
 * - Consistent cache invalidation
 * - Proper deduplication of in-flight requests
 */
export const priceQueryKeys = {
  /**
   * Query key for product data (dims, materials, threeJsGDs)
   */
  productData: (productId: string) => ["productData", productId] as const,

  /**
   * Query key for calculated product price
   * Note: dims and materialSelections are part of the key for proper cache invalidation
   */
  wsProductPrice: (
    productId: string,
    dims: Record<string, number | string>,
    materialSelections: MaterialSelections
  ) => ["wsProductPrice", productId, dims, materialSelections] as const,

  /**
   * Base key for all price queries (useful for invalidation)
   */
  all: () => ["wsProductPrice"] as const,
}
