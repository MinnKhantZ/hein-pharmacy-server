# Sales Search, Filter, and Sort Enhancements

## Overview
This document describes the enhancements made to the sales system to support comprehensive search, filtering, and sorting capabilities for sales history.

## Changes Made

### 1. Payment Method Validation Fix

**Problem**: Client was sending `'mobile_wallet'` but server validates against `'cash'`, `'card'`, `'mobile'`, `'credit'`.

**Solution**: Updated client-side payment methods to match server validation.

**Files Modified**:
- `hein-pharmacy-client/app/(tabs)/sales.tsx`
  - Changed payment methods array from `['cash', 'mobile_wallet']` to `['cash', 'card', 'mobile', 'credit']`
  - Updated display logic to show all payment types correctly
  - Added backward compatibility for existing `'mobile_wallet'` records in display

### 2. Customer Phone Display

**Enhancement**: Added customer phone number display in sales history cards.

**Files Modified**:
- `hein-pharmacy-client/app/(tabs)/sales.tsx`
  - Added conditional display of `customer_phone` field after `customer_name`
  - Format: "Phone: {phone_number}"

### 3. Enhanced Server-Side Search

**Enhancement**: Extended sales search to include item names in addition to customer name and phone.

**Files Modified**:
- `hein-pharmacy-server/controllers/salesController.js`
  - Updated search query to include `i.name ILIKE` condition
  - Added EXISTS subquery for count query to properly count sales with matching items
  - Search now finds sales by:
    - Customer name (partial match, case-insensitive)
    - Customer phone (partial match, case-insensitive)
    - Item name (partial match, case-insensitive)

**SQL Changes**:
```sql
-- Main query
AND (s.customer_name ILIKE $1 OR s.customer_phone ILIKE $1 OR i.name ILIKE $1)

-- Count query
AND (s.customer_name ILIKE $1 OR s.customer_phone ILIKE $1 OR EXISTS (
  SELECT 1 FROM sale_items si2
  JOIN inventory_items i2 ON si2.inventory_item_id = i2.id
  WHERE si2.sale_id = s.id AND i2.name ILIKE $1
))
```

### 4. Client-Side Search, Filter, and Sort UI

**Enhancement**: Added comprehensive filtering UI with search, payment method filter, and sort controls.

**Files Modified**:
- `hein-pharmacy-client/app/(tabs)/sales.tsx`

**New State Variables**:
- `salesSearch`: Search query for customer name, phone, or item name
- `paymentFilter`: Payment method filter (all, cash, card, mobile, credit)
- `sortBy`: Sort field (sale_date, total_amount, customer_name)
- `sortOrder`: Sort direction (ASC, DESC)
- `showFilters`: Toggle for showing/hiding filter controls

**New UI Components**:
1. **Search Input**:
   - Placeholder: "Search by customer name, phone, or item..."
   - Debounced search (500ms) to reduce API calls
   - Triggers fetchSalesHistory on change

2. **Filter Toggle Button**:
   - Shows/hides filter controls
   - Text: "▼ Show Filters" / "▲ Hide Filters"

3. **Payment Method Filter**:
   - Horizontal scrollable buttons
   - Options: All, Cash, Card, Mobile, Credit
   - Active filter highlighted in blue

4. **Sort Controls**:
   - Horizontal scrollable buttons
   - Sort fields: Date, Amount, Customer
   - Sort order toggle button (↑ ASC / ↓ DESC)
   - Active sort field highlighted in blue

**New Styles Added**:
- `filterSection`: Container for search and toggle button
- `filterToggleButton`: Button to show/hide filters
- `filterToggleText`: Text style for toggle button
- `filtersContainer`: Container for filter options
- `filterRow`: Row for each filter group
- `filterLabel`: Label for filter groups
- `filterOptions`: Horizontal scroll container for filter buttons
- `filterOption`: Individual filter button
- `filterOptionActive`: Active filter button style
- `filterOptionText`: Filter button text
- `filterOptionTextActive`: Active filter button text
- `sortOrderButton`: Sort order toggle button
- `sortOrderText`: Sort order icon text

### 5. Updated fetchSalesHistory Function

**Enhancement**: Modified to accept and use search, filter, and sort parameters.

**Changes**:
- Added parameters: `salesSearch`, `paymentFilter`, `sortBy`, `sortOrder`
- Conditionally adds search parameter if not empty
- Conditionally adds payment_method filter if not 'all'
- Always includes sortBy and sortOrder parameters
- Dependencies updated to trigger re-fetch on parameter changes

**Debouncing**:
- Added useEffect with 500ms debounce for search, filter, and sort changes
- Reduces API calls while user is typing or changing filters

## API Endpoint Parameters

### GET `/api/sales`

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `search` (string, optional): Search by customer name, phone, or item name
- `payment_method` (string, optional): Filter by payment method (cash, card, mobile, credit)
- `sortBy` (string, optional): Sort field (sale_date, total_amount, payment_method, customer_name)
- `sortOrder` (string, optional): Sort direction (ASC, DESC)
- `start_date` (string, optional): Filter by start date
- `end_date` (string, optional): Filter by end date
- `owner_id` (number, optional): Filter by owner ID

**Response**:
```json
{
  "sales": [
    {
      "id": 1,
      "total_amount": "150.00",
      "payment_method": "mobile",
      "customer_name": "John Doe",
      "customer_phone": "555-1234",
      "notes": "Sample note",
      "sale_date": "2024-01-15T10:30:00Z",
      "items": [
        {
          "id": 1,
          "item_name": "Product A",
          "quantity": 2,
          "unit_price": "50.00",
          "total_price": "100.00",
          "owner_name": "Owner Name"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

## User Experience Improvements

1. **Real-time Search**: Users can search sales by customer name, phone, or item name with immediate feedback (500ms debounce)

2. **Flexible Filtering**: Users can filter sales by payment method to quickly find cash, card, mobile, or credit transactions

3. **Custom Sorting**: Users can sort sales by date, amount, or customer name in ascending or descending order

4. **Collapsible Filters**: Filter controls can be hidden to provide more screen space for the sales list

5. **Visual Feedback**: Active filters and sort options are highlighted in blue for easy identification

6. **Lazy Loading**: Combined with existing pagination, providing smooth infinite scroll experience

7. **Phone Number Display**: Customer phone numbers are now visible in sales history for better customer tracking

## Technical Notes

- All search queries use ILIKE for case-insensitive matching
- Search uses partial matching with % wildcards
- SQL injection protected via parameterized queries
- Sort fields are whitelisted to prevent SQL injection
- Debouncing prevents excessive API calls during user input
- Backward compatibility maintained for old 'mobile_wallet' records

## Testing Recommendations

1. Test search with customer names, phone numbers, and item names
2. Test all payment method filters
3. Test all sort combinations (field + direction)
4. Test debouncing by typing quickly in search
5. Test pagination with filters applied
6. Test toggling filters on/off
7. Test with empty search results
8. Test with special characters in search
9. Verify old sales with 'mobile_wallet' display correctly
10. Verify new sales use correct payment method values

## Future Enhancements

Potential improvements for future versions:
- Date range filter UI (currently only available via API)
- Export filtered sales to CSV/PDF
- Save filter presets
- Advanced search with multiple criteria
- Real-time search (no debounce for faster networks)
- Filter by owner (for multi-owner setups)
- Filter by amount range
- Combined filters (AND/OR logic)
