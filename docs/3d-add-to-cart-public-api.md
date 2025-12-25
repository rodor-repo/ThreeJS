# Add to Cart API Documentation

> **For 3D Web App Development Team**
>
> This API allows your 3D room configurator to add configured products directly to a user's shopping cart on the main webshop.

---

## TL;DR - If You Already Use Calculate-Price API

The **Add to Cart** API uses the **exact same product configuration format** as the Calculate Price API. Here's what's different:

| Aspect           | Calculate Price API                     | Add to Cart API                     |
| ---------------- | --------------------------------------- | ----------------------------------- |
| **Endpoint**     | `POST /api/3D/three-js/calculate-price` | `POST /api/3D/three-js/add-to-cart` |
| **Auth**         | Same `Bearer` token                     | Same `Bearer` token                 |
| **Products**     | Single product config                   | Array of product configs            |
| **User context** | Not needed                              | Requires `userEmail`                |
| **Project name** | Not needed                              | Requires `projectName`              |
| **Response**     | Price details                           | Project & cart item IDs             |

**Quick migration**: Wrap your existing product config in `items` array, add `userEmail` and `projectName`.

---

## API Reference

### Endpoint

```
POST https://your-domain.com/api/3D/three-js/add-to-cart
```

### Authentication

Same as the Calculate Price API - use Bearer token authentication:

```http
Authorization: Bearer YOUR_SECRET_KEY
Content-Type: application/json
```

---

## Request Format

### Full Request Structure

```typescript
interface AddToCartRequest {
  userEmail: string // Customer's email (must have an account)
  projectName: string // Name for the new shopping cart project
  items: ProductConfig[] // Array of product configurations
}

// This is IDENTICAL to the calculate-price request body
interface ProductConfig {
  productId: string
  dimensions: Record<string, number>
  materials: Record<string, MaterialSelection>
  hardwares?: Record<string, string> // hardwareId -> SKUId
  doorExcluded?: boolean
  quantity?: number
}

interface MaterialSelection {
  colorId: string
  finishId: string
  priceRangeId?: string // Optional
}
```

### Example Request

```json
{
  "userEmail": "customer@example.com",
  "projectName": "Kitchen Renovation 2025",
  "items": [
    {
      "productId": "PROD_BASE_CAB_001",
      "dimensions": {
        "1": 600,
        "2": 870,
        "3": 580
      },
      "materials": {
        "mat_carcass_01": {
          "colorId": "CLR_WHITE_001",
          "finishId": "FIN_MATT"
        },
        "mat_door_01": {
          "colorId": "CLR_OAK_002",
          "finishId": "FIN_NATURAL"
        }
      },
      "hardwares": {
        "hw_hinge_01": "SKU_SOFT_CLOSE_HINGE",
        "hw_handle_01": "SKU_BAR_HANDLE_300"
      },
      "doorExcluded": false,
      "quantity": 2
    },
    {
      "productId": "PROD_WALL_CAB_001",
      "dimensions": {
        "1": 400,
        "2": 720
      },
      "materials": {
        "mat_carcass_01": {
          "colorId": "CLR_WHITE_001",
          "finishId": "FIN_MATT"
        }
      },
      "quantity": 4
    }
  ]
}
```

---

## Response Format

### Success Response

```typescript
interface SuccessResponse {
  success: true
  projectId: string // ID of the created shopping cart project
  cartItemIds: string[] // IDs of added cart items (same order as request)
  projectTotals: {
    price: number // Subtotal (sum of all items)
    totalPrice: number // Total including surcharges
    GST: number // GST amount
    surcharge: number // Material minimum order surcharges
  }
  itemsAdded: number // Count of successfully added items
  itemErrors?: ItemError[] // Present only if some items failed
}

interface ItemError {
  index: number // Index in the items array
  productId: string // The product ID that failed
  error: string // Error description
}
```

### Success Example

```json
{
  "success": true,
  "projectId": "9999851234567-project-a1b2c3d4",
  "cartItemIds": [
    "9999851234568-cartItem-e5f6g7h8",
    "9999851234569-cartItem-i9j0k1l2"
  ],
  "projectTotals": {
    "price": 2450.0,
    "totalPrice": 2500.0,
    "GST": 227.27,
    "surcharge": 50.0
  },
  "itemsAdded": 2
}
```

### Partial Success Example

Some items added, some failed:

```json
{
  "success": true,
  "projectId": "9999851234567-project-a1b2c3d4",
  "cartItemIds": ["9999851234568-cartItem-e5f6g7h8"],
  "projectTotals": {
    "price": 1225.0,
    "totalPrice": 1250.0,
    "GST": 113.64,
    "surcharge": 25.0
  },
  "itemsAdded": 1,
  "itemErrors": [
    {
      "index": 1,
      "productId": "PROD_WALL_CAB_001",
      "error": "Missing material colors for required materials"
    }
  ]
}
```

### Error Response

```typescript
interface ErrorResponse {
  success: false
  error: string
  itemErrors?: ItemError[] // If all items failed
}
```

### Error Examples

**User not found:**

```json
{
  "success": false,
  "error": "User not found. User must have an account to add items to cart."
}
```

**No valid items:**

```json
{
  "success": false,
  "error": "No valid items to add",
  "itemErrors": [
    { "index": 0, "productId": "INVALID_PROD", "error": "Product not found" }
  ]
}
```

---

## Side-by-Side Comparison

### Calculate Price API (current usage)

```bash
curl -X POST https://your-domain.com/api/3D/three-js/calculate-price \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "PROD_BASE_CAB_001",
    "dimensions": { "1": 600, "2": 870 },
    "materials": {
      "mat_carcass_01": {
        "colorId": "CLR_WHITE_001",
        "finishId": "FIN_MATT"
      }
    },
    "quantity": 2
  }'
```

### Add to Cart API (new)

```bash
curl -X POST https://your-domain.com/api/3D/three-js/add-to-cart \
  -H "Authorization: Bearer YOUR_SECRET_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userEmail": "customer@example.com",
    "projectName": "Kitchen Renovation",
    "items": [
      {
        "productId": "PROD_BASE_CAB_001",
        "dimensions": { "1": 600, "2": 870 },
        "materials": {
          "mat_carcass_01": {
            "colorId": "CLR_WHITE_001",
            "finishId": "FIN_MATT"
          }
        },
        "quantity": 2
      }
    ]
  }'
```

**Notice**: The product configuration inside `items[0]` is **identical** to the calculate-price request body.

---

## Integration Guide

### Step 1: Collect User Information

Before calling the add-to-cart API, you need:

- `userEmail`: The customer's email (they must have an account on the webshop)
- `projectName`: A meaningful name like "Kitchen Design - Living Room" or auto-generated

### Step 2: Build Product Configurations

You already have this from your calculate-price integration! For each configured product in the 3D scene:

```typescript
const productConfig = {
  productId: product.id,
  dimensions: currentDimensions, // Same as calculate-price
  materials: currentMaterialSelections, // Same format: { colorId, finishId }
  hardwares: currentHardwareSelections, // Same format: hardwareId -> SKUId
  doorExcluded: doorExcludedState,
  quantity: quantityInScene,
}
```

### Step 3: Call the API

```typescript
async function addProductsToCart(
  userEmail: string,
  projectName: string,
  products: ProductConfig[]
): Promise<AddToCartResponse> {
  const response = await fetch("/api/3D/three-js/add-to-cart", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userEmail,
      projectName,
      items: products,
    }),
  })

  return response.json()
}
```

### Step 4: Handle the Response

```typescript
const result = await addProductsToCart(
  userEmail,
  projectName,
  configuredProducts
)

if (result.success) {
  // Show success message
  console.log(`Added ${result.itemsAdded} items to cart`)
  console.log(`Project ID: ${result.projectId}`)
  console.log(`Total: $${result.projectTotals.totalPrice}`)

  // Check for partial failures
  if (result.itemErrors?.length) {
    console.warn("Some items failed:", result.itemErrors)
    // Show warning to user about failed items
  }

  // Redirect user to cart or show confirmation
  window.location.href = "https://your-domain.com/cart"
} else {
  // Show error message
  console.error("Failed to add to cart:", result.error)
}
```

---

## Error Handling Best Practices

### Common Errors and Solutions

| Error                        | Cause                                | Solution                                           |
| ---------------------------- | ------------------------------------ | -------------------------------------------------- |
| `"User not found"`           | Email doesn't match any account      | Prompt user to create account or check email       |
| `"Product not found"`        | Invalid productId                    | Verify product ID against catalog                  |
| `"Missing material colors"`  | Material selection incomplete        | Ensure all visible materials have colorId/finishId |
| `"Price calculation failed"` | Invalid dimensions or material combo | Validate with calculate-price API first            |
| `"Unauthorized"`             | Invalid or missing Bearer token      | Check API key configuration                        |

### Recommended Flow

1. **Validate first**: Use calculate-price API to validate each product before final add-to-cart
2. **Handle partial success**: The API will add valid items even if some fail
3. **Show item errors**: Tell users which specific products failed and why
4. **Retry logic**: For transient errors, implement exponential backoff

---

## TypeScript Types (Copy-Paste Ready)

```typescript
// Request Types
interface AddToCartRequest {
  userEmail: string
  projectName: string
  items: ProductConfig[]
}

interface ProductConfig {
  productId: string
  dimensions: Record<string, number>
  materials: Record<string, MaterialSelection>
  hardwares?: Record<string, string>
  doorExcluded?: boolean
  quantity?: number
}

interface MaterialSelection {
  colorId: string
  finishId: string
  priceRangeId?: string
}

// Response Types
type AddToCartResponse = SuccessResponse | ErrorResponse

interface SuccessResponse {
  success: true
  projectId: string
  cartItemIds: string[]
  projectTotals: {
    price: number
    totalPrice: number
    GST: number
    surcharge: number
  }
  itemsAdded: number
  itemErrors?: ItemError[]
}

interface ErrorResponse {
  success: false
  error: string
  itemErrors?: ItemError[]
}

interface ItemError {
  index: number
  productId: string
  error: string
}
```

---

## Quick Migration Checklist

If you're already using the Calculate Price API, here's your migration checklist:

- [ ] Use the same `Bearer` token (no changes)
- [ ] Change endpoint from `/calculate-price` to `/add-to-cart`
- [ ] Wrap your product config in `items: [...]` array
- [ ] Add `userEmail` to request body
- [ ] Add `projectName` to request body
- [ ] Update response handling for new format
- [ ] Handle `itemErrors` for partial success scenarios
- [ ] Test with a real user email that has an account

---

## FAQ

**Q: Can I add to an existing project instead of creating a new one?**
A: Currently, this API always creates a new project. Future versions may support adding to existing projects.

**Q: What happens if the user doesn't have an account?**
A: The API returns a 404 error. Users must have an account before products can be added to their cart.

**Q: Are prices calculated the same as the calculate-price API?**
A: Yes, the same pricing engine is used. The response prices should match what you get from calculate-price.

**Q: Can I test with a staging/sandbox environment?**
A: Contact the webshop team to set up test credentials and a staging environment.

**Q: What's the rate limit?**
A: Contact the webshop team for current rate limiting policies.

---

## Support

For questions or issues, contact the CabinetWorX development team.
