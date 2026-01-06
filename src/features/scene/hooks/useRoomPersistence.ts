import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import type { SavedRoom } from "@/types/roomTypes"
import type { WsProducts, WsRooms } from "@/types/erpTypes"
import type { CabinetData, WallDimensions as WallDims } from "../types"
import type { View, ViewId, ViewManager } from "@/features/cabinets/ViewManager"
import {
  serializeRoom,
  restoreRoom,
  type CreateCabinetFn,
} from "../utils/roomPersistenceUtils"
import { saveRoomDesign } from "@/server/rooms/saveRoomDesign"

type CabinetGroupsMap = Map<
  string,
  Array<{ cabinetId: string; percentage: number }>
>
type CabinetSyncsMap = Map<string, string[]>

type UseRoomPersistenceOptions = {
  cabinets: CabinetData[]
  cabinetGroups: CabinetGroupsMap
  setCabinetGroups: Dispatch<SetStateAction<CabinetGroupsMap>>
  wallDimensions: WallDims
  wallColor: string
  setWallColor: Dispatch<SetStateAction<string>>
  applyDimensions: (
    dimensions: WallDims,
    color?: string,
    zoomLevel?: number,
    preserveCamera?: boolean
  ) => void
  viewManager: {
    activeViews: View[]
    viewManager: ViewManager
    createView: () => View
    assignCabinetToView: (cabinetId: string, viewId: ViewId) => void
    getCabinetView: (cabinetId: string) => ViewId | undefined
  }
  wsProducts?: WsProducts | null
  setNumbersVisible: Dispatch<SetStateAction<boolean>>
  clearCabinets: () => void
  createCabinet: CreateCabinetFn
  updateCabinetViewId: (cabinetId: string, viewId: ViewId | undefined) => void
  updateCabinetLock: (
    cabinetId: string,
    leftLock: boolean,
    rightLock: boolean
  ) => void
  onLoadRoomReady?: (loadRoom: (room: SavedRoom) => Promise<void>) => void
  cabinetSyncs?: CabinetSyncsMap
  setCabinetSyncs?: Dispatch<SetStateAction<CabinetSyncsMap>>
  viewGDFormulas?: Map<ViewId, Record<string, string>>
  setViewGDFormulas?: Dispatch<
    SetStateAction<Map<ViewId, Record<string, string>>>
  >
  /** Current room URL slug */
  currentRoomUrl?: string | null
  /** Current room ID resolved from room url */
  currentRoomId?: string | null
  /** WsRooms config for room metadata */
  wsRooms?: WsRooms | null
}

export const useRoomPersistence = ({
  cabinets,
  cabinetGroups,
  setCabinetGroups,
  wallDimensions,
  wallColor,
  setWallColor,
  applyDimensions,
  viewManager,
  wsProducts,
  setNumbersVisible,
  clearCabinets,
  createCabinet,
  updateCabinetViewId,
  updateCabinetLock,
  onLoadRoomReady,
  cabinetSyncs,
  setCabinetSyncs,
  viewGDFormulas,
  setViewGDFormulas,
  currentRoomUrl,
  currentRoomId,
  wsRooms,
}: UseRoomPersistenceOptions) => {
  const [currentRoom, setCurrentRoom] = useState<SavedRoom | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const {
    activeViews,
    viewManager: viewManagerInstance,
    createView,
    assignCabinetToView,
    getCabinetView,
  } = viewManager

  // Get current room name from wsRooms metadata
  const currentRoomName = currentRoomId && wsRooms?.rooms?.[currentRoomId]?.room

  /**
   * Save the current room design to Firestore.
   * Uses set() with merge:true so it works for both new and existing designs.
   */
  const handleSaveRoom = useCallback(async () => {
    if (!currentRoomUrl) {
      throw new Error(
        "No room selected. Please select a room from the menu first."
      )
    }

    setIsSaving(true)

    try {
      // Get room metadata from wsRooms
      const roomMeta = currentRoomId ? wsRooms?.rooms?.[currentRoomId] : undefined
      const categoryId = roomMeta?.categoryId
      const categoryName = categoryId
        ? wsRooms?.categories?.[categoryId]?.category
        : undefined

      // Serialize the current scene state
      const serializedRoom = serializeRoom({
        cabinets,
        cabinetGroups,
        wallDimensions,
        wallColor,
        activeViews,
        getCabinetView,
        wsProducts,
        roomName: roomMeta?.room || "Untitled",
        // Use category name from wsRooms, with fallback
        roomCategory: (categoryName as SavedRoom["category"]) || "Kitchen",
        cabinetSyncs,
        viewGDFormulas,
      })

      // Save to Firestore using set() with merge:true
      // We omit id, name, category since those come from wsRooms.rooms
      const {
        id: _id,
        name: _name,
        category: _category,
        ...designData
      } = serializedRoom

      await saveRoomDesign(currentRoomUrl, designData)

      // Update local state
      setCurrentRoom(serializedRoom)

      console.log("Room saved to Firestore:", currentRoomId)
    } catch (error) {
      console.error("Failed to save room:", error)
      throw error // Re-throw so caller can handle
    } finally {
      setIsSaving(false)
    }
  }, [
    currentRoomId,
    currentRoomUrl,
    wsRooms,
    activeViews,
    cabinets,
    cabinetGroups,
    getCabinetView,
    wallColor,
    wallDimensions,
    wsProducts,
    cabinetSyncs,
    viewGDFormulas,
  ])

  const loadRoom = useCallback(
    async (savedRoom: SavedRoom) => {
      setCurrentRoom(savedRoom)
      await restoreRoom({
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
        setViewGDFormulas,
      })
    },
    [
      applyDimensions,
      assignCabinetToView,
      clearCabinets,
      createCabinet,
      createView,
      setCabinetGroups,
      setNumbersVisible,
      setWallColor,
      updateCabinetLock,
      updateCabinetViewId,
      viewManagerInstance,
      setCabinetSyncs,
      setViewGDFormulas,
    ]
  )

  useEffect(() => {
    if (onLoadRoomReady) {
      onLoadRoomReady(loadRoom)
    }
  }, [onLoadRoomReady, loadRoom])

  return {
    currentRoom,
    currentRoomName,
    isSaving,
    saveRoom: handleSaveRoom,
    loadRoom,
  }
}
