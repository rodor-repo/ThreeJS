// import { CarcassAssembly, CarcassMaterial, MaterialLoader } from "./index"

// /**
//  * Demo showing how to use the centralized material system
//  */
// export class MaterialDemo {
//   /**
//    * Example 1: Create a carcass with default material
//    */
//   static createWithDefaultMaterial() {
//     const dimensions = { width: 600, height: 800, depth: 500 }
//     const carcass = CarcassAssembly.createBaseCabinet(dimensions)

//     console.log("Created carcass with default material:", {
//       colour: carcass.config.material.getColour(),
//       panelThickness: carcass.config.material.getPanelThickness(),
//       backThickness: carcass.config.material.getBackThickness(),
//     })

//     return carcass
//   }

//   /**
//    * Example 2: Create a carcass with specific material from data
//    */
//   static createWithSpecificMaterial(materialId: string = "premium-wood") {
//     const dimensions = { width: 600, height: 800, depth: 500 }

//     // Load material from data
//     const material = MaterialLoader.loadMaterialById(materialId)

//     if (material) {
//       const carcass = CarcassAssembly.createBaseCabinet(dimensions, {
//         material,
//       })

//       console.log("Created carcass with specific material:", {
//         materialId,
//         colour: carcass.config.material.getColour(),
//         panelThickness: carcass.config.material.getPanelThickness(),
//         backThickness: carcass.config.material.getBackThickness(),
//       })

//       return carcass
//     } else {
//       console.error(`Material '${materialId}' not found`)
//       return null
//     }
//   }

//   /**
//    * Example 3: Update material on existing carcass
//    */
//   static updateMaterialOnCarcass(
//     carcass: CarcassAssembly,
//     newMaterialId: string
//   ) {
//     const newMaterial = MaterialLoader.loadMaterialById(newMaterialId)

//     if (newMaterial) {
//       carcass.updateMaterial(newMaterial)

//       console.log("Updated carcass material to:", {
//         materialId: newMaterialId,
//         colour: carcass.config.material.getColour(),
//         panelThickness: carcass.config.material.getPanelThickness(),
//         backThickness: carcass.config.material.getBackThickness(),
//       })
//     } else {
//       console.error(`Material '${newMaterialId}' not found`)
//     }
//   }

//   /**
//    * Example 4: List all available materials
//    */
//   static listAvailableMaterials() {
//     const materialIds = MaterialLoader.getAvailableMaterialIds()
//     const materials = MaterialLoader.getAllMaterials()

//     console.log("Available materials:")
//     materialIds.forEach((id, index) => {
//       const material = materials[index]
//       console.log(
//         `  ${id}: ${material.getColour()} (${material.getPanelThickness()}mm)`
//       )
//     })

//     return materials
//   }

//   /**
//    * Example 5: Create custom material
//    */
//   static createCustomMaterial() {
//     const customMaterial = new CarcassMaterial({
//       colour: "#FF6B6B", // Custom red color
//       panelThickness: 22, // 22mm thick panels
//       backThickness: 18, // 18mm back panel
//       opacity: 0.8, // 80% opacity
//       transparent: true,
//     })

//     const dimensions = { width: 600, height: 800, depth: 500 }
//     const carcass = CarcassAssembly.createBaseCabinet(dimensions, {
//       material: customMaterial,
//     })

//     console.log("Created carcass with custom material:", {
//       colour: carcass.config.material.getColour(),
//       panelThickness: carcass.config.material.getPanelThickness(),
//       backThickness: carcass.config.material.getBackThickness(),
//     })

//     return carcass
//   }
// }

// // Usage examples:
// // MaterialDemo.createWithDefaultMaterial();
// // MaterialDemo.createWithSpecificMaterial('premium-wood');
// // MaterialDemo.listAvailableMaterials();
// // MaterialDemo.createCustomMaterial();
