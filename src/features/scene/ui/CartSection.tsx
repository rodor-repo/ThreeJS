import React from "react"
import { ShoppingCart, ChevronDown, Loader2, FolderOpen, Save, User, ShieldCheck } from "lucide-react"
import type { AppMode } from "../context/ModeContext"

interface CartSectionProps {
  totalPrice: number
  onAddToCart: () => void
  onShowProducts: () => void
  onShowMyRooms?: () => void
  onSaveRoom?: () => void
  isLoading?: boolean
  isSaving?: boolean
  isPriceCalculating?: boolean
  appMode?: AppMode
  userEmail?: string | null
  userRole?: AppMode | null
}

export const CartSection: React.FC<CartSectionProps> = (props) => {
  const {
    totalPrice,
    onAddToCart,
    onShowProducts,
    onShowMyRooms,
    onSaveRoom,
    isLoading = false,
    isSaving = false,
    isPriceCalculating = false,
    appMode,
    userEmail,
    userRole,
  } = props

  const isUserMode = appMode === "user"
  const displayEmail = userEmail || "Guest user"
  const showRoleBadge = userRole === "admin"
  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-2 z-10">
      <div className="w-full max-w-xs rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-800 to-blue-700 text-white shadow-2xl border border-white/10 backdrop-blur">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <User size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/70">Signed in</p>
            <p className="text-sm font-semibold truncate" title={displayEmail}>{displayEmail}</p>
            {showRoleBadge && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                <ShieldCheck size={14} />
                Admin
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white/10 px-4 py-2 text-[11px] text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          <span>Cart uses this email for checkout</span>
        </div>
      </div>

      {isUserMode && (
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
      )}

      {isUserMode && onShowMyRooms && (
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

      {isUserMode && onSaveRoom && (
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
          {isPriceCalculating && (
            <Loader2 size={12} className="animate-spin text-gray-400 ml-1" />
          )}
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

