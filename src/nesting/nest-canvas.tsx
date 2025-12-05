/**
 * Canvas component for visualizing 2D sheet nesting
 * Features: zoom, pan, pagination, part interaction
 */

'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import type { Sheet, PlacedPart, NestingResult } from './nest-types'
import { getPlacedFootprint } from './nest-algorithm'

interface NestCanvasProps {
  nestingResult: NestingResult
  selectedPartId: string | null
  onPartSelect: (partId: string | null) => void
  currentSheetIndex: number
  onSheetChange: (index: number) => void
}

export const NestCanvas: React.FC<NestCanvasProps> = ({
  nestingResult,
  selectedPartId,
  onPartSelect,
  currentSheetIndex,
  onSheetChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [hoveredPartId, setHoveredPartId] = useState<string | null>(null)
  const [initialZoomSet, setInitialZoomSet] = useState(false)

  // Early return if no nesting result or sheets
  if (!nestingResult || !nestingResult.sheets || nestingResult.sheets.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">No sheet data available</p>
      </div>
    )
  }

  const currentSheet = nestingResult.sheets[currentSheetIndex]

  // Calculate initial zoom and pan to fit horizontal sheet in viewport
  useEffect(() => {
    if (!currentSheet || !containerRef.current || initialZoomSet) return

    const container = containerRef.current
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    // Calculate zoom to fit the horizontal sheet (width > height)
    // Leave some padding (10% on each side)
    const padding = 0.1
    const scaleX = (containerWidth * (1 - padding * 2)) / currentSheet.width
    const scaleY = (containerHeight * (1 - padding * 2)) / currentSheet.height
    const initialZoom = Math.min(scaleX, scaleY, 1) // Don't zoom in more than 1x initially

    // Center the sheet in the viewport
    const scaledWidth = currentSheet.width * initialZoom
    const scaledHeight = currentSheet.height * initialZoom
    const initialPanX = (containerWidth - scaledWidth) / 2
    const initialPanY = (containerHeight - scaledHeight) / 2

    setZoom(initialZoom)
    setPan({ x: initialPanX, y: initialPanY })
    setInitialZoomSet(true)
  }, [currentSheet, initialZoomSet])

  // Reset initial zoom when sheet changes
  useEffect(() => {
    setInitialZoomSet(false)
  }, [currentSheetIndex])

  // Additional check for currentSheet (should not happen if sheets array is valid)
  if (!currentSheet) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-600">No sheet data available</p>
      </div>
    )
  }

  // Handle zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((prev) => Math.max(0.1, Math.min(5, prev * delta)))
  }, [])

  // Handle pan with mouse drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left mouse button
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }, [pan])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) {
        setPan({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        })
      } else {
        const canvas = canvasRef.current
        if (!canvas || !currentSheet) return

        const rect = canvas.getBoundingClientRect()
        const x = (e.clientX - rect.left - pan.x) / zoom
        const y = (e.clientY - rect.top - pan.y) / zoom

        let hoveredId: string | null = null
        for (const part of currentSheet.parts) {
          const footprint = getPlacedFootprint(part)
          const topLeftX = part.x
          const topLeftY = part.y // TOP-LEFT in skyline

          if (
            x >= topLeftX &&
            x <= topLeftX + footprint.width &&
            y >= topLeftY &&
            y <= topLeftY + footprint.height
          ) {
            hoveredId = part.id
            break
          }
        }
        setHoveredPartId(hoveredId)
      }
    },
    [isDragging, dragStart, pan, zoom, currentSheet]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current
      if (!canvas || !currentSheet) return

      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left - pan.x) / zoom
      const y = (e.clientY - rect.top - pan.y) / zoom

      for (const part of currentSheet.parts) {
        const footprint = getPlacedFootprint(part)
        const topLeftX = part.x
        const topLeftY = part.y

        if (
          x >= topLeftX &&
          x <= topLeftX + footprint.width &&
          y >= topLeftY &&
          y <= topLeftY + footprint.height
        ) {
          onPartSelect(part.id === selectedPartId ? null : part.id)
          return
        }
      }
      onPartSelect(null)
    },
    [pan, zoom, currentSheet, selectedPartId, onPartSelect]
  )

  // Draw canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !currentSheet) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const container = containerRef.current
    if (container) {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Apply zoom and pan
    ctx.save()
    ctx.translate(pan.x, pan.y)
    ctx.scale(zoom, zoom)

    // Draw sheet background
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, currentSheet.width, currentSheet.height)

    // Draw sheet border
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 2 / zoom
    ctx.strokeRect(0, 0, currentSheet.width, currentSheet.height)

    // Draw shelves (if available - used by FFDH algorithm, empty for Skyline algorithm)
    if (currentSheet.shelves && currentSheet.shelves.length > 0) {
      ctx.strokeStyle = '#ddd'
      ctx.lineWidth = 1 / zoom
      for (const shelf of currentSheet.shelves) {
        ctx.beginPath()
        ctx.moveTo(0, shelf.y + shelf.height)
        ctx.lineTo(currentSheet.width, shelf.y + shelf.height)
        ctx.stroke()
      }
    }

    // Parts
    for (const part of currentSheet.parts) {
      const isSelected = part.id === selectedPartId
      const isHovered = part.id === hoveredPartId

      const footprint = getPlacedFootprint(part)
      const topLeftX = part.x           // skyline gives TOP-LEFT
      const topLeftY = part.y

      // Rect fill
      ctx.fillStyle = part.materialColor || '#cccccc'
      ctx.globalAlpha = isSelected ? 0.8 : isHovered ? 0.7 : 0.6
      ctx.fillRect(topLeftX, topLeftY, footprint.width, footprint.height)

      // Border
      ctx.strokeStyle = isSelected ? '#0066ff' : isHovered ? '#0099ff' : '#666'
      ctx.lineWidth = (isSelected ? 3 : isHovered ? 2 : 1) / zoom
      ctx.strokeRect(topLeftX, topLeftY, footprint.width, footprint.height)

      // Bounds check using rotated footprint
      const isOutOfBounds =
        topLeftX < 0 ||
        topLeftY < 0 ||
        topLeftX + footprint.width > currentSheet.width ||
        topLeftY + footprint.height > currentSheet.height

      // Rotation indicator (just a dot, no canvas rotation)
      if (part.rotation !== 0 && !isOutOfBounds) {
        ctx.fillStyle = '#ff6600'
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.arc(
          topLeftX + 10 / zoom,
          topLeftY + 10 / zoom,
          5 / zoom,
          0,
          2 * Math.PI
        )
        ctx.fill()
      }

      // Error indicator
      if (isOutOfBounds) {
        ctx.fillStyle = '#ff0000'
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.arc(
          topLeftX + footprint.width - 10 / zoom,
          topLeftY + 10 / zoom,
          6 / zoom,
          0,
          2 * Math.PI
        )
        ctx.fill()

        ctx.strokeStyle = '#ff0000'
        ctx.lineWidth = 2 / zoom
        ctx.setLineDash([5 / zoom, 5 / zoom])
        ctx.strokeRect(topLeftX, topLeftY, footprint.width, footprint.height)
        ctx.setLineDash([])
      }

      // Label (center of footprint)
      const labelX = topLeftX + footprint.width / 2
      const labelY = topLeftY + footprint.height / 2

      const hasCabinetNumber = typeof part.cabinetNumber === 'number'
      const cabinetNumberText = hasCabinetNumber ? `#${part.cabinetNumber}` : ''
      const cabinetName = part.cabinetName || part.cabinetType || 'Cabinet'
      const partName = part.partName || 'Part'
      const partSize = `${Math.round(footprint.width)}×${Math.round(
        footprint.height
      )}mm`

      const line1Text = hasCabinetNumber
        ? `${cabinetNumberText} - ${cabinetName}`
        : cabinetName
      const line2Text = `${partName} - ${partSize}`

      ctx.save()
      ctx.fillStyle = '#000'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.globalAlpha = 1
      ctx.font = `${10 / zoom}px Arial`

      const line1Height = 10 / zoom
      const line2Height = 10 / zoom
      const lineSpacing = 2 / zoom
      const totalHeight = line1Height + line2Height + lineSpacing

      ctx.fillText(line1Text, labelX, labelY - totalHeight / 2)
      ctx.fillText(
        line2Text,
        labelX,
        labelY - totalHeight / 2 + line1Height + lineSpacing
      )

      ctx.restore()
    }

    ctx.restore()
  }, [
    currentSheet,
    selectedPartId,
    hoveredPartId,
    zoom,
    pan,
  ])

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative bg-gray-100 overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}

