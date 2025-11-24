import React, { useEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import * as THREE from 'three'
import type { CabinetData } from '../types'

type Props = {
  cabinet: CabinetData
  camera: THREE.PerspectiveCamera | null
  allCabinets: CabinetData[]
  onClose: () => void
  onLockChange?: (cabinetId: string, leftLock: boolean, rightLock: boolean) => void
}

export const CabinetLockIcons: React.FC<Props> = ({ cabinet, camera, allCabinets, onClose, onLockChange }) => {
  const [positions, setPositions] = useState({ center: { x: 0, y: 0 }, left: { x: 0, y: 0 }, right: { x: 0, y: 0 } })
  
  // Lock states - use cabinet's lock state, default to unlocked (false)
  const isLeftLocked = cabinet.leftLock ?? false
  const isRightLocked = cabinet.rightLock ?? false
  const [isCenterLocked, setIsCenterLocked] = useState(false)

  // Always show all three locks (left, center, right) for all cabinets
  const showLeftLock = true
  const showRightLock = true

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

      // Fixed spacing: 40px between icons
      const iconSpacing = 40

      // Position icons: center at door center, left 40px to the left, right 40px to the right
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

      {/* Left Lock Icon - Always shown */}
        <div
          className={`fixed z-50 bg-white rounded-full p-2 shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${
            isLeftLocked 
              ? 'border-blue-600 hover:border-blue-700' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          style={{
            left: `${positions.left.x}px`,
            top: `${positions.left.y}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            width: '36px',
            height: '36px',
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
            <Lock size={20} className="text-blue-600" />
          ) : (
            <Unlock size={20} className="text-gray-500" />
          )}
        </div>

      {/* Center Lock Icon */}
      <div
        className={`fixed z-50 bg-white rounded-full p-2 shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${
          isCenterLocked 
            ? 'border-blue-600 hover:border-blue-700' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        style={{
          left: `${positions.center.x}px`,
          top: `${positions.center.y}px`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'auto',
          width: '36px',
          height: '36px',
        }}
        onClick={(e) => {
          e.stopPropagation()
          setIsCenterLocked(prev => !prev)
        }}
        title={isCenterLocked ? "Unlock position" : "Lock position"}
      >
        {isCenterLocked ? (
          <Lock size={20} className="text-blue-600" />
        ) : (
          <Unlock size={20} className="text-gray-500" />
        )}
      </div>

      {/* Right Lock Icon - Always shown */}
        <div
          className={`fixed z-50 bg-white rounded-full p-2 shadow-lg border-2 transition-colors cursor-pointer flex items-center justify-center ${
            isRightLocked 
              ? 'border-blue-600 hover:border-blue-700' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          style={{
            left: `${positions.right.x}px`,
            top: `${positions.right.y}px`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'auto',
            width: '36px',
            height: '36px',
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
            <Lock size={20} className="text-blue-600" />
          ) : (
            <Unlock size={20} className="text-gray-500" />
          )}
        </div>
    </>
  )
}

