const sqlite3 = require('sqlite3').verbose();

// Helper function for database queries
const queryDatabase = (query, params) => {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database("./Database/Book.db");
        db.get(query, params, (err, row) => {
            db.close();
            if (err) reject(err);
            else resolve(row);
        });
    });
};

module.exports = {
    getInfo: async (req, res) => {
        const bookId = req.params.id;
        const cache = req.app.locals.cache;
        const cacheKey = `book_${bookId}`;

        try {
            // 1. Check cache first
            const cachedData = cache.get(cacheKey);
            if (cachedData) {
                console.log(`[Cache] Hit for book ${bookId}`);
                return res.status(200).json({
                    information: cachedData,
                    metadata: {
                        source: "cache",
                        timestamp: new Date().toISOString(),
                        ttl: cache.getTtl(cacheKey) - Date.now()
                    }
                });
            }

            console.log(`[Cache] Miss for book ${bookId}`);
            
            // 2. Query database
            const book = await queryDatabase(
                'SELECT name, count, cost FROM Books WHERE id = ?',
                [bookId]
            );

            if (!book) {
                return res.status(404).json({
                    error: "Book not found",
                    bookId: bookId
                });
            }

            // 3. Cache the result
            cache.set(cacheKey, book);
            console.log(`[Cache] Stored book ${bookId} (TTL: 100s)`);

            res.status(200).json({
                information: book,
                metadata: {
                    source: "database",
                    timestamp: new Date().toISOString(),
                    cached: true
                }
            });

        } catch (err) {
            console.error(`[Error] Fetching book ${bookId}:`, err.message);
            res.status(500).json({
                error: "Database operation failed",
                details: err.message,
                bookId: bookId
            });
        }
    },

    updatedCount: async (req, res) => {
        const bookId = req.params.id;
        const newCount = req.body.count;
        const cache = req.app.locals.cache;
        const cacheKey = `book_${bookId}`;

        try {
            // 1. Validate input
            if (typeof newCount !== 'number' || newCount < 0) {
                return res.status(400).json({
                    error: "Invalid count value",
                    received: newCount
                });
            }

            // 2. Update database
            const db = new sqlite3.Database("./Database/Book.db");
            const result = await new Promise((resolve, reject) => {
                db.run(
                    'UPDATE Books SET count = ? WHERE id = ?',
                    [newCount, bookId],
                    function(err) {
                        db.close();
                        if (err) reject(err);
                        else resolve(this.changes);
                    }
                );
            });

            if (result === 0) {
                return res.status(404).json({
                    error: "Book not found",
                    bookId: bookId
                });
            }

            // 3. Invalidate cache
            cache.del(cacheKey);
            console.log(`[Cache] Invalidated book ${bookId}`);

            // 4. Optionally: Update replica server's cache
            // (Would require HTTP call to replica's invalidation endpoint)

            res.status(200).json({
                message: "Book count updated successfully",
                bookId: bookId,
                newCount: newCount,
                cache: "invalidated"
            });

        } catch (err) {
            console.error(`[Error] Updating book ${bookId}:`, err.message);
            res.status(500).json({
                error: "Database operation failed",
                details: err.message,
                bookId: bookId
            });
        }
    }
};