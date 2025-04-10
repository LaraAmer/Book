const express = require('express');
const axios = require('axios');
const app = express();
const port = 5000;

// Configuration
const config = {
    services: {
        catalog: {
            baseUrl: process.env.CATALOG_SERVICE_URL || 'http://catalog:3000',
            timeout: 5000
        },
        order: {
            baseUrl: process.env.ORDER_SERVICE_URL || 'http://order:4000',
            timeout: 5000
        }
    },
    maxRetryAttempts: 3,
    retryDelay: 1000
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper function for resilient requests
async function makeServiceRequest(service, method, endpoint, data = null) {
    const serviceConfig = config.services[service];
    let lastError;
    
    for (let attempt = 0; attempt < config.maxRetryAttempts; attempt++) {
        try {
            const response = await axios({
                method,
                url: `${serviceConfig.baseUrl}${endpoint}`,
                data,
                timeout: serviceConfig.timeout
            });
            return response.data;
        } catch (error) {
            lastError = error;
            if (attempt < config.maxRetryAttempts - 1) {
                await new Promise(resolve => setTimeout(resolve, config.retryDelay));
            }
        }
    }
    
    throw lastError;
}

// Enhanced info endpoint
app.get('/info/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid book ID' });
        }

        const data = await makeServiceRequest('catalog', 'get', `/info/${id}`);
        res.json(data);
    } catch (error) {
        console.error('Info error:', error.message);
        const status = error.response?.status || 500;
        res.status(status).json({
            error: error.response?.data?.error || 'Service unavailable',
            details: status === 500 ? undefined : error.response?.data
        });
    }
});

// Enhanced search endpoint
app.get('/search/:topic', async (req, res) => {
    try {
        const topic = req.params.topic;
        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Topic is required' });
        }

        const data = await makeServiceRequest('catalog', 'get', `/search/${encodeURIComponent(topic)}`);
        res.json(data);
    } catch (error) {
        console.error('Search error:', error.message);
        const status = error.response?.status || 500;
        res.status(status).json({
            error: error.response?.data?.error || 'Service unavailable',
            details: status === 500 ? undefined : error.response?.data
        });
    }
});

// Enhanced purchase endpoint
app.post('/purchase/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ error: 'Invalid book ID' });
        }

        const data = await makeServiceRequest('order', 'post', `/purchase/${id}`);
        res.json(data);
    } catch (error) {
        console.error('Purchase error:', error.message);
        const status = error.response?.status || 500;
        res.status(status).json({
            error: error.response?.data?.error || 'Purchase failed',
            details: status === 500 ? undefined : error.response?.data
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const [catalogHealth, orderHealth] = await Promise.all([
            makeServiceRequest('catalog', 'get', '/health').catch(() => ({ status: 'unreachable' })),
            makeServiceRequest('order', 'get', '/health').catch(() => ({ status: 'unreachable' }))
        ]);

        res.json({
            status: 'healthy',
            services: {
                catalog: catalogHealth.status,
                order: orderHealth.status
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'degraded',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

app.listen(port, () => {
    console.log(`Client server running on port ${port}`);
    console.log('Available endpoints:');
    console.log(`- GET  /health`);
    console.log(`- GET  /info/:id`);
    console.log(`- GET  /search/:topic`);
    console.log(`- POST /purchase/:id`);
});