# Quick Reference: Server-Side Filtering API

## Inventory API

### Endpoint
`GET /api/inventory`

### Available Filters & Sorting

| Parameter | Type | Options/Description | Example |
|-----------|------|---------------------|---------|
| `search` | string | Searches name, description, barcode | `?search=aspirin` |
| `category` | string | Exact category match | `?category=Medicine` |
| `owner_id` | integer | Filter by owner | `?owner_id=2` |
| `sortBy` | string | `name`, `quantity`, `unit_price`, `selling_price`, `created_at`, `category` | `?sortBy=name` |
| `sortOrder` | string | `ASC`, `DESC` | `?sortOrder=ASC` |
| `page` | integer | Page number (default: 1) | `?page=2` |
| `limit` | integer | Items per page (default: 20) | `?limit=50` |

### Common Use Cases

**Search for items:**
```javascript
inventoryAPI.getItems({ search: 'paracetamol' })
```

**Filter by owner and category:**
```javascript
inventoryAPI.getItems({ 
  owner_id: 2, 
  category: 'Medicine' 
})
```

**Sort by quantity (low stock first):**
```javascript
inventoryAPI.getItems({ 
  sortBy: 'quantity', 
  sortOrder: 'ASC' 
})
```

**Sort by name alphabetically:**
```javascript
inventoryAPI.getItems({ 
  sortBy: 'name', 
  sortOrder: 'ASC' 
})
```

**Combine search, filter, and sort:**
```javascript
inventoryAPI.getItems({ 
  search: 'medicine',
  category: 'Medicine',
  owner_id: 3,
  sortBy: 'selling_price',
  sortOrder: 'DESC'
})
```

---

## Sales API

### Endpoint
`GET /api/sales`

### Available Filters & Sorting

| Parameter | Type | Options/Description | Example |
|-----------|------|---------------------|---------|
| `search` | string | Searches customer name and phone | `?search=john` |
| `start_date` | string | Date from (YYYY-MM-DD) | `?start_date=2024-01-01` |
| `end_date` | string | Date to (YYYY-MM-DD) | `?end_date=2024-12-31` |
| `owner_id` | integer | Filter by owner | `?owner_id=2` |
| `payment_method` | string | `cash`, `card`, `mobile_wallet` | `?payment_method=cash` |
| `sortBy` | string | `sale_date`, `total_amount`, `payment_method`, `customer_name` | `?sortBy=total_amount` |
| `sortOrder` | string | `ASC`, `DESC` | `?sortOrder=DESC` |
| `page` | integer | Page number (default: 1) | `?page=2` |
| `limit` | integer | Items per page (default: 20) | `?limit=50` |

### Common Use Cases

**Get today's sales:**
```javascript
const today = new Date().toISOString().split('T')[0];
salesAPI.getSales({ 
  start_date: today, 
  end_date: today 
})
```

**Search customer:**
```javascript
salesAPI.getSales({ search: 'john' })
```

**Filter by payment method:**
```javascript
salesAPI.getSales({ payment_method: 'cash' })
```

**Sort by amount (highest first):**
```javascript
salesAPI.getSales({ 
  sortBy: 'total_amount', 
  sortOrder: 'DESC' 
})
```

**Get sales for date range:**
```javascript
salesAPI.getSales({ 
  start_date: '2024-01-01',
  end_date: '2024-03-31',
  sortBy: 'sale_date',
  sortOrder: 'DESC'
})
```

**Combine multiple filters:**
```javascript
salesAPI.getSales({ 
  start_date: '2024-01-01',
  payment_method: 'cash',
  owner_id: 2,
  sortBy: 'total_amount',
  sortOrder: 'DESC'
})
```

---

## Other Endpoints

### Get Owners
`GET /api/inventory/owners`

Returns list of all active owners for dropdown filters.

```javascript
inventoryAPI.getOwners()
```

**Response:**
```json
[
  { "id": 1, "username": "admin", "full_name": "Administrator" },
  { "id": 2, "username": "john", "full_name": "John Doe" }
]
```

### Get Categories
`GET /api/inventory/categories`

Returns list of all unique categories.

```javascript
inventoryAPI.getCategories()
```

**Response:**
```json
["Medicine", "Supplies", "Equipment"]
```

---

## Client-Side Implementation Pattern

### React Component Example

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [filterCategory, setFilterCategory] = useState('');
const [filterOwner, setFilterOwner] = useState('');
const [sortBy, setSortBy] = useState('name');
const [sortOrder, setSortOrder] = useState('ASC');

// Fetch with useCallback to handle dependencies
const fetchItems = useCallback(async () => {
  const params: any = { sortBy, sortOrder };
  
  if (searchQuery.trim()) params.search = searchQuery.trim();
  if (filterCategory) params.category = filterCategory;
  if (filterOwner) params.owner_id = filterOwner;
  
  const response = await inventoryAPI.getItems(params);
  setItems(response.data.items);
}, [searchQuery, filterCategory, filterOwner, sortBy, sortOrder]);

// Trigger fetch when filters change
useEffect(() => {
  fetchItems();
}, [fetchItems]);
```

---

## Performance Tips

1. **Debounce search input** - Don't fetch on every keystroke
```javascript
const debouncedSearch = useDebounce(searchQuery, 500);
useEffect(() => {
  fetchItems();
}, [debouncedSearch]);
```

2. **Use pagination** - Don't load all items at once
```javascript
const [page, setPage] = useState(1);
inventoryAPI.getItems({ page, limit: 20 });
```

3. **Cache filter options** - Load owners/categories once
```javascript
useEffect(() => {
  fetchOwners();
  fetchCategories();
}, []); // Run only once
```

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Error message description"
}
```

Handle errors gracefully:

```javascript
try {
  const response = await inventoryAPI.getItems(params);
  setItems(response.data.items);
} catch (error) {
  Alert.alert('Error', error.response?.data?.error || 'Failed to fetch items');
}
```

---

## Testing Examples

### Using curl

**Test inventory search:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/inventory?search=medicine&sortBy=name&sortOrder=ASC"
```

**Test sales filter:**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5000/api/sales?payment_method=cash&sortBy=total_amount&sortOrder=DESC"
```

### Using Postman/Thunder Client

1. Set Authorization header: `Bearer YOUR_TOKEN`
2. Add query parameters as needed
3. Send GET request
4. Verify response matches expected format

---

## Migration Notes

### Before (Client-Side Filtering)
```javascript
// ❌ Old way - filters in client
const filtered = items.filter(item => 
  item.name.includes(search) && 
  item.category === category
);
```

### After (Server-Side Filtering)
```javascript
// ✅ New way - filters on server
const response = await inventoryAPI.getItems({
  search,
  category,
  sortBy: 'name',
  sortOrder: 'ASC'
});
```

**Benefits:**
- Faster for large datasets
- Reduced memory usage
- Better mobile performance
- Consistent sorting across devices
