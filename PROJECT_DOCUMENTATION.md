# Hein Pharmacy - Project Documentation

## Overview
A comprehensive pharmacy inventory and income management system with multi-owner support, automated income calculation, and analytics with charts.

## Technology Stack

### Backend
- **Framework**: Node.js with Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT tokens with bcryptjs
- **Security**: Helmet, CORS, rate limiting
- **Validation**: Joi schemas

### Frontend
- **Framework**: React Native with Expo Router
- **State Management**: React Context API, React Query
- **HTTP Client**: Axios with interceptors
- **Charts**: react-native-chart-kit
- **Secure Storage**: expo-secure-store

## Features Implemented

### 1. Authentication System
- ✅ User registration with validation
- ✅ Login with JWT token generation
- ✅ Secure token storage
- ✅ Protected routes
- ✅ Auto-login from stored credentials

### 2. Inventory Management
- ✅ Full CRUD operations (Create, Read, Update, Delete)
- ✅ Search and filter functionality
- ✅ Low stock indicators
- ✅ Multi-owner support
- ✅ Pull-to-refresh
- ✅ Category management
- ✅ Price tracking (unit price & selling price)

### 3. Sales Recording
- ✅ Interactive cart system
- ✅ Item search and selection
- ✅ Quantity adjustment with stock validation
- ✅ Customer information capture
- ✅ Multiple payment methods (Cash, Card, Mobile)
- ✅ Notes/memo field
- ✅ Automatic inventory deduction
- ✅ Real-time total calculation

### 4. Income Analytics Dashboard
- ✅ Period filters (Daily, Monthly, Yearly)
- ✅ Summary cards (Total Income, Total Sales)
- ✅ Owner filter
- ✅ **LineChart**: Income trend over time
- ✅ **BarChart**: Income comparison by owner
- ✅ **PieChart**: Income distribution
- ✅ Detailed summary list
- ✅ Pull-to-refresh

### 5. Dashboard
- ✅ Quick action buttons
- ✅ Welcome message with user name
- ✅ Navigation shortcuts

### 6. Profile Management
- ✅ User information display
- ✅ Avatar with initials
- ✅ Logout functionality

## Database Models

### Owner
```javascript
- id (Primary Key)
- username (Unique)
- password (Hashed)
- full_name
- email (Unique)
- phone
- address
```

### InventoryItem
```javascript
- id (Primary Key)
- owner_id (Foreign Key → Owner)
- name
- description
- category
- quantity
- unit_price
- selling_price
- minimum_stock
```

### Sale
```javascript
- id (Primary Key)
- owner_id (Foreign Key → Owner)
- total_amount
- customer_name
- customer_phone
- payment_method
- notes
- sale_date
```

### SaleItem
```javascript
- id (Primary Key)
- sale_id (Foreign Key → Sale)
- inventory_item_id (Foreign Key → InventoryItem)
- owner_id (Foreign Key → Owner)
- quantity
- unit_price
- total_price
```

### IncomeSummary
```javascript
- id (Primary Key)
- owner_id (Foreign Key → Owner)
- period
- total_sales
- total_income
- item_count
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new owner
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user (Protected)
- `PUT /api/auth/profile` - Update profile (Protected)

### Inventory
- `GET /api/inventory` - Get all items (Protected)
- `GET /api/inventory/:id` - Get single item (Protected)
- `POST /api/inventory` - Create new item (Protected)
- `PUT /api/inventory/:id` - Update item (Protected)
- `DELETE /api/inventory/:id` - Delete item (Protected)

### Sales
- `POST /api/sales` - Record new sale (Protected)
- `GET /api/sales` - Get all sales (Protected)
- `GET /api/sales/:id` - Get single sale (Protected)

### Income
- `GET /api/income/summary` - Get income summaries (Protected)
- `GET /api/income/daily` - Get daily income (Protected)
- `GET /api/income/monthly` - Get monthly income (Protected)
- `GET /api/income/by-category` - Income by category (Protected)
- `GET /api/income/top-selling` - Top selling items (Protected)
- `GET /api/income/stats` - Overall statistics (Protected)

## Project Structure

```
hein-pharmacy-server/
├── models/
│   ├── index.js              # Sequelize connection
│   ├── owner.js              # Owner model
│   ├── inventory_item.js     # Inventory model
│   ├── sale.js               # Sale model
│   ├── sale_item.js          # Sale item model
│   └── income_summary.js     # Income summary model
├── controllers/
│   ├── authController.js     # Authentication logic
│   ├── inventoryController.js
│   ├── salesController.js
│   └── incomeController.js
├── middleware/
│   ├── auth.js               # JWT verification
│   └── validation.js         # Joi schemas
├── routes/
│   ├── auth.js
│   ├── inventory.js
│   ├── sales.js
│   └── income.js
├── migrations/
│   └── migrate.js            # Database setup & seeding
└── server.js                 # Express app entry

hein-pharmacy-client/
├── app/
│   ├── _layout.tsx           # Root layout
│   ├── (auth)/
│   │   ├── login.tsx         # Login screen
│   │   └── register.tsx      # Register screen
│   └── (tabs)/
│       ├── _layout.tsx       # Tab navigation
│       ├── dashboard.tsx     # Dashboard
│       ├── inventory.tsx     # Inventory management
│       ├── sales.tsx         # Sales recording
│       ├── income.tsx        # Income analytics
│       └── profile.tsx       # User profile
├── contexts/
│   └── AuthContext.js        # Auth state management
├── services/
│   └── api.js                # API client
└── components/               # Reusable components
```

## Configuration

### Backend Environment Variables
```
PORT=5000
DATABASE_URL=postgresql://username:password@localhost:5432/hein_pharmacy
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

### Frontend Configuration
```javascript
// services/api.js
const API_BASE_URL = 'http://192.168.100.76:5000/api';
```

## Setup Instructions

### Backend Setup
```bash
cd hein-pharmacy-server
npm install
# Configure .env file
npm run migrate    # Setup database and seed data
npm start          # Start server on port 5000
```

### Frontend Setup
```bash
cd hein-pharmacy-client
npm install
npx expo start     # Start Expo development server
```

## Key Features Highlights

### 1. Multi-Owner System
- Each inventory item has an owner
- Sales automatically calculate income per owner
- Owner-specific filtering in analytics

### 2. Automatic Income Calculation
- Sales automatically deduct from inventory
- Income calculated as: (selling_price - unit_price) × quantity
- Pre-aggregated income summaries for performance

### 3. Comprehensive Analytics
- Three types of charts for different insights
- Period-based filtering (daily/monthly/yearly)
- Owner-based filtering
- Real-time data with pull-to-refresh

### 4. Professional UI/UX
- Modern, clean design
- Intuitive navigation
- Loading states and error handling
- Responsive layouts
- Pull-to-refresh on all data screens

## Security Features
- JWT-based authentication
- Password hashing with bcryptjs
- Protected API routes
- Token stored securely in expo-secure-store
- CORS configuration
- Rate limiting on sensitive endpoints
- Helmet for HTTP headers security

## Future Enhancements (Suggested)
- Export reports to PDF/Excel
- Push notifications for low stock
- Barcode scanning for items
- Receipt printing
- Expense tracking
- Multi-currency support
- Role-based access control
- Inventory categories management
- Sales history with filtering
- Advanced analytics (profit margins, trends)

## Development Notes
- Backend runs on port 5000
- All API requests require JWT token (except auth endpoints)
- Sample data is seeded automatically on first migration
- Frontend uses React Query for efficient data fetching
- Charts are horizontally scrollable for large datasets

## Testing Credentials (After Migration)
```
Username: john_doe
Password: password123

Username: jane_smith  
Password: password123
```

## Status
✅ **Project Complete** - All core features implemented and functional
- Backend API fully operational
- Database models and migrations working
- Frontend screens implemented with full functionality
- Charts and analytics operational
- Authentication and authorization working
- Multi-owner income calculation functional
