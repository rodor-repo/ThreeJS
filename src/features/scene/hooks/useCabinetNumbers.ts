import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { CabinetData } from '../types'

/**
 * Hook to manage cabinet numbering system (3D text sprites showing sort numbers)
 */
export const useCabinetNumbers = (
  sceneRef: React.MutableRefObject<THREE.Scene | null>,
  cabinets: CabinetData[],
  visible: boolean
) => {
  const numberSpritesRef = useRef<Map<string, THREE.Sprite>>(new Map())

  useEffect(() => {
    if (!sceneRef.current) return

    // First, search the scene for ALL number sprites (both tracked and orphaned)
    // This ensures we catch any sprites that might have been left behind
    const scene = sceneRef.current
    const allNumberSprites: THREE.Sprite[] = []
    scene.traverse((object) => {
      if (object instanceof THREE.Sprite && (object as any).isCabinetNumber) {
        allNumberSprites.push(object)
      }
    })
    
    // Remove all number sprites from the scene
    allNumberSprites.forEach((sprite) => {
      if (sprite.parent) {
        sprite.parent.remove(sprite)
      }
      if (sprite.material) {
        if (sprite.material.map) {
          sprite.material.map.dispose()
        }
        sprite.material.dispose()
      }
    })
    
    // Clear the tracking ref
    numberSpritesRef.current.clear()

    if (!visible) {
      console.log('[useCabinetNumbers] Numbers hidden - all sprites removed')
      return
    }

    console.log('[useCabinetNumbers] Creating number sprites for', cabinets.length, 'cabinets')

    // Create number sprites for each cabinet
    cabinets.forEach((cabinet) => {
      if (!cabinet.sortNumber) {
        console.warn('[useCabinetNumbers] Cabinet missing sortNumber:', cabinet.cabinetId)
        return
      }

      console.log('[useCabinetNumbers] Creating sprite for cabinet', cabinet.cabinetId, 'with number', cabinet.sortNumber)

      // Create canvas for text
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return

      const size = 128
      canvas.width = size
      canvas.height = size

      // Draw circle background (transparent)
      context.fillStyle = 'rgba(255, 255, 255, 0)' // Transparent
      context.beginPath()
      context.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
      context.fill()

      // Draw circle border
      context.strokeStyle = '#eab308' // Yellow
      context.lineWidth = 6 // Thicker line for bold appearance
      context.beginPath()
      context.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2)
      context.stroke()

      // Draw number text (with stroke for bold effect)
      context.font = 'bold 72px Arial' // Larger and bolder font
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      const numberText = cabinet.sortNumber.toString()
      // Draw stroke first (outline) for bold effect
      context.strokeStyle = '#eab308' // Yellow
      context.lineWidth = 3
      context.strokeText(numberText, size / 2, size / 2)
      // Draw fill on top
      context.fillStyle = '#eab308' // Yellow
      context.fillText(numberText, size / 2, size / 2)

      // Create texture from canvas
      const texture = new THREE.CanvasTexture(canvas)
      texture.needsUpdate = true
      texture.flipY = true // Flip Y to fix upside-down orientation

      // Create sprite material
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.1,
        depthTest: true,
        depthWrite: false,
      })

      // Create sprite
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.scale.set(100, 100, 1) // Scale to appropriate size
      // Rotate around Y axis to make circle parallel with X axis (90 degrees)
      sprite.rotation.y = Math.PI / 2
      // Mark this sprite as a cabinet number sprite for easy identification
      ;(sprite as any).isCabinetNumber = true

      // Position sprite on front edge of cabinet (middle)
      const cabinetX = cabinet.group.position.x
      const cabinetY = cabinet.group.position.y
      const cabinetZ = cabinet.group.position.z
      const cabinetWidth = cabinet.carcass.dimensions.width
      const cabinetHeight = cabinet.carcass.dimensions.height
      const cabinetDepth = cabinet.carcass.dimensions.depth

      // Position at middle of front edge
      // Front edge is at cabinetZ + cabinetDepth (not depth/2)
      sprite.position.set(
        cabinetX + cabinetWidth / 2, // Middle X
        cabinetY + cabinetHeight / 2, // Middle Y
        cabinetZ + cabinetDepth + 100 // Front edge + 100mm offset in positive Z
      )

      if (sceneRef.current) {
        sceneRef.current.add(sprite)
        numberSpritesRef.current.set(cabinet.cabinetId, sprite)
        console.log('[useCabinetNumbers] Sprite created and added at position:', sprite.position)
      }
    })
    
    console.log('[useCabinetNumbers] Created', numberSpritesRef.current.size, 'number sprites')

    // Cleanup function - remove all number sprites when effect is cleaned up
    return () => {
      if (sceneRef.current) {
        const scene = sceneRef.current
        const spritesToRemove: THREE.Sprite[] = []
        scene.traverse((object) => {
          if (object instanceof THREE.Sprite && (object as any).isCabinetNumber) {
            spritesToRemove.push(object)
          }

        })
        spritesToRemove.forEach((sprite) => {
          if (sprite.parent) {
            sprite.parent.remove(sprite)
          }
          if (sprite.material) {
            if (sprite.material.map) {
              sprite.material.map.dispose()
            }
            sprite.material.dispose()
          }
        })
      }
      numberSpritesRef.current.clear()
    }
  }, [sceneRef, cabinets, visible])

  // Update sprite positions when cabinets move
  useEffect(() => {
    if (!visible) return

    cabinets.forEach((cabinet) => {
      const sprite = numberSpritesRef.current.get(cabinet.cabinetId)
      if (!sprite) return

      const cabinetX = cabinet.group.position.x
      const cabinetY = cabinet.group.position.y
      const cabinetZ = cabinet.group.position.z
      const cabinetWidth = cabinet.carcass.dimensions.width
      const cabinetHeight = cabinet.carcass.dimensions.height
      const cabinetDepth = cabinet.carcass.dimensions.depth

      // Update position to middle of front edge
      sprite.position.set(
        cabinetX + cabinetWidth / 2,
        cabinetY + cabinetHeight / 2,
        cabinetZ + cabinetDepth + 100 // Front edge + 100mm offset in positive Z
      )
    })
  }, [cabinets, visible])
}


