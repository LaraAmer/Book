
const express = require('express');
const bodyParser = require('body-parser');
const orderRouter = require('./routes/OrderRoutes'); 

const app = express();
const PORT = process.env.PORT || 4000; 

app.use(bodyParser.json()); // Middleware for parsing JSON requests

// Use the order router
app.use('/ORDER_WEBSERVICE_IP', orderRouter);

app.listen(PORT, () => {
    console.log(`Order server running on port ${PORT}...`);
});
