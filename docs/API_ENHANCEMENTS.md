# API Enhancements - Search, Filter, and Sort

This document describes the server-side search, filter, and sort capabilities added to the Inventory and Sales APIs.

## Inventory API Enhancements

### GET /api/inventory

Enhanced endpoint to retrieve inventory items with server-side search, filter, and sort capabilities.

#### Query Parameters

| Parameter | Type | Description | Default | Example |
|-----------|------|-------------|---------|---------|
| `page` | number | Page number for pagination | 1 | `?page=2` |
| `limit` | number | Number of items per page | 20 | `?limit=50` |
| `search` | string | Search in name, description, or barcode | - | `?search=aspirin` |
| `category` | string | Filter by category | - | `?category=Medicine` |
| `owner_id` | number | Filter by owner ID | - | `?owner_id=3` |
| `sortBy` | string | Sort field: `name`, `quantity`, `unit_price`, `selling_price`, `created_at`, `category` | `created_at` | `?sortBy=name` |
| `sortOrder` | string | Sort direction: `ASC` or `DESC` | `DESC` | `?sortOrder=ASC` |

#### Examples

**Sort by name (alphabetically):**
```
GET /api/inventory?sortBy=name&sortOrder=ASC
```

**Filter by category and sort by quantity:**
```
GET /api/inventory?category=Medicine&sortBy=quantity&sortOrder=ASC
```

**Search and filter by owner:**
```
GET /api/inventory?search=paracetamol&owner_id=2
```

**Sort by price (highest first):**
```
GET /api/inventory?sortBy=selling_price&sortOrder=DESC
```

#### Response
```json
{
  "items": [
    {
      "id": 1,
      "name": "Product Name",
      "description": "Product description",
      "category": "Category",
      "quantity": 100,
      "unit_price": 10.50,
      "selling_price": 15.00,
      "minimum_stock": 10,
      "owner_id": 1,
      "owner_name": "Owner Full Name",
      "owner_username": "owner_username",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

### GET /api/inventory/owners

New endpoint to retrieve all active owners for filtering purposes.

#### Response
```json
[
  {
    "id": 1,
    "username": "admin",
    "full_name": "Administrator"
  },
  {
    "id": 2,
    "username": "john_doe",
    "full_name": "John Doe"
  }
]
```

### GET /api/inventory/categories

Retrieve all unique categories.

#### Response
```json
["Medicine", "Supplies", "Equipment"]
```

---

## Sales API Enhancements

### GET /api/sales

Enhanced endpoint to retrieve sales with server-side search, filter, and sort capabilities.

#### Query Parameters

| Parameter | Type | Description | Default | Example |
|-----------|------|-------------|---------|---------|
| `page` | number | Page number for pagination | 1 | `?page=2` |
| `limit` | number | Number of items per page | 20 | `?limit=50` |
| `start_date` | string | Filter sales from this date (YYYY-MM-DD) | - | `?start_date=2024-01-01` |
| `end_date` | string | Filter sales until this date (YYYY-MM-DD) | - | `?end_date=2024-12-31` |
| `owner_id` | number | Filter by owner ID | - | `?owner_id=3` |
| `search` | string | Search in customer name or phone | - | `?search=John` |
| `payment_method` | string | Filter by payment method: `cash`, `card`, `mobile` | - | `?payment_method=cash` |
| `sortBy` | string | Sort field: `sale_date`, `total_amount`, `payment_method`, `customer_name` | `sale_date` | `?sortBy=total_amount` |
| `sortOrder` | string | Sort direction: `ASC` or `DESC` | `DESC` | `?sortOrder=ASC` |

#### Examples

**Sort by total amount (highest first):**
```
GET /api/sales?sortBy=total_amount&sortOrder=DESC
```

**Filter by date range:**
```
GET /api/sales?start_date=2024-01-01&end_date=2024-12-31
```

**Search customer and filter by payment method:**
```
GET /api/sales?search=john&payment_method=cash
```

**Filter by owner and sort by date:**
```
GET /api/sales?owner_id=2&sortBy=sale_date&sortOrder=ASC
```

**Combine multiple filters:**
```
GET /api/sales?start_date=2024-01-01&payment_method=card&sortBy=total_amount&sortOrder=DESC
```

#### Response
```json
{
  "sales": [
    {
      "id": 1,
      "total_amount": 150.00,
      "payment_method": "cash",
      "customer_name": "John Doe",
      "customer_phone": "1234567890",
      "notes": "Sale notes",
      "sale_date": "2024-10-15T10:30:00Z",
      "items": [
        {
          "id": 1,
          "inventory_item_id": 5,
          "item_name": "Product Name",
          "quantity": 2,
          "unit_price": 75.00,
          "total_price": 150.00,
          "owner_id": 1,
          "owner_name": "Owner Name"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

---

## Implementation Notes

### Security
- All sort fields are validated against a whitelist to prevent SQL injection
- Sort order is validated to only accept 'ASC' or 'DESC'
- Search queries use parameterized queries with ILIKE for case-insensitive matching

### Performance Considerations
- Pagination is always enforced (default 20 items per page)
- Indexes should be added to frequently sorted/filtered columns:
  - `inventory_items.name`
  - `inventory_items.quantity`
  - `inventory_items.selling_price`
  - `inventory_items.category`
  - `sales.sale_date`
  - `sales.total_amount`
  - `sales.payment_method`

### Client Integration
Update your API calls to include the new query parameters:

```javascript
// Inventory example
const response = await inventoryAPI.getItems({
  search: 'medicine',
  category: 'Medicine',
  owner_id: 2,
  sortBy: 'name',
  sortOrder: 'ASC',
  page: 1,
  limit: 20
});

// Sales example
const response = await salesAPI.getSales({
  search: 'john',
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  payment_method: 'cash',
  sortBy: 'total_amount',
  sortOrder: 'DESC',
  page: 1,
  limit: 20
});
```
