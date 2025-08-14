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

        db.run(`CREATE TABLE IF NOT EXISTS draft_exercises (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            exercise_name TEXT NOT NULL,
            weight REAL,
            sets INTEGER,
            reps INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
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

        db.run(`CREATE TABLE IF NOT EXISTS app_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setting_key TEXT UNIQUE NOT NULL,
            setting_value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS user_activity_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action_type TEXT NOT NULL,
            action_details TEXT,
            entity_type TEXT,
            entity_id INTEGER,
            old_value TEXT,
            new_value TEXT,
            ip_address TEXT,
            user_agent TEXT,
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

        const fullNameExists = columns.some(col => col.name === 'full_name');
        const hiddenFromLeaderboardExists = columns.some(col => col.name === 'hidden_from_leaderboard');
        const schoolExists = columns.some(col => col.name === 'school');
        const customColorsExists = columns.some(col => col.name === 'custom_colors');
        const socialLinksExists = columns.some(col => col.name === 'social_links');
        const bioExists = columns.some(col => col.name === 'bio');
        const ageExists = columns.some(col => col.name === 'age');
        const locationExists = columns.some(col => col.name === 'location');
        const youtubeExists = columns.some(col => col.name === 'youtube');
        const instagramExists = columns.some(col => col.name === 'instagram');
        const linkedinExists = columns.some(col => col.name === 'linkedin');

        if (!fullNameExists) {
            db.run("ALTER TABLE users ADD COLUMN full_name TEXT", (err) => {
                if (err) {
                    console.error('Error adding full_name column to users table:', err);
                } else {
                    console.log('Column full_name added to users table');
                }
            });
        }

        if (!hiddenFromLeaderboardExists) {
            db.run("ALTER TABLE users ADD COLUMN hidden_from_leaderboard BOOLEAN DEFAULT 0", (err) => {
                if (err) {
                    console.error('Error adding hidden_from_leaderboard column to users table:', err);
                } else {
                    console.log('Column hidden_from_leaderboard added to users table');
                    // Set admin account as hidden by default
                    db.run("UPDATE users SET hidden_from_leaderboard = 1 WHERE username = 'admin'", (err) => {
                        if (err) {
                            console.error('Error setting admin as hidden:', err);
                        } else {
                            console.log('Admin account set as hidden from leaderboard');
                        }
                    });
                }
            });
        }

        if (!schoolExists) {
            db.run("ALTER TABLE users ADD COLUMN school TEXT", (err) => {
                if (err) {
                    console.error('Error adding school column to users table:', err);
                } else {
                    console.log('Column school added to users table');
                }
            });
        }

        if (!customColorsExists) {
            db.run("ALTER TABLE users ADD COLUMN custom_colors TEXT DEFAULT '{}'", (err) => {
                if (err) {
                    console.error('Error adding custom_colors column to users table:', err);
                } else {
                    console.log('Column custom_colors added to users table');
                }
            });
        }

        if (!socialLinksExists) {
            db.run("ALTER TABLE users ADD COLUMN social_links TEXT DEFAULT '{}'", (err) => {
                if (err) {
                    console.error('Error adding social_links column to users table:', err);
                } else {
                    console.log('Column social_links added to users table');
                }
            });
        }

        if (!bioExists) {
            db.run("ALTER TABLE users ADD COLUMN bio TEXT", (err) => {
                if (err) {
                    console.error('Error adding bio column to users table:', err);
                } else {
                    console.log('Column bio added to users table');
                }
            });
        }

        if (!ageExists) {
            db.run("ALTER TABLE users ADD COLUMN age INTEGER", (err) => {
                if (err) {
                    console.error('Error adding age column to users table:', err);
                } else {
                    console.log('Column age added to users table');
                }
            });
        }

        if (!locationExists) {
            db.run("ALTER TABLE users ADD COLUMN location TEXT", (err) => {
                if (err) {
                    console.error('Error adding location column to users table:', err);
                } else {
                    console.log('Column location added to users table');
                }
            });
        }

        if (!youtubeExists) {
            db.run("ALTER TABLE users ADD COLUMN youtube TEXT", (err) => {
                if (err) {
                    console.error('Error adding youtube column to users table:', err);
                } else {
                    console.log('Column youtube added to users table');
                }
            });
        }

        if (!instagramExists) {
            db.run("ALTER TABLE users ADD COLUMN instagram TEXT", (err) => {
                if (err) {
                    console.error('Error adding instagram column to users table:', err);
                } else {
                    console.log('Column instagram added to users table');
                }
            });
        }

        if (!linkedinExists) {
            db.run("ALTER TABLE users ADD COLUMN linkedin TEXT", (err) => {
                if (err) {
                    console.error('Error adding linkedin column to users table:', err);
                } else {
                    console.log('Column linkedin added to users table');
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

function logUserActivity(userId, actionType, actionDetails, entityType = null, entityId = null, oldValue = null, newValue = null, req = null) {
    const ipAddress = req ? req.ip || req.connection.remoteAddress : null;
    const userAgent = req ? req.get('User-Agent') : null;
    
    db.run(`INSERT INTO user_activity_log 
            (user_id, action_type, action_details, entity_type, entity_id, old_value, new_value, ip_address, user_agent) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, actionType, actionDetails, entityType, entityId, oldValue, newValue, ipAddress, userAgent],
        (err) => {
            if (err) {
                console.error('Error logging user activity:', err);
            }
        }
    );
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
                                    joinDate: user.join_date,
                                    hiddenFromLeaderboard: Boolean(user.hidden_from_leaderboard),
                                    school: user.school,
                                    bio: user.bio,
                                    age: user.age,
                                    location: user.location,
                                    youtube: user.youtube,
                                    instagram: user.instagram,
                                    linkedin: user.linkedin,
                                    customColors: user.custom_colors ? JSON.parse(user.custom_colors) : {},
                                    socialLinks: user.social_links ? JSON.parse(user.social_links) : {}
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
    const { maxes, date } = req.body;

    if (!date) {
        return res.status(400).json({ error: 'Date is required for max updates' });
    }

    const updateDate = date;

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

            // Log activity for each changed max
            Object.keys(maxes).forEach(exercise => {
                const oldMax = existingMaxes[exercise] || 0;
                const newMax = maxes[exercise].current;
                
                if (oldMax !== newMax) {
                    logUserActivity(userId, 'UPDATE_MAX', `Updated ${exercise} max from ${oldMax}lbs to ${newMax}lbs`, 'max', null, oldMax.toString(), newMax.toString(), req);
                }
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
                
                // Log activity
                logUserActivity(userId, 'CREATE_WORKOUT', `Added workout with ${exercises.length} exercises on ${date}`, 'workout', workoutId, null, JSON.stringify(exercises), req);
                
                res.json({ message: 'Workout saved successfully' });
            });
        }
    );
});

// Save draft exercise endpoint
app.post('/api/user/draft-exercise', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { exercise, weight, sets, reps } = req.body;

    if (!exercise || !weight || !sets || !reps) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    db.run('INSERT INTO draft_exercises (user_id, exercise_name, weight, sets, reps) VALUES (?, ?, ?, ?, ?)', 
        [userId, exercise, weight, sets, reps], function(err) {
            if (err) {
                console.error('Error saving draft exercise:', err);
                return res.status(500).json({ error: 'Failed to save exercise' });
            }
            
            logUserActivity(userId, 'ADD_DRAFT_EXERCISE', `Added draft exercise: ${exercise}`, 'exercise', this.lastID, null, JSON.stringify({exercise, weight, sets, reps}), req);
            
            res.json({ message: 'Exercise saved successfully', exerciseId: this.lastID });
        }
    );
});

// Get draft exercises endpoint
app.get('/api/user/draft-exercises', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    db.all('SELECT * FROM draft_exercises WHERE user_id = ? ORDER BY created_at DESC', [userId], (err, exercises) => {
        if (err) {
            console.error('Error fetching draft exercises:', err);
            return res.status(500).json({ error: 'Failed to fetch exercises' });
        }
        
        res.json(exercises);
    });
});

// Delete draft exercise endpoint
app.delete('/api/user/draft-exercise/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const exerciseId = req.params.id;

    // First check if the exercise belongs to the user
    db.get('SELECT id FROM draft_exercises WHERE id = ? AND user_id = ?', [exerciseId, userId], (err, exercise) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!exercise) {
            return res.status(404).json({ error: 'Exercise not found or access denied' });
        }

        db.run('DELETE FROM draft_exercises WHERE id = ? AND user_id = ?', [exerciseId, userId], function(err) {
            if (err) {
                console.error('Error deleting draft exercise:', err);
                return res.status(500).json({ error: 'Failed to delete exercise' });
            }
            
            logUserActivity(userId, 'DELETE_DRAFT_EXERCISE', `Deleted draft exercise ID ${exerciseId}`, 'exercise', exerciseId, null, null, req);
            
            res.json({ message: 'Exercise deleted successfully' });
        });
    });
});

// Convert draft exercises to workout
app.post('/api/user/finalize-workout', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { date } = req.body;

    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
    }

    // First get all draft exercises for the user
    db.all('SELECT * FROM draft_exercises WHERE user_id = ? ORDER BY created_at', [userId], (err, draftExercises) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to fetch draft exercises' });
        }

        if (draftExercises.length === 0) {
            return res.status(400).json({ error: 'No exercises to save' });
        }

        // Create the workout
        db.run('INSERT INTO workouts (user_id, workout_date) VALUES (?, ?)', 
            [userId, date], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create workout' });
                }

                const workoutId = this.lastID;
                const stmt = db.prepare('INSERT INTO workout_exercises (workout_id, exercise_name, weight, sets, reps) VALUES (?, ?, ?, ?, ?)');

                // Transfer all draft exercises to the workout
                draftExercises.forEach(ex => {
                    stmt.run(workoutId, ex.exercise_name, ex.weight, ex.sets, ex.reps);
                });

                stmt.finalize((err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to save workout exercises' });
                    }
                    
                    // Clear all draft exercises for this user
                    db.run('DELETE FROM draft_exercises WHERE user_id = ?', [userId], (err) => {
                        if (err) {
                            console.error('Error clearing draft exercises:', err);
                        }
                        
                        // Log activity
                        logUserActivity(userId, 'CREATE_WORKOUT', `Finalized workout with ${draftExercises.length} exercises on ${date}`, 'workout', workoutId, null, JSON.stringify(draftExercises), req);
                        
                        res.json({ message: 'Workout saved successfully', workoutId });
                    });
                });
            }
        );
    });
});

// Save weekly checkin endpoint
app.post('/api/user/checkin', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { date, weight, feeling, notes } = req.body;
    
    if (!date || !weight || !feeling) {
        return res.status(400).json({ error: 'Date, weight, and feeling are required' });
    }

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
            u.full_name,
            u.school,
            u.bio,
            u.age,
            u.location,
            u.youtube,
            u.instagram,
            u.linkedin,
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
        WHERE (u.hidden_from_leaderboard = 0 OR u.hidden_from_leaderboard IS NULL)
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
    db.all(`SELECT u.id, u.username, u.full_name, u.join_date, u.current_weight, u.starting_weight, u.hidden_from_leaderboard,
                   COALESCE(SUM(um.current_max - um.starting_max), 0) as strength_gain,
                   COUNT(DISTINCT w.id) as workout_count,
                   CASE WHEN rt.id IS NOT NULL THEN 1 ELSE 0 END as has_reset_token
            FROM users u
            LEFT JOIN user_maxes um ON u.id = um.user_id
            LEFT JOIN workouts w ON u.id = w.user_id
            LEFT JOIN reset_tokens rt ON u.id = rt.user_id
            WHERE u.is_admin = 0
            GROUP BY u.id, u.username, u.join_date, u.current_weight, u.starting_weight, u.hidden_from_leaderboard, rt.id`,
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
                        
                        db.get(`SELECT 
                                    COALESCE(SUM(reps), 0) as total_reps,
                                    COALESCE(SUM(sets), 0) as total_sets,
                                    COALESCE(SUM(weight), 0) as total_weight
                                FROM workout_exercises`, (err5, totals) => {
                            res.json({
                                totalUsers: totalUsers ? totalUsers.total_users : 0,
                                totalWorkouts: totalWorkouts ? totalWorkouts.total_workouts : 0,
                                activeUsers: activeUsers ? activeUsers.active_users : 0,
                                avgStrengthGain: avgGain ? Math.round(avgGain.avg_strength_gain || 0) : 0,
                                totalReps: totals ? totals.total_reps : 0,
                                totalSets: totals ? totals.total_sets : 0,
                                totalWeight: totals ? totals.total_weight : 0
                            });
                        });
                    });
                });
            });
        });
    });
});

app.post('/api/admin/change-password', authenticateToken, requireAdmin, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.id;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    db.get('SELECT * FROM users WHERE id = ? AND is_admin = 1', [adminId], async (err, admin) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!admin) {
            return res.status(404).json({ error: 'Admin user not found' });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, admin.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, adminId], function(err) {
                if (err) {
                    console.error('Error updating admin password:', err);
                    return res.status(500).json({ error: 'Failed to update password' });
                }
                
                res.json({ message: 'Admin password updated successfully' });
            }
        );
    });
});

app.post('/api/admin/toggle-workout-reminders', authenticateToken, requireAdmin, (req, res) => {
    const { enabled } = req.body;

    db.run(`INSERT OR REPLACE INTO app_settings (setting_key, setting_value, updated_at) 
            VALUES ('workout_reminders_enabled', ?, CURRENT_TIMESTAMP)`,
        [enabled ? '1' : '0'], function(err) {
            if (err) {
                console.error('Error updating workout reminders setting:', err);
                return res.status(500).json({ error: 'Failed to update setting' });
            }
            
            res.json({ message: 'Workout reminders setting updated successfully' });
        }
    );
});

app.get('/api/settings', (req, res) => {
    db.get('SELECT setting_value FROM app_settings WHERE setting_key = ?', 
        ['workout_reminders_enabled'], (err, row) => {
            if (err) {
                console.error('Error getting settings:', err);
                return res.status(500).json({ error: 'Failed to get settings' });
            }
            
            const workoutRemindersEnabled = row ? row.setting_value === '1' : false;
            
            res.json({
                workoutRemindersEnabled
            });
        }
    );
});

// Delete workout endpoint
app.delete('/api/user/workout/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const workoutId = req.params.id;

    // First check if the workout belongs to the user
    db.get('SELECT id FROM workouts WHERE id = ? AND user_id = ?', [workoutId, userId], (err, workout) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!workout) {
            return res.status(404).json({ error: 'Workout not found or access denied' });
        }

        // Delete workout and associated exercises
        db.serialize(() => {
            db.run('DELETE FROM workout_exercises WHERE workout_id = ?', [workoutId]);
            db.run('DELETE FROM workouts WHERE id = ?', [workoutId], function(err) {
                if (err) {
                    console.error('Error deleting workout:', err);
                    return res.status(500).json({ error: 'Failed to delete workout' });
                }
                
                // Log activity
                logUserActivity(userId, 'DELETE_WORKOUT', `Deleted workout ID ${workoutId}`, 'workout', workoutId, null, null, req);
                
                res.json({ message: 'Workout deleted successfully' });
            });
        });
    });
});

// Update workout endpoint
app.put('/api/user/workout/:id', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const workoutId = req.params.id;
    const { date, exercises } = req.body;

    console.log('Update workout request:', { userId, workoutId, date, exercises });

    if (!date || !exercises || exercises.length === 0) {
        console.log('Validation failed:', { date, exercises });
        return res.status(400).json({ error: 'Date and exercises are required' });
    }

    // First check if the workout belongs to the user
    db.get('SELECT id FROM workouts WHERE id = ? AND user_id = ?', [workoutId, userId], (err, workout) => {
        if (err) {
            console.error('Database error finding workout:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        console.log('Workout lookup result:', { workout, workoutId, userId });

        if (!workout) {
            return res.status(404).json({ error: 'Workout not found or access denied' });
        }

        // Update workout and exercises
        db.serialize(() => {
            // Update workout date
            db.run('UPDATE workouts SET workout_date = ? WHERE id = ?', [date, workoutId], (err) => {
                if (err) {
                    console.error('Error updating workout:', err);
                    return res.status(500).json({ error: 'Failed to update workout' });
                }

                // Delete existing exercises
                db.run('DELETE FROM workout_exercises WHERE workout_id = ?', [workoutId], (err) => {
                    if (err) {
                        console.error('Error deleting old exercises:', err);
                        return res.status(500).json({ error: 'Failed to update exercises' });
                    }

                    // Insert new exercises
                    const stmt = db.prepare('INSERT INTO workout_exercises (workout_id, exercise_name, weight, sets, reps) VALUES (?, ?, ?, ?, ?)');
                    exercises.forEach(ex => {
                        stmt.run(workoutId, ex.exercise, ex.weight, ex.sets, ex.reps);
                    });

                    stmt.finalize((err) => {
                        if (err) {
                            console.error('Error inserting new exercises:', err);
                            return res.status(500).json({ error: 'Failed to save updated exercises' });
                        }
                        
                        // Log activity
                        logUserActivity(userId, 'UPDATE_WORKOUT', `Updated workout ID ${workoutId} with ${exercises.length} exercises on ${date}`, 'workout', workoutId, null, JSON.stringify(exercises), req);
                        
                        res.json({ message: 'Workout updated successfully' });
                    });
                });
            });
        });
    });
});

// Delete check-in endpoint
app.delete('/api/user/checkin', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { date } = req.body;

    if (!date) {
        return res.status(400).json({ error: 'Date is required' });
    }

    db.run('DELETE FROM weekly_checkins WHERE user_id = ? AND checkin_date = ?', 
        [userId, date], function(err) {
            if (err) {
                console.error('Error deleting check-in:', err);
                return res.status(500).json({ error: 'Failed to delete check-in' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Check-in not found' });
            }
            
            res.json({ message: 'Check-in deleted successfully' });
        }
    );
});

// Admin reset user data endpoint
app.post('/api/admin/reset-user-data', authenticateToken, requireAdmin, (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // Prevent resetting admin user
    if (username === 'admin') {
        return res.status(400).json({ error: 'Cannot reset admin user data' });
    }

    db.get('SELECT id FROM users WHERE username = ? AND is_admin = 0', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found or is admin' });
        }

        const userId = user.id;

        // Delete all user data but keep the account
        db.serialize(() => {
            db.run('DELETE FROM workout_exercises WHERE workout_id IN (SELECT id FROM workouts WHERE user_id = ?)', [userId]);
            db.run('DELETE FROM workouts WHERE user_id = ?', [userId]);
            db.run('DELETE FROM weekly_checkins WHERE user_id = ?', [userId]);
            db.run('DELETE FROM user_maxes WHERE user_id = ?', [userId]);
            db.run('DELETE FROM user_goals WHERE user_id = ?', [userId], function(err) {
                if (err) {
                    console.error('Error resetting user data:', err);
                    return res.status(500).json({ error: 'Failed to reset user data' });
                }
                
                res.json({ message: `All data for user ${username} has been reset successfully` });
            });
        });
    });
});

// Get day details endpoint
app.get('/api/user/day-details/:date', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const date = req.params.date;

    db.serialize(() => {
        // Get workouts for the day
        db.all(`SELECT w.*, we.exercise_name, we.weight, we.sets, we.reps 
                FROM workouts w 
                LEFT JOIN workout_exercises we ON w.id = we.workout_id 
                WHERE w.user_id = ? AND w.workout_date = ?
                ORDER BY w.id`, [userId, date], (err, workoutRows) => {
            
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

            // Get check-ins for the day
            db.all('SELECT * FROM weekly_checkins WHERE user_id = ? AND checkin_date = ?', 
                [userId, date], (err, checkins) => {
                
                // Get max updates for the day
                db.all('SELECT exercise_name, current_max FROM user_maxes WHERE user_id = ? AND last_max_update_date = ?', 
                    [userId, date], (err, maxUpdates) => {
                    
                    res.json({
                        workouts: Object.values(workouts),
                        checkins: checkins || [],
                        maxUpdates: maxUpdates || []
                    });
                });
            });
        });
    });
});

// Edit max update endpoint
app.put('/api/user/max-update', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { exerciseName, date, newMax } = req.body;

    if (!exerciseName || !date || newMax === undefined) {
        return res.status(400).json({ error: 'Exercise name, date, and new max are required' });
    }

    if (isNaN(newMax) || newMax < 0) {
        return res.status(400).json({ error: 'New max must be a valid positive number' });
    }

    // Get current max value first
    db.get('SELECT current_max FROM user_maxes WHERE user_id = ? AND exercise_name = ?', 
        [userId, exerciseName], (err, row) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            const oldMax = row ? row.current_max : 0;
            
            // Update the max value for the exercise
            db.run(`UPDATE user_maxes 
                    SET current_max = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE user_id = ? AND exercise_name = ?`,
                [newMax, userId, exerciseName], function(err) {
                    if (err) {
                        console.error('Error updating max:', err);
                        return res.status(500).json({ error: 'Failed to update max' });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Exercise not found' });
                    }
                    
                    // Log activity
                    logUserActivity(userId, 'EDIT_MAX', `Edited ${exerciseName} max from ${oldMax}lbs to ${newMax}lbs on ${date}`, 'max', null, oldMax.toString(), newMax.toString(), req);
                    
                    res.json({ message: 'Max updated successfully' });
                }
            );
        }
    );
});

// Delete max update endpoint
app.delete('/api/user/max-update', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { exerciseName, date } = req.body;

    if (!exerciseName || !date) {
        return res.status(400).json({ error: 'Exercise name and date are required' });
    }

    // Remove the max update date for this specific exercise
    db.run(`UPDATE user_maxes 
            SET last_max_update_date = NULL, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ? AND exercise_name = ? AND last_max_update_date = ?`,
        [userId, exerciseName, date], function(err) {
            if (err) {
                console.error('Error deleting max update:', err);
                return res.status(500).json({ error: 'Failed to delete max update' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Max update not found for this date' });
            }
            
            // Log activity
            logUserActivity(userId, 'DELETE_MAX_UPDATE', `Removed max update for ${exerciseName} on ${date}`, 'max', null, null, null, req);
            
            res.json({ message: 'Max update deleted successfully' });
        }
    );
});

// Get user activity log (admin only)
app.get('/api/admin/user-activity/:username', authenticateToken, requireAdmin, (req, res) => {
    const username = req.params.username;

    db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        db.all(`SELECT ual.*, u.username 
                FROM user_activity_log ual
                JOIN users u ON ual.user_id = u.id
                WHERE ual.user_id = ?
                ORDER BY ual.created_at DESC 
                LIMIT 100`, [user.id], (err, activities) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to get user activity' });
            }

            res.json(activities);
        });
    });
});

// Promote user to admin (admin only)
app.post('/api/admin/promote-user', authenticateToken, requireAdmin, (req, res) => {
    const { username } = req.body;
    const adminId = req.user.id;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    db.get('SELECT id, is_admin FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.is_admin) {
            return res.status(400).json({ error: 'User is already an admin' });
        }

        db.run('UPDATE users SET is_admin = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id], function(err) {
                if (err) {
                    console.error('Error promoting user:', err);
                    return res.status(500).json({ error: 'Failed to promote user' });
                }

                // Log activity for both users
                logUserActivity(adminId, 'PROMOTE_USER', `Promoted ${username} to admin`, 'user', user.id, 'user', 'admin', req);
                logUserActivity(user.id, 'PROMOTED_TO_ADMIN', `Promoted to admin by admin`, 'user', user.id, 'user', 'admin', req);

                res.json({ message: `User ${username} has been promoted to admin` });
            }
        );
    });
});

// Demote admin to user (admin only) 
app.post('/api/admin/demote-user', authenticateToken, requireAdmin, (req, res) => {
    const { username } = req.body;
    const adminId = req.user.id;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    // Prevent demoting the main admin user
    if (username === 'admin') {
        return res.status(400).json({ error: 'Cannot demote the main admin user' });
    }

    db.get('SELECT id, is_admin FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!user.is_admin) {
            return res.status(400).json({ error: 'User is not an admin' });
        }

        db.run('UPDATE users SET is_admin = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [user.id], function(err) {
                if (err) {
                    console.error('Error demoting user:', err);
                    return res.status(500).json({ error: 'Failed to demote user' });
                }

                // Log activity for both users
                logUserActivity(adminId, 'DEMOTE_USER', `Demoted ${username} from admin to user`, 'user', user.id, 'admin', 'user', req);
                logUserActivity(user.id, 'DEMOTED_FROM_ADMIN', `Demoted from admin by admin`, 'user', user.id, 'admin', 'user', req);

                res.json({ message: `User ${username} has been demoted to regular user` });
            }
        );
    });
});

// Toggle user's leaderboard visibility (user can hide themselves)
app.post('/api/user/toggle-leaderboard-visibility', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { hidden } = req.body;

    if (typeof hidden !== 'boolean') {
        return res.status(400).json({ error: 'Hidden parameter must be a boolean' });
    }

    db.run('UPDATE users SET hidden_from_leaderboard = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [hidden ? 1 : 0, userId], function(err) {
            if (err) {
                console.error('Error updating leaderboard visibility:', err);
                return res.status(500).json({ error: 'Failed to update leaderboard visibility' });
            }

            const action = hidden ? 'hidden from' : 'shown on';
            logUserActivity(userId, 'TOGGLE_LEADERBOARD_VISIBILITY', `User ${action} leaderboard`, 'user', userId, (!hidden).toString(), hidden.toString(), req);

            res.json({ 
                message: `Successfully ${hidden ? 'hidden from' : 'shown on'} leaderboard`,
                hidden: hidden
            });
        }
    );
});

// Update user profile endpoint
app.put('/api/user/profile', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { fullName, school, customColors, socialLinks, age, bio, location, youtube, instagram, linkedin } = req.body;

    // Validate inputs
    if (customColors && typeof customColors !== 'object') {
        return res.status(400).json({ error: 'Custom colors must be an object' });
    }

    if (socialLinks && typeof socialLinks !== 'object') {
        return res.status(400).json({ error: 'Social links must be an object' });
    }

    if (age !== undefined && (isNaN(age) || age < 0 || age > 120)) {
        return res.status(400).json({ error: 'Age must be a valid number between 0 and 120' });
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const values = [];

    if (fullName !== undefined) {
        updates.push('full_name = ?');
        values.push(fullName);
    }

    if (school !== undefined) {
        updates.push('school = ?');
        values.push(school);
    }

    if (age !== undefined) {
        updates.push('age = ?');
        values.push(age);
    }

    if (bio !== undefined) {
        updates.push('bio = ?');
        values.push(bio);
    }

    if (location !== undefined) {
        updates.push('location = ?');
        values.push(location);
    }

    if (youtube !== undefined) {
        updates.push('youtube = ?');
        values.push(youtube);
    }

    if (instagram !== undefined) {
        updates.push('instagram = ?');
        values.push(instagram);
    }

    if (linkedin !== undefined) {
        updates.push('linkedin = ?');
        values.push(linkedin);
    }

    if (customColors !== undefined) {
        updates.push('custom_colors = ?');
        values.push(JSON.stringify(customColors));
    }

    if (socialLinks !== undefined) {
        updates.push('social_links = ?');
        values.push(JSON.stringify(socialLinks));
    }

    if (updates.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.run(query, values, function(err) {
        if (err) {
            console.error('Error updating user profile:', err);
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        res.json({ 
            success: true, 
            message: 'Profile updated successfully' 
        });
    });
});

// Admin toggle user's leaderboard visibility 
app.post('/api/admin/toggle-user-leaderboard-visibility', authenticateToken, requireAdmin, (req, res) => {
    const { username, hidden } = req.body;
    const adminId = req.user.id;

    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    if (typeof hidden !== 'boolean') {
        return res.status(400).json({ error: 'Hidden parameter must be a boolean' });
    }

    db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        db.run('UPDATE users SET hidden_from_leaderboard = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hidden ? 1 : 0, user.id], function(err) {
                if (err) {
                    console.error('Error updating user leaderboard visibility:', err);
                    return res.status(500).json({ error: 'Failed to update user leaderboard visibility' });
                }

                const action = hidden ? 'hidden from' : 'shown on';
                logUserActivity(adminId, 'ADMIN_TOGGLE_USER_LEADERBOARD', `Admin set ${username} ${action} leaderboard`, 'user', user.id, (!hidden).toString(), hidden.toString(), req);
                logUserActivity(user.id, 'LEADERBOARD_VISIBILITY_CHANGED', `Admin set user ${action} leaderboard`, 'user', user.id, (!hidden).toString(), hidden.toString(), req);

                res.json({ 
                    message: `Successfully set ${username} ${action} leaderboard`,
                    username: username,
                    hidden: hidden
                });
            }
        );
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