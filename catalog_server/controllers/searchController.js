const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const NodeCache = require('node-cache');

// Initialize database
const db = new sqlite3.Database("./Database/Book.db", sqlite3.OPEN_READWRITE, (err) => {
    if (err) return console.error(err.message);
});

// Initialize NodeCache with a TTL of 100 seconds and a check period of 120 seconds
const cache = new NodeCache({ stdTTL: 100, checkperiod: 120 });

// Cache-enabled bookSearch function
exports.bookSearch = (req, res) => {
    const topic = req.params.topic;

    // Check if data is already cached for the given topic
    const cachedData = cache.get(topic);
    if (cachedData) {
        console.log('Cache hit for topic:', topic);
        return res.status(200).json({ information: cachedData, source: "cache" });
    }

    console.log('Cache miss for topic:', topic);
    const sqlQuery = 'SELECT id, name FROM Books WHERE topic = ?';

    // Query the database if data is not in cache
    db.all(sqlQuery, [topic], (err, result) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (result && result.length > 0) {
            // Cache the result before responding
            cache.set(topic, result);
            res.status(200).json({ information: result, source: "database" });
        } else {
            res.status(404).json({ message: 'Books not found' });
        }
    });
};
