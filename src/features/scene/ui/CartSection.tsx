import React from "react"
import { ShoppingCart, ChevronDown } from "lucide-react"

interface CartSectionProps {
  totalPrice: number
  onAddToCart: () => void
  onShowProducts: () => void
}

export const CartSection: React.FC<CartSectionProps> = ({ totalPrice, onAddToCart, onShowProducts }) => {
  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAddToCart()
        }}
        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg transition-colors duration-200 flex items-center gap-2 w-full"
        title="Add to Cart"
      >
        <ShoppingCart size={20} />
        <span>Add to Cart</span>
      </button>

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

