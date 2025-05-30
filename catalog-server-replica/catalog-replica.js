const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const NodeCache = require('node-cache');

const app = express();
const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 });
app.locals.cache = cache; // Make cache available to routes

app.use(express.json());

// Connect to SQLite database
const db = new sqlite3.Database("./Book-replica.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error("Database connection error:", err.message);
    console.log("Connected to the SQLite database.");
});

// Add server identification middleware
app.use((req, res, next) => {
    res.setHeader('X-Server', 'catalog-primary');
    next();
});

// Route to get book information
app.get('/CATALOG_WEBSERVICE_IP/info/:id', (req, res) => {
    const bookId = req.params.id;

    const cachedData = cache.get(bookId);
    if (cachedData) {
        console.log('Serving info from cache for book ID:', bookId);
        return res.status(200).json({ information: cachedData, source: "cache" });
    }

    const sqlQuery = 'SELECT name, count, cost FROM Books WHERE id = ?';
    db.get(sqlQuery, [bookId], (err, result) => {
        if (err) {
            console.error("Database query error:", err.message);
            return res.status(500).json({ error: 'Database query failed' });
        }

        if (result) {
            cache.set(bookId, result);
            res.status(200).json({ information: result, source: "database" });
        } else {
            res.status(404).json({ message: 'Book not found' });
        }
    });
});

// Route to search for books by topic
app.get('/CATALOG_WEBSERVICE_IP/search/:topic', (req, res) => {
    const topic = req.params.topic;

    const cachedSearch = cache.get(topic);
    if (cachedSearch) {
        console.log('Serving search results from cache for topic:', topic);
        return res.status(200).json({ information: cachedSearch, source: "cache" });
    }

    const sqlQuery = 'SELECT id, name FROM Books WHERE topic = ?';
    db.all(sqlQuery, [topic], (err, result) => {
        if (err) {
            console.error("Database query error:", err.message);
            return res.status(500).json({ error: 'Database query failed' });
        }

        if (result && result.length > 0) {
            cache.set(topic, result);
            res.status(200).json({ information: result, source: "database" });
        } else {
            res.status(404).json({ message: 'No books found for the specified topic' });
        }
    });
});

// Route to update book count
app.put('/CATALOG_WEBSERVICE_IP/updateCount/:id', (req, res) => {
    const bookId = req.params.id;
    const newCount = req.body.count;

    const sqlQuery = 'UPDATE Books SET count = ? WHERE id = ?';
    db.run(sqlQuery, [newCount, bookId], function (err) {
        if (err) {
            console.error("Database update error:", err.message);
            return res.status(500).json({ error: 'Failed to update book count.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Book not found.' });
        }

        // Invalidate cache
        cache.del(bookId);
        console.log("Cache invalidated for book ID:", bookId);
        res.status(200).json({ message: 'Book count updated successfully.' });
    });
});

// New route for cache invalidation
app.delete('/CATALOG_WEBSERVICE_IP/invalidateCache/:id', (req, res) => {
    const bookId = req.params.id;
    cache.del(bookId);
    console.log("Replica cache invalidated for book ID:", bookId);
    res.status(200).json({ message: 'Replica cache invalidated successfully' });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Catalog replica service running on port ${PORT}`);
});