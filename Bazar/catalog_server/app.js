const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

// Database setup
let db = new sqlite3.Database('./database/Book.db', (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the Book database.');
});

// Initialize database with books if not exists
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        topic TEXT NOT NULL,
        count INTEGER NOT NULL,
        cost REAL NOT NULL
    )`);

    // Insert initial data if empty
    db.get(`SELECT COUNT(*) as count FROM books`, [], (err, row) => {
        if (row.count === 0) {
            db.run(`INSERT INTO books (name, topic, count, cost) VALUES 
                   ('How to get a good grade in DOS in 40 minutes a day', 'distributed systems', 100, 50),
                   ('RPCs for Noobs', 'distributed systems', 100, 40),
                   ('Xen and the Art of Surviving Undergraduate School', 'undergraduate school', 100, 30),
                   ('Cooking for the Impatient Undergrad', 'undergraduate school', 100, 20)`);
        }
    });
});

// Routes
app.get('/search/:topic', (req, res) => {
    const topic = req.params.topic;
    db.all(`SELECT id, name FROM books WHERE topic = ?`, [topic], (err, rows) => {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        res.json({information: rows});
    });
});

app.get('/info/:id', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT name, count, cost FROM books WHERE id = ?`, [id], (err, row) => {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        if (!row) {
            res.status(404).json({error: 'Book not found'});
            return;
        }
        res.json({information: row});
    });
});

app.post('/updateCount/:id', (req, res) => {
    const id = req.params.id;
    const { change } = req.body;
    
    db.run(`UPDATE books SET count = count + ? WHERE id = ?`, [change, id], function(err) {
        if (err) {
            res.status(500).json({error: err.message});
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({error: 'Book not found'});
            return;
        }
        res.json({message: 'Count updated successfully'});
    });
});

app.listen(port, () => {
    console.log(`Catalog server running on port ${port}`);
});