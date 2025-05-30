// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/OrderController');

router.post('/purchase/:id', OrderController.purchase);

module.exports = router;

