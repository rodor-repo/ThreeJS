import * as THREE from 'three';

/**
 * Creates a box geometry with standard parameters
 */
export function createBoxGeometry(
  width: number,
  height: number,
  depth: number
): THREE.BoxGeometry {
  return new THREE.BoxGeometry(width, height, depth);
}

/**
 * Configuration for horizontal panel geometry (like Bottom, Top, Shelf)
 */
export interface HorizontalPanelConfig {
  width: number;          // Width between the two ends (X axis)
  thickness: number;      // Panel thickness (Y axis)
  depth: number;          // Depth (Z axis)
  backThickness?: number; // Optional back panel thickness to subtract from depth
}

/**
 * Creates geometry for horizontal panels (Bottom, Top, Shelf)
 * X-axis: width (between the two ends)
 * Y-axis: thickness (PullPush direction)
 * Z-axis: depth
 */
export function createHorizontalPanelGeometry(config: HorizontalPanelConfig): THREE.BoxGeometry {
  const effectiveDepth = config.backThickness 
    ? config.depth - config.backThickness 
    : config.depth;
  
  return createBoxGeometry(config.width, config.thickness, effectiveDepth);
}

/**
 * Configuration for vertical panel geometry (like Back)
 */
export interface VerticalPanelConfig {
  width: number;      // Width between the two ends (X axis)
  height: number;     // Height (Y axis)
  thickness: number;  // Panel thickness (Z axis)
}

/**
 * Creates geometry for vertical panels (Back)
 * X-axis: width (between the two ends)
 * Y-axis: height
 * Z-axis: thickness (PullPush direction)
 */
export function createVerticalPanelGeometry(config: VerticalPanelConfig): THREE.BoxGeometry {
  return createBoxGeometry(config.width, config.height, config.thickness);
}

/**
 * Configuration for end panel geometry
 */
export interface EndPanelConfig {
  thickness: number;  // Thickness of the end panel (X axis)
  height: number;     // Height of the cabinet (Y axis)
  depth: number;      // Depth of the cabinet (Z axis)
}

/**
 * Creates geometry for end panels
 * X-axis: thickness (PullPush direction)
 * Y-axis: height
 * Z-axis: depth
 */
export function createEndPanelGeometry(config: EndPanelConfig): THREE.BoxGeometry {
  return createBoxGeometry(config.thickness, config.height, config.depth);
}
