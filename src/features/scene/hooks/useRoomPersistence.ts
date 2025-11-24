import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"
import { saveRoom, type RoomCategory, type SavedRoom } from "@/data/savedRooms"
import type { WsProducts } from "@/types/erpTypes"
import type { CabinetType } from "@/features/carcass"
import type { CabinetData, WallDimensions as WallDims } from "../types"
import type { View, ViewId, ViewManager } from "@/features/cabinets/ViewManager"
import {
  serializeRoom,
  restoreRoom,
  type CreateCabinetFn,
} from "../utils/roomPersistenceUtils"

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
}: UseRoomPersistenceOptions) => {
  const [currentRoom, setCurrentRoom] = useState<SavedRoom | null>(null)
  const {
    activeViews,
    viewManager: viewManagerInstance,
    createView,
    assignCabinetToView,
    getCabinetView,
  } = viewManager

  const handleSaveRoom = useCallback(
    async (roomName: string, roomCategory: RoomCategory) => {
      try {
        const savedRoom = serializeRoom({
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
        })

        await saveRoom(savedRoom)
        setCurrentRoom(savedRoom)
        console.log("Room saved:", savedRoom)
        alert(`Room "${roomName}" saved successfully!`)
      } catch (error) {
        console.error("Failed to save room:", error)
        alert(
          `Failed to save room: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        )
      }
    },
    [
      activeViews,
      cabinets,
      cabinetGroups,
      getCabinetView,
      wallColor,
      wallDimensions,
      wsProducts,
      cabinetSyncs,
    ]
  )

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
    ]
  )

  useEffect(() => {
    if (onLoadRoomReady) {
      onLoadRoomReady(loadRoom)
    }
  }, [onLoadRoomReady, loadRoom])

  return {
    currentRoom,
    saveRoom: handleSaveRoom,
    loadRoom,
  }
}
