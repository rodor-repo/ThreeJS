import {
  generateRoomId,
  type RoomCategory,
  type SavedRoom,
  type SavedCabinet,
  type SavedView,
} from "@/data/savedRooms"
import { cabinetPanelState } from "@/features/cabinets/ui/ProductPanel"
import type { WsProducts } from "@/types/erpTypes"
import type { CabinetType, CarcassDimensions } from "@/features/carcass"
import type { CabinetData, WallDimensions as WallDims } from "../types"
import type { View, ViewId, ViewManager } from "@/features/cabinets/ViewManager"
import { getClient } from "@/app/QueryProvider"
import {
  getProductData,
  type MaterialOptionsResponse,
  type DefaultMaterialSelections,
} from "@/server/getProductData"
import _ from "lodash"
import toast from "react-hot-toast"

type CabinetGroupsMap = Map<
  string,
  Array<{ cabinetId: string; percentage: number }>
>
type CabinetSyncsMap = Map<string, string[]>

/**
 * Prefetch product data for a list of product IDs and add to React Query cache.
 * This ensures product data is available before cabinet operations that need it.
 */
async function prefetchProductData(productIds: string[]): Promise<void> {
  const queryClient = getClient()

  // Filter out products that are already in the cache or invalid
  const missingProductIds = _.uniq(
    productIds.filter((productId) => {
      if (!productId) return false
      const cached = queryClient.getQueryData(["productData", productId])
      return !cached
    })
  )

  if (missingProductIds.length === 0) {
    console.log("[roomPersistence] All product data already cached")
    return
  }

  console.log(
    `[roomPersistence] Prefetching ${missingProductIds.length} products...`
  )

  // Show loading toast
  const toastId = toast.loading("Loading products...")

  // Fetch all missing products in parallel
  const results = await Promise.allSettled(
    missingProductIds.map(async (productId) => {
      const data = await getProductData(productId)
      // Add to cache with infinite gcTime to match ProductPanel behavior
      queryClient.setQueryData(["productData", productId], data)
      return productId
    })
  )

  const successful = results.filter((r) => r.status === "fulfilled").length
  const failed = results.filter((r) => r.status === "rejected").length

  console.log(
    `[roomPersistence] Prefetch complete: ${successful} succeeded, ${failed} failed`
  )

  // Update toast based on results
  if (failed === 0) {
    toast.success(`Loaded ${successful} products`, { id: toastId })
  } else if (successful === 0) {
    toast.error("Failed to load products", { id: toastId })
  } else {
    toast.success(`Loaded ${successful} products (${failed} failed)`, {
      id: toastId,
    })
  }

  // Log any failures for debugging
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `[roomPersistence] Failed to prefetch product ${missingProductIds[index]}:`,
        result.reason
      )
    }
  })
}

export type CreateCabinetFn = (
  cabinetType: CabinetType,
  subcategoryId: string,
  options?: {
    productId?: string
    productName?: string
    fillerReturnPosition?: "left" | "right"
    customDimensions?: Partial<CarcassDimensions>
    additionalProps?: Partial<
      Omit<
        CabinetData,
        "group" | "carcass" | "cabinetType" | "subcategoryId" | "cabinetId"
      >
    >
  }
) => CabinetData | undefined

interface SerializeRoomOptions {
  cabinets: CabinetData[]
  cabinetGroups: CabinetGroupsMap
  wallDimensions: WallDims
  wallColor: string
  activeViews: View[]
  getCabinetView: (cabinetId: string) => ViewId | undefined
  wsProducts?: WsProducts | null
  roomName: string
  roomCategory: RoomCategory
  cabinetSyncs?: CabinetSyncsMap
}

export function serializeRoom({
  cabinets,
  cabinetGroups,
  wallDimensions,
  wallColor,
  activeViews,
  getCabinetView,
  wsProducts,
  roomName,
  roomCategory,
  cabinetSyncs,
}: SerializeRoomOptions): SavedRoom {
  const savedCabinets: SavedCabinet[] = cabinets.map((cabinet) => {
    const persisted = cabinetPanelState.get(cabinet.cabinetId)
    const productName =
      cabinet.productId && wsProducts?.products[cabinet.productId]?.product
    const viewIdFromManager = getCabinetView(cabinet.cabinetId)
    const cabinetViewId = viewIdFromManager || cabinet.viewId || undefined

    return {
      cabinetId: cabinet.cabinetId,
      productId: cabinet.productId,
      productName: productName || undefined,
      cabinetType: cabinet.cabinetType,
      subcategoryId: cabinet.subcategoryId,
      dimensions: {
        width: cabinet.carcass.dimensions.width,
        height: cabinet.carcass.dimensions.height,
        depth: cabinet.carcass.dimensions.depth,
      },
      viewId: cabinetViewId,
      position: {
        x: cabinet.group.position.x,
        y: cabinet.group.position.y,
        z: cabinet.group.position.z,
      },
      materialSelections: persisted?.materialSelections,
      materialColor: persisted?.materialColor,
      dimensionValues: persisted?.values,
      shelfCount: cabinet.carcass.config.shelfCount,
      doorEnabled: cabinet.carcass.config.doorEnabled,
      doorCount: cabinet.carcass.config.doorCount,
      overhangDoor: cabinet.carcass.config.overhangDoor,
      drawerEnabled: cabinet.carcass.config.drawerEnabled,
      drawerQuantity: cabinet.carcass.config.drawerQuantity,
      drawerHeights: cabinet.carcass.config.drawerHeights,
      kickerHeight:
        cabinet.cabinetType === "base" || cabinet.cabinetType === "tall"
          ? cabinet.group.position.y
          : undefined,
      leftLock: cabinet.leftLock,
      rightLock: cabinet.rightLock,
      group: cabinetGroups.get(cabinet.cabinetId) || undefined,
      sortNumber: cabinet.sortNumber,
      syncCabinets: cabinetSyncs?.get(cabinet.cabinetId) || undefined,
      // Parent relationship properties for kickers, bulkheads, and fillers/panels
      parentCabinetId: cabinet.parentCabinetId,
      parentSide: cabinet.parentSide,
      hideLockIcons: cabinet.hideLockIcons,
      kickerParentCabinetId: cabinet.kickerParentCabinetId,
      bulkheadParentCabinetId: cabinet.bulkheadParentCabinetId,
      underPanelParentCabinetId: cabinet.underPanelParentCabinetId,
      // Appliance properties
      applianceType: cabinet.carcass.config.applianceType,
      applianceTopGap: cabinet.carcass.config.applianceTopGap,
      applianceLeftGap: cabinet.carcass.config.applianceLeftGap,
      applianceRightGap: cabinet.carcass.config.applianceRightGap,
      applianceKickerHeight: cabinet.carcass.config.applianceKickerHeight,
      fridgeDoorCount: cabinet.carcass.config.fridgeDoorCount,
      fridgeDoorSide: cabinet.carcass.config.fridgeDoorSide,
      // Benchtop properties
      benchtopParentCabinetId: cabinet.benchtopParentCabinetId,
      benchtopFrontOverhang: cabinet.benchtopFrontOverhang,
      benchtopLeftOverhang: cabinet.benchtopLeftOverhang,
      benchtopRightOverhang: cabinet.benchtopRightOverhang,
      benchtopThickness: cabinet.benchtopThickness,
      benchtopHeightFromFloor: cabinet.benchtopHeightFromFloor,
    }
  })

  const savedViews: SavedView[] = activeViews.map((view) => ({
    id: view.id,
    name: view.name,
    cabinetIds: Array.from(view.cabinetIds),
  }))

  const savedSyncs = cabinetSyncs
    ? Array.from(cabinetSyncs.entries()).map(([cabinetId, syncedWith]) => ({
        cabinetId,
        syncedWith,
      }))
    : undefined

  const backWallLength = wallDimensions.backWallLength ?? wallDimensions.length

  return {
    id: generateRoomId(),
    name: roomName,
    category: roomCategory,
    savedAt: new Date().toISOString(),
    wallSettings: {
      height: wallDimensions.height,
      length: backWallLength,
      color: wallColor,
      backWallLength: backWallLength,
      leftWallLength: wallDimensions.leftWallLength ?? wallDimensions.length,
      rightWallLength: wallDimensions.rightWallLength ?? wallDimensions.length,
      leftWallVisible: wallDimensions.leftWallVisible ?? true,
      rightWallVisible: wallDimensions.rightWallVisible ?? true,
      additionalWalls: wallDimensions.additionalWalls ?? [],
    },
    cabinets: savedCabinets,
    views: savedViews,
    cabinetSyncs: savedSyncs,
  }
}

interface RestoreRoomOptions {
  savedRoom: SavedRoom
  setNumbersVisible: (visible: boolean) => void
  clearCabinets: () => void
  setCabinetGroups: (
    groups: CabinetGroupsMap | ((prev: CabinetGroupsMap) => CabinetGroupsMap)
  ) => void
  applyDimensions: (
    dimensions: WallDims,
    color?: string,
    zoomLevel?: number,
    preserveCamera?: boolean
  ) => void
  setWallColor: (color: string) => void
  viewManagerInstance: ViewManager
  createView: () => View
  createCabinet: CreateCabinetFn
  updateCabinetViewId: (cabinetId: string, viewId: ViewId | undefined) => void
  assignCabinetToView: (cabinetId: string, viewId: ViewId) => void
  updateCabinetLock: (
    cabinetId: string,
    leftLock: boolean,
    rightLock: boolean
  ) => void
  setCabinetSyncs?: (syncs: CabinetSyncsMap) => void
}

export async function restoreRoom({
  savedRoom,
  setNumbersVisible,
  clearCabinets,
  setCabinetGroups,
  applyDimensions,
  setWallColor,
  viewManagerInstance,
  createView,
  createCabinet,
  updateCabinetViewId,
  assignCabinetToView,
  updateCabinetLock,
  setCabinetSyncs,
}: RestoreRoomOptions): Promise<void> {
  setNumbersVisible(false)
  clearCabinets()
  setCabinetGroups(new Map())
  if (setCabinetSyncs) {
    setCabinetSyncs(new Map())
  }

  const backWallLength =
    savedRoom.wallSettings.backWallLength ?? savedRoom.wallSettings.length
  const newWallDims: WallDims = {
    height: savedRoom.wallSettings.height,
    length: backWallLength,
    backWallLength: backWallLength,
    leftWallLength: savedRoom.wallSettings.leftWallLength ?? 600,
    rightWallLength: savedRoom.wallSettings.rightWallLength ?? 600,
    leftWallVisible: savedRoom.wallSettings.leftWallVisible ?? true,
    rightWallVisible: savedRoom.wallSettings.rightWallVisible ?? true,
    additionalWalls: savedRoom.wallSettings.additionalWalls ?? [],
  }
  // Pass true for preserveCamera to prevent camera reset on restore
  applyDimensions(newWallDims, savedRoom.wallSettings.color, undefined, true)
  setWallColor(savedRoom.wallSettings.color)

  // Extract all unique product IDs from saved cabinets and prefetch their data
  const productIds = savedRoom.cabinets
    .map((c) => c.productId)
    .filter((id): id is string => !!id)
  await prefetchProductData(productIds)

  // After prefetching, sync material options for all productIds (including cached ones)
  const { getPartDataManager } = await import("@/nesting/PartDataManager")
  const partDataManager = getPartDataManager()
  const queryClient = getClient()
  productIds.forEach((productId) => {
    const cached = queryClient.getQueryData(["productData", productId])
    if (
      cached &&
      typeof cached === "object" &&
      "materialOptions" in cached &&
      "defaultMaterialSelections" in cached
    ) {
      const data = cached as {
        materialOptions: MaterialOptionsResponse
        defaultMaterialSelections: DefaultMaterialSelections
      }
      if (data.materialOptions) {
        partDataManager.setMaterialOptions(productId, data.materialOptions)
      }
      if (data.defaultMaterialSelections) {
        partDataManager.setDefaultMaterialSelections(
          productId,
          data.defaultMaterialSelections
        )
      }
    }
  })

  return new Promise((resolve) => {
    setTimeout(() => {
      const viewIdMap = new Map<string, ViewId>()
      const viewIdsToRestore = new Set<string>()

      savedRoom.views.forEach((savedView) => {
        if (savedView.id !== "none") {
          viewIdsToRestore.add(savedView.id)
        }
      })

      savedRoom.cabinets.forEach((savedCabinet) => {
        if (savedCabinet.viewId && savedCabinet.viewId !== "none") {
          viewIdsToRestore.add(savedCabinet.viewId)
        }
      })

      viewIdsToRestore.forEach((savedViewId) => {
        const existingView = viewManagerInstance.getView(savedViewId as ViewId)
        const savedView = savedRoom.views.find((v) => v.id === savedViewId)

        if (existingView) {
          viewIdMap.set(savedViewId, savedViewId as ViewId)
        } else {
          const newView = createView()
          if (savedView && savedView.name) {
            // ViewManager currently lacks a rename API; keep default naming.
          }
          viewIdMap.set(savedViewId, newView.id)
        }
      })

      const oldIdToNewId = new Map<string, string>()
      const createdCabinets = new Map<string, CabinetData>()

      // Pass 1: Create cabinets and build ID map
      savedRoom.cabinets.forEach((savedCabinet) => {
        const cabinetData = createCabinet(
          savedCabinet.cabinetType as CabinetType,
          savedCabinet.subcategoryId,
          {
            productId: savedCabinet.productId,
            productName: savedCabinet.productName,
          }
        )

        if (!cabinetData) {
          console.error("Failed to create cabinet:", savedCabinet)
          return
        }

        oldIdToNewId.set(savedCabinet.cabinetId, cabinetData.cabinetId)
        createdCabinets.set(cabinetData.cabinetId, cabinetData)

        // Restore benchtop properties (simple ones) before updateDimensions
        if (savedCabinet.benchtopFrontOverhang !== undefined) {
          cabinetData.benchtopFrontOverhang = savedCabinet.benchtopFrontOverhang
          cabinetData.carcass.config.benchtopFrontOverhang =
            savedCabinet.benchtopFrontOverhang
        }
        if (savedCabinet.benchtopLeftOverhang !== undefined) {
          cabinetData.benchtopLeftOverhang = savedCabinet.benchtopLeftOverhang
          cabinetData.carcass.config.benchtopLeftOverhang =
            savedCabinet.benchtopLeftOverhang
        }
        if (savedCabinet.benchtopRightOverhang !== undefined) {
          cabinetData.benchtopRightOverhang = savedCabinet.benchtopRightOverhang
          cabinetData.carcass.config.benchtopRightOverhang =
            savedCabinet.benchtopRightOverhang
        }
        if (savedCabinet.benchtopThickness !== undefined) {
          cabinetData.benchtopThickness = savedCabinet.benchtopThickness
        }
        if (savedCabinet.benchtopHeightFromFloor !== undefined) {
          cabinetData.benchtopHeightFromFloor = savedCabinet.benchtopHeightFromFloor
        }

        cabinetData.carcass.updateDimensions(savedCabinet.dimensions)

        // Mark dimensions as applied so ProductPanel doesn't re-apply defaults
        cabinetData.carcass.defaultDimValuesApplied = true

        cabinetData.group.position.set(
          savedCabinet.position.x,
          savedCabinet.position.y,
          savedCabinet.position.z
        )

        // Restore appliance config
        if (savedCabinet.applianceType) {
          cabinetData.carcass.updateConfig({
            applianceType: savedCabinet.applianceType,
            applianceTopGap: savedCabinet.applianceTopGap || 0,
            applianceLeftGap: savedCabinet.applianceLeftGap || 0,
            applianceRightGap: savedCabinet.applianceRightGap || 0,
            applianceKickerHeight: savedCabinet.applianceKickerHeight || 100,
            fridgeDoorCount: savedCabinet.fridgeDoorCount,
            fridgeDoorSide: savedCabinet.fridgeDoorSide,
          })
        }

        if (savedCabinet.shelfCount !== undefined) {
          cabinetData.carcass.updateConfig({
            shelfCount: savedCabinet.shelfCount,
          })
        }

        if (savedCabinet.doorEnabled !== undefined) {
          cabinetData.carcass.toggleDoors(savedCabinet.doorEnabled)
        }
        if (savedCabinet.doorCount !== undefined) {
          cabinetData.carcass.updateDoorConfiguration(savedCabinet.doorCount)
        }
        if (
          savedCabinet.overhangDoor !== undefined &&
          cabinetData.cabinetType === "top"
        ) {
          cabinetData.carcass.updateOverhangDoor(savedCabinet.overhangDoor)
        }

        if (savedCabinet.drawerEnabled !== undefined) {
          cabinetData.carcass.updateDrawerEnabled(savedCabinet.drawerEnabled)
        }
        if (savedCabinet.drawerQuantity !== undefined) {
          cabinetData.carcass.updateDrawerQuantity(savedCabinet.drawerQuantity)
        }
        if (
          savedCabinet.drawerHeights &&
          savedCabinet.drawerHeights.length > 0
        ) {
          savedCabinet.drawerHeights.forEach((height, index) => {
            cabinetData.carcass.updateDrawerHeight(index, height)
          })
        }

        if (
          savedCabinet.kickerHeight !== undefined &&
          (cabinetData.cabinetType === "base" ||
            cabinetData.cabinetType === "tall")
        ) {
          cabinetData.carcass.updateKickerHeight(savedCabinet.kickerHeight)
        }

        if (
          savedCabinet.materialSelections ||
          savedCabinet.materialColor ||
          savedCabinet.dimensionValues
        ) {
          cabinetPanelState.set(cabinetData.cabinetId, {
            values: savedCabinet.dimensionValues || {},
            materialColor: savedCabinet.materialColor || "#ffffff",
            materialSelections: savedCabinet.materialSelections,
          })
        }

        if (savedCabinet.viewId && savedCabinet.viewId !== "none") {
          const mappedViewId = viewIdMap.get(savedCabinet.viewId)
          if (mappedViewId) {
            cabinetData.viewId = mappedViewId
            updateCabinetViewId(cabinetData.cabinetId, mappedViewId)
            assignCabinetToView(cabinetData.cabinetId, mappedViewId)
          } else {
            console.warn(
              `Could not find mapped view ID for cabinet ${cabinetData.cabinetId} with viewId ${savedCabinet.viewId}`
            )
          }
        } else {
          cabinetData.viewId = undefined
          updateCabinetViewId(cabinetData.cabinetId, undefined)
        }

        if (
          savedCabinet.leftLock !== undefined ||
          savedCabinet.rightLock !== undefined
        ) {
          updateCabinetLock(
            cabinetData.cabinetId,
            savedCabinet.leftLock ?? false,
            savedCabinet.rightLock ?? false
          )
        }

        if (savedCabinet.sortNumber !== undefined) {
          cabinetData.sortNumber = savedCabinet.sortNumber
        }

        // Restore hideLockIcons flag (doesn't need ID mapping)
        if (savedCabinet.hideLockIcons !== undefined) {
          cabinetData.hideLockIcons = savedCabinet.hideLockIcons
        }

        // Restore parentSide (doesn't need ID mapping)
        if (savedCabinet.parentSide !== undefined) {
          cabinetData.parentSide = savedCabinet.parentSide
        }
      })

      // Pass 1.5: Restore parent relationships using ID map
      // These need to be done after all cabinets are created because they reference other cabinet IDs
      savedRoom.cabinets.forEach((savedCabinet) => {
        const newCabinetId = oldIdToNewId.get(savedCabinet.cabinetId)
        if (!newCabinetId) return

        const cabinetData = createdCabinets.get(newCabinetId)
        if (!cabinetData) return

        // Map parentCabinetId (for fillers/panels)
        if (savedCabinet.parentCabinetId) {
          const newParentId = oldIdToNewId.get(savedCabinet.parentCabinetId)
          if (newParentId) {
            cabinetData.parentCabinetId = newParentId
          }
        }

        // Map kickerParentCabinetId
        if (savedCabinet.kickerParentCabinetId) {
          const newKickerParentId = oldIdToNewId.get(
            savedCabinet.kickerParentCabinetId
          )
          if (newKickerParentId) {
            cabinetData.kickerParentCabinetId = newKickerParentId
          }
        }

        // Map bulkheadParentCabinetId
        if (savedCabinet.bulkheadParentCabinetId) {
          const newBulkheadParentId = oldIdToNewId.get(
            savedCabinet.bulkheadParentCabinetId
          )
          if (newBulkheadParentId) {
            cabinetData.bulkheadParentCabinetId = newBulkheadParentId
          }
        }

        // Map underPanelParentCabinetId
        if (savedCabinet.underPanelParentCabinetId) {
          const newUnderPanelParentId = oldIdToNewId.get(
            savedCabinet.underPanelParentCabinetId
          )
          if (newUnderPanelParentId) {
            cabinetData.underPanelParentCabinetId = newUnderPanelParentId
          }
        }

        // Map benchtopParentCabinetId
        if (savedCabinet.benchtopParentCabinetId) {
          const newBenchtopParentId = oldIdToNewId.get(
            savedCabinet.benchtopParentCabinetId
          )
          if (newBenchtopParentId) {
            cabinetData.benchtopParentCabinetId = newBenchtopParentId
          }
        }
      })

      // Pass 2: Restore groups and syncs using ID map
      savedRoom.cabinets.forEach((savedCabinet) => {
        const newCabinetId = oldIdToNewId.get(savedCabinet.cabinetId)
        if (!newCabinetId) return

        if (savedCabinet.group && savedCabinet.group.length > 0) {
          const mappedGroup = savedCabinet.group
            .map((g) => ({
              cabinetId: oldIdToNewId.get(g.cabinetId) || g.cabinetId,
              percentage: g.percentage,
            }))
            .filter((g) => g.cabinetId)

          if (mappedGroup.length > 0) {
            setCabinetGroups((prev) => {
              const newMap = new Map(prev)
              newMap.set(newCabinetId, mappedGroup)
              return newMap
            })
          }
        }
      })

      if (savedRoom.cabinetSyncs && setCabinetSyncs) {
        const syncsMap = new Map<string, string[]>()
        savedRoom.cabinetSyncs.forEach((sync) => {
          const newSourceId = oldIdToNewId.get(sync.cabinetId)
          if (newSourceId) {
            const mappedSyncedWith = sync.syncedWith
              .map((id) => oldIdToNewId.get(id))
              .filter((id): id is string => !!id)

            if (mappedSyncedWith.length > 0) {
              syncsMap.set(newSourceId, mappedSyncedWith)
            }
          }
        })
        setCabinetSyncs(syncsMap)
      }

      console.log(
        "Room loaded:",
        savedRoom.name,
        "Views restored:",
        viewIdsToRestore.size,
        "Cabinets assigned to views"
      )
      resolve()
    }, 100)
  })
}
