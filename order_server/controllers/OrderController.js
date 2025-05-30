const axios = require('axios');

exports.purchase = async (req, res) => {
    const item_id = req.params.id;

    try {
        // First try the main catalog server
        let response;
        try {
            response = await axios.get(`http://catalog_server:3000/CATALOG_WEBSERVICE_IP/info/${item_id}`);
        } catch (err) {
            // If main server fails, try the replica
            console.log("Main catalog server failed, trying replica...");
            response = await axios.get(`http://catalog-server-replica:3001/CATALOG_WEBSERVICE_IP/info/${item_id}`);
        }

        const bookInfo = response.data.information;
        if (!bookInfo) {
            return res.status(404).json({ message: 'Book not found.' });
        }

        if (bookInfo.count <= 0) {
            return res.status(400).json({ message: 'Item is out of stock.' });
        }

        const updatedCount = bookInfo.count - 1;

        // Update both servers
        const updatePromises = [
            axios.put(`http://catalog_server:3000/CATALOG_WEBSERVICE_IP/updateCount/${item_id}`, {
                count: updatedCount
            }),
            axios.put(`http://catalog-server-replica:3001/CATALOG_WEBSERVICE_IP/updateCount/${item_id}`, {
                count: updatedCount
            })
        ];

        await Promise.all(updatePromises);

        const { count, ...responseData } = bookInfo;
        return res.status(200).json({ 
            message: 'Purchase successful!', 
            item: responseData 
        });
    } catch (error) {
        console.error('Full error during purchase:', error);
        if (error.response) {
            return res.status(error.response.status).json({ 
                error: error.response.data.error || error.response.data.message 
            });
        }
        res.status(500).json({ 
            error: 'Internal Server Error',
            details: error.message 
        });
    }
};