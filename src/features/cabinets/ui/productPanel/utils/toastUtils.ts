import _ from "lodash"
import toast from "react-hot-toast"

/**
 * Throttled toast to prevent spam when user drags sliders rapidly.
 * Only shows one error toast per second, preventing UI spam during
 * rapid slider movements that hit validation limits.
 */
export const toastThrottled = _.throttle(
  (message: string) => toast.error(message),
  1000,
  { leading: true, trailing: false }
)
