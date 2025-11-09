# Hein Pharmacy Inventory & Income Manager

A comprehensive pharmacy management system built with React Native (Expo) frontend and Node.js backend with PostgreSQL database.

## Features

### 🏥 Core Features
- **Multi-Owner Inventory Management**: Different pharmacy owners can manage their own inventory items
- **Sales Recording**: Automatically calculates income distribution among owners based on item ownership
- **Income Analytics**: Comprehensive charts and reports with period filters
- **Authentication & Authorization**: Secure login system for each owner

### 📱 Frontend Features
- Cross-platform mobile app (iOS/Android/Web)
- Modern React Native with Expo
- Intuitive user interface
- Real-time data synchronization
- Comprehensive charts and analytics

### 🔧 Backend Features
- RESTful API with Express.js
- PostgreSQL database with optimized queries
- JWT authentication
- Input validation and sanitization
- Rate limiting and security middleware
- Comprehensive error handling
- **Push Notifications**: Expo push notifications for low stock alerts and sales updates
- **Device Management**: Multi-device support with individual notification preferences
- **Advanced Filtering**: Server-side search, filter, and sort for inventory and sales
- **Cron Jobs**: Automated tasks for data maintenance and notifications
- **Lazy Loading**: Efficient data loading with pagination

## Tech Stack

### Frontend
- **React Native** with Expo
- **Expo Router** for navigation
- **React Query** for data fetching
- **Axios** for API calls
- **React Native Chart Kit** for charts
- **Expo Secure Store** for secure token storage

### Backend
- **Node.js** with Express.js
- **PostgreSQL** database
- **JWT** for authentication
- **bcryptjs** for password hashing
- **Joi** for input validation
- **Helmet** for security headers
- **Morgan** for logging

## Project Structure

```
hein-pharmacy-client/          # React Native Frontend
├── app/                       # Expo Router pages
│   ├── (auth)/               # Authentication screens
│   ├── (tabs)/               # Main app tabs
│   └── _layout.tsx           # Root layout
├── components/               # Reusable components
├── contexts/                 # React contexts (Auth, etc.)
├── services/                 # API services
└── package.json

hein-pharmacy-server/         # Node.js Backend
├── controllers/              # Route controllers
├── middleware/               # Custom middleware
├── routes/                   # API routes
├── config/                   # Database configuration
├── migrations/               # Database migrations
└── index.js                  # Entry point
```

## Database Schema

### Tables
- **owners**: User accounts and authentication
- **inventory_items**: Pharmacy inventory with owner assignment
- **sales**: Sales transactions
- **sale_items**: Individual items in each sale
- **income_summary**: Pre-calculated income data for performance

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- Expo CLI
- Git

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd hein-pharmacy
```

### 2. Backend Setup

```bash
cd hein-pharmacy-server

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file with your database credentials
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=hein_pharmacy
# DB_USER=your_username
# DB_PASSWORD=your_password
# JWT_SECRET=your_very_long_jwt_secret_key_here
# EXPO_ACCESS_TOKEN=your_expo_access_token_for_push_notifications
```

### 3. Database Setup

Create a PostgreSQL database:
```sql
CREATE DATABASE hein_pharmacy;
```

Run migrations and seed data:
```bash
npm run migrate
```

### 4. Start Backend Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server will run on `http://localhost:3000`

### 5. Frontend Setup

```bash
cd ../hein-pharmacy-client

# Install dependencies
npm install

# Start the development server
npx expo start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new owner
- `POST /api/auth/login` - Owner login
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile

### Inventory Management
- `GET /api/inventory` - Get inventory items
- `GET /api/inventory/:id` - Get single item
- `POST /api/inventory` - Create new item
- `PUT /api/inventory/:id` - Update item
- `DELETE /api/inventory/:id` - Delete item (soft delete)
- `GET /api/inventory/low-stock` - Get low stock items
- `GET /api/inventory/categories` - Get item categories

### Sales Management
- `GET /api/sales` - Get sales history
- `GET /api/sales/:id` - Get single sale
- `POST /api/sales` - Create new sale

### Income Analytics
- `GET /api/income/summary` - Income summary by owner
- `GET /api/income/daily` - Daily income data
- `GET /api/income/monthly` - Monthly income data
- `GET /api/income/by-category` - Income by category
- `GET /api/income/top-selling` - Top selling items
- `GET /api/income/stats` - Overall statistics

### Device & Notifications
- `POST /api/devices/register` - Register device for push notifications
- `PUT /api/devices/preferences` - Update notification preferences
- `GET /api/devices/my-devices` - Get user's registered devices
- `DELETE /api/devices/:id` - Unregister device
- `POST /api/notifications/test` - Send test notification

## Default Accounts

After running migrations, these accounts are available:

- **Username**: `owner1`, **Password**: `password123`
- **Username**: `owner2`, **Password**: `password123`
- **Username**: `admin`, **Password**: `password123`

## Development

### Backend Development
```bash
cd hein-pharmacy-server
npm run dev  # Starts with nodemon for auto-restart
```

### Frontend Development
```bash
cd hein-pharmacy-client
npx expo start  # Choose platform (iOS/Android/Web)
```

### Notification Setup
To enable push notifications:

1. **Get Expo Access Token**:
   - Go to [Expo Account Settings](https://expo.dev/settings/access-tokens)
   - Create a new access token
   - Add to `.env`: `EXPO_ACCESS_TOKEN=your_token_here`

2. **Test Notifications**:
   ```bash
   # Send test notification
   curl -X POST http://localhost:3000/api/notifications/test \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"message": "Test notification"}'
   ```

### Database Migrations
To reset and recreate the database:
```bash
npm run migrate
```

## Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Input validation with Joi
- SQL injection prevention
- Rate limiting
- CORS configuration
- Security headers with Helmet

## Advanced Features

### 🔔 Push Notifications
- **Low Stock Alerts**: Automatic notifications when items reach minimum stock levels
- **Sales Notifications**: Real-time alerts for new sales transactions
- **Device Management**: Support for multiple devices per user with individual preferences
- **Customizable Preferences**: Users can enable/disable specific notification types per device

### 🔍 Advanced Filtering & Search
- **Inventory Search**: Search by name, description, barcode with fuzzy matching
- **Multi-Filter Support**: Combine category, owner, and search filters
- **Dynamic Sorting**: Sort by name, quantity, price, date with ASC/DESC order
- **Sales Filtering**: Filter by date range, payment method, customer info
- **Pagination**: Efficient data loading with configurable page sizes

### ⏰ Automated Tasks
- **Cron Jobs**: Scheduled tasks for data maintenance and notifications
- **Income Summarization**: Automatic calculation of daily/monthly income summaries
- **Notification Scheduling**: Time-based notifications for different devices
- **Data Cleanup**: Automated removal of old logs and temporary data

### 📊 Performance Optimizations
- Database indexes on frequently queried columns
- Income summary table for fast analytics queries
- Connection pooling for database efficiency
- Query optimization with proper JOINs and WHERE clauses
- Lazy loading for large datasets

## Deployment

### Backend Deployment
1. Set environment variables
2. Install dependencies: `npm install --production`
3. Run migrations: `npm run migrate`
4. Start server: `npm start`

### Frontend Deployment
1. Build for production: `npx expo build`
2. Deploy to App Store/Google Play or web hosting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please create an issue in the repository.