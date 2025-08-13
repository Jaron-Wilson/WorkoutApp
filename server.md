# API Endpoints

This document provides a list of all available API endpoints and how to use them.

**Authentication:**

Most endpoints require a JWT token for authentication. To get a token, use the `/api/login` endpoint. The token should be included in the `Authorization` header of your requests as a Bearer token.

`Authorization: Bearer <YOUR_JWT_TOKEN>`

---

## User Management

### `POST /api/register`

Registers a new user.

**Parameters:**

*   `username` (string, required): The desired username (must be at least 3 characters).
*   `password` (string, required): The desired password (must be at least 6 characters).
*   `height` (number, required): The user's height.
*   `startingWeight` (number, required): The user's starting weight.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/register \
-H "Content-Type: application/json" \
-d 
{
    "username": "testuser",
    "password": "password123",
    "height": 70,
    "startingWeight": 180
}
```

### `POST /api/login`

Logs in a user and returns a JWT token.

**Parameters:**

*   `username` (string, required): The user's username.
*   `password` (string, required): The user's password.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/login \
-H "Content-Type: application/json" \
-d 
{
    "username": "testuser",
    "password": "password123"
}
```

### `POST /api/reset-password`

Resets a user's password if a reset has been initiated by an admin.

**Parameters:**

*   `username` (string, required): The user's username.
*   `newPassword` (string, required): The new password (must be at least 6 characters).
*   `confirmPassword` (string, required): The new password confirmation.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/reset-password \
-H "Content-Type: application/json" \
-d 
{
    "username": "testuser",
    "newPassword": "newpassword123",
    "confirmPassword": "newpassword123"
}
```

---

## User Data

### `GET /api/user/data`

Retrieves all data for the authenticated user.

**Authentication:** Bearer Token

**Example `curl` command:**

```bash
curl -X GET http://localhost:3000/api/user/data \
-H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### `POST /api/user/maxes`

Saves the user\'s maxes for different exercises.

**Authentication:** Bearer Token

**Parameters:**

*   `maxes` (object, required): An object where keys are exercise names and values are objects with `starting` and `current` properties.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/user/maxes \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
-d 
{
    "maxes": {
        "Bench Press": { "starting": 100, "current": 150 },
        "Squat": { "starting": 150, "current": 200 }
    }
}
```

### `POST /api/user/workout`

Saves a workout for the authenticated user.

**Authentication:** Bearer Token

**Parameters:**

*   `date` (string, required): The date of the workout in `YYYY-MM-DD` format.
*   `exercises` (array, required): An array of exercise objects, each with `exercise`, `weight`, `sets`, and `reps` properties.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/user/workout \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
-d 
{
    "date": "2025-08-12",
    "exercises": [
        { "exercise": "Bench Press", "weight": 135, "sets": 3, "reps": 8 },
        { "exercise": "Squat", "weight": 185, "sets": 3, "reps": 5 }
    ]
}
```

### `POST /api/user/checkin`

Saves a weekly check-in for the authenticated user.

**Authentication:** Bearer Token

**Parameters:**

*   `weight` (number, required): The user\'s current weight.
*   `feeling` (string, required): How the user is feeling.
*   `notes` (string, optional): Any additional notes.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/user/checkin \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
-d 
{
    "weight": 185,
    "feeling": "Great",
    "notes": "Feeling strong this week."
}
```

### `POST /api/user/goals`

Saves the user\'s goals.

**Authentication:** Bearer Token

**Parameters:**

*   `goals` (array, required): An array of goal objects, each with `text`, `target`, and `current` properties.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/user/goals \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
-d 
{
    "goals": [
        { "text": "Lose 10 pounds", "target": 10, "current": 2 },
        { "text": "Bench 200 lbs", "target": 200, "current": 150 }
    ]
}
```

---

## General

### `GET /api/leaderboard`

Retrieves the leaderboard data.

**Authentication:** Bearer Token

**Example `curl` command:**

```bash
curl -X GET http://localhost:3000/api/leaderboard \
-H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### `GET /api/workout/:id`

Retrieves details for a specific workout.

**Authentication:** Bearer Token

**Parameters:**

*   `id` (number, required): The ID of the workout.

**Example `curl` command:**

```bash
curl -X GET http://localhost:3000/api/workout/1 \
-H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

---

## Admin

These endpoints require admin privileges.

### `GET /api/admin/users`

Retrieves a list of all non-admin users.

**Authentication:** Bearer Token (Admin)

**Example `curl` command:**

```bash
curl -X GET http://localhost:3000/api/admin/users \
-H "Authorization: Bearer <YOUR_ADMIN_JWT_TOKEN>"
```

### `POST /api/admin/reset-password`

Initiates or cancels a password reset for a user.

**Authentication:** Bearer Token (Admin)

**Parameters:**

*   `username` (string, required): The username of the user to reset.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/admin/reset-password \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_ADMIN_JWT_TOKEN>" \
-d 
{
    "username": "testuser"
}
```

### `POST /api/admin/edit-user`

Edits a user\'s password.

**Authentication:** Bearer Token (Admin)

**Parameters:**

*   `username` (string, required): The username of the user to edit.
*   `newPassword` (string, required): The new password for the user (must be at least 6 characters).

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/admin/edit-user \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_ADMIN_JWT_TOKEN>" \
-d 
{
    "username": "testuser",
    "newPassword": "newpassword456"
}
```

### `POST /api/admin/delete-user`

Deletes a user and all their associated data.

**Authentication:** Bearer Token (Admin)

**Parameters:**

*   `username` (string, required): The username of the user to delete.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/admin/delete-user \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_ADMIN_JWT_TOKEN>" \
-d 
{
    "username": "testuser"
}
```

### `GET /api/admin/stats`

Retrieves statistics about the application.

**Authentication:** Bearer Token (Admin)

**Example `curl` command:**

```bash
curl -X GET http://localhost:3000/api/admin/stats \
-H "Authorization: Bearer <YOUR_ADMIN_JWT_TOKEN>"
```

### `POST /api/admin/verify-password`

Verifies the admin\'s password for sensitive actions.

**Authentication:** Bearer Token (Admin)

**Parameters:**

*   `password` (string, required): The admin\'s current password.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/admin/verify-password \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_ADMIN_JWT_TOKEN>" \
-d 
{
    "password": "adminpassword123"
}
```

### `POST /api/admin/change-password`

Allows the admin to change their own password.

**Authentication:** Bearer Token (Admin)

**Parameters:**

*   `oldPassword` (string, required): The admin\'s current password.
*   `newPassword` (string, required): The new password.
*   `confirmPassword` (string, required): Confirmation of the new password.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/admin/change-password \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_ADMIN_JWT_TOKEN>" \
-d 
{
    "oldPassword": "adminpassword123",
    "newPassword": "newadminpassword456",
    "confirmPassword": "newadminpassword456"
}
```

### `POST /api/admin/impersonate`

Generates a short-lived token to log in as another user.

**Authentication:** Bearer Token (Admin)

**Parameters:**

*   `userId` (number, required): The ID of the user to impersonate.

**Example `curl` command:**

```bash
curl -X POST http://localhost:3000/api/admin/impersonate \
-H "Content-Type: application/json" \
-H "Authorization: Bearer <YOUR_ADMIN_JWT_TOKEN>" \
-d 
{
    "userId": 2
}
```