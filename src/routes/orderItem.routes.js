const express = require('express');
const router = express.Router();
const orderItemController = require('../controllers/orderItem.controller');

router.post('/', orderItemController.createOrderItem);
router.delete('/remove-order-item/:oi_id', orderItemController.deleteOrderItem);

module.exports = router;
