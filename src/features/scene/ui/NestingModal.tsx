import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { CabinetData } from '../types'
import type { WsProducts } from '@/types/erpTypes'
import { MaterialLoader } from '@/features/carcass/MaterialLoader'
import { getPartDataManager } from '@/nesting/PartDataManager'

interface NestingModalProps {
  isOpen: boolean
  onClose: () => void
  cabinets: CabinetData[]
  wsProducts?: WsProducts | null
}

type SheetSize = {
  width: number
  height: number
  label: string
}

const SHEET_SIZES: SheetSize[] = [
  { width: 2440, height: 1220, label: '2440 X 1220 mm' }, // Horizontal orientation: 2440mm across X, 1220mm across Y
  { width: 2720, height: 1810, label: '2720 X 1810 mm' }, // Horizontal orientation: 2720mm across X, 1810mm across Y
  { width: 3620, height: 1810, label: '3620 X 1810 mm' }, // Horizontal orientation: 3620mm across X, 1810mm across Y
]

export const NestingModal: React.FC<NestingModalProps> = ({
  isOpen,
  onClose,
  cabinets,
  wsProducts,
}) => {
  const [selectedSheetSize, setSelectedSheetSize] = useState<SheetSize>(SHEET_SIZES[0])
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [hasGrainDirection, setHasGrainDirection] = useState<boolean>(false)
  const [cuttingToolsThick, setCuttingToolsThick] = useState<number>(10) // Default 10mm

  // Get all unique materials from cabinet parts (actual selected materials)
  // Calculate parts fresh when modal opens to ensure up-to-date data
  const materials = useMemo(() => {
    if (!isOpen) return [] // Don't compute if modal is closed
    
    // Calculate all parts fresh when modal opens
    const pdm = getPartDataManager()
    pdm.setWsProducts(wsProducts)
    pdm.updateAllCabinets(cabinets)
    
    const materialSet = new Map<string, { id: string, name: string }>()
    
    // Collect unique material names from all cabinet parts
    cabinets.forEach(cab => {
      const parts = pdm.getCabinetParts(cab.cabinetId)
      parts.forEach(part => {
        if (part.materialName && !materialSet.has(part.materialName)) {
          // Use material name as both id and name for simplicity
          const safeId = part.materialName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
          materialSet.set(part.materialName, {
            id: safeId,
            name: part.materialName
          })
        }
      })
    })
    
    const materialsList = Array.from(materialSet.values())
    
    // Fallback to MaterialLoader if no cabinet parts have materials
    if (materialsList.length === 0) {
      const fallbackList = MaterialLoader.getAllMaterialsWithNames()
      return fallbackList.map(m => ({ id: m.id, name: m.name }))
    }
    
    return materialsList
  }, [isOpen, cabinets, wsProducts])

  // Set default selected material when materials change
  useEffect(() => {
    if (!selectedMaterialId && materials.length > 0) {
      setSelectedMaterialId(materials[0].id)
    }
  }, [materials, selectedMaterialId])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-2xl bg-white rounded-lg shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-bold text-gray-800">Nesting</h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Materials Dropdown */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Materials
                </label>
                {materials.length === 0 ? (
                  <p className="text-gray-500 text-sm">No materials available.</p>
                ) : (
                  <select
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  >
                    {materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Sheet Size Dropdown */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Sheet Size
                </label>
                <select
                  value={selectedSheetSize.label}
                  onChange={(e) => {
                    const selected = SHEET_SIZES.find(
                      (size) => size.label === e.target.value
                    )
                    if (selected) {
                      setSelectedSheetSize(selected)
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                >
                  {SHEET_SIZES.map((size) => (
                    <option key={size.label} value={size.label}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grain Direction Checkbox */}
              <div>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasGrainDirection}
                    onChange={(e) => setHasGrainDirection(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-lg font-semibold text-gray-800">
                    Grain Direction
                  </span>
                </label>
                <p className="text-sm text-gray-600 mt-2 ml-8">
                  Check this if the sheets have grain direction (timber materials)
                </p>
              </div>

              {/* Cutting Tools Thickness */}
              <div>
                <label className="block text-lg font-semibold text-gray-800 mb-3">
                  Cutting Tools Thickness (mm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="1"
                  value={cuttingToolsThick}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value)
                    if (!isNaN(value) && value >= 0) {
                      setCuttingToolsThick(value)
                    }
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Spacing between parts and sheet boundaries for cutting tools (default: 10mm)
                </p>
              </div>

              {/* Generate Nesting Button */}
              <div className="pt-4">
                <button
                  onClick={() => {
                    if (cabinets.length === 0) {
                      alert('No cabinets in the scene to nest.')
                      return
                    }

                    const selectedMaterial = materials.find(
                      (m) => m.id === selectedMaterialId
                    )

                    // Import serializer
                    import('@/nesting/nest-serializer').then(({ serializeCabinetsForNesting }) => {
                      // Serialize cabinets for transmission (includes part data and product names)
                      const serializedCabinets = serializeCabinetsForNesting(cabinets, wsProducts)

                      // Check if sessionStorage is available
                      if (typeof Storage === 'undefined' || !window.sessionStorage) {
                        throw new Error('sessionStorage is not available in this browser')
                      }
                      
                      // Generate unique session key for storing data
                      const sessionKey = `nesting-data-${Date.now()}-${Math.random().toString(36).substring(7)}`
                      
                      // Store serialized cabinets in sessionStorage to avoid URL length limits
                      // Note: sessionStorage is per-tab, so we'll use postMessage to pass data to the new tab
                      try {
                        const dataToStore = JSON.stringify(serializedCabinets)
                        console.log(`Storing nesting data with key: ${sessionKey}, size: ${dataToStore.length} bytes`)
                        
                        // Try to store the data in sessionStorage
                        sessionStorage.setItem(sessionKey, dataToStore)
                        
                        // Verify the data was stored immediately
                        const verifyData = sessionStorage.getItem(sessionKey)
                        if (!verifyData || verifyData !== dataToStore) {
                          throw new Error('Failed to verify data storage - data mismatch')
                        }
                        console.log(`Verified nesting data stored successfully (${verifyData.length} bytes)`)
                        
                        // Clean up old sessionStorage entries (keep only last 5)
                        // IMPORTANT: Do this AFTER verifying the current key is stored
                        // and make sure we don't remove the key we just stored
                        const keysToClean: string[] = []
                        for (let i = 0; i < sessionStorage.length; i++) {
                          const key = sessionStorage.key(i)
                          if (key && key.startsWith('nesting-data-') && key !== sessionKey) {
                            // Don't include the current session key in cleanup
                            keysToClean.push(key)
                          }
                        }
                        // Sort by timestamp (extracted from key) and remove oldest
                        // Keep only the 4 oldest (plus our current one = 5 total)
                        keysToClean.sort().reverse()
                        if (keysToClean.length > 4) {
                          keysToClean.slice(4).forEach(key => {
                            console.log(`Cleaning up old nesting key: ${key}`)
                            sessionStorage.removeItem(key)
                          })
                        }
                        
                        // Final verification that our key still exists after cleanup
                        const finalVerify = sessionStorage.getItem(sessionKey)
                        if (!finalVerify) {
                          throw new Error('Data was removed during cleanup - this should not happen')
                        }
                        console.log(`Final verification passed - key ${sessionKey} still exists`)
                      } catch (error) {
                        console.error('Failed to store nesting data in sessionStorage:', error)
                        
                        // Fallback: If sessionStorage fails, try to use URL parameters
                        // This will only work if the data is small enough (not ideal but better than failing)
                        const dataToStore = JSON.stringify(serializedCabinets)
                        const encodedData = encodeURIComponent(dataToStore)
                        
                        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                          // If quota exceeded, try URL fallback if data is small enough
                          if (encodedData.length < 2000) {
                            console.warn('sessionStorage quota exceeded, falling back to URL parameters')
                            // Continue with URL fallback below
                          } else {
                            alert('Storage quota exceeded and data is too large for URL. Please clear some browser data and try again.')
                            return
                          }
                        } else {
                          // For other errors, try URL fallback if data is small enough
                          if (encodedData.length < 2000) {
                            console.warn('sessionStorage failed, falling back to URL parameters:', error)
                            // Continue with URL fallback below
                          } else {
                            alert(`Failed to prepare nesting data: ${error instanceof Error ? error.message : 'Unknown error'}. Data is too large for URL fallback. Please try again or check browser settings.`)
                            return
                          }
                        }
                        
                        // URL fallback: use URL parameters instead of sessionStorage
                        const params = new URLSearchParams({
                          sheetWidth: selectedSheetSize.width.toString(),
                          sheetHeight: selectedSheetSize.height.toString(),
                          materialId: selectedMaterialId,
                          materialName: selectedMaterial?.name || 'Default Material',
                          hasGrainDirection: hasGrainDirection.toString(),
                          cuttingToolsThick: cuttingToolsThick.toString(),
                          cabinets: encodedData, // Fallback: put data in URL
                        })
                        
                        const nestingUrl = `/nesting?${params.toString()}`
                        console.log(`Opening nesting page with URL fallback (data in URL)`)
                        setTimeout(() => {
                          const newWindow = window.open(nestingUrl, '_blank')
                          if (!newWindow) {
                            alert('Please allow popups for this site to open the nesting page.')
                          }
                        }, 100)
                        return // Exit early, don't use sessionStorage path
                      }

                      // Build URL with parameters (only small config data, not cabinet data)
                      const params = new URLSearchParams({
                        sheetWidth: selectedSheetSize.width.toString(),
                        sheetHeight: selectedSheetSize.height.toString(),
                        materialId: selectedMaterialId,
                        materialName: selectedMaterial?.name || 'Default Material',
                        hasGrainDirection: hasGrainDirection.toString(),
                        cuttingToolsThick: cuttingToolsThick.toString(),
                        sessionKey: sessionKey, // Pass only the session key
                      })

                      // Open nesting page in new tab
                      // Data will be sent via postMessage since sessionStorage is per-tab
                      const nestingUrl = `/nesting?${params.toString()}`
                      console.log(`Opening nesting page with sessionKey: ${sessionKey}`)
                      
                      // Verify one more time that the data exists before opening
                      const preOpenVerify = sessionStorage.getItem(sessionKey)
                      if (!preOpenVerify) {
                        console.error(`CRITICAL: Data not found before opening tab! Key: ${sessionKey}`)
                        alert('Error: Data was lost before opening nesting page. Please try again.')
                        return
                      }
                      
                      // Open the new window and use postMessage to send data
                      // Since sessionStorage is per-tab, we'll send the data via postMessage
                      const newWindow = window.open(nestingUrl, '_blank')
                      if (!newWindow) {
                        alert('Please allow popups for this site to open the nesting page.')
                        return
                      }
                      
                      // Wait for the new window to load, then send the data via postMessage
                      // Send multiple times to ensure the message is received
                      const dataToSend = sessionStorage.getItem(sessionKey)
                      if (!dataToSend) {
                        console.error(`CRITICAL: Data not found in sessionStorage! Key: ${sessionKey}`)
                        alert('Error: Data was lost. Please try generating nesting again.')
                        return
                      }
                      
                      let sendAttempts = 0
                      const maxAttempts = 20 // Try for up to 2 seconds
                      const checkWindow = setInterval(() => {
                        try {
                          if (newWindow.closed) {
                            clearInterval(checkWindow)
                            return
                          }
                          
                          sendAttempts++
                          // Try to send data via postMessage
                          try {
                            newWindow.postMessage({
                              type: 'nesting-data',
                              sessionKey: sessionKey,
                              data: dataToSend
                            }, window.location.origin)
                            console.log(`Sent nesting data via postMessage (attempt ${sendAttempts}/${maxAttempts}). Key: ${sessionKey}`)
                          } catch (e) {
                            console.warn(`Error sending postMessage (attempt ${sendAttempts}):`, e)
                          }
                          
                          // Stop after max attempts
                          if (sendAttempts >= maxAttempts) {
                            clearInterval(checkWindow)
                            console.log(`Finished sending postMessage attempts. Data should be received.`)
                            
                            // Clean up after a delay to ensure the message was received
                            setTimeout(() => {
                              try {
                                sessionStorage.removeItem(sessionKey)
                                console.log(`Cleaned up sessionStorage key: ${sessionKey}`)
                              } catch (e) {
                                console.warn('Failed to clean up sessionStorage:', e)
                              }
                            }, 2000) // Wait 2 seconds before cleanup
                          }
                        } catch (e) {
                          console.warn('Error in checkWindow interval:', e)
                        }
                      }, 100) // Check every 100ms
                      
                      // Clear interval after 5 seconds to prevent infinite loop (safety)
                      setTimeout(() => {
                        clearInterval(checkWindow)
                        console.log('Cleared checkWindow interval (safety timeout)')
                      }, 5000)
                    })
                  }}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg shadow-md"
                >
                  Generate
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

