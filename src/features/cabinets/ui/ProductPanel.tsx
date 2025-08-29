import React from 'react'
import type { CarcassDimensions, CarcassMaterial, CarcassMaterialData, DoorMaterial, DoorMaterialData } from '@/components/Carcass'
import { useProductPanelState } from '../../cabinets/hooks/useProductPanelState'
import ProductPanelView from './ProductPanelView'
import type { ProductPanelProps } from './product-panel.types'

interface LocalProductPanelProps extends ProductPanelProps { }

const ProductPanel: React.FC<LocalProductPanelProps> = props => {
  const state = useProductPanelState({
    selectedCabinet: props.selectedCabinet,
    onDimensionsChange: props.onDimensionsChange,
    onMaterialChange: props.onMaterialChange,
    onKickerHeightChange: props.onKickerHeightChange,
    onDoorToggle: props.onDoorToggle,
    onDoorMaterialChange: props.onDoorMaterialChange,
    onDoorCountChange: props.onDoorCountChange,
    onOverhangDoorToggle: props.onOverhangDoorToggle,
    onDrawerToggle: props.onDrawerToggle,
    onDrawerQuantityChange: props.onDrawerQuantityChange,
    onDrawerHeightChange: props.onDrawerHeightChange,
    onDrawerHeightsBalance: props.onDrawerHeightsBalance,
    onDrawerHeightsReset: props.onDrawerHeightsReset
  })

  return (
    <ProductPanelView
      {...props}
      state={{
        isExpanded: state.isExpanded,
        setIsExpanded: state.setIsExpanded,
        dimensions: state.dimensions,
        materialColor: state.materialColor,
        materialThickness: state.materialThickness,
        kickerHeight: state.kickerHeight,
        doorEnabled: state.doorEnabled,
        doorColor: state.doorColor,
        doorThickness: state.doorThickness,
        doorCount: state.doorCount,
        doorCountAutoAdjusted: state.doorCountAutoAdjusted,
        overhangDoor: state.overhangDoor,
        drawerEnabled: state.drawerEnabled,
        drawerQuantity: state.drawerQuantity,
        drawerHeights: state.drawerHeights,
        isEditingDrawerHeights: state.isEditingDrawerHeights,
        isEditingDimensions: state.isEditingDimensions,
        isOneDoorAllowed: state.isOneDoorAllowed,
        isDrawerCabinet: state.isDrawerCabinet,
        dimensionConstraints: state.dimensionConstraints
      }}
      handlers={{
        handleDimensionChange: state.handleDimensionChange,
        handleMaterialChange: state.handleMaterialChange,
        handleKickerHeightChange: state.handleKickerHeightChange,
        handleDoorToggle: state.handleDoorToggle,
        handleOverhangDoorToggle: state.handleOverhangDoorToggle,
        handleDoorMaterialChange: state.handleDoorMaterialChange,
        handleDoorCountChange: state.handleDoorCountChange,
        handleDrawerToggle: state.handleDrawerToggle,
        handleDrawerQuantityChange: state.handleDrawerQuantityChange,
        handleDrawerHeightChange: state.handleDrawerHeightChange,
        updateDrawerHeightLocal: state.updateDrawerHeightLocal,
        recalculateDrawerHeights: state.recalculateDrawerHeights,
        onDrawerHeightsBalance: state.onDrawerHeightsBalance,
        onDrawerHeightsReset: state.onDrawerHeightsReset,
        setIsEditingDrawerHeights: state.setIsEditingDrawerHeights,
        setIsEditingDimensions: state.setIsEditingDimensions,
        debugBalanceTest: state.debugBalanceTest
      }}
    />
  )
}

export default ProductPanel
