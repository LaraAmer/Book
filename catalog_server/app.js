const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const app = express();
const port = 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Enhanced middleware setup
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Database setup with connection pool
let db;
const MAX_DB_RETRIES = 3;
let dbConnectionAttempts = 0;

function connectToDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database('./database/Book.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Database connection error:', err.message);
                if (dbConnectionAttempts < MAX_DB_RETRIES) {
                    dbConnectionAttempts++;
                    console.log(`Retrying database connection (attempt ${dbConnectionAttempts})...`);
                    setTimeout(() => connectToDatabase().then(resolve).catch(reject), 2000);
                } else {
                    reject(err);
                }
            } else {
                console.log('Connected to the Book database.');
                resolve();
            }
        });
    });
}

// Initialize database
// Initialize database
async function initializeDatabase() {
    try {
        await connectToDatabase();
        
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('PRAGMA foreign_keys = ON');
                db.run('PRAGMA journal_mode = WAL');
                
                db.run(`CREATE TABLE IF NOT EXISTS books (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    count INTEGER NOT NULL CHECK(count >= 0),
                    cost REAL NOT NULL CHECK(cost > 0),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`, (err) => {
                    if (err) return reject(err);
                    
                    db.get(`SELECT COUNT(*) as count FROM books`, [], (err, row) => {
                        if (err) return reject(err);
                        
                        if (row.count === 0) {
                            const stmt = db.prepare(`INSERT INTO books (name, topic, count, cost) VALUES (?, ?, ?, ?)`);
                            const books = [
                                ['How to get a good grade in DOS in 40 minutes a day', 'distributed systems', 100, 50],
                                ['RPCs for Noobs', 'distributed systems', 100, 40],
                                ['Xen and the Art of Surviving Undergraduate School', 'undergraduate school', 100, 30],
                                ['Cooking for the Impatient Undergrad', 'undergraduate school', 100, 20]
                            ];
                            
                            // Corrected Promise handling
                            const insertPromises = books.map(book => {
                                return new Promise((resolve, reject) => {
                                    stmt.run(book, function(err) {
                                        if (err) reject(err);
                                        else resolve();
                                    });
                                });
                            });
                            
                            Promise.all(insertPromises)
                                .then(() => stmt.finalize())
                                .then(resolve)
                                .catch(reject);
                        } else {
                            resolve();
                        }
                    });
                });
            });
        });
        
        console.log('Database initialization complete');
    } catch (err) {
        console.error('Database initialization failed:', err);
        process.exit(1);
    }
}

// Request validation middleware
const validateBookId = (req, res, next) => {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
        return res.status(400).json({ error: 'Invalid book ID' });
    }
    next();
};

const validateChangeValue = (req, res, next) => {
    const change = parseInt(req.body?.change);
    if (isNaN(change)) {
        return res.status(400).json({ error: 'Invalid change value' });
    }
    next();
};

// Enhanced routes with input validation
app.get('/search/:topic', (req, res) => {
    const topic = req.params.topic.trim();
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    db.all(`SELECT id, name FROM books WHERE topic = ?`, [topic], (err, rows) => {
        if (err) {
            console.error('Search error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ 
            status: 'success',
            data: rows || [],
            timestamp: new Date().toISOString()
        });
    });
});

app.get('/info/:id', validateBookId, (req, res) => {
    const id = parseInt(req.params.id);

    db.get(`SELECT id, name, count, cost FROM books WHERE id = ?`, [id], (err, row) => {
        if (err) {
            console.error('Info error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (!row) return res.status(404).json({ error: 'Book not found' });
        res.json({ 
            status: 'success',
            data: row,
            timestamp: new Date().toISOString()
        });
    });
});

app.post('/updateCount/:id', validateBookId, validateChangeValue, (req, res) => {
    const id = parseInt(req.params.id);
    const change = parseInt(req.body.change);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.get(`SELECT count FROM books WHERE id = ?`, [id], (err, row) => {
            if (err) {
                db.run('ROLLBACK');
                console.error('Count check error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!row) {
                db.run('ROLLBACK');
                return res.status(404).json({ error: 'Book not found' });
            }
            
            if (row.count + change < 0) {
                db.run('ROLLBACK');
                return res.status(400).json({ error: 'Insufficient stock' });
            }
            
            db.run(`UPDATE books SET count = count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, 
                [change, id], 
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('Update error:', err);
                        return res.status(500).json({ error: 'Update failed' });
                    }
                    
                    if (this.changes === 0) {
                        db.run('ROLLBACK');
                        return res.status(404).json({ error: 'Book not found' });
                    }
                    
                    db.get(`SELECT count FROM books WHERE id = ?`, [id], (err, updatedRow) => {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('Count verification error:', err);
                            return res.status(500).json({ error: 'Verification failed' });
                        }
                        
                        db.run('COMMIT');
                        res.json({ 
                            status: 'success',
                            message: 'Count updated successfully',
                            newCount: updatedRow.count,
                            timestamp: new Date().toISOString()
                        });
                    });
                }
            );
        });
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    const checkDb = new Promise((resolve) => {
        db.get('SELECT 1', (err) => {
            resolve(!err);
        });
    });
    
    const checkMemory = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal < 0.8;
    
    Promise.all([checkDb])
        .then(([dbHealthy]) => {
            const status = dbHealthy ? 'healthy' : 'degraded';
            res.json({ 
                status,
                details: {
                    database: dbHealthy ? 'connected' : 'unavailable',
                    memory: checkMemory ? 'ok' : 'warning',
                    uptime: process.uptime()
                },
                timestamp: new Date().toISOString()
            });
        });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    db.close(() => {
        console.log('Database connection closed.');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    db.close(() => {
        console.log('Database connection closed.');
        process.exit(0);
    });
});

// Start server
initializeDatabase().then(() => {
    app.listen(port, () => {
        console.log(`Catalog server running on port ${port}`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});