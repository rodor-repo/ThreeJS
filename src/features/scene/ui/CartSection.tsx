import React from "react"
import { ShoppingCart, ChevronDown, Loader2, FolderOpen, Save, User, ShieldCheck } from "lucide-react"
import type { AppMode } from "../context/ModeContext"
import _ from "lodash"

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

  const cx = (...classes: Array<string | false | null | undefined>) => _.join(_.compact(classes), ' ')

  return (
    <div className="absolute top-4 right-4 flex flex-col items-end gap-3 z-10 w-72">
      {/* User Info Card */}
      <div className="w-full rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20 overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100">
            <User size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Signed in as</p>
              {showRoleBadge && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  <ShieldCheck size={10} />
                  Admin
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-gray-900 truncate mt-0.5" title={displayEmail}>
              {displayEmail}
            </p>
          </div>
        </div>
        <div className="bg-gray-50/80 px-4 py-2 border-t border-gray-100 flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          <span className="text-[10px] font-medium text-gray-500">Cart uses this email for checkout</span>
        </div>
      </div>

      {/* Price Box */}
      <div
        className="w-full rounded-2xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20 p-4 relative group cursor-pointer transition-transform hover:scale-[1.02]"
        onClick={(e) => {
          e.stopPropagation()
          onShowProducts()
        }}
        data-price-box
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Estimate</span>
          {isPriceCalculating && (
            <Loader2 size={14} className="animate-spin text-indigo-500" />
          )}
        </div>
        <div className="flex items-end justify-between">
          <div className="text-3xl font-black text-gray-900 tracking-tight tabular-nums">
            ${totalPrice.toFixed(2)}
          </div>
          <div className="p-1.5 rounded-lg bg-gray-50 text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
            <ChevronDown size={16} />
          </div>
        </div>
        <div className="text-[10px] font-medium text-gray-400 mt-1">
          Inclusive of GST
        </div>
      </div>

      {/* Action Buttons */}
      {isUserMode && (
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (!isLoading) {
                onAddToCart()
              }
            }}
            disabled={isLoading}
            className={cx(
              "w-full py-3 px-4 rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 font-bold text-sm",
              isLoading
                ? "bg-emerald-50 text-emerald-400 cursor-not-allowed border border-emerald-100"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 hover:shadow-emerald-500/30 border border-transparent"
            )}
            title={isLoading ? "Adding to cart..." : "Add to Cart"}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <ShoppingCart size={18} />
                <span>Add to Cart</span>
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            {onShowMyRooms && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowMyRooms()
                }}
                className="py-2.5 px-3 rounded-xl bg-white/95 backdrop-blur-xl shadow-lg border border-white/20 text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-all duration-200 flex items-center justify-center gap-2 text-xs font-bold"
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
                className={cx(
                  "py-2.5 px-3 rounded-xl bg-white/95 backdrop-blur-xl shadow-lg border border-white/20 text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-all duration-200 flex items-center justify-center gap-2 text-xs font-bold",
                  isSaving && "opacity-70 cursor-not-allowed"
                )}
                title="Save Room Design"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                <span>{isSaving ? "Saving..." : "Save"}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

