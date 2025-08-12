
# Fitness Competition Tracker

A mobile-first web application for tracking fitness progress and competing with friends.

## Features

- 📱 **Mobile-First Design** - Optimized for smartphone use
- 👥 **User Registration** - Anyone can sign up and join competitions
- 💪 **Strength Tracking** - Log max lifts and track improvements
- 📊 **Daily Workouts** - Record detailed workout sessions
- 📈 **Weekly Check-ins** - Track weight and mood progression
- 🏆 **Leaderboard** - Rankings based on strength gains (not absolute numbers)
- 👑 **Admin Panel** - Manage users and view system statistics
- 🚀 **TODO List** - Future features including payment integration

## Quick Start with Docker

1. Save the HTML content as `index.html`
2. Create the Docker files (Dockerfile, nginx.conf, docker-compose.yml)
3. Run the application:

```bash
# Using docker-compose (recommended)
docker-compose up -d

# Or using Docker directly
docker build -t fitness-tracker .
docker run -p 8080:80 fitness-tracker
```

4. Open your browser to `http://localhost:8080`

## Default Admin Account

- **Username:** admin
- **Password:** admin123

## Mobile Optimization

- Touch-friendly buttons and inputs
- Responsive grid layouts
- Sticky navigation and user info
- Optimized for iOS Safari and Android Chrome
- Prevents zoom on input focus
- Smooth scrolling and touch interactions

## Competition Rules

The leaderboard ranks users based on **strength gained** from their starting maxes, not absolute strength. This ensures fair competition regardless of starting fitness level.

Example:
- User A: Started at 100lbs bench, now at 150lbs = +50lbs gain
- User B: Started at 200lbs bench, now at 220lbs = +20lbs gain
- **User A wins** despite lifting less absolute weight

## Future Development (TODO)

- 💰 Payment integration for competition entry fees
- 🏆 Prize pool management and automatic payouts
- 📊 Advanced analytics and progress charts
- 📱 Push notifications for reminders
- 👥 Social features and friend system
- 📄 Data export capabilities

## Technology Stack

- **Frontend:** Pure HTML5, CSS3, JavaScript (ES6+)
- **Backend:** Node.js + Express
- **Database:** SQLite with proper schema
- **Authentication:** JWT tokens with bcrypt password hashing
- **Styling:** Mobile-first responsive design with CSS Grid/Flexbox
- **Deployment:** Docker + Node.js
- **Security:** Bcrypt password hashing, JWT token authentication

## Security Features

- **Password Hashing:** All passwords are hashed using bcryptjs with salt rounds
- **JWT Authentication:** Secure token-based authentication for API access
- **Persistent Login:** Mobile devices stay logged in using localStorage token storage
- **Admin Panel:** Secure admin functions for user management and password resets
- **SQL Injection Protection:** Parameterized queries prevent SQL injection attacks

## Database Schema

The SQLite database includes tables for:
- `users` - User accounts with hashed passwords
- `user_maxes` - Exercise maximum lifts tracking
- `workouts` - Daily workout logging
- `workout_exercises` - Individual exercise details
- `weekly_checkins` - Weekly progress check-ins
- `reset_tokens` - Admin-initiated password resets

## Development Notes

- **Real Database:** Uses SQLite for persistent data storage
- **API-First:** All data operations go through REST API endpoints
- **Mobile-First:** Optimized for mobile devices with persistent login
- **Admin Tools:** Complete admin panel for user management
- **Token Expiration:** JWT tokens valid for 30 days for mobile convenience

## Support

For issues or feature requests, check the admin TODO panel for planned improvements.