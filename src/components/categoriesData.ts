export interface Subcategory {
  id: string
  name: string
  dimensions: {
    height: { min: number; max: number; default: number }
    width: { min: number; max: number; default: number }
    depth: { min: number; max: number; default: number }
  }
}

export interface Category {
  id: string
  name: string
  description: string
  icon: string
  color: string
  subcategories: Subcategory[]
}

export const categoriesData: { 
  categories: Category[];
  baseRailSetting: { default: number; description: string };
  legSettings: { default: number; description: string };
  doorSettings: { gap: number; description: string };
  drawerSettings: { minQuantity: number; maxQuantity: number; defaultQuantity: number; description: string };
  carcassMaterials: any[];
} = {
  "baseRailSetting": {
    "default": 60,
    "description": "Base Rail depth for Base cabinet types (in mm)"
  },
  "legSettings": {
    "default": 100,
    "description": "Standard leg height for Base and Tall cabinet types (in mm)"
  },
  "doorSettings": {
    "gap": 2,
    "description": "Gap between doors and carcass edges (in mm)"
  },
  "drawerSettings": {
    "minQuantity": 1,
    "maxQuantity": 6,
    "defaultQuantity": 3,
    "description": "Drawer quantity and configuration settings"
  },
  "categories": [
    {
      "id": "base",
      "name": "Base",
      "description": "Base cabinets and foundation elements",
      "icon": "📦",
      "color": "#3B82F6",
      "subcategories": [
        { 
          "id": "standard", 
          "name": "Standard",
          "dimensions": {
            "height": { "min": 400, "max": 900, "default": 720 },
            "width": { "min": 300, "max": 1200, "default": 600 },
            "depth": { "min": 300, "max": 600, "default": 600 }
          }
        },
        { 
          "id": "drawer", 
          "name": "Drawer",
          "dimensions": {
            "height": { "min": 400, "max": 1200, "default": 730 },
            "width": { "min": 300, "max": 1200, "default": 600 },
            "depth": { "min": 400, "max": 600, "default": 500 }
          }
        },
        { 
          "id": "corner", 
          "name": "Corner",
          "dimensions": {
            "height": { "min": 400, "max": 900, "default": 720 },
            "width": { "min": 400, "max": 800, "default": 600 },
            "depth": { "min": 400, "max": 800, "default": 600 }
          }
        },
        { 
          "id": "blind", 
          "name": "Blind",
          "dimensions": {
            "height": { "min": 400, "max": 900, "default": 720 },
            "width": { "min": 200, "max": 400, "default": 300 },
            "depth": { "min": 300, "max": 600, "default": 600 }
          }
        },
        { 
          "id": "wine-rack", 
          "name": "Wine Rack",
          "dimensions": {
            "height": { "min": 400, "max": 900, "default": 720 },
            "width": { "min": 300, "max": 1200, "default": 600 },
            "depth": { "min": 300, "max": 500, "default": 400 }
          }
        }
      ]
    },
    {
      "id": "top",
      "name": "Top",
      "description": "Top cabinets and upper storage",
      "icon": "🔝",
      "color": "#10B981",
      "subcategories": [
        { 
          "id": "standard", 
          "name": "Standard",
          "dimensions": {
            "height": { "min": 300, "max": 600, "default": 600 },
            "width": { "min": 300, "max": 1200, "default": 600 },
            "depth": { "min": 200, "max": 400, "default": 300 }
          }
        },
        { 
          "id": "corner", 
          "name": "Corner",
          "dimensions": {
            "height": { "min": 300, "max": 600, "default": 600 },
            "width": { "min": 400, "max": 800, "default": 600 },
            "depth": { "min": 200, "max": 400, "default": 300 }
          }
        },
        { 
          "id": "blind", 
          "name": "Blind",
          "dimensions": {
            "height": { "min": 300, "max": 600, "default": 600 },
            "width": { "min": 200, "max": 400, "default": 300 },
            "depth": { "min": 200, "max": 400, "default": 300 }
          }
        },
        { 
          "id": "wine-rack", 
          "name": "Wine Rack",
          "dimensions": {
            "height": { "min": 300, "max": 600, "default": 600 },
            "width": { "min": 300, "max": 1200, "default": 600 },
            "depth": { "min": 200, "max": 400, "default": 300 }
          }
        }
      ]
    },
    {
      "id": "tall",
      "name": "Tall",
      "description": "Tall cabinets and full-height storage",
      "icon": "📏",
      "color": "#F59E0B",
      "subcategories": [
        { 
          "id": "standard", 
          "name": "Standard",
          "dimensions": {
            "height": { "min": 1800, "max": 3000, "default": 2400 },
            "width": { "min": 300, "max": 1200, "default": 600 },
            "depth": { "min": 300, "max": 600, "default": 600 }
          }
        },
        { 
          "id": "corner", 
          "name": "Corner",
          "dimensions": {
            "height": { "min": 1800, "max": 3000, "default": 2400 },
            "width": { "min": 400, "max": 800, "default": 600 },
            "depth": { "min": 400, "max": 800, "default": 600 }
          }
        },
        { 
          "id": "blind", 
          "name": "Blind",
          "dimensions": {
            "height": { "min": 1800, "max": 3000, "default": 2400 },
            "width": { "min": 200, "max": 400, "default": 300 },
            "depth": { "min": 300, "max": 600, "default": 600 }
          }
        },
        { 
          "id": "wine-rack", 
          "name": "Wine Rack",
          "dimensions": {
            "height": { "min": 1800, "max": 3000, "default": 2400 },
            "width": { "min": 300, "max": 1200, "default": 600 },
            "depth": { "min": 300, "max": 500, "default": 400 }
          }
        },
        { 
          "id": "broom", 
          "name": "Broom",
          "dimensions": {
            "height": { "min": 1800, "max": 3000, "default": 2400 },
            "width": { "min": 200, "max": 400, "default": 300 },
            "depth": { "min": 200, "max": 400, "default": 300 }
          }
        }
      ]
    },
    {
      "id": "wardrobe",
      "name": "Wardrobe",
      "description": "Wardrobe systems and clothing storage",
      "icon": "👔",
      "color": "#8B5CF6",
      "subcategories": [
        { 
          "id": "wardrobe-insert", 
          "name": "Wardrobe Insert",
          "dimensions": {
            "height": { "min": 1800, "max": 3000, "default": 2400 },
            "width": { "min": 400, "max": 1200, "default": 800 },
            "depth": { "min": 400, "max": 800, "default": 600 }
          }
        },
        { 
          "id": "pigeon-holes", 
          "name": "Pigeon Holes",
          "dimensions": {
            "height": { "min": 1800, "max": 3000, "default": 2400 },
            "width": { "min": 300, "max": 800, "default": 600 },
            "depth": { "min": 300, "max": 600, "default": 400 }
          }
        },
        { 
          "id": "shelving", 
          "name": "Shelving",
          "dimensions": {
            "height": { "min": 1800, "max": 3000, "default": 2400 },
            "width": { "min": 400, "max": 1200, "default": 800 },
            "depth": { "min": 400, "max": 800, "default": 600 }
          }
        }
      ]
    },
    {
      "id": "doors",
      "name": "Doors",
      "description": "Cabinet doors and access panels",
      "icon": "🚪",
      "color": "#EF4444",
      "subcategories": [
        { 
          "id": "hinge-doors", 
          "name": "Hinge Doors",
          "dimensions": {
            "height": { "min": 400, "max": 2400, "default": 720 },
            "width": { "min": 200, "max": 800, "default": 400 },
            "depth": { "min": 18, "max": 25, "default": 18 }
          }
        },
        { 
          "id": "drawer-face", 
          "name": "Drawer Face",
          "dimensions": {
            "height": { "min": 100, "max": 200, "default": 150 },
            "width": { "min": 200, "max": 800, "default": 400 },
            "depth": { "min": 18, "max": 25, "default": 18 }
          }
        },
        { 
          "id": "slide-doors", 
          "name": "Slide Doors",
          "dimensions": {
            "height": { "min": 400, "max": 2400, "default": 720 },
            "width": { "min": 200, "max": 800, "default": 400 },
            "depth": { "min": 18, "max": 25, "default": 18 }
          }
        },
        { 
          "id": "bi-fold-door", 
          "name": "Bi Fold Door",
          "dimensions": {
            "height": { "min": 400, "max": 2400, "default": 720 },
            "width": { "min": 400, "max": 1200, "default": 800 },
            "depth": { "min": 18, "max": 25, "default": 18 }
          }
        }
      ]
    },
    {
      "id": "panel-fillers",
      "name": "Panel/Fillers",
      "description": "Filler panels and decorative elements",
      "icon": "🎨",
      "color": "#6B7280",
      "subcategories": [
        { 
          "id": "linear-fillers", 
          "name": "Linear Fillers",
          "dimensions": {
            "height": { "min": 400, "max": 2400, "default": 720 },
            "width": { "min": 50, "max": 200, "default": 100 },
            "depth": { "min": 300, "max": 600, "default": 600 }
          }
        },
        { 
          "id": "l-fillers", 
          "name": "L Fillers",
          "dimensions": {
            "height": { "min": 400, "max": 2400, "default": 720 },
            "width": { "min": 50, "max": 200, "default": 100 },
            "depth": { "min": 300, "max": 600, "default": 600 }
          }
        },
        { 
          "id": "side-panel", 
          "name": "Side Panel",
          "dimensions": {
            "height": { "min": 400, "max": 2400, "default": 720 },
            "width": { "min": 18, "max": 25, "default": 18 },
            "depth": { "min": 300, "max": 600, "default": 600 }
          }
        },
        { 
          "id": "island-panel", 
          "name": "Island Panel",
          "dimensions": {
            "height": { "min": 400, "max": 2400, "default": 720 },
            "width": { "min": 18, "max": 25, "default": 18 },
            "depth": { "min": 300, "max": 600, "default": 600 }
          }
        }
      ]
    }
  ],
  "carcassMaterials": [
    {
      "id": "standard-wood",
      "name": "Standard Wood",
      "description": "Standard wood material for carcass panels",
      "colour": "#8B4513",
      "panelThickness": 18,
      "backThickness": 18,
      "opacity": 0.9,
      "transparent": true
    },
    {
      "id": "premium-wood",
      "name": "Premium Wood",
      "description": "Premium wood material with darker finish",
      "colour": "#654321",
      "panelThickness": 18,
      "backThickness": 18,
      "opacity": 0.95,
      "transparent": true
    },
    {
      "id": "light-wood",
      "name": "Light Wood",
      "description": "Light wood material for modern designs",
      "colour": "#DEB887",
      "panelThickness": 18,
      "backThickness": 18,
      "opacity": 0.9,
      "transparent": true
    },
    {
      "id": "thick-panel",
      "name": "Thick Panel",
      "description": "Thicker panels for heavy-duty applications",
      "colour": "#8B4513",
      "panelThickness": 25,
      "backThickness": 18,
      "opacity": 0.9,
      "transparent": true
    }
  ]
}
