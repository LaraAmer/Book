const express = require('express');
const axios = require('axios');
const app = express();
const port = 4000;

// Enhanced configuration
const config = {
    catalogService: {
        baseUrl: process.env.CATALOG_URL || 'http://catalog:3000',
        timeout: 10000 // Increased timeout
    },
    maxRetryAttempts: 3,
    retryDelay: 2000 // Increased delay
};

// Enhanced middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Improved request helper with logging
// Replace the makeRequestWithRetry function with:
async function makeRequestWithRetry(method, url, data = null, attempts = 0) {
    const startTime = Date.now();
    try {
        console.log(`[${method}] ${url} - Attempt ${attempts + 1}`);
        
        const response = await axios({
            method,
            url,
            data,
            timeout: config.catalogService.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': Date.now().toString()
            }
        });
        
        console.log(`[Success] ${method} ${url} - ${Date.now() - startTime}ms`);
        return response;
    } catch (error) {
        console.error(`[Error] ${method} ${url} - ${error.message}`);
        
        if (attempts >= config.maxRetryAttempts || 
            (error.response?.status >= 400 && error.response?.status < 500)) {
            throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        return makeRequestWithRetry(method, url, data, attempts + 1);
    }
}

// Enhanced purchase endpoint
app.post('/purchase/:id', async (req, res) => {
    const id = req.params.id;
    
    try {
        console.log(`[Order] Processing purchase for book ${id}`);
        
        // 1. Verify book availability
        const infoResponse = await axios.get(`${config.catalogService.baseUrl}/info/${id}`);
        const book = infoResponse.data.information;
        
        if (!book) {
            console.error(`[Order] Book ${id} not found`);
            return res.status(404).json({ error: 'Book not found' });
        }
        
        if (book.count <= 0) {
            console.error(`[Order] Book ${id} out of stock`);
            return res.status(400).json({ error: 'Book out of stock' });
        }
        
        // 2. Update inventory - with proper headers
        const updateResponse = await axios.post(
            `${config.catalogService.baseUrl}/updateCount/${id}`,
            { change: -1 },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`[Order] Successfully purchased book ${id}: ${book.name}`);
        
        // 3. Return success response
        res.json({
            success: true,
            message: 'Purchase successful',
            item: {
                id: id,
                name: book.name,
                cost: book.cost,
                remainingStock: book.count - 1
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`[Order] Purchase failed for book ${id}:`, error.message);
        
        if (error.response) {
            res.status(error.response.status).json({
                error: error.response.data.error || 'Catalog service error',
                details: error.response.data
            });
        } else if (error.code === 'ECONNABORTED') {
            res.status(504).json({ error: 'Catalog service timeout' });
        } else {
            res.status(500).json({ 
                error: 'Internal server error',
                details: error.message 
            });
        }
        // In the purchase endpoint, add this debug logging:
console.log(`Attempting to verify book ${id} at ${config.catalogService.baseUrl}/info/${id}`);

// And modify the error handling:
if (error.response) {
    console.error('Catalog service response error:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers
    });
} else {
    console.error('Network error contacting catalog:', error.message);
}
    }
});
// Enhanced health check
app.get('/health', async (req, res) => {
    try {
        const catalogHealth = await axios.get(`${config.catalogService.baseUrl}/health`, {
            timeout: 3000
        });
        
        res.json({
            status: 'healthy',
            service: 'order',
            catalogStatus: catalogHealth.data,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({
            status: 'degraded',
            service: 'order',
            catalogStatus: 'unreachable',
            error: err.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
    console.log(`[Order] Server running on port ${port}`);
    console.log(`[Order] Catalog service: ${config.catalogService.baseUrl}`);
});