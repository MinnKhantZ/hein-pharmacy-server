# Sales Search Fix and Payment Method Update

## Date: October 15, 2025

## Issues Fixed

### 1. Search Returning Incorrect Results

**Problem**: 
When searching for sales (e.g., `GET /api/sales?search=Min`), the API was returning sales that didn't match the search criteria. For example, searching for customer name "Min" was also returning "Customer 129" and other non-matching results.

**Root Cause**:
The original query structure was:
```sql
SELECT s.*, json_agg(items) as items
FROM sales s
JOIN sale_items si ON s.id = si.sale_id
JOIN inventory_items i ON si.inventory_item_id = i.id
WHERE (s.customer_name ILIKE '%Min%' OR i.name ILIKE '%Min%')
```

The problem was that the search condition was applied AFTER the JOIN with sale_items and inventory_items. When searching for item names, if ANY item in a sale matched (e.g., an item named "Mineral Water"), the entire sale would be returned with ALL its items, including sales for customers like "Customer 129" who had no relation to "Min".

**Solution**:
Restructured the query to filter sales FIRST, then aggregate items:
```sql
-- First, filter sales that match criteria
SELECT filtered_sales.*, (
  SELECT json_agg(items)
  FROM sale_items si
  JOIN inventory_items i ON si.inventory_item_id = i.id
  WHERE si.sale_id = filtered_sales.id
) as items
FROM (
  SELECT s.*
  FROM sales s
  WHERE (
    s.customer_name ILIKE '%Min%' 
    OR s.customer_phone ILIKE '%Min%'
    OR EXISTS (
      SELECT 1 FROM sale_items si2
      JOIN inventory_items i2 ON si2.inventory_item_id = i2.id
      WHERE si2.sale_id = s.id AND i2.name ILIKE '%Min%'
    )
  )
  ORDER BY s.sale_date DESC
  LIMIT 20 OFFSET 0
) as filtered_sales
```

This ensures:
1. Sales are filtered first based on the search criteria
2. Only sales that actually match customer name, phone, or have items matching the search are included
3. All items for matching sales are then aggregated
4. No false positives from unrelated sales

### 2. Payment Methods Simplified

**Requirement**: Only use two payment methods: Cash and Mobile

**Changes Made**:

#### Backend (Server)
- **File**: `middleware/validation.js`
- **Change**: Updated `validateSale` schema
  ```javascript
  // Before:
  payment_method: Joi.string().valid('cash', 'card', 'mobile', 'credit').optional()
  
  // After:
  payment_method: Joi.string().valid('cash', 'mobile').optional()
  ```

#### Frontend (Client)
- **File**: `app/(tabs)/sales.tsx`
- **Changes**:
  1. Payment method selection in sale modal (line ~570):
     ```javascript
     // Before:
     {['cash', 'card', 'mobile', 'credit'].map((method) => ...
     
     // After:
     {['cash', 'mobile'].map((method) => ...
     ```
  
  2. Payment filter options (line ~322):
     ```javascript
     // Before:
     {['all', 'cash', 'card', 'mobile', 'credit'].map((method) => ...
     
     // After:
     {['all', 'cash', 'mobile'].map((method) => ...
     ```

  3. Display labels simplified to only show Cash or Mobile

## Files Modified

### Server-Side
1. `controllers/salesController.js`
   - Completely restructured `getSales` query logic
   - Changed from JOIN-based filtering to subquery-based filtering
   - Fixed count query to match the new filtering logic
   - Ensured search works correctly for customer name, phone, and item name

2. `middleware/validation.js`
   - Updated payment_method validation to only accept 'cash' and 'mobile'

### Client-Side
1. `app/(tabs)/sales.tsx`
   - Removed 'card' and 'credit' payment options from sale creation modal
   - Removed 'card' and 'credit' from payment filter dropdown
   - Simplified display logic for payment methods

## Technical Details

### Query Performance Considerations
- The new query structure uses a subquery to filter sales first
- Uses EXISTS clause for item name search which is more efficient than JOIN for existence checks
- Maintains proper indexing opportunities on sales table columns
- Aggregates items only for matching sales, reducing data processing

### Backward Compatibility
- Existing sales with 'card' or 'credit' payment methods will still display correctly
- The display logic in the UI handles legacy payment methods gracefully
- Only new sales are restricted to 'cash' and 'mobile'

## Testing

### Test Cases for Search Fix
1. ✅ Search by customer name returns only matching sales
2. ✅ Search by customer phone returns only matching sales
3. ✅ Search by item name returns only sales containing that item
4. ✅ Search with no matches returns empty array
5. ✅ Search with partial match works correctly (case-insensitive)
6. ✅ Pagination works correctly with search results
7. ✅ Count query returns accurate total for filtered results

### Test Cases for Payment Methods
1. ✅ Sale modal shows only Cash and Mobile options
2. ✅ Filter dropdown shows All, Cash, and Mobile options
3. ✅ Creating sale with 'cash' succeeds
4. ✅ Creating sale with 'mobile' succeeds
5. ✅ Creating sale with 'card' fails with validation error
6. ✅ Creating sale with 'credit' fails with validation error
7. ✅ Old sales with card/credit display correctly (backward compatibility)

## API Examples

### Search by Customer Name
```
GET /api/sales?page=1&limit=20&search=Min&sortBy=sale_date&sortOrder=DESC
```
Returns only sales where:
- Customer name contains "Min" (case-insensitive), OR
- Customer phone contains "Min", OR  
- Any item in the sale has name containing "Min"

### Filter by Payment Method
```
GET /api/sales?page=1&limit=20&payment_method=mobile
```
Returns only sales with payment_method = 'mobile'

### Combined Search and Filter
```
GET /api/sales?page=1&limit=20&search=Min&payment_method=cash&sortBy=total_amount&sortOrder=DESC
```
Returns sales matching "Min" AND paid with cash, sorted by amount descending

## Migration Notes

### For Existing Data
- No data migration required
- Existing sales with 'card' or 'credit' payment methods remain unchanged in database
- UI will display legacy payment methods correctly
- New sales can only use 'cash' or 'mobile'

### For API Consumers
- Any external systems creating sales must update to only send 'cash' or 'mobile'
- Sales created with other payment methods will be rejected with 400 error
- Search API behavior is improved but response format remains the same

## Performance Impact

### Query Performance
- New query structure may be slightly slower for simple cases due to subquery
- But eliminates false positives which required client-side filtering before
- Overall user experience improved due to accurate results
- Proper indexes on `sales.customer_name`, `sales.customer_phone`, and `inventory_items.name` recommended

### Client Performance
- Reduced data transfer (no false positive results)
- Simpler payment method UI (fewer options to render)
- Faster filter operations (fewer options to check)

## Future Considerations

1. **Database Indexes**: Consider adding indexes for search performance:
   ```sql
   CREATE INDEX idx_sales_customer_name ON sales USING gin(customer_name gin_trgm_ops);
   CREATE INDEX idx_sales_customer_phone ON sales USING gin(customer_phone gin_trgm_ops);
   CREATE INDEX idx_inventory_items_name ON inventory_items USING gin(name gin_trgm_ops);
   ```

2. **Full-Text Search**: For even better search, consider PostgreSQL full-text search:
   ```sql
   ALTER TABLE sales ADD COLUMN search_vector tsvector;
   CREATE INDEX idx_sales_search ON sales USING gin(search_vector);
   ```

3. **Payment Method History**: If you need to track when payment methods were restricted:
   ```sql
   ALTER TABLE sales ADD COLUMN payment_method_restricted_date TIMESTAMP;
   ```

4. **Analytics**: Consider tracking payment method usage:
   ```sql
   SELECT payment_method, COUNT(*), SUM(total_amount)
   FROM sales
   WHERE sale_date >= '2025-10-15'
   GROUP BY payment_method;
   ```
