let sql;
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());
const catalogServers = ["http://catalog_server:3000", "http://catalog-server-replica:3001"];
let catalogCounter = 0; // Counter to alternate between servers

// Function to get catalog server based on round-robin
function getCatalogServer() {
    const server = catalogServers[catalogCounter % 2]; // Toggle between 0 and 1
    catalogCounter++; // Increment the counter for the next request
    return server;
}

const orderServers = ["http://order_server:4000", "http://order-server-replica:4001"];
let orderCounter = 0; // Counter to alternate between servers

// Function to get catalog server based on round-robin
function getOrderServer() {
    const server2 = orderServers[orderCounter % 2]; // Toggle between 0 and 1
    orderCounter++; // Increment the counter for the next request
    return server2;
}


// Search for a book by title
app.get('/search/:topic', async (req, res) => {
  const  bookTitle  = req.params.topic; // Get book title from query params
  if (!bookTitle) {
    return res.status(400).json({ error: "Book title is required." });
  }

  try {
    const server=getCatalogServer();
    console.log(server);
    const result = await axios.get(`${server}/CATALOG_WEBSERVICE_IP/search/${bookTitle}`);
    res.json(result.data); // Send back the catalog server response to the client
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get info about a book by item number
app.get('/info/:id', async (req, res) => {
    try {
        const server = getCatalogServer();
        const response = await axios.get(`${server}/CATALOG_WEBSERVICE_IP/info/${req.params.id}`);
        
        // Forward the server identification header
        if (response.headers['x-server']) {
            res.setHeader('X-Server', response.headers['x-server']);
        }
        
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Purchase a book by item number
app.post('/purchase/:id', async (req, res) => {
  const  itemNumber = req.params.id; // Get item number from request body
  if (!itemNumber) {
    return res.status(400).json({ error: "Item number is required." });
  }

  try {
    const server2=getOrderServer();
    const result = await axios.post(`${server2}/ORDER_WEBSERVICE_IP/purchase/${itemNumber}`, {
      id: itemNumber,
      // orderCost: req.body.money, // Optional field
    });
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Client server running on port ${PORT}...`);
});
