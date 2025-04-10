const express = require('express');
const axios = require('axios');
const app = express();
const port = 4000;

app.use(express.json());

app.post('/purchase/:id', async (req, res) => {
    const id = req.params.id;
    
    try {
        // First check if book exists and has stock
        const infoResponse = await axios.get(`http://catalog:3000/info/${id}`);
        const book = infoResponse.data.information;
        
        if (book.count <= 0) {
            return res.status(400).json({error: 'Book out of stock'});
        }
        
        // Decrement stock
        await axios.post(`http://catalog:3000/updateCount/${id}`, { change: -1 });
        
        res.json({
            message: 'Purchase successfully',
            item: { name: book.name, cost: book.cost }
        });
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return res.status(404).json({error: 'Book not found'});
        }
        res.status(500).json({error: error.message});
    }
});

app.listen(port, () => {
    console.log(`Order server running on port ${port}`);
});