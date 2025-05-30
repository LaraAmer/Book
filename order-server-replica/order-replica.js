const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Purchase service
app.post('/ORDER_WEBSERVICE_IP/purchase/:id', async (req, res) => {
    const itemId = req.params.id;

    try {
        // Call the info service to retrieve book details
        const infoResponse = await axios.get(`http://catalog_server:3000/CATALOG_WEBSERVICE_IP/info/${itemId}`);
        const bookInfo = infoResponse.data.information;

        if (bookInfo.count <= 0) {
            return res.status(400).json({ message: 'Item is out of stock.' });
        }

        // Decrement the stock count by one
        const updatedCount = bookInfo.count - 1;

        // Call the updateCount service to update the stock
        await axios.put(`http://catalog-server-replica:3001/CATALOG_WEBSERVICE_IP/updateCount/${itemId}`, {
            count: updatedCount
        });
        await axios.put(`http://catalog_server:3000/CATALOG_WEBSERVICE_IP/updateCount/${itemId}`, {
            count: updatedCount
        });

        const { count, ...responseData } = bookInfo; // Exclude count from response
        res.status(200).json({ message: 'Purchase successful!', item: responseData });

    } catch (error) {
        console.error('Error during purchase:', error.message);
        if (error.response) {
            // Handle error from catalog service response
            return res.status(error.response.status).json({ error: error.response.data });
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server on port 4001 for the order service
const PORT = 4001;
app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});
