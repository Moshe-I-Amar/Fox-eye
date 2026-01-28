# GeoMap Server

A Node.js/Express backend for geolocation-based user mapping with JWT authentication and role-based access control.

## Features

- JWT authentication with role-based access (admin/user)
- Geospatial user location tracking using MongoDB 2dsphere indexing
- Secure password hashing with bcrypt
- Rate limiting and security headers
- RESTful API design with comprehensive error handling
- CORS configuration for frontend integration
- **Real-time WebSocket connections with JWT authentication**
- **Live location updates and user presence tracking**
- **Admin real-time monitoring capabilities**
- **Secure Socket.io middleware for authentication**

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database with Mongoose ODM
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **express-validator** - Input validation
- **Socket.io** - Realtime events

## Setup

### Prerequisites

- Node.js (v16+)
- MongoDB (running locally or connection string)

### Installation

1. Clone the repository
2. Navigate to the server directory:
   ```bash
   cd server
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create environment variables:
   ```bash
   cp .env.example .env
   ```

5. Update `.env` with your configuration:
   ```
   PORT=5000
   MONGO_URI=mongodb://localhost:27017/geo-map
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=1d
   CLIENT_ORIGIN=http://localhost:5173
   ```

### Running

Development mode (with nodemon):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on `http://localhost:5000`

## Realtime Setup

Socket.io is attached to the same HTTP server as the REST API (no separate port). The server enables CORS using `CLIENT_ORIGIN`.

Environment:
```
CLIENT_ORIGIN=http://localhost:5173
```

Use the exported Socket.io instance in controllers:
```javascript
const { getIO } = require('./realtime/socket');

getIO().emit('user:updated', { userId: '123' });
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info (protected)

### Users
- `GET /api/users` - Get all users (admin only, with pagination)
- `GET /api/users/near?lat=&lng=&distance=` - Get nearby users (protected)
- `GET /api/users/:id` - Get user by ID (admin only)
- `PUT /api/users/me/location` - Update current user location (protected)

### Health Check
- `GET /api/health` - Server health status

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

## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get Nearby Users
```bash
curl -X GET "http://localhost:5000/api/users/near?lat=40.7128&lng=-74.0060&distance=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Update Location
```bash
curl -X PUT http://localhost:5000/api/users/me/location \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "coordinates": [-74.0060, 40.7128]
  }'
```

## Security Features

- JWT token authentication
- Password hashing with bcrypt (12 rounds)
- Rate limiting on auth endpoints (5 requests per 15 minutes)
- CORS configuration for frontend origin
- Helmet security headers
- Input validation and sanitization
- Geospatial coordinate validation

## Data Model

### User Schema
```javascript
{
  name: String (required, 2-50 chars),
  email: String (required, unique, valid email),
  password: String (required, hashed, min 6 chars),
  role: { type: String, enum: ["admin","user"], default: "user" },
  location: {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: [Number] // [longitude, latitude]
  },
  createdAt: Date,
  updatedAt: Date
}
```

## Error Handling

All API responses follow a consistent format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "details": "Additional error details (optional)"
}
```

## Socket.io Authentication

All Socket.io connections require JWT authentication:

### Client Connection
```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

### Socket Events Examples

**Update Location:**
```javascript
socket.emit('location:update', {
  coordinates: [longitude, latitude],
  timestamp: new Date().toISOString()
});
```

**Request Nearby Users:**
```javascript
socket.emit('location:request', {
  center: [latitude, longitude],
  radius: 10,
  excludeSelf: true
});
```

**Listen for Updates:**
```javascript
socket.on('location:updated', (data) => {
  console.log('User location updated:', data);
});
```

## Development Notes

- The server uses MongoDB 2dsphere indexing for efficient geospatial queries
- Passwords are automatically hashed before saving
- All routes are protected with appropriate middleware
- JWT tokens expire based on `JWT_EXPIRES_IN` environment variable
- Location coordinates are validated for valid ranges
- Socket.io connections are authenticated with the same JWT system as REST APIs
- Real-time updates provide instant location changes and user presence
- Admin users receive all location updates for monitoring purposes
