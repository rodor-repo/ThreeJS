/**
 * Nesting visualization page
 * Opens in a new tab to display 2D sheet nesting results
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { nestParts } from '@/nesting/nest-algorithm'
import { extractPartsFromScene } from '@/nesting/nest-mapper'
import { NestCanvas } from '@/nesting/nest-canvas'
import type { NestingConfig, NestingResult, PlacedPart } from '@/nesting/nest-types'
import type { CabinetData } from '@/features/scene/types'

export default function NestingPage() {
  const searchParams = useSearchParams()
  const [nestingResult, setNestingResult] = useState<NestingResult | null>(null)
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null)
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const runNesting = async () => {
      setLoading(true)
      setError(null)
      
      console.log('=== Nesting Page Started ===')
      console.log('URL params:', {
        sheetWidth: searchParams.get('sheetWidth'),
        sheetHeight: searchParams.get('sheetHeight'),
        materialId: searchParams.get('materialId'),
        sessionKey: searchParams.get('sessionKey'),
        hasCabinetsParam: !!searchParams.get('cabinets'),
      })
      
      try {
        // Get configuration from URL parameters
        const sheetWidth = parseInt(searchParams.get('sheetWidth') || '1220')
        const sheetHeight = parseInt(searchParams.get('sheetHeight') || '2440')
        const materialId = searchParams.get('materialId') || ''
        const materialName = searchParams.get('materialName') || 'Default Material'
        const hasGrainDirection = searchParams.get('hasGrainDirection') === 'true'
        const cuttingToolsThick = parseFloat(searchParams.get('cuttingToolsThick') || '10')
        const sessionKey = searchParams.get('sessionKey')
        const cabinetsJson = searchParams.get('cabinets') // Legacy support

        let cabinets: any[] = []

        // Try to get cabinets from postMessage or sessionStorage (new method)
        if (sessionKey) {
          let receivedData: string | null = null
          
          // Set up postMessage listener FIRST (before checking storage)
          const messageHandler = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return
            if (event.data?.type === 'nesting-data' && event.data?.sessionKey === sessionKey) {
              console.log('Received nesting data via postMessage')
              try {
                receivedData = event.data.data
                console.log(`Received ${receivedData?.length ?? 0} bytes via postMessage`)
                window.removeEventListener('message', messageHandler)
              } catch (e) {
                console.error('Error receiving data from postMessage:', e)
              }
            }
          }
          
          // Add listener immediately (before window opens)
          window.addEventListener('message', messageHandler)
          
          // Wait for postMessage to arrive (parent window sends it multiple times over ~2 seconds)
          console.log('Waiting for postMessage data...')
          // Wait longer since parent sends multiple times
          for (let i = 0; i < 10 && !receivedData; i++) {
            await new Promise(resolve => setTimeout(resolve, 200)) // Check every 200ms
            if (receivedData) break
          }
          
          // If we got data via postMessage, use it
          if (receivedData) {
            try {
              cabinets = JSON.parse(receivedData)
              console.log(`Parsed ${cabinets.length} cabinets from postMessage`)
              // Remove listener
              window.removeEventListener('message', messageHandler)
            } catch (e) {
              console.error('Error parsing data from postMessage:', e)
              receivedData = null // Reset to try other methods
            }
          }
          
          // If postMessage didn't work, try sessionStorage
          if (!receivedData) {
            let sessionStorageAvailable = false
            try {
              sessionStorageAvailable = typeof Storage !== 'undefined' && !!window.sessionStorage
              if (sessionStorageAvailable) {
                // Test write/read to ensure sessionStorage is actually working
                const testKey = '__nesting_test__'
                sessionStorage.setItem(testKey, 'test')
                const testRead = sessionStorage.getItem(testKey)
                sessionStorage.removeItem(testKey)
                if (testRead !== 'test') {
                  sessionStorageAvailable = false
                  console.warn('sessionStorage test failed - write/read mismatch')
                }
              }
            } catch (e) {
              sessionStorageAvailable = false
              console.warn('sessionStorage not available:', e)
            }
            
            if (sessionStorageAvailable) {
              // Retry logic: sometimes the data isn't immediately available due to timing
              let retries = 10
              let storedData: string | null = null
              
              while (retries > 0 && !storedData) {
                try {
                  console.log(`Retrieving nesting data from sessionStorage with key: ${sessionKey} (attempt ${11 - retries}/10)`)
                  storedData = sessionStorage.getItem(sessionKey)
                  
                  if (!storedData && retries > 1) {
                    // Wait a bit before retrying (exponential backoff)
                    const delay = Math.min(200 * (11 - retries), 1000) // Max 1 second delay
                    await new Promise(resolve => setTimeout(resolve, delay))
                  }
                } catch (error) {
                  console.error(`Error retrieving nesting data (attempt ${11 - retries}):`, error)
                }
                retries--
              }
              
              if (storedData) {
                try {
                  console.log(`Found nesting data in sessionStorage, size: ${storedData.length} bytes`)
                  cabinets = JSON.parse(storedData)
                  console.log(`Parsed ${cabinets.length} cabinets from sessionStorage`)
                  // Clean up after reading
                  try {
                    sessionStorage.removeItem(sessionKey)
                    console.log(`Cleaned up sessionStorage key: ${sessionKey}`)
                  } catch (e) {
                    console.warn('Failed to clean up sessionStorage key:', e)
                  }
                } catch (error) {
                  console.error('Error parsing nesting data from sessionStorage:', error)
                  storedData = null // Reset to try URL fallback
                }
              }
            }
          }
          
          // Remove message listener after a timeout
          setTimeout(() => {
            window.removeEventListener('message', messageHandler)
          }, 5000)
        } 
      // Fallback to URL parameter method (for backward compatibility or if localStorage failed)
      if ((!cabinets || cabinets.length === 0) && cabinetsJson) {
        try {
          console.log('Using URL parameter fallback method')
          cabinets = JSON.parse(decodeURIComponent(cabinetsJson))
          console.log(`Parsed ${cabinets.length} cabinets from URL parameters`)
        } catch (error) {
          console.error('Failed to parse cabinet data from URL:', error)
          throw new Error('Failed to parse cabinet data from URL. Please try generating nesting again.')
        }
      }
      
      // Final check - if we still don't have cabinets, show error
      if (!cabinets || cabinets.length === 0) {
        const errorMsg = sessionKey 
          ? `No cabinet data found. The data may have expired or been cleared. Please try generating nesting again from the main scene.`
          : 'No cabinet data provided. Please ensure you generated nesting from the main scene.'
        throw new Error(errorMsg)
      }

      // Create nesting config
      const config: NestingConfig = {
        sheetSize: {
          width: sheetWidth,
          height: sheetHeight,
          label: `${sheetWidth} X ${sheetHeight} mm`,
        },
        materialId,
        materialName,
        allowRotation: true, // Enable rotation for better nesting efficiency
        grainDirection: hasGrainDirection ? 'horizontal' : 'none', // Set based on checkbox
        cuttingToolsThick, // Spacing between parts and sheet boundaries (default: 10mm)
      }

      // Extract parts from scene
      const parts = extractPartsFromScene(cabinets)

      // Debug: Log extracted parts
      console.log('Extracted parts:', parts.length)
      if (parts.length > 0) {
        console.log('Parts sample:', parts.slice(0, 3))
      } else {
        console.warn('No parts extracted from cabinets:', cabinets.length, 'cabinets')
      }

      // Don't filter by material - nest all parts regardless of material selection
      // The material selection is used for display/config purposes, not filtering
      const filteredParts = parts

      if (filteredParts.length === 0) {
        throw new Error('No parts found to nest. Please ensure cabinets have valid dimensions.')
      }

      // Run nesting algorithm
      const result = nestParts(filteredParts, config)
      
      // Debug: Log nesting result
      console.log('Nesting result:', {
        totalSheets: result.totalSheets,
        totalParts: result.totalParts,
        placedParts: result.placedParts,
        efficiency: result.materialEfficiency.toFixed(1) + '%'
      })
        setNestingResult(result)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setLoading(false)
      }
    }

    runNesting()
  }, [searchParams])

  // Ensure currentSheetIndex is valid - must be before conditional returns
  useEffect(() => {
    if (nestingResult && nestingResult.sheets.length > 0) {
      const validIndex = Math.max(0, Math.min(currentSheetIndex, nestingResult.sheets.length - 1))
      if (validIndex !== currentSheetIndex) {
        setCurrentSheetIndex(validIndex)
      }
    }
  }, [nestingResult, currentSheetIndex])

  // Calculate valid sheet index
  const validSheetIndex = nestingResult 
    ? Math.max(0, Math.min(currentSheetIndex, nestingResult.sheets.length - 1))
    : 0

  const selectedPart: PlacedPart | null =
    nestingResult && selectedPartId
      ? nestingResult.sheets
          .flatMap((s) => s.parts)
          .find((p) => p.id === selectedPartId) || null
      : null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Processing nesting...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-6 border border-red-200">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Nesting Error</h2>
            <p className="text-gray-700 text-lg mb-4">{error}</p>
            <div className="space-y-2 text-sm text-gray-600 mb-6">
              <p><strong>Possible causes:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>The nesting data may have expired or been cleared</li>
                <li>sessionStorage may be disabled or blocked in your browser</li>
                <li>The data may be too large for the storage method</li>
                <li>There may be a timing issue - try generating again</li>
                <li>Browser popup blockers may have prevented data transfer</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  // Try to reload the page to retry
                  window.location.reload()
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => window.close()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!nestingResult || nestingResult.sheets.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <p className="text-gray-600 text-lg mb-4">No sheets generated. No parts to nest.</p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">2D Sheet Nesting</h1>
            <p className="text-sm text-gray-600 mt-1">
              Material: {nestingResult.sheets[validSheetIndex]?.parts[0]?.materialName || 'N/A'} |{' '}
              Sheet Size: {nestingResult.sheets[validSheetIndex]?.width} × {nestingResult.sheets[validSheetIndex]?.height} mm
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Efficiency:</span>{' '}
              {nestingResult.materialEfficiency.toFixed(1)}% |{' '}
              <span className="font-semibold">Waste:</span>{' '}
              {(nestingResult.materialWaste / 1000000).toFixed(2)} m²
            </div>
            <button
              onClick={() => window.close()}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Canvas Area */}
        <div className="flex-1 relative">
          <NestCanvas
            nestingResult={nestingResult}
            selectedPartId={selectedPartId}
            onPartSelect={setSelectedPartId}
            currentSheetIndex={validSheetIndex}
            onSheetChange={setCurrentSheetIndex}
          />
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto">
          {/* Sheet Pagination */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-gray-800">Sheets</h2>
              <span className="text-sm text-gray-600">
                {validSheetIndex + 1} / {nestingResult.totalSheets}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentSheetIndex(Math.max(0, validSheetIndex - 1))}
                disabled={validSheetIndex === 0}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setCurrentSheetIndex(
                    Math.min(nestingResult.totalSheets - 1, validSheetIndex + 1)
                  )
                }
                disabled={validSheetIndex === nestingResult.totalSheets - 1}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>

          {/* Selected Part Details */}
          {selectedPart && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">
                Selected Part
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Label:</span> {selectedPart.label}
                </div>
                <div>
                  <span className="font-semibold">Dimensions:</span>{' '}
                  {selectedPart.width} × {selectedPart.height} mm
                </div>
                <div>
                  <span className="font-semibold">Rotation:</span> {selectedPart.rotation}°
                </div>
                <div>
                  <span className="font-semibold">Position:</span> ({selectedPart.x},{' '}
                  {selectedPart.y})
                </div>
                <div>
                  <span className="font-semibold">Material:</span>{' '}
                  {selectedPart.materialName}
                </div>
                <div>
                  <span className="font-semibold">Cabinet:</span>{' '}
                  {selectedPart.cabinetType} ({selectedPart.cabinetId})
                </div>
              </div>
            </div>
          )}

          {/* Sheet Statistics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Current Sheet Stats
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-semibold">Parts:</span>{' '}
                {nestingResult.sheets[validSheetIndex]?.parts.length || 0}
              </div>
              <div>
                <span className="font-semibold">Shelves:</span>{' '}
                {nestingResult.sheets[validSheetIndex]?.shelves.length || 0}
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-600">
            <h4 className="font-semibold text-gray-800 mb-2">Controls:</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>Mouse wheel: Zoom in/out</li>
              <li>Click + drag: Pan canvas</li>
              <li>Click part: Select for details</li>
              <li>Hover part info tooltip</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

