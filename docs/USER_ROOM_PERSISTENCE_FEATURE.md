# User Room Persistence (Feature)

This feature lets end-users save their room configuration (based on an admin template) and later reload it to continue editing and/or update the same webshop project/cart.

## What’s included

- Save a user room (manually via UI)
- Auto-save a user room after a successful **Add to Cart**
- List saved rooms by user email (“My Rooms”)
- Load a saved room into the 3D scene
- Delete a saved room (with email ownership check)
- Re-use an existing webshop project via `projectId` when re-adding to cart (updates the existing project)

## Storage model (Firestore)

User rooms are stored per company:

- Collection: `companies/{companyId}/wsUserRooms`
- Document: `{userRoomId}` (Firestore auto-ID for new rooms)

### Types

The canonical types live in [src/data/savedRooms.ts](src/data/savedRooms.ts).

- `SavedRoom`: serialized room state (walls, cabinets, views, syncs)
- `UserSavedRoom extends SavedRoom`: adds user/project/template metadata
- `UserRoomListItem`: minimal fields used for the “My Rooms” list

Key user-room fields:

- `userEmail` (normalized to lowercase + trimmed when saved)
- `originalRoomId`: admin template room ID the user started from
- `originalRoomName`: template display name
- `projectName`: user-friendly project label
- `projectId?`: webshop project ID returned from Add to Cart
- `createdAt`, `updatedAt` (ISO strings)

## Server actions

All server actions use the Admin SDK (`getAdminDb()`), so Firestore security rules do not apply.

- Save/create: [src/server/rooms/saveUserRoom.ts](src/server/rooms/saveUserRoom.ts)

  - Creates new doc when `userRoomId` is not provided
  - Updates existing doc when `userRoomId` is provided
  - Normalizes `userEmail` to `toLowerCase().trim()`

- List by email: [src/server/rooms/getUserRoomsList.ts](src/server/rooms/getUserRoomsList.ts)

  - Query: `.where("userEmail", "==", normalizedEmail)`
  - Uses `.select(...)` to fetch only list fields
  - Sorts by `updatedAt` **client-side** (avoids needing a Firestore composite index)

- Load by ID: [src/server/rooms/getUserRoom.ts](src/server/rooms/getUserRoom.ts)

  - Fetches full document data

- Delete by ID + email: [src/server/rooms/deleteUserRoom.ts](src/server/rooms/deleteUserRoom.ts)
  - Fetches the doc first, verifies `data.userEmail` matches the provided email (normalized)

## Client integration

### React Query hooks

Client hooks wrap the server actions in React Query:

- [src/hooks/useUserRoomsQuery.ts](src/hooks/useUserRoomsQuery.ts)
  - `useUserRoomsList(email)`: list query (email must contain `@`)
  - `useLoadUserRoom()`: imperative load by room ID
  - `useSaveUserRoom()`: save/update mutation (invalidates list)
  - `useDeleteUserRoom()`: delete mutation (optimistic list update)

### Scene wiring

The primary integration is in [src/features/scene/ThreeScene.tsx](src/features/scene/ThreeScene.tsx):

- Maintains `currentUserRoom` state (when set, the app is effectively in “user room mode”)
- **Add to Cart** flow:

  - Calls `addToCart(items, projectName, userEmail, currentUserRoom?.projectId)`
  - On success, serializes the current room state and calls `saveUserRoomMutation.mutateAsync(...)`
  - The room save is wrapped in a nested `try/catch` so a save failure does not break add-to-cart success

- **Save Room** flow:

  - Opens a modal to capture `userEmail` + `projectName`
  - Saves the serialized room without calling add-to-cart

- **My Rooms** flow:
  - Opens a modal to search rooms by email
  - Loads a selected room via `loadUserRoomMutation`, then calls `loadRoom(userRoom)` and `resetHistory(userRoom)`

### UI entry points

- Top-right controls: [src/features/scene/ui/CartSection.tsx](src/features/scene/ui/CartSection.tsx)

  - **Add to Cart**
  - **My Rooms** (opens room list)
  - **Save Room** (saves without add-to-cart)

- Add-to-cart modal: [src/features/scene/ui/AddToCartModal.tsx](src/features/scene/ui/AddToCartModal.tsx)

  - Reads email from `initialEmail` (if provided) or `localStorage.userEmail`
  - Prefills project name from `initialProjectName` (first open) or a date-based default
  - Shows “Updating existing project” when `isUserRoomMode` is true

- Save-room modal: [src/features/scene/ui/SaveRoomModal.tsx](src/features/scene/ui/SaveRoomModal.tsx)

  - Similar prefill behavior, stores `localStorage.userEmail` on confirm

- My Rooms modal: [src/features/scene/ui/UserRoomsModal.tsx](src/features/scene/ui/UserRoomsModal.tsx)
  - Email search, list results, delete with confirmation

## Webshop integration behavior

The add-to-cart server call supports updating an existing webshop project:

- [src/server/addToCart.ts](src/server/addToCart.ts)
  - Request body includes `projectId` when provided
  - If `projectId` is omitted, the webshop creates a new project

When a user room is loaded, subsequent Add to Cart calls will pass `currentUserRoom.projectId`, so the same project is updated instead of creating a new one.

## Operational notes / constraints

- Email-based ownership: deletion requires matching email, but list queries are also email-driven.

  - Because these are server actions using Admin SDK, the app currently relies on the UI/email entry for access control.
  - If you need stronger security, add authenticated user identity and enforce it server-side.

- Firestore indexing:
  - The list query is intentionally implemented without `orderBy` (then sorted client-side), so it avoids requiring a composite index.
  - If you later change it to `where(userEmail)==...` + `orderBy(updatedAt, desc)`, you’ll need a composite index on `userEmail` + `updatedAt`.

## Quick manual test checklist

- Save Room creates a new entry and appears in My Rooms
- Add to Cart succeeds and (best-effort) saves/updates the user room
- Loading a saved room restores cabinets/views/walls and resets history
- Re-adding to cart after loading updates the existing webshop project (uses `projectId`)
- Deleting a room removes it from the list and from Firestore
