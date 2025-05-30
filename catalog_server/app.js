const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bodyParser = require('body-parser');


const NodeCache = require('node-cache');

const cache = new NodeCache({
    stdTTL: 100,
    checkperiod: 120,
    useClones: false,
    deleteOnExpire: true
});

const app = express();
app.locals.cache = cache; // Make cache available to all routes

// Database connection with error handling
const db = new sqlite3.Database("./Database/Book.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error('[Database] Connection error:', err.message);
        process.exit(1);
    }
    console.log('[Database] Connected to SQLite database');
});

// Add server identification middleware
app.use((req, res, next) => {
    res.setHeader('X-Server', 'catalog-primary');
    next();
});
// Verify database structure on startup
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS Books (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        count INTEGER NOT NULL,
        cost INTEGER NOT NULL,
        topic TEXT NOT NULL
    )`, (err) => {
        if (err) console.error('[Database] Table creation error:', err.message);
    });
});

// Middleware
app.use(bodyParser.json());
app.use((req, res, next) => {
    console.log(`[Request] ${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
});

// Routes
const catalogRoutes = require('./routes/catalogRoutes');
app.use('/CATALOG_WEBSERVICE_IP', catalogRoutes);

// Health endpoint with cache diagnostics
app.get('/health', (req, res) => {
    const stats = cache.getStats();
    res.status(200).json({
        status: 'operational',
        uptime: process.uptime(),
        cache: {
            keys: cache.keys().length,
            hits: stats.hits,
            misses: stats.misses,
            size: stats.ksize
        },
        database: {
            status: db.open ? 'connected' : 'disconnected'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('[Error]', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// Server startup
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`[Server] Catalog service running on port ${PORT}`);
    console.log('[Cache] Initialized with stats:', cache.getStats());
    
    // Log initial book count
    db.get("SELECT COUNT(*) as count FROM Books", (err, row) => {
        if (err) console.error('[Database] Count error:', err.message);
        else console.log(`[Database] Contains ${row.count} books`);
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('[Server] Shutting down gracefully...');
    server.close(() => {
        db.close();
        console.log('[Database] Connection closed');
        process.exit(0);
    });
});