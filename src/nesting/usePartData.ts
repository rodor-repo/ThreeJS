/**
 * React hook to manage part data database
 * Automatically updates when cabinets change
 */

import { useEffect, useRef } from 'react'
import type { CabinetData } from '@/features/scene/types'
import type { WsProducts } from '@/types/erpTypes'
import { getPartDataManager, type PartData } from './PartDataManager'

/**
 * Hook to manage part data database
 * Automatically syncs with cabinets array
 */
export function usePartData(cabinets: CabinetData[], wsProducts?: WsProducts | null): {
  getAllParts: () => PartData[]
  getCabinetParts: (cabinetId: string) => PartData[]
  updateCabinet: (cabinet: CabinetData) => void
  removeCabinet: (cabinetId: string) => void
  clear: () => void
  getStats: () => { totalCabinets: number; totalParts: number; lastUpdated: number | null }
} {
  const partDataManager = useRef(getPartDataManager())
  
  const lastCabinetsRef = useRef<string>('')
  
  // Update wsProducts when it changes and refresh cabinet names
  useEffect(() => {
    partDataManager.current.setWsProducts(wsProducts)
    // Re-update all cabinets to refresh their names with new wsProducts
    if (wsProducts && cabinets.length > 0) {
      partDataManager.current.updateAllCabinets(cabinets)
    }
  }, [wsProducts])

  // Update part data whenever cabinets change
  useEffect(() => {
    // Create a signature of cabinet IDs and their update times to detect changes
    const cabinetsSignature = JSON.stringify(
      cabinets.map((c) => ({
        id: c.cabinetId,
        // Include key properties that affect parts
        width: c.carcass?.dimensions?.width,
        height: c.carcass?.dimensions?.height,
        depth: c.carcass?.dimensions?.depth,
        doorCount: c.carcass?.config?.doorCount,
        drawerQuantity: c.carcass?.config?.drawerQuantity,
        shelfCount: c.carcass?.config?.shelfCount,
      }))
    )

    // Only update if cabinets actually changed
    if (cabinetsSignature !== lastCabinetsRef.current) {
      partDataManager.current.updateAllCabinets(cabinets)
      lastCabinetsRef.current = cabinetsSignature
    }
  }, [cabinets])

  return {
    getAllParts: () => partDataManager.current.getAllParts(),
    getCabinetParts: (cabinetId: string) => partDataManager.current.getCabinetParts(cabinetId),
    updateCabinet: (cabinet: CabinetData) => partDataManager.current.updateCabinetParts(cabinet),
    removeCabinet: (cabinetId: string) => partDataManager.current.removeCabinetParts(cabinetId),
    clear: () => partDataManager.current.clear(),
    getStats: () => partDataManager.current.getStats(),
  }
}

