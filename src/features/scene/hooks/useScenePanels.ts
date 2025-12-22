import { useCallback, useEffect, useState } from "react"
import type { CabinetData, WallDimensions } from "../types"

export const DEFAULT_WALL_COLOR = "#dcbfa0"

type UseScenePanelsOptions = {
  showProductPanel: boolean
  isMenuOpen: boolean
  applyDimensions: (
    dimensions: WallDimensions,
    color?: string,
    zoomLevel?: number
  ) => void
  initialWallColor?: string
}

export const useScenePanels = ({
  showProductPanel,
  isMenuOpen,
  applyDimensions,
  initialWallColor = DEFAULT_WALL_COLOR,
}: UseScenePanelsOptions) => {
  const [showSettingsSidebar, setShowSettingsSidebar] = useState(false)
  const [showWallDrawer, setShowWallDrawer] = useState(false)
  const [showViewsDrawer, setShowViewsDrawer] = useState(false)
  const [showViewDrawer, setShowViewDrawer] = useState(false)
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null)
  const [wallColor, setWallColor] = useState(initialWallColor)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [cabinetToDelete, setCabinetToDelete] = useState<CabinetData | null>(
    null
  )

  useEffect(() => {
    if (showProductPanel) {
      setShowSettingsSidebar(false)
      setShowWallDrawer(false)
      setShowViewsDrawer(false)
      setShowViewDrawer(false)
    }
  }, [showProductPanel])

  useEffect(() => {
    if (isMenuOpen) {
      setShowSettingsSidebar(false)
      setShowWallDrawer(false)
      setShowViewsDrawer(false)
      setShowViewDrawer(false)
    }
  }, [isMenuOpen])

  const openSettings = useCallback(() => {
    setShowSettingsSidebar(true)
  }, [])

  const closeSettings = useCallback(() => {
    setShowSettingsSidebar(false)
    setShowWallDrawer(false)
    setShowViewsDrawer(false)
    setShowViewDrawer(false)
    setSelectedViewId(null)
  }, [])

  const openWallDrawer = useCallback(() => setShowWallDrawer(true), [])
  const closeWallDrawer = useCallback(() => setShowWallDrawer(false), [])

  const openViewsDrawer = useCallback(() => setShowViewsDrawer(true), [])
  const closeViewsDrawer = useCallback(() => setShowViewsDrawer(false), [])

  const openViewDrawer = useCallback((viewId: string) => {
    setSelectedViewId(viewId)
    setShowViewDrawer(true)
  }, [])

  const closeViewDrawer = useCallback(() => {
    setShowViewDrawer(false)
    setSelectedViewId(null)
  }, [])

  const openSaveModal = useCallback(() => setShowSaveModal(true), [])
  const closeSaveModal = useCallback(() => setShowSaveModal(false), [])

  const requestDelete = useCallback((cabinet: CabinetData) => {
    setCabinetToDelete(cabinet)
    setShowDeleteModal(true)
  }, [])

  const closeDeleteModal = useCallback(() => {
    setShowDeleteModal(false)
    setCabinetToDelete(null)
  }, [])

  const handleApplyWallSettings = useCallback(
    (dims: WallDimensions, color: string, zoomLevel?: number) => {
      if (color !== wallColor) setWallColor(color)
      applyDimensions(dims, color, zoomLevel)
    },
    [applyDimensions, wallColor]
  )

  return {
    wallColor,
    setWallColor,
    showSettingsSidebar,
    showWallDrawer,
    showViewsDrawer,
    showViewDrawer,
    showSaveModal,
    showDeleteModal,
    selectedViewId,
    cabinetToDelete,
    setCabinetToDelete,
    openSettings,
    closeSettings,
    openWallDrawer,
    closeWallDrawer,
    openViewsDrawer,
    closeViewsDrawer,
    openViewDrawer,
    closeViewDrawer,
    openSaveModal,
    closeSaveModal,
    requestDelete,
    closeDeleteModal,
    handleApplyWallSettings,
  }
}
