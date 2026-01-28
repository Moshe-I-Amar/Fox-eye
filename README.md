# GeoMap - Luxury Location System

A full-stack application displaying users on a map based on their geographic location, featuring a luxury UI with JWT authentication and role-based access control.

## 🌟 Features

### Backend (Node.js + Express + MongoDB)
- **Secure Authentication**: JWT tokens with role-based access (admin/user)
- **Geospatial Queries**: MongoDB 2dsphere indexing for efficient location searches
- **RESTful API**: Clean, documented endpoints with comprehensive error handling
- **Security Features**: Rate limiting, CORS, Helmet, password hashing
- **Validation**: Input sanitization and coordinate validation
- **Real-time Communication**: WebSocket connections with JWT authentication
- **Live Features**: Location broadcasting, user presence, admin monitoring

### Frontend (React + Tailwind CSS)
- **Luxury Dark Theme**: Sophisticated UI with gold accents and glass morphism
- **Interactive Map**: Leaflet integration showing user locations
- **Real-time Updates**: WebSocket-driven location tracking and user presence
- **Live Indicators**: Online/offline status, connection status, live updates
- **Admin Panel**: Complete user management with real-time monitoring
- **Responsive Design**: Mobile-first approach with touch-friendly interactions

## 🏗️ Architecture

```
geo-map/
├── server/                 # Backend application
│   ├── src/
│   │   ├── config/        # Database configuration
│   │   ├── models/        # Mongoose schemas
│   │   ├── controllers/   # Route handlers
│   │   ├── routes/        # API endpoints
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── services/      # Socket.io service
│   │   ├── realtime/      # Socket.io setup
│   │   ├── utils/         # Helper functions
│   │   ├── middleware/    # Auth, validation, error handling
│   │   ├── utils/         # Helper functions
│   │   └── app.js         # Express app setup
│   ├── package.json
│   └── README.md
└── client/                # Frontend application
    ├── src/
    │   ├── components/    # Reusable UI components
    │   ├── pages/         # Route components
    │   ├── services/      # API service layer
    │   ├── styles/        # Global styles
    │   └── App.jsx        # Main app component
    ├── package.json
    └── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB (running locally or connection string)

### Setup Backend

```bash
cd server
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

### Setup Frontend

```bash
cd client
npm install
cp .env.example .env
# Edit .env with your API URL
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/api/health

## 🔄 Real-time Features

### WebSocket Authentication
All Socket.io connections require JWT authentication using the same tokens as REST APIs. The connection is automatically established when users log in.

### Live Location Updates
- User location changes are instantly broadcast to subscribed clients
- Map markers update in real-time without page refresh
- Distance calculations refresh automatically
- Online/offline indicators show user presence

### Viewport Subscriptions and Grid Rooms
- Clients send `viewport:subscribe` with a bounding box and zoom on map move/zoom (debounced)
- The server stores per-socket viewport state and only emits updates when a user is inside that viewport
- Subscriptions are also mapped to grid rooms to reduce broadcast fan-out
- Rooms are based on rounded lat/lng cells; the viewport check is still applied to prevent false positives

Limitations:
- Grid cells use coarse, zoom-based sizes and can be truncated if a viewport spans too many cells
- Large, low-zoom viewports may receive fewer updates until the user zooms in
- Dateline-wrapping viewports are normalized (no multi-range support)

### Admin Monitoring
- Admin users receive all location updates system-wide
- Real-time user presence tracking in admin dashboard
- Live connection status indicators
- Instant notifications for user joins/leaves

### Socket Events
- `location:update` - Update user location (broadcasts to viewport subscribers)
- `location:request` - Request nearby users with radius filtering
- `presence:subscribe` - Subscribe to user presence updates
- `viewport:subscribe` - Subscribe to viewport updates with bounds + zoom
- `location:updated` - Receive real-time location changes
- `presence:user_joined/left` - User join/leave notifications

## 📱 Usage

### User Registration & Login
1. Register a new account or login with existing credentials
2. First user becomes admin, subsequent users default to regular users
3. **WebSocket connection automatically establishes with JWT token**

### Map Dashboard
1. Click "Use My Location" to set your current position
2. Adjust the search radius slider to filter users by distance
3. Click on map markers or user cards to view details
4. Users within your radius are displayed with distance information
5. **Watch for real-time updates as other users move**
6. **Online indicators show which users are currently active**

### Admin Panel (Admins Only)
1. Access via navigation menu
2. View all registered users
3. **Monitor real-time location updates from all users**
4. **See live user presence with online indicators**
3. Search and filter users
4. View detailed user information
5. Manage user data with pagination

## 🔐 Authentication & Security

### JWT Tokens
- Access tokens with configurable expiration
- Automatic token refresh handling
- Secure storage in localStorage

### Role-Based Access
- **User**: Access to dashboard and location features
- **Admin**: Full user management capabilities
- Backend enforcement with middleware
- Frontend route guards for UI protection

### Security Features
- Password hashing with bcrypt (12 rounds)
- Rate limiting on authentication endpoints
- CORS configuration
- Input validation and sanitization
- Helmet security headers
- HTTPS ready for production

## 🗺️ Geolocation Features

### User Location
- Store location as GeoJSON points
- Automatic coordinate validation
- Efficient 2dsphere indexing

### Spatial Queries
- Find users within specified radius
- Distance calculations in kilometers
- Support for coordinate-based searches

### Browser Integration
- HTML5 Geolocation API
- Permission handling
- Fallback coordinates for testing

## 🎨 Design System

### Color Palette
- **Primary**: Jet black (#0a0a0a)
- **Secondary**: Charcoal (#1a1a1a)
- **Accent**: Gold (#C7A76C)
- **Text**: Various opacity levels for hierarchy

### UI Components
- **Glass Cards**: Translucent panels with backdrop blur
- **Gold Borders**: Gradient borders for premium feel
- **Micro-interactions**: Hover states, transitions, animations
- **Responsive Grid**: Mobile-first layout system

## 📊 API Documentation

### Authentication Endpoints
```
POST /api/auth/register  - Register new user
POST /api/auth/login     - User login
GET  /api/auth/me       - Get current user
```

### User Endpoints
```
GET    /api/users           - List users (admin only)
GET    /api/users/near      - Get nearby users
GET    /api/users/:id       - Get user details (admin only)
PUT    /api/users/me/location - Update location
```

### WebSocket Events (Socket.io with JWT Auth)
- **Connection**: Connect with JWT token in `auth.token` or `Authorization` header
- **`location:update`** - Update user location (requires coordinates)
- **`location:request`** - Request nearby users (requires center, radius, excludeSelf)
- **`presence:subscribe`** - Subscribe to user presence updates
- **`location:updated`** - Receive location updates from other users
- **`location:updated:confirm`** - Confirmation of your own location update
- **`location:response`** - Response to location request
- **`presence:users`** - List of all connected users
- **`presence:user_joined`** - User joined notification
- **`presence:user_left`** - User left notification
- **`admin:location:updated`** - Admin receives all location updates

### Sample Request
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

## 🛠️ Development

### Backend Development
```bash
cd server
npm run dev  # With nodemon for auto-reload
```

### Frontend Development
```bash
cd client
npm run dev  # Vite dev server
```

### Environment Variables
- Server: Copy `.env.example` to `.env`
- Client: Copy `.env.example` to `.env`
- Update with your specific configuration

## 🚀 Production Deployment

### Backend Deployment
1. Set production environment variables
2. Configure MongoDB connection
3. Set secure JWT secret
4. Enable HTTPS
5. Configure CORS for production domain

### Frontend Deployment
1. Build the application: `npm run build`
2. Deploy static files to CDN or hosting service
3. Configure environment variables
4. Set up proper routing for SPA

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the README files in `server/` and `client/` directories
2. Review the API documentation
3. Ensure environment variables are properly configured
4. Verify MongoDB is running and accessible

## 🎯 Key Features Demonstrated

- **Full-Stack Development**: Complete MERN stack application
- **Geospatial Features**: MongoDB geospatial queries and interactive maps
- **Security Best Practices**: JWT authentication, role-based access, input validation
- **Modern UI/UX**: Luxury design with Tailwind CSS and glass morphism
- **API Design**: RESTful endpoints with comprehensive error handling
- **State Management**: Efficient client-side state management
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Production Ready**: Environment configuration, security headers, error handling
