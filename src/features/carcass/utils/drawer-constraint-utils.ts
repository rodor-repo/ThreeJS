import { getClient } from "@/app/QueryProvider"
import { getProductData } from "@/server/getProductData"
import _ from "lodash"
import { toNum } from "../../cabinets/ui/ProductPanel"

export interface DrawerConstraint {
  min: number
  max: number
  dimId: string
  defaultValue?: number
}

export type DrawerConstraintsMap = Record<number, DrawerConstraint>

/**
 * Fetches product data from the query cache
 */
export function fetchProductData(productId: string) {
  return getClient().getQueryData([
    "productData",
    productId,
  ]) as Awaited<ReturnType<typeof getProductData>> | undefined
}

/**
 * Maps drawer indices to their dimensional constraints based on product data
 */
export function getDrawerConstraints(
  productId: string,
  drawerCount: number
): DrawerConstraint[] {
  const productData = fetchProductData(productId)
  if (!productData) return []

  const { product: wsProduct, threeJsGDs } = productData

  const drawerHeightGDMap: Record<number, string[]> = {
    0: threeJsGDs?.drawerH1 || [],
    1: threeJsGDs?.drawerH2 || [],
    2: threeJsGDs?.drawerH3 || [],
    3: threeJsGDs?.drawerH4 || [],
    4: threeJsGDs?.drawerH5 || [],
  }

  const dimsList = _.sortBy(
    Object.entries(wsProduct?.dims || {}),
    ([, dimObj]) => Number(dimObj.sortNum)
  )

  const constraintsMap: DrawerConstraintsMap = {}

  dimsList.forEach(([dimId, dimObj]) => {
    const gdId = dimObj.GDId
    if (!gdId) return

    // For some contexts we need min/max, for others just defaultValue might be used
    // but here we try to get all of them
    const { defaultValue: v, min, max } = dimObj
    if (!min || !max) return

    Object.entries(drawerHeightGDMap).forEach(([drawerIndexStr, gdList]) => {
      const drawerIndex = Number(drawerIndexStr)
      if (gdList.includes(gdId)) {
        const numVal = toNum(v)

        constraintsMap[drawerIndex] = {
          min: typeof min === 'string' ? parseFloat(min) : min,
          max: typeof max === 'string' ? parseFloat(max) : max,
          dimId,
          defaultValue: !isNaN(numVal) ? numVal : undefined
        }
      }
    })
  })

  // Convert map to array filling missing with defaults
  // We don't know the exact height context here, so we return what we found
  // The consumer should handle defaults for missing indices if needed
  // But here we return array of length drawerCount
  
  const result: DrawerConstraint[] = []
  for (let i = 0; i < drawerCount; i++) {
      if (constraintsMap[i]) {
          result.push(constraintsMap[i])
      } else {
          // Placeholder for missing constraints - let consumer decide default
          // or we can return a "default" constraint here
          result.push({
              min: 50,
              max: 9999, // Effectively infinite relative to cabinet
              dimId: '',
          })
      }
  }
  
  return result
}

