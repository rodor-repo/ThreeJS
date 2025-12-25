import React from "react"
import { ShoppingCart, ChevronDown, Loader2, FolderOpen, Save } from "lucide-react"

interface CartSectionProps {
  totalPrice: number
  onAddToCart: () => void
  onShowProducts: () => void
  onShowMyRooms?: () => void
  onSaveRoom?: () => void
  isLoading?: boolean
  isSaving?: boolean
}

export const CartSection: React.FC<CartSectionProps> = ({
  totalPrice,
  onAddToCart,
  onShowProducts,
  onShowMyRooms,
  onSaveRoom,
  isLoading = false,
  isSaving = false,
}) => {
  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10">
      <button
        onClick={(e) => {
          e.stopPropagation()
          if (!isLoading) {
            onAddToCart()
          }
        }}
        disabled={isLoading}
        className={`${isLoading
          ? "bg-green-400 cursor-not-allowed"
          : "bg-green-600 hover:bg-green-700"
          } text-white px-6 py-3 rounded-lg shadow-lg transition-colors duration-200 flex items-center justify-center gap-2 w-full`}
        title={isLoading ? "Adding to cart..." : "Add to Cart"}
      >
        {isLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            <span>Adding...</span>
          </>
        ) : (
          <>
            <ShoppingCart size={20} />
            <span>Add to Cart</span>
          </>
        )}
      </button>

      {onShowMyRooms && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShowMyRooms()
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors duration-200 flex items-center justify-center gap-2 w-full text-sm"
          title="View My Saved Rooms"
        >
          <FolderOpen size={16} />
          <span>My Rooms</span>
        </button>
      )}

      {onSaveRoom && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!isSaving) {
              onSaveRoom()
            }
          }}
          disabled={isSaving}
          className={`${isSaving
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-gray-600 hover:bg-gray-700"
            } text-white px-4 py-2 rounded-lg shadow-lg transition-colors duration-200 flex items-center justify-center gap-2 w-full text-sm`}
          title="Save Room Design"
        >
          {isSaving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>Save Room</span>
            </>
          )}
        </button>
      )}

      <div
        className="bg-white px-4 py-1 rounded-lg shadow-lg border border-gray-200 w-full text-center relative"
        data-price-box
      >
        <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
          Total Price
          <span className="text-[8px] font-normal text-gray-500">(Incl GST)</span>
        </div>
        <div className="text-xl font-bold text-gray-800">${totalPrice.toFixed(2)}</div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onShowProducts()
          }}
          className="absolute bottom-1 left-1 p-1 text-gray-500 hover:text-gray-700 transition-colors"
          title="View Products List"
        >
          <ChevronDown size={16} />
        </button>
      </div>
    </div>
  )
}

