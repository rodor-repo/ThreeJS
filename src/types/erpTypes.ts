type TypeOfGD = "Dim" | "Qty"
export type userType = "Admin" | "Guest" | "Retail" | "Trade"

export type GDThreeJsType =
  | "height"
  | "depth"
  | "width"
  | "kicker"
  | "shelfQty"
  | "doorQty"
  | "drawerQty"
  | "drawerH1"
  | "drawerH2"
  | "drawerH3"
  | "drawerH4"
  | "drawerH5"
  | "widthExt"
  | "depthExt"
  | "fingerPull90"
  | "fingerPullBevel"
  | "doorOverhang"

export type WsProducts = {
  /**
   * GD stands for Global Dimensions
   */
  GDs: {
    [GDId: string]: {
      GD: string
      // subCategoryId: string
      type: TypeOfGD
      userType: "Admin" | "Guest" | "Retail" | "Trade"
      visible: boolean
      threeJsType?: GDThreeJsType
    } & (
      | {
          valueType: "selection"
          defaultValue: number | string
          options: (number | string)[]

          max?: undefined
          min?: undefined
        }
      | {
          valueType: "range"
          defaultValue: number
          max: number
          min: number

          options?: undefined
        }
    )
  }

  GPs: {
    [GPId: string]: {
      GP: string
      // defaultValue: number
      // max: number
      // min: number
      type: TypeOfGD
      // description?: string
      userType: "Admin" | "Guest" | "Retail" | "Trade"
      visible: boolean
    } & (
      | {
          valueType: "selection"
          defaultValue: number | string
          options: (number | string)[]

          max?: undefined
          min?: undefined
        }
      | {
          valueType: "range"
          defaultValue: number
          max: number
          min: number

          options?: undefined
        }
    )
  }

  globalHelps: {
    [helpId: string]: {
      help: string
      description?: string
    }
  }

  GParts: {
    [GPartId: string]: {
      part: string
      QtyId: string

      longDimFormula: (string | number)[]
      longEdge: 0 | 1 | 2
      shortDimFormula: (string | number)[]
      shortEdge: 0 | 1 | 2

      materialType: string

      SQMFormula: (string | number)[]
      LMFormula: (string | number)[]
    }
  }

  /**
   * GSLs stands for General SQMs/LMs
   */

  GSLs: {
    [GSLId: string]: {
      GSL: string
      type: "SQM" | "LM"
      formula: (string | number)[]
    }
  }

  /**
   * GM stands for Global Materials
   */
  GMs: {
    [GMId: string]: {
      GM: string
      priceRangeIds: string[]
      // defaultPriceRangeId: string
      defaultPriceLevel: string
      defaultPriceLevelId: string
      // defaultSKUId: string
      // defaultSKU: string
      defaultColorId: unknown
      defaultColor: unknown
      defaultFinish: unknown
      defaultFinishId: unknown
      defaultThickness: number
      defaultBrandId: string
      defaultMargin: number
      defaultBuyingBoardsPerSQM: number
      defaultBuyingEdgePerLM: number
      defaultColorImgUrl?: string
      defaultColorImgUrlAlt?: string
    }
  }

  /**
   * GH stands for Global Hardwares
   */
  GHs: {
    [GHId: string]: {
      GH: string
      visible: boolean
      materialType: string
      access: userType
      defaultSKUId: string
      defaultSKUGroupId: string
      acceptableCollectionId: string
      hardwareQtyFormula: (string | number)[]
      defaultMargin: number
      defaultBuyingPrice: number
    }
  }

  categories: {
    [categoryId: string]: {
      category: string
      url: string
      description?: string
      indexPhoto?: string
      indexPhotoAlt?: string
      sortNum: string
      SEO: {
        title?: string
        description?: string
        canonicalUrl?: string
        ogTitle?: string
        ogDescription?: string
        ogImageAlt?: string[]
        // scriptTags?: {
        //   [scriptTagId: string]: {
        //     scriptTag: string
        //     content: string
        //     date: Timestamp
        //   }
        // }
      }
    }
  }
  subCategories: {
    [subCategoryId: string]: {
      subCategory: string
      categoryId: string
      description?: string
      /**
       * Url of the image
       */
      sortNum: string
      indexPhoto?: string
      indexPhotoAlt?: string
    }
  }

  designs: {
    [designId: string]: {
      design: string
      subCategoryId: string
      description?: string
      /**
       * Url of the image
       */
      sortNum: string
      indexPhoto?: string
      indexPhotoAlt?: string
    }
  }

  hingeSettings: {
    x2: number
    x3: number
    x4: number
    x5: number
  }
  products: {
    [productId: string]: {
      disabled3D?: boolean
      product: string
      categoryId: string
      subCategoryId: string
      designId: string
      // description?: string
      shortDescription?: string
      sortNum: string
      status: "Active" | "Hidden"
      indexImageAlt?: string[]
      SEO: {
        pageTitle?: string
        metaDescription?: string
        // tags?: string
        tags?: string[]
        canonicalUrl?: string
        ogTitle?: string
        ogDescription?: string
        indexPhotoAlt?: string[]
      }
    }
  }
}

type WsProductMaterialType = "Carcass" | "Door" | "Benchtop"

export type WsProduct = {
  // id: string
  product: string
  productId: string
  categoryId: string
  subCategoryId: string
  designId: string

  sortNum: string
  status: "Active" | "Hidden"

  // application: ("joinerlinx" | "joinershop")[]
  disabled3D?: boolean

  shortDescription?: string
  longDescription?: string
  tipsAndTricks?: string

  SEO: {
    pageTitle?: string
    metaDescription?: string
    tags?: string[]
    canonicalUrl?: string
    ogTitle?: string
    ogDescription?: string
    ogImageUrl?: string
    ogImageUrlAlt?: string
  }

  shapes: {
    [shapeId: string]: {
      imageUrl?: string
      imageUrlAlt?: string
      isIndex: boolean
      sortNum: string
    }
  }

  relatedProducts: {
    [productId: string]: {
      designId: string
      subCategoryId: string
      productId: string
      categoryId: string
      sortNum: string
    }
  }

  costing: {
    fixAddOnCost?: number
    assemblyCost?: number
    costAdjustment?: number
    installationCost?: number
  }
  createdAt: unknown // firestore Timestamp
  dims: {
    [dimId: string]: {
      dim: string
      GDId?: string
      globalHelpId?: string
      materialId: string
      userType: userType
      type: TypeOfGD
      visible: boolean
      dimIndex: string
      sortNum: string
    } & (
      | {
          valueType: "selection"
          defaultValue: number | string
          options: (number | string)[]

          max?: undefined
          min?: undefined
        }
      | {
          valueType: "range"
          defaultValue: number
          max: number
          min: number

          options?: undefined
        }
    )
  }
  hardwares: {
    [hardwareId: string]: {
      hardware: string
      GHId: string
      SKUIds: string[]
    }
  }
  materials: {
    [materialId: string]: {
      material: string
      materialType: WsProductMaterialType
      visible: boolean
      GMId: string
      priceRangeIds: string[]
      defaultColor: string
      sortNum: string
    }
  }
  parts: {
    [partId: string]: {
      part: string
      QtyId: string

      longEdge: 0 | 1 | 2
      longDimFormula: (string | number)[]

      shortEdge: 0 | 1 | 2
      shortDimFormula: (string | number)[]

      /**
       * A material of the same product
       */
      materialId: string

      SQMFormulaId: string
      LMFormulaId: string
    }
  }
}
