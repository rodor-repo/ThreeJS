import { useQuery } from "@tanstack/react-query"
import { getProductData } from "@/server/getProductData"
import { priceQueryKeys } from "@/features/cabinets/ui/productPanel/utils/queryKeys"

/**
 * Hook to fetch product data for a given productId.
 * Safely handles "appliance-" IDs by not fetching them.
 */
export function useProductData(productId: string | undefined | null) {
  const isAppliance = productId?.startsWith("appliance-")
  const enabled = !!productId && !isAppliance

  return useQuery({
    queryKey: priceQueryKeys.productData(productId ?? ""),
    queryFn: () => getProductData(productId!),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  })
}
