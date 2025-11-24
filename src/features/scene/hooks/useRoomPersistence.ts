import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { saveRoom, generateRoomId, type RoomCategory, type SavedRoom, type SavedCabinet, type SavedView } from '@/data/savedRooms'
import { cabinetPanelState } from '@/features/cabinets/ui/ProductPanel'
import type { WsProducts } from '@/types/erpTypes'
import type { CabinetType } from '@/features/carcass'
import type { CabinetData, WallDimensions as WallDims } from '../types'
import type { View, ViewId, ViewManager } from '@/features/cabinets/ViewManager'

type CabinetGroupsMap = Map<string, Array<{ cabinetId: string; percentage: number }>>

type CreateCabinetFn = (
  cabinetType: CabinetType,
  subcategoryId: string,
  productId?: string
) => CabinetData | undefined

type UseRoomPersistenceOptions = {
  cabinets: CabinetData[]
  cabinetGroups: CabinetGroupsMap
  setCabinetGroups: Dispatch<SetStateAction<CabinetGroupsMap>>
  wallDimensions: WallDims
  wallColor: string
  setWallColor: Dispatch<SetStateAction<string>>
  applyDimensions: (dimensions: WallDims, color?: string) => void
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
  updateCabinetLock: (cabinetId: string, leftLock: boolean, rightLock: boolean) => void
  onLoadRoomReady?: (loadRoom: (room: SavedRoom) => void) => void
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
  onLoadRoomReady
}: UseRoomPersistenceOptions) => {
  const [currentRoom, setCurrentRoom] = useState<SavedRoom | null>(null)
  const { activeViews, viewManager: viewManagerInstance, createView, assignCabinetToView, getCabinetView } = viewManager

  const handleSaveRoom = useCallback(async (roomName: string, roomCategory: RoomCategory) => {
    try {
      const savedCabinets: SavedCabinet[] = cabinets.map((cabinet) => {
        const persisted = cabinetPanelState.get(cabinet.cabinetId)
        const productName = cabinet.productId && wsProducts?.products[cabinet.productId]?.product
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
          kickerHeight: cabinet.cabinetType === 'base' || cabinet.cabinetType === 'tall' 
            ? cabinet.group.position.y 
            : undefined,
          leftLock: cabinet.leftLock,
          rightLock: cabinet.rightLock,
          group: cabinetGroups.get(cabinet.cabinetId) || undefined,
          sortNumber: cabinet.sortNumber,
        }
      })

      const savedViews: SavedView[] = activeViews.map((view) => ({
        id: view.id,
        name: view.name,
        cabinetIds: Array.from(view.cabinetIds),
      }))

      const backWallLength = wallDimensions.backWallLength ?? wallDimensions.length
      const savedRoom: SavedRoom = {
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
      }

      await saveRoom(savedRoom)
      setCurrentRoom(savedRoom)
      console.log('Room saved:', savedRoom)
      alert(`Room "${roomName}" saved successfully!`)
    } catch (error) {
      console.error('Failed to save room:', error)
      alert(`Failed to save room: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [activeViews, cabinets, cabinetGroups, getCabinetView, wallColor, wallDimensions, wsProducts])

  const loadRoom = useCallback((savedRoom: SavedRoom) => {
    setCurrentRoom(savedRoom)
    setNumbersVisible(false)
    clearCabinets()
    setCabinetGroups(new Map())

    const backWallLength = savedRoom.wallSettings.backWallLength ?? savedRoom.wallSettings.length
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
    applyDimensions(newWallDims, savedRoom.wallSettings.color)
    setWallColor(savedRoom.wallSettings.color)

    setTimeout(() => {
      const viewIdMap = new Map<string, ViewId>()
      const viewIdsToRestore = new Set<string>()

      savedRoom.views.forEach((savedView) => {
        if (savedView.id !== 'none') {
          viewIdsToRestore.add(savedView.id)
        }
      })

      savedRoom.cabinets.forEach((savedCabinet) => {
        if (savedCabinet.viewId && savedCabinet.viewId !== 'none') {
          viewIdsToRestore.add(savedCabinet.viewId)
        }
      })

      viewIdsToRestore.forEach((savedViewId) => {
        const existingView = viewManagerInstance.getView(savedViewId as ViewId)
        const savedView = savedRoom.views.find(v => v.id === savedViewId)

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

      savedRoom.cabinets.forEach((savedCabinet) => {
        const cabinetData = createCabinet(
          savedCabinet.cabinetType as CabinetType,
          savedCabinet.subcategoryId,
          savedCabinet.productId
        )

        if (!cabinetData) {
          console.error('Failed to create cabinet:', savedCabinet)
          return
        }

        cabinetData.carcass.updateDimensions(savedCabinet.dimensions)

        cabinetData.group.position.set(
          savedCabinet.position.x,
          savedCabinet.position.y,
          savedCabinet.position.z
        )

        if (savedCabinet.shelfCount !== undefined) {
          cabinetData.carcass.updateConfig({ shelfCount: savedCabinet.shelfCount })
        }

        if (savedCabinet.doorEnabled !== undefined) {
          cabinetData.carcass.toggleDoors(savedCabinet.doorEnabled)
        }
        if (savedCabinet.doorCount !== undefined) {
          cabinetData.carcass.updateDoorConfiguration(savedCabinet.doorCount)
        }
        if (savedCabinet.overhangDoor !== undefined && cabinetData.cabinetType === 'top') {
          cabinetData.carcass.updateOverhangDoor(savedCabinet.overhangDoor)
        }

        if (savedCabinet.drawerEnabled !== undefined) {
          cabinetData.carcass.updateDrawerEnabled(savedCabinet.drawerEnabled)
        }
        if (savedCabinet.drawerQuantity !== undefined) {
          cabinetData.carcass.updateDrawerQuantity(savedCabinet.drawerQuantity)
        }
        if (savedCabinet.drawerHeights && savedCabinet.drawerHeights.length > 0) {
          savedCabinet.drawerHeights.forEach((height, index) => {
            cabinetData.carcass.updateDrawerHeight(index, height)
          })
        }

        if (savedCabinet.kickerHeight !== undefined && (cabinetData.cabinetType === 'base' || cabinetData.cabinetType === 'tall')) {
          cabinetData.carcass.updateKickerHeight(savedCabinet.kickerHeight)
        }

        if (savedCabinet.materialSelections || savedCabinet.materialColor || savedCabinet.dimensionValues) {
          cabinetPanelState.set(cabinetData.cabinetId, {
            values: savedCabinet.dimensionValues || {},
            materialColor: savedCabinet.materialColor || '#ffffff',
            materialSelections: savedCabinet.materialSelections,
          })
        }

        if (savedCabinet.viewId && savedCabinet.viewId !== 'none') {
          const mappedViewId = viewIdMap.get(savedCabinet.viewId)
          if (mappedViewId) {
            cabinetData.viewId = mappedViewId
            updateCabinetViewId(cabinetData.cabinetId, mappedViewId)
            assignCabinetToView(cabinetData.cabinetId, mappedViewId)
          } else {
            console.warn(`Could not find mapped view ID for cabinet ${cabinetData.cabinetId} with viewId ${savedCabinet.viewId}`)
          }
        } else {
          cabinetData.viewId = undefined
          updateCabinetViewId(cabinetData.cabinetId, undefined)
        }

        if (savedCabinet.leftLock !== undefined || savedCabinet.rightLock !== undefined) {
          updateCabinetLock(
            cabinetData.cabinetId,
            savedCabinet.leftLock ?? false,
            savedCabinet.rightLock ?? false
          )
        }

        if (savedCabinet.group && savedCabinet.group.length > 0) {
          setCabinetGroups(prev => {
            const newMap = new Map(prev)
            newMap.set(cabinetData.cabinetId, savedCabinet.group!)
            return newMap
          })
        }

        if (savedCabinet.sortNumber !== undefined) {
          cabinetData.sortNumber = savedCabinet.sortNumber
        }
      })

      console.log('Room loaded:', savedRoom.name, 'Views restored:', viewIdsToRestore.size, 'Cabinets assigned to views')
    }, 100)
  }, [applyDimensions, assignCabinetToView, clearCabinets, createCabinet, createView, setCabinetGroups, setNumbersVisible, setWallColor, updateCabinetLock, updateCabinetViewId, viewManagerInstance])

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
