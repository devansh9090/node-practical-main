const Order = require("../schemas/order.schema");

const createOrder = async (req, res) => {
  try {
    const order = new Order(req.body);
    await order.save();
    res.status(201).send(order);
  } catch (error) {
    res.status(400).send(error);
  }
};

const requestHold = async (req, res) => {
  const { order_id } = req.params;
  const { order_request_hold } = req.body;

  // Add your logic to find the statuses of all order items in the order and update all order items
  // update order as well for order_request_hold and make order status as 'hold'
};

const updateOrder = async (req, res) => {
  // Add your logic to update the order here
};

const confirmOrder = async (req, res) => {
  // Add your logic to confirm the order here
};

module.exports = {
  createOrder,
  updateOrder,
  requestHold,
  confirmOrder,
};
