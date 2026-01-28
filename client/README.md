# GeoMap Client

A luxury React frontend for geolocation-based user mapping with dark theme and gold accents.

## Features

- Luxury dark theme UI with gold accents
- Interactive map showing user locations
- **Real-time WebSocket connections with JWT authentication**
- **Live location updates and user presence tracking**
- User authentication with JWT
- Role-based access control (admin panel)
- Responsive design with Tailwind CSS
- Glass morphism effects and smooth animations

## Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling framework
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Socket.io Client** - Real-time WebSocket connections
- **Leaflet + React-Leaflet** - Interactive maps
- **React Hook Form** - Form management

## Setup

### Prerequisites

- Node.js (v16+)
- GeoMap Server running on port 5000

### Installation

1. Clone the repository
2. Navigate to the client directory:
   ```bash
   cd client
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create environment variables:
   ```bash
   cp .env.example .env
   ```

5. Update `.env` with your server URL:
   ```
   VITE_API_URL=http://localhost:5000
   ```

### Running

Development mode:
```bash
npm run dev
```

Build for production:
```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

The application will be available at `http://localhost:5173`

## Pages & Features

### Authentication
- **Login** (`/login`) - User sign-in with email/password
- **Register** (`/register`) - New user registration
- Luxury glass morphism design with gold accents
- Form validation and error handling

### Dashboard (`/dashboard`)
- Interactive map showing nearby users
- **Real-time user presence with online/offline indicators**
- **Live location updates from other users**
- User list panel with search and filtering
- "Use My Location" button for geolocation
- Radius slider for distance filtering
- User detail modals
- WebSocket connection status indicators

### Admin Panel (`/admin`)
- Complete user management (admin only)
- **Real-time monitoring of all user location updates**
- **Live user presence tracking with online indicators**
- Searchable user table
- Pagination support
- User detail views
- Role management interface
- Real-time connection status

## UI Components

### Luxury Design System
- **Color Palette**: Jet black, charcoal, slate with gold accents
- **Glass Cards**: Translucent panels with backdrop blur
- **Gold Borders**: Gradient borders for premium feel
- **Animations**: Smooth transitions and micro-interactions
- **Typography**: Clean Inter font with proper hierarchy

### Reusable Components
- `Button` - Primary, secondary, outline, ghost variants
- `Card` - Glass morphism with optional gold borders
- `Input` - Dark theme inputs with gold focus states
- `Modal` - Glass modal with blur backdrop
- `Navbar` - Luxury navigation with user menu

## Map Features

- Dark theme map tiles from CartoDB
- Custom gold location markers
- **Real-time marker updates via WebSocket**
- Interactive popups with user info
- Distance calculations and display
- Responsive map container
- Geolocation integration
- **Online/offline user indicators**
- **Live presence tracking**

## Authentication Flow

1. User registers/logs in
2. JWT token stored in localStorage
3. Axios interceptor adds token to HTTP requests
4. **Socket.io connection established with JWT token**
5. Protected routes check authentication
6. Admin routes verify role permissions
7. Auto-logout on token expiration
8. **Real-time events authenticated via WebSocket**

## State Management

- React hooks for local state
- localStorage for persistence
- Axios interceptors for API calls
- **Socket.io service for real-time state**
- Context-free architecture (simple and scalable)

## Responsive Design

- Mobile-first approach
- Breakpoints: sm, md, lg, xl
- Touch-friendly interactions
- Adaptive layouts for all screen sizes
- Optimized map display on mobile

## Performance Features

- Lazy loading for map components
- Optimized API calls with debouncing
- Efficient re-renders with React.memo
- Code splitting with Vite
- Image optimization for markers

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Development Notes

- Uses Vite for fast development and optimized builds
- Tailwind CSS for rapid styling with consistent design
- Leaflet maps with dark theme customization
- Component-based architecture for maintainability
- Environment variables for configuration