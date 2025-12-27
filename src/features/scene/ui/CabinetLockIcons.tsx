import React, { useEffect, useState, useMemo } from 'react'
import { Lock, Unlock } from 'lucide-react'
import * as THREE from 'three'
import _ from 'lodash'
import type { CabinetData } from '../types'
import type { WsProducts } from '@/types/erpTypes'
import { FillersModal } from './FillersModal'

type Props = {
  cabinet: CabinetData
  camera: THREE.PerspectiveCamera | null
  allCabinets: CabinetData[]
  onClose: () => void
  onLockChange?: (cabinetId: string, leftLock: boolean, rightLock: boolean) => void
  onKickerToggle?: (cabinetId: string, enabled: boolean) => void
  onBulkheadToggle?: (cabinetId: string, enabled: boolean) => void
  onUnderPanelToggle?: (cabinetId: string, enabled: boolean) => void
  wsProducts?: WsProducts | null
  onFillerSelect?: (cabinetId: string, productId: string, side: 'left' | 'right') => void
  onFillerToggle?: (cabinetId: string, side: 'left' | 'right', enabled: boolean) => void
  onKickerSelect?: (cabinetId: string, productId: string) => void
  onBulkheadSelect?: (cabinetId: string, productId: string) => void
  onUnderPanelSelect?: (cabinetId: string, productId: string) => void
  onBenchtopToggle?: (cabinetId: string, enabled: boolean) => void
  onBenchtopSelect?: (cabinetId: string, productId: string | null) => void
}

export const CabinetLockIcons: React.FC<Props> = ({
  cabinet,
  camera,
  allCabinets,
  onClose,
  onLockChange,
  onKickerToggle,
  onBulkheadToggle,
  onUnderPanelToggle,
  wsProducts,
  onFillerSelect,
  onFillerToggle,
  onKickerSelect,
  onBulkheadSelect,
  onUnderPanelSelect,
  onBenchtopToggle,
  onBenchtopSelect
}) => {
  const [positions, setPositions] = useState({ center: { x: 0, y: 0 }, left: { x: 0, y: 0 }, right: { x: 0, y: 0 } })

  // Lock states - use cabinet's lock state, default to unlocked (false)
  const isLeftLocked = cabinet.leftLock ?? false
  const isRightLocked = cabinet.rightLock ?? false
  const [isCenterLocked, setIsCenterLocked] = useState(false)

  // Toggle states for letter icons (F, B, U, K, T)
  const [isFLeftOn, setIsFLeftOn] = useState(false)
  const [isFRightOn, setIsFRightOn] = useState(false)
  // Initialize B state based on whether bulkhead exists as a separate CabinetData entry (only for top and tall)
  const [isBOn, setIsBOn] = useState(() => {
    if (cabinet.cabinetType === 'top' || cabinet.cabinetType === 'tall') {
      // Check if bulkhead exists as a separate CabinetData entry
      const existingBulkheadCabinet = allCabinets.find(
        (c) => c.cabinetType === 'bulkhead' && c.bulkheadParentCabinetId === cabinet.cabinetId
      )
      return !!existingBulkheadCabinet
    }
    return false
  })

  // Sync B state with actual bulkhead existence when cabinet dimensions change (only for top and tall)
  useEffect(() => {
    if (cabinet.cabinetType === 'top' || cabinet.cabinetType === 'tall') {
      // Check if bulkhead exists as a separate CabinetData entry
      const existingBulkheadCabinet = allCabinets.find(
        (c) => c.cabinetType === 'bulkhead' && c.bulkheadParentCabinetId === cabinet.cabinetId
      )
      const bulkheadExists = !!existingBulkheadCabinet
      // Sync state with actual bulkhead existence
      setIsBOn(bulkheadExists)
    }
  }, [
    cabinet.cabinetId,
    cabinet.cabinetType,
    cabinet.carcass.dimensions.width,
    cabinet.carcass.dimensions.height,
    cabinet.carcass.dimensions.depth,
    cabinet.group.position.y,
    allCabinets,
  ])
  
  // Initialize U state based on whether underPanel exists as a separate CabinetData entry (only for top cabinets)
  const [isUOn, setIsUOn] = useState(() => {
    if (cabinet.cabinetType === 'top') {
      // Check if underPanel exists as a separate CabinetData entry
      const existingUnderPanelCabinet = allCabinets.find(
        (c) => c.cabinetType === 'underPanel' && c.underPanelParentCabinetId === cabinet.cabinetId
      )
      return !!existingUnderPanelCabinet
    }
    return false
  })

  // Sync U state with actual underPanel existence when cabinet dimensions change (only for top cabinets)
  useEffect(() => {
    if (cabinet.cabinetType === 'top') {
      // Check if underPanel exists as a separate CabinetData entry
      const existingUnderPanelCabinet = allCabinets.find(
        (c) => c.cabinetType === 'underPanel' && c.underPanelParentCabinetId === cabinet.cabinetId
      )
      const underPanelExists = !!existingUnderPanelCabinet
      // Sync state with actual underPanel existence
      setIsUOn(underPanelExists)
    }
  }, [
    cabinet.cabinetId,
    cabinet.cabinetType,
    cabinet.carcass.dimensions.width,
    cabinet.carcass.dimensions.height,
    cabinet.carcass.dimensions.depth,
    cabinet.group.position.y,
    allCabinets,
  ])

  // Modal state for Fillers
  const [showFillersModal, setShowFillersModal] = useState(false)
  const [fillerSide, setFillerSide] = useState<'left' | 'right' | null>(null)

  // Get the first available kicker product ID (for auto-adding kicker without modal)
  const defaultKickerProductId = useMemo(() => {
    if (!wsProducts) return null
    const kickerProducts = Object.entries(wsProducts.products).filter(([, p]) => {
      if (p.status !== 'Active' || p.enabled3D !== true) return false
      const designEntry = wsProducts.designs[p.designId]
      return designEntry?.type3D === 'kicker'
    })
    const productsWithData = kickerProducts.map(([id, p]) => ({
      id,
      name: p.product,
      sortNum: Number(p.sortNum),
    }))
    const sorted = _.sortBy(productsWithData, ['sortNum'])
    return sorted.length > 0 ? sorted[0].id : null
  }, [wsProducts])

  // Get the first available bulkhead product ID (for auto-adding bulkhead without modal)
  const defaultBulkheadProductId = useMemo(() => {
    if (!wsProducts) return null
    const bulkheadProducts = Object.entries(wsProducts.products).filter(([, p]) => {
      if (p.status !== 'Active' || p.enabled3D !== true) return false
      const designEntry = wsProducts.designs[p.designId]
      return designEntry?.type3D === 'bulkhead'
    })
    const productsWithData = bulkheadProducts.map(([id, p]) => ({
      id,
      name: p.product,
      sortNum: Number(p.sortNum),
    }))
    const sorted = _.sortBy(productsWithData, ['sortNum'])
    return sorted.length > 0 ? sorted[0].id : null
  }, [wsProducts])

  // Get the first available underPanel product ID (for auto-adding underPanel without modal)
  const defaultUnderPanelProductId = useMemo(() => {
    if (!wsProducts) return null
    const underPanelProducts = Object.entries(wsProducts.products).filter(([, p]) => {
      if (p.status !== 'Active' || p.enabled3D !== true) return false
      const designEntry = wsProducts.designs[p.designId]
      return designEntry?.type3D === 'underPanel'
    })
    const productsWithData = underPanelProducts.map(([id, p]) => ({
      id,
      name: p.product,
      sortNum: Number(p.sortNum),
    }))
    const sorted = _.sortBy(productsWithData, ['sortNum'])
    return sorted.length > 0 ? sorted[0].id : null
  }, [wsProducts])

  // Check if appliance supports benchtop (dishwasher or washingMachine)
  const applianceType = cabinet.carcass?.config?.applianceType
  const isApplianceWithBenchtop = cabinet.cabinetType === 'appliance' && 
    (applianceType === 'dishwasher' || applianceType === 'washingMachine')
  
  // T icon is available for base cabinets AND appliances (dishwasher/washingMachine)
  const supportsBenchtop = cabinet.cabinetType === 'base' || isApplianceWithBenchtop
  
  // Hide F, B, U, K, T icons for:
  // - Independent fillers/panels (added from drawer, not modal)
  // - Standalone benchtops (they only need lock icons for length extension)
  // Lock icons should always be visible
  const isIndependentFillerOrPanel = (cabinet.cabinetType === 'filler' || cabinet.cabinetType === 'panel') && !cabinet.hideLockIcons
  const isStandaloneBenchtop = cabinet.cabinetType === 'benchtop'
  const showLetterIcons = !isIndependentFillerOrPanel && !isStandaloneBenchtop
  
  // Initialize T state based on whether benchtop exists as a separate CabinetData entry
  const [isTOn, setIsTOn] = useState(() => {
    if (supportsBenchtop) {
      // Check if benchtop exists as a separate CabinetData entry
      const existingBenchtopCabinet = allCabinets.find(
        (c) => c.cabinetType === 'benchtop' && c.benchtopParentCabinetId === cabinet.cabinetId
      )
      return !!existingBenchtopCabinet
    }
    return false
  })

  // Sync T state with actual benchtop existence when cabinet dimensions change
  useEffect(() => {
    if (supportsBenchtop) {
      // Check if benchtop exists as a separate CabinetData entry
      const existingBenchtopCabinet = allCabinets.find(
        (c) => c.cabinetType === 'benchtop' && c.benchtopParentCabinetId === cabinet.cabinetId
      )
      const benchtopExists = !!existingBenchtopCabinet
      // Sync state with actual benchtop existence
      setIsTOn(benchtopExists)
    }
  }, [
    cabinet.cabinetId,
    cabinet.cabinetType,
    cabinet.carcass.dimensions.width,
    cabinet.carcass.dimensions.height,
    cabinet.carcass.dimensions.depth,
    cabinet.group.position.y,
    allCabinets,
    supportsBenchtop,
  ])

  // Initialize K state based on whether kicker exists as a separate CabinetData entry
  const [isKOn, setIsKOn] = useState(() => {
    if (cabinet.cabinetType === 'base' || cabinet.cabinetType === 'tall') {
      // Check if kicker exists as a separate CabinetData entry
      const existingKickerCabinet = allCabinets.find(
        (c) => c.cabinetType === 'kicker' && c.kickerParentCabinetId === cabinet.cabinetId
      )
      return !!existingKickerCabinet
    }
    return false
  })

  // Sync K state with actual kicker existence when cabinet dimensions change
  useEffect(() => {
    if (cabinet.cabinetType === 'base' || cabinet.cabinetType === 'tall') {
      // Check if kicker exists as a separate CabinetData entry
      const existingKickerCabinet = allCabinets.find(
        (c) => c.cabinetType === 'kicker' && c.kickerParentCabinetId === cabinet.cabinetId
      )
      const kickerExists = !!existingKickerCabinet
      // Sync state with actual kicker existence
      setIsKOn(kickerExists)
    }
  }, [
    cabinet.cabinetId,
    cabinet.carcass.dimensions.width,
    cabinet.carcass.dimensions.depth,
    cabinet.group.position.y,
    // Watch for changes in cabinets array (when kicker is added/removed)
    allCabinets.length
  ])

  // Always show all three locks (left, center, right) for all cabinets
  const showLeftLock = true
  const showRightLock = true

  // Sync filler/panel state with actual children
  useEffect(() => {
    const childFillers = allCabinets.filter(
      (c) =>
        c.parentCabinetId === cabinet.cabinetId &&
        (c.cabinetType === 'filler' || c.cabinetType === 'panel') &&
        c.hideLockIcons === true
    )

    const leftExists = childFillers.some((c) => c.parentSide === 'left')
    const rightExists = childFillers.some((c) => c.parentSide === 'right')

    setIsFLeftOn(leftExists)
    setIsFRightOn(rightExists)
  }, [allCabinets, cabinet.cabinetId])

  // Update positions on camera/scene changes
  useEffect(() => {
    if (!camera) return

    const updatePositions = () => {
      // Calculate door center position in world space
      // Cabinet position is at bottom-left corner (X = left edge, Y = bottom edge)
      const cabinetX = cabinet.group.position.x
      const cabinetY = cabinet.group.position.y
      const cabinetZ = cabinet.group.position.z
      const width = cabinet.carcass.dimensions.width
      const height = cabinet.carcass.dimensions.height
      const depth = cabinet.carcass.dimensions.depth

      // Door center: horizontally centered, vertically centered, at front face (Z = depth + small offset for door clearance)
      const doorCenterX = cabinetX + width / 2
      const doorCenterY = cabinetY + height / 2
      const doorCenterZ = cabinetZ + depth + 2 // 2mm offset for door clearance (as per CarcassDoor)

      // Create 3D position vector for door center
      const doorCenterWorld = new THREE.Vector3(doorCenterX, doorCenterY, doorCenterZ)

      // Project door center to screen coordinates
      const doorCenterScreen = doorCenterWorld.clone().project(camera)
      const centerX = (doorCenterScreen.x * 0.5 + 0.5) * window.innerWidth
      const centerY = (-doorCenterScreen.y * 0.5 + 0.5) * window.innerHeight

      // Fixed spacing: 35px between icons horizontally
      const iconSpacing = 35

      // Position icons: center at door center, left 35px to the left, right 35px to the right
      setPositions({
        center: { x: centerX, y: centerY },
        left: { x: centerX - iconSpacing, y: centerY },
        right: { x: centerX + iconSpacing, y: centerY },
      })
    }

    updatePositions()
    // Update on window resize and animation frame for smooth updates
    const handleResize = () => updatePositions()
    window.addEventListener('resize', handleResize)

    // Update positions on animation frame for smooth tracking
    let animationFrameId: number
    const animate = () => {
      updatePositions()
      animationFrameId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [cabinet, camera])

  if (!camera) return null

  return (
    <>
      {/* Backdrop to close on click outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        style={{ pointerEvents: 'auto' }}
      />

      {/* F Icon above Left Lock - Toggleable */}
      {showLetterIcons && (
        <div
          className={`fixed z-50 bg-white rounded-full shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isFLeftOn
              ? 'border-blue-600 hover:border-blue-700'
              : 'border-gray-300 hover:border-gray-400'
            }`}
          style={{
            left: `${positions.left.x}px`,
            top: `${positions.left.y - 35}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            width: '29px',
            height: '29px',
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (isFLeftOn) {
              setIsFLeftOn(false)
              if (onFillerToggle) {
                onFillerToggle(cabinet.cabinetId, 'left', false)
              }
            } else {
              setIsFLeftOn(true)
              setFillerSide('left')
              setShowFillersModal(true)
            }
          }}
        >
          <span className={`font-bold text-sm ${isFLeftOn ? 'text-blue-600' : 'text-gray-400'}`}>F</span>
        </div>
      )}

      {/* Left Lock Icon - Always shown */}
      <div
        className={`fixed z-50 bg-white rounded-full p-1.5 shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isLeftLocked
            ? 'border-blue-600 hover:border-blue-700'
            : 'border-gray-300 hover:border-gray-400'
          }`}
        style={{
          left: `${positions.left.x}px`,
          top: `${positions.left.y}px`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          width: '29px',
          height: '29px',
        }}
        onClick={(e) => {
          e.stopPropagation()
          const newLeftLock = !isLeftLocked
          if (onLockChange) {
            onLockChange(cabinet.cabinetId, newLeftLock, isRightLocked)
          }
        }}
        title={isLeftLocked ? "Unlock left edge (allow extension in negative X)" : "Lock left edge (freeze left side, extend only in positive X)"}
      >
        {isLeftLocked ? (
          <Lock size={16} className="text-blue-600" />
        ) : (
          <Unlock size={16} className="text-gray-500" />
        )}
      </div>

      {/* T Icon above Center Lock - Toggleable, for Base cabinets and Appliances (Dishwasher/Washing Machine) */}
      {showLetterIcons && supportsBenchtop && (
        <div
          className={`fixed z-50 bg-white rounded-full shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isTOn
              ? 'border-blue-600 hover:border-blue-700'
              : 'border-gray-300 hover:border-gray-400'
            }`}
          style={{
            left: `${positions.center.x}px`,
            top: `${positions.center.y - 35}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            width: '29px',
            height: '29px',
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (isTOn) {
              // Benchtop exists - remove it
              setIsTOn(false)
              if (onBenchtopToggle) {
                onBenchtopToggle(cabinet.cabinetId, false)
              }
            } else {
              // Benchtop doesn't exist - automatically add
              if (onBenchtopSelect) {
                onBenchtopSelect(cabinet.cabinetId, null) // null means use default product
                setIsTOn(true)
              }
            }
          }}
        >
          <span className={`font-bold text-sm ${isTOn ? 'text-blue-600' : 'text-gray-400'}`}>T</span>
        </div>
      )}

      {/* B Icon above Center Lock - Toggleable, for Tall and Top (Overhead) cabinets only */}
      {showLetterIcons && (cabinet.cabinetType === 'tall' || cabinet.cabinetType === 'top') && (
        <div
          className={`fixed z-50 bg-white rounded-full shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isBOn
              ? 'border-blue-600 hover:border-blue-700'
              : 'border-gray-300 hover:border-gray-400'
            }`}
          style={{
            left: `${positions.center.x}px`,
            top: `${positions.center.y - 35}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            width: '29px',
            height: '29px',
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (isBOn) {
              // Bulkhead exists - remove it
              setIsBOn(false)
              if (onBulkheadToggle) {
                onBulkheadToggle(cabinet.cabinetId, false)
              }
            } else {
              // Bulkhead doesn't exist - automatically add with default product
              if (defaultBulkheadProductId && onBulkheadSelect) {
                onBulkheadSelect(cabinet.cabinetId, defaultBulkheadProductId)
                setIsBOn(true)
              }
            }
          }}
        >
          <span className={`font-bold text-sm ${isBOn ? 'text-blue-600' : 'text-gray-400'}`}>B</span>
        </div>
      )}

      {/* Center Lock Icon */}
      <div
        className={`fixed z-50 bg-white rounded-full p-1.5 shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isCenterLocked
            ? 'border-blue-600 hover:border-blue-700'
            : 'border-gray-300 hover:border-gray-400'
          }`}
        style={{
          left: `${positions.center.x}px`,
          top: `${positions.center.y}px`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          width: '29px',
          height: '29px',
        }}
        onClick={(e) => {
          e.stopPropagation()
          setIsCenterLocked(prev => !prev)
        }}
        title={isCenterLocked ? "Unlock position" : "Lock position"}
      >
        {isCenterLocked ? (
          <Lock size={16} className="text-blue-600" />
        ) : (
          <Unlock size={16} className="text-gray-500" />
        )}
      </div>

      {/* K Icon below Center Lock - Toggleable, only for Base and Tall cabinets */}
      {showLetterIcons && (cabinet.cabinetType === 'base' || cabinet.cabinetType === 'tall') && (
        <div
          className={`fixed z-50 bg-white rounded-full shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isKOn
              ? 'border-blue-600 hover:border-blue-700'
              : 'border-gray-300 hover:border-gray-400'
            }`}
          style={{
            left: `${positions.center.x}px`,
            top: `${positions.center.y + 35}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            width: '29px',
            height: '29px',
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (isKOn) {
              // Kicker exists - remove it
              setIsKOn(false)
              if (onKickerToggle) {
                onKickerToggle(cabinet.cabinetId, false)
              }
            } else {
              // Kicker doesn't exist - automatically add with default product
              if (defaultKickerProductId && onKickerSelect) {
                onKickerSelect(cabinet.cabinetId, defaultKickerProductId)
                setIsKOn(true)
              }
            }
          }}
        >
          <span className={`font-bold text-sm ${isKOn ? 'text-blue-600' : 'text-gray-400'}`}>K</span>
        </div>
      )}

      {/* U Icon below Center Lock - Toggleable, only for Top (Overhead) cabinets */}
      {showLetterIcons && cabinet.cabinetType === 'top' && (
        <div
          className={`fixed z-50 bg-white rounded-full shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isUOn
              ? 'border-blue-600 hover:border-blue-700'
              : 'border-gray-300 hover:border-gray-400'
            }`}
          style={{
            left: `${positions.center.x}px`,
            top: `${positions.center.y + 35}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            width: '29px',
            height: '29px',
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (isUOn) {
              // UnderPanel exists - remove it
              setIsUOn(false)
              if (onUnderPanelToggle) {
                onUnderPanelToggle(cabinet.cabinetId, false)
              }
            } else {
              // UnderPanel doesn't exist - automatically add with default product
              if (defaultUnderPanelProductId && onUnderPanelSelect) {
                onUnderPanelSelect(cabinet.cabinetId, defaultUnderPanelProductId)
                setIsUOn(true)
              }
            }
          }}
        >
          <span className={`font-bold text-sm ${isUOn ? 'text-blue-600' : 'text-gray-400'}`}>U</span>
        </div>
      )}

      {/* F Icon above Right Lock - Toggleable */}
      {showLetterIcons && (
        <div
          className={`fixed z-50 bg-white rounded-full shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isFRightOn
              ? 'border-blue-600 hover:border-blue-700'
              : 'border-gray-300 hover:border-gray-400'
            }`}
          style={{
            left: `${positions.right.x}px`,
            top: `${positions.right.y - 35}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            width: '29px',
            height: '29px',
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (isFRightOn) {
              setIsFRightOn(false)
              if (onFillerToggle) {
                onFillerToggle(cabinet.cabinetId, 'right', false)
              }
            } else {
              setIsFRightOn(true)
              setFillerSide('right')
              setShowFillersModal(true)
            }
          }}
        >
          <span className={`font-bold text-sm ${isFRightOn ? 'text-blue-600' : 'text-gray-400'}`}>F</span>
        </div>
      )}

      {/* Right Lock Icon - Always shown */}
      <div
        className={`fixed z-50 bg-white rounded-full p-1.5 shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${isRightLocked
            ? 'border-blue-600 hover:border-blue-700'
            : 'border-gray-300 hover:border-gray-400'
          }`}
        style={{
          left: `${positions.right.x}px`,
          top: `${positions.right.y}px`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          width: '29px',
          height: '29px',
        }}
        onClick={(e) => {
          e.stopPropagation()
          const newRightLock = !isRightLocked
          if (onLockChange) {
            onLockChange(cabinet.cabinetId, isLeftLocked, newRightLock)
          }
        }}
        title={isRightLocked ? "Unlock right edge (allow extension in positive X)" : "Lock right edge (freeze right side, extend only in negative X)"}
      >
        {isRightLocked ? (
          <Lock size={16} className="text-blue-600" />
        ) : (
          <Unlock size={16} className="text-gray-500" />
        )}
      </div>

      {/* Fillers Modal */}
      <FillersModal
        isOpen={showFillersModal}
        onClose={() => {
          setShowFillersModal(false)
          setFillerSide(null)
        }}
        wsProducts={wsProducts || null}
        onProductSelect={(productId) => {
          if (fillerSide && onFillerSelect) {
            onFillerSelect(cabinet.cabinetId, productId, fillerSide)
            if (fillerSide === 'left') {
              setIsFLeftOn(true)
            } else {
              setIsFRightOn(true)
            }
          }
          setShowFillersModal(false)
          setFillerSide(null)
        }}
      />

    </>
  )
}

