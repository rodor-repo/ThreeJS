'use client'

import React, { useState } from 'react'
import { getCategoriesAndSubCategoriesAction } from '../server/getCategoriesAction'

interface CategoryData {
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
  }
}

interface SubCategoryData {
  subCategory: string
  categoryId: string
  description?: string
  sortNum: string
  indexPhoto?: string
  indexPhotoAlt?: string
}

const FetchCategoriesComponent: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<{
    categories: { [categoryId: string]: CategoryData }
    subCategories: { [subCategoryId: string]: SubCategoryData }
  } | null>(null)

  const handleFetchCategories = async () => {
    setLoading(true)
    setError(null)
    try {
      const fetchedData = await getCategoriesAndSubCategoriesAction()
      setData(fetchedData)
      console.log('Fetched categories:', fetchedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories')
      console.error('Error fetching categories:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col items-center space-y-2">
      <button
        onClick={handleFetchCategories}
        disabled={loading}
        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-md transition-colors duration-150"
      >
        {loading ? 'Fetching...' : 'Get categories from firebase'}
      </button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {data && (
        <div className="w-full max-h-64 overflow-y-auto border border-gray-300 rounded-md p-2 bg-gray-50">
          <h3 className="font-semibold text-gray-800 mb-2">Actual Categories & Subcategories from Database:</h3>
          <div className="space-y-2">
            {Object.entries(data.categories).map(([categoryId, category]) => {
              const categorySubs = Object.values(data.subCategories)
                .filter((sub) => sub.categoryId === categoryId)

              return (
                <div key={categoryId} className="border-b border-gray-200 pb-2">
                  <h4 className="font-medium text-gray-700">{category.category}</h4>
                  {categorySubs.length > 0 ? (
                    <ul className="ml-4 list-disc list-inside text-sm text-gray-600">
                      {categorySubs.map((sub, subIndex) => (
                        <li key={subIndex}>{sub.subCategory}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="ml-4 text-sm text-gray-500 italic">no subcategories found!</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default FetchCategoriesComponent