const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

const db = new sqlite3.Database('./fitness_tracker.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
        migrateDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin BOOLEAN DEFAULT 0,
            height REAL,
            starting_weight REAL,
            current_weight REAL,
            join_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_maxes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            exercise_name TEXT NOT NULL,
            starting_max REAL DEFAULT 0,
            current_max REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_max_update_date DATE,
            FOREIGN KEY (user_id) REFERENCES users (id),
            UNIQUE(user_id, exercise_name)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS workouts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            workout_date DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS workout_exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workout_id INTEGER,
            exercise_name TEXT NOT NULL,
            weight REAL,
            sets INTEGER,
            reps INTEGER,
            FOREIGN KEY (workout_id) REFERENCES workouts (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS weekly_checkins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            checkin_date DATE NOT NULL,
            weight REAL,
            feeling TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            reset_by_admin_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (reset_by_admin_id) REFERENCES users (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_goals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            goal_text TEXT NOT NULL,
            target_value INTEGER NOT NULL,
            current_value INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        createDefaultAdmin();
    });
}

function migrateDatabase() {
    db.all("PRAGMA table_info(user_maxes)", (err, columns) => {
        if (err) {
            console.error('Error getting table info:', err);
            return;
        }

        const columnExists = columns.some(col => col.name === 'last_max_update_date');

        if (!columnExists) {
            db.run("ALTER TABLE user_maxes ADD COLUMN last_max_update_date DATE", (err) => {
                if (err) {
                    console.error('Error adding column:', err);
                } else {
                    console.log('Column last_max_update_date added to user_maxes table');
                }
            });
        }
    });

    // Migration for full_name column
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
            console.error('Error getting table info for users:', err);
            return;
        }

        const columnExists = columns.some(col => col.name === 'full_name');

        if (!columnExists) {
            db.run("ALTER TABLE users ADD COLUMN full_name TEXT", (err) => {
                if (err) {
                    console.error('Error adding full_name column to users table:', err);
                } else {
                    console.log('Column full_name added to users table');
                }
            });
        }
    });
}

async function createDefaultAdmin() {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    db.get('SELECT id FROM users WHERE username = ?', ['admin'], (err, row) => {
        if (err) {
            console.error('Error checking for admin user:', err);
            return;
        }
        
        if (!row) {
            db.run(`INSERT INTO users (username, password_hash, full_name, is_admin, height, starting_weight, current_weight) 
                    VALUES (?, ?, ?, 1, 70, 180, 180)`, 
                [
                    'admin', 
                    hashedPassword,
                    'Admin User'
                ], 
                function(err) {
                    if (err) {
                        console.error('Error creating admin user:', err);
                    } else {
                        console.log('Default admin user created');
                    }
                }
            );
        }
    });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (!req.user.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Register endpoint
app.post('/api/register', async (req, res) => {
    try {
        const { username, fullName, password, height, startingWeight } = req.body;

        if (!username || !password || !height || !startingWeight) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('Attempting to insert user into database...');

        db.run(`INSERT INTO users (username, password_hash, full_name, height, starting_weight, current_weight) 
                VALUES (?, ?, ?, ?, ?, ?)`,
            [username, hashedPassword, fullName, height, startingWeight, startingWeight],
            function(err) {
                console.log('Inside db.run callback. Error object:', err);
                console.log('Inside db.run callback. This object:', this);
                if (err) {
                    console.error('SQLite registration error:', err);
                    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                        return res.status(400).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: 'Failed to create user' });
                }

                const userId = this.lastID;
                const defaultExercises = ['Bench Press', 'Deadlift', 'Squat', 'Overhead Press', 'Bicep Curls', 'Barbell Rows'];
                
                const stmt = db.prepare('INSERT INTO user_maxes (user_id, exercise_name, starting_max, current_max) VALUES (?, ?, 0, 0)');
                
                defaultExercises.forEach(exercise => {
                    stmt.run(userId, exercise);
                });
                
                stmt.finalize();

                res.status(201).json({ 
                    message: 'User created successfully',
                    userId: userId
                });
            }
        );
    } catch (error) {
        console.error('Registration error (outer catch):', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            db.get('SELECT * FROM reset_tokens WHERE user_id = ?', [user.id], async (resetErr, resetToken) => {
                if (resetErr) {
                    return res.status(500).json({ error: 'Database error' });
                }

                if (resetToken) {
                    return res.status(200).json({
                        requiresReset: true,
                        message: 'Password reset required by admin'
                    });
                }

                const isValidPassword = await bcrypt.compare(password, user.password_hash);
                
                if (!isValidPassword) {
                    return res.status(401).json({ error: 'Invalid username or password' });
                }

                const token = jwt.sign(
                    { 
                        id: user.id, 
                        username: user.username, 
                        isAdmin: Boolean(user.is_admin) 
                    },
                    JWT_SECRET,
                    { expiresIn: '30d' }
                );

                res.json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        fullName: user.full_name,
                        isAdmin: Boolean(user.is_admin),
                        height: user.height,
                        startingWeight: user.starting_weight,
                        currentWeight: user.current_weight
                    }
                });
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Password reset endpoint
app.post('/api/reset-password', async (req, res) => {
    try {
        const { username, newPassword, confirmPassword } = req.body;

        if (!username || !newPassword || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            db.get('SELECT * FROM reset_tokens WHERE user_id = ?', [user.id], async (resetErr, resetToken) => {
                if (resetErr) {
                    return res.status(500).json({ error: 'Database error' });
                }

                if (!resetToken) {
                    return res.status(400).json({ error: 'No password reset pending for this user' });
                }

                const hashedPassword = await bcrypt.hash(newPassword, 10);

                db.serialize(() => {
                    db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
                        [hashedPassword, user.id]);
                    
                    db.run('DELETE FROM reset_tokens WHERE user_id = ?', [user.id]);
                });

                res.json({ message: 'Password updated successfully' });
            });
        });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Server error during password reset' });
    }
});

// Get user data endpoint
app.get('/api/user/data', authenticateToken, (req, res) => {
    const userId = req.user.id;

    db.serialize(() => {
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'User not found' });
            }

            db.all('SELECT * FROM user_maxes WHERE user_id = ?', [userId], (err, maxes) => {
                if (err) maxes = [];

                db.all(`SELECT w.*, we.exercise_name, we.weight, we.sets, we.reps 
                        FROM workouts w 
                        LEFT JOIN workout_exercises we ON w.id = we.workout_id 
                        WHERE w.user_id = ? 
                        ORDER BY w.workout_date DESC, w.id DESC`, [userId], (err, workoutRows) => {
                    
                    const workouts = {};
                    workoutRows.forEach(row => {
                        if (!workouts[row.id]) {
                            workouts[row.id] = {
                                id: row.id,
                                date: row.workout_date,
                                exercises: [],
                                timestamp: row.created_at
                            };
                        }
                        if (row.exercise_name) {
                            workouts[row.id].exercises.push({
                                exercise: row.exercise_name,
                                weight: row.weight,
                                sets: row.sets,
                                reps: row.reps
                            });
                        }
                    });

                    db.all('SELECT * FROM weekly_checkins WHERE user_id = ? ORDER BY checkin_date DESC', [userId], (err, checkins) => {
                        if (err) checkins = [];

                        db.all('SELECT goal_text as text, target_value as target, current_value as current FROM user_goals WHERE user_id = ?', [userId], (err, goals) => {
                            if (err) goals = [];

                            const maxesObj = {};
                            const maxUpdateDates = {};
                            maxes.forEach(max => {
                                maxesObj[max.exercise_name] = {
                                    starting: max.starting_max,
                                    current: max.current_max
                                };
                                if (max.last_max_update_date) {
                                    maxUpdateDates[max.last_max_update_date] = true;
                                }
                            });

                            res.json({
                                user: {
                                    id: user.id,
                                    username: user.username,
                                    fullName: user.full_name,
                                    isAdmin: Boolean(user.is_admin),
                                    height: user.height,
                                    startingWeight: user.starting_weight,
                                    currentWeight: user.current_weight,
                                    joinDate: user.join_date
                                },
                                maxes: maxesObj,
                                maxUpdateDates: Object.keys(maxUpdateDates),
                                workouts: Object.values(workouts),
                                weeklyCheckins: checkins,
                                goals: goals
                            });
                        });
                    });
                });
            });
        });
    });
});

// Save maxes endpoint
app.post('/api/user/maxes', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { maxes } = req.body;

    // Get current date for max updates
    const now = new Date();
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const updateDate = localDate.getFullYear() + '-' + 
                      String(localDate.getMonth() + 1).padStart(2, '0') + '-' + 
                      String(localDate.getDate()).padStart(2, '0');

    db.serialize(() => {
        // First get existing maxes to check for changes
        db.all('SELECT exercise_name, current_max FROM user_maxes WHERE user_id = ?', [userId], (err, existing) => {
            const existingMaxes = {};
            existing.forEach(row => {
                existingMaxes[row.exercise_name] = row.current_max;
            });

            Object.keys(maxes).forEach(exercise => {
                const oldMax = existingMaxes[exercise] || 0;
                const newMax = maxes[exercise].current;
                
                // Only set update date if current max actually changed
                const maxUpdateDate = (oldMax !== newMax) ? updateDate : null;
                
                // Check if record exists
                db.get('SELECT id FROM user_maxes WHERE user_id = ? AND exercise_name = ?', 
                    [userId, exercise], (err, row) => {
                        if (row) {
                            // Update existing record
                            db.run(`UPDATE user_maxes 
                                    SET starting_max = ?, current_max = ?, updated_at = CURRENT_TIMESTAMP, last_max_update_date = ?
                                    WHERE user_id = ? AND exercise_name = ?`,
                                [maxes[exercise].starting, newMax, maxUpdateDate, userId, exercise]);
                        } else {
                            // Insert new record
                            db.run(`INSERT INTO user_maxes 
                                    (user_id, exercise_name, starting_max, current_max, updated_at, last_max_update_date) 
                                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
                                [userId, exercise, maxes[exercise].starting, newMax, maxUpdateDate]);
                        }
                    });
            });

            res.json({ message: 'Maxes saved successfully' });
        });
    });
});

// Save workout endpoint
app.post('/api/user/workout', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { date, exercises } = req.body;

    db.run('INSERT INTO workouts (user_id, workout_date) VALUES (?, ?)', 
        [userId, date], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to save workout' });
            }

            const workoutId = this.lastID;
            const stmt = db.prepare('INSERT INTO workout_exercises (workout_id, exercise_name, weight, sets, reps) VALUES (?, ?, ?, ?, ?)');

            exercises.forEach(ex => {
                stmt.run(workoutId, ex.exercise, ex.weight, ex.sets, ex.reps);
            });

            stmt.finalize((err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to save workout exercises' });
                }
                res.json({ message: 'Workout saved successfully' });
            });
        }
    );
});

// Save weekly checkin endpoint
app.post('/api/user/checkin', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { weight, feeling, notes } = req.body;
    
    // Use UTC date to avoid timezone issues and ensure consistency
    const date = new Date().toISOString().split('T')[0];

    db.serialize(() => {
        db.run('INSERT INTO weekly_checkins (user_id, checkin_date, weight, feeling, notes) VALUES (?, ?, ?, ?, ?)',
            [userId, date, weight, feeling, notes]);

        db.run('UPDATE users SET current_weight = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [weight, userId]);
    });

    res.json({ message: 'Weekly check-in saved successfully' });
});

// Save goals endpoint
app.post('/api/user/goals', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { goals } = req.body;

    db.serialize(() => {
        // Clear existing goals for simplicity.
        // A more robust solution might update existing goals.
        db.run('DELETE FROM user_goals WHERE user_id = ?', [userId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to clear old goals' });
            }

            if (goals && goals.length > 0) {
                const stmt = db.prepare('INSERT INTO user_goals (user_id, goal_text, target_value, current_value) VALUES (?, ?, ?, ?)');
                goals.forEach(goal => {
                    stmt.run(userId, goal.text, goal.target, goal.current);
                });
                stmt.finalize((err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to save new goals' });
                    }
                    res.json({ message: 'Goals saved successfully' });
                });
            } else {
                res.json({ message: 'Goals cleared successfully' });
            }
        });
    });
});

// Get leaderboard endpoint
app.get('/api/leaderboard', authenticateToken, (req, res) => {
    db.all(`
        SELECT 
            u.id, 
            u.username, 
            u.current_weight, 
            u.starting_weight,
            COALESCE(SUM(um.current_max - um.starting_max), 0) as strength_gain,
            w_stats.workout_count,
            w_stats.last_workout_id,
            w_stats.last_workout_date,
            c_stats.last_checkin_date
        FROM users u
        LEFT JOIN user_maxes um ON u.id = um.user_id
        LEFT JOIN (
            SELECT 
                user_id, 
                COUNT(id) as workout_count, 
                MAX(id) as last_workout_id,
                MAX(workout_date) as last_workout_date 
            FROM workouts 
            GROUP BY user_id
        ) w_stats ON u.id = w_stats.user_id
        LEFT JOIN (
            SELECT 
                user_id, 
                MAX(checkin_date) as last_checkin_date 
            FROM weekly_checkins 
            GROUP BY user_id
        ) c_stats ON u.id = c_stats.user_id
        WHERE u.is_admin = 0
        GROUP BY u.id, u.username, u.current_weight, u.starting_weight, c_stats.last_checkin_date
        ORDER BY strength_gain DESC`,
        (err, users) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to get leaderboard' });
            }
            res.json(users);
        }
    );
});

// Get specific workout for modal
app.get('/api/workout/:id', authenticateToken, (req, res) => {
    const workoutId = req.params.id;

    db.all(`SELECT w.workout_date, we.exercise_name, we.weight, we.sets, we.reps, u.username
            FROM workouts w
            JOIN workout_exercises we ON w.id = we.workout_id
            JOIN users u ON w.user_id = u.id
            WHERE w.id = ?`,
        [workoutId],
        (err, rows) => {
            if (err || rows.length === 0) {
                return res.status(404).json({ error: 'Workout not found' });
            }
            
            const workoutDetails = {
                username: rows[0].username,
                date: rows[0].workout_date,
                exercises: rows.map(r => ({
                    exercise: r.exercise_name,
                    weight: r.weight,
                    sets: r.sets,
                    reps: r.reps
                }))
            };

            res.json(workoutDetails);
        }
    );
});


// Admin endpoints
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    db.all(`SELECT u.id, u.username, u.join_date, u.current_weight, u.starting_weight,
                   COALESCE(SUM(um.current_max - um.starting_max), 0) as strength_gain,
                   COUNT(DISTINCT w.id) as workout_count,
                   CASE WHEN rt.id IS NOT NULL THEN 1 ELSE 0 END as has_reset_token
            FROM users u
            LEFT JOIN user_maxes um ON u.id = um.user_id
            LEFT JOIN workouts w ON u.id = w.user_id
            LEFT JOIN reset_tokens rt ON u.id = rt.user_id
            WHERE u.is_admin = 0
            GROUP BY u.id, u.username, u.join_date, u.current_weight, u.starting_weight, rt.id`,
        (err, users) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to get users' });
            }
            res.json(users);
        }
    );
});

app.post('/api/admin/reset-password', authenticateToken, requireAdmin, (req, res) => {
    const { username } = req.body;
    const adminId = req.user.id;

    db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        db.get('SELECT id FROM reset_tokens WHERE user_id = ?', [user.id], (err, existingToken) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (existingToken) {
                db.run('DELETE FROM reset_tokens WHERE user_id = ?', [user.id]);
                res.json({ message: 'Password reset cancelled' });
            } else {
                db.run('INSERT INTO reset_tokens (user_id, reset_by_admin_id) VALUES (?, ?)',
                    [user.id, adminId]);
                res.json({ message: 'Password reset initiated' });
            }
        });
    });
});

app.post('/api/admin/edit-user', authenticateToken, requireAdmin, (req, res) => {
    const { username, newPassword } = req.body;

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    db.get('SELECT id FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.serialize(() => {
            db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [hashedPassword, user.id]);
            
            db.run('DELETE FROM reset_tokens WHERE user_id = ?', [user.id]);
        });

        res.json({ message: 'User password updated successfully' });
    });
});

app.post('/api/admin/delete-user', authenticateToken, requireAdmin, (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // Prevent deletion of admin user
    if (username === 'admin') {
        return res.status(400).json({ error: 'Cannot delete admin user' });
    }

    db.get('SELECT id FROM users WHERE username = ? AND is_admin = 0', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found or is admin' });
        }

        const userId = user.id;

        // Delete user and all associated data
        db.serialize(() => {
            // Delete in order to respect foreign key constraints
            db.run('DELETE FROM reset_tokens WHERE user_id = ?', [userId]);
            db.run('DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = ?)', [userId]);
            db.run('DELETE FROM workouts WHERE user_id = ?', [userId]);
            db.run('DELETE FROM weekly_checkins WHERE user_id = ?', [userId]);
            db.run('DELETE FROM user_maxes WHERE user_id = ?', [userId]);
            db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
                if (err) {
                    console.error('Error deleting user:', err);
                    return res.status(500).json({ error: 'Failed to delete user' });
                }
                
                if (this.changes === 0) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                res.json({ message: `User ${username} and all associated data deleted successfully` });
            });
        });
    });
});

app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    db.serialize(() => {
        db.get('SELECT COUNT(*) as total_users FROM users WHERE is_admin = 0', (err, totalUsers) => {
            db.get('SELECT COUNT(*) as total_workouts FROM workouts', (err2, totalWorkouts) => {
                db.get('SELECT COUNT(DISTINCT user_id) as active_users FROM workouts', (err3, activeUsers) => {
                    db.get(`SELECT AVG(strength_gain) as avg_strength_gain FROM (
                                SELECT COALESCE(SUM(current_max - starting_max), 0) as strength_gain
                                FROM user_maxes
                                GROUP BY user_id
                            )`, (err4, avgGain) => {
                        
                        res.json({
                            totalUsers: totalUsers ? totalUsers.total_users : 0,
                            totalWorkouts: totalWorkouts ? totalWorkouts.total_workouts : 0,
                            activeUsers: activeUsers ? activeUsers.active_users : 0,
                            avgStrengthGain: avgGain ? Math.round(avgGain.avg_strength_gain || 0) : 0
                        });
                    });
                });
            });
        });
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed.');
        process.exit(0);
    });
});