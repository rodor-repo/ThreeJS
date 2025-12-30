export const SESSION_COOKIE_NAME = "threejs_session"
export const BRIDGE_NONCE_COOKIE_NAME = "bridge_nonce"

export const DEFAULT_SESSION_TTL_SECONDS = 2 * 60 * 60
export const BRIDGE_STATE_TTL_SECONDS = 5 * 60
export const BRIDGE_NONCE_TTL_SECONDS = 10 * 60

export type BridgeProvider = "webshop" | "controlpanel"
export const DEFAULT_BRIDGE_PROVIDER: BridgeProvider = "webshop"

export const BRIDGE_CALLBACK_PATH = "/api/auth/bridge/callback"
export const BRIDGE_START_PATH = "/api/3D/three-js/auth-bridge/start"
export const BRIDGE_EXCHANGE_PATH = "/api/3D/three-js/auth-bridge/exchange"
