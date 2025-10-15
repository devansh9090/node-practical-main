const Order = require("../schemas/order.schema");
const OrderItem = require("../schemas/orderItem.schema");
const { getStatus } = require("../helper/orderItem");

const createOrderItem = async (req, res) => {
  try {
    const { oi_inventory_fk_inventory_id, oi_order_fk_order_id } = req.body;

    const existingOrderItem = await OrderItem.findOne({
      oi_inventory_fk_inventory_id,
      oi_order_fk_order_id,
    });

    if (existingOrderItem) {
      return res.status(400).json({
        error: "This inventory is already added to the order",
      });
    }

    const order = await Order.findOne({ order_id: oi_order_fk_order_id });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const { status, unavailableUntil } = await getStatus(order);

    const newOrderItem = new OrderItem({
      ...req.body,
      oi_pickup_at: order.order_pickup_at,
      oi_return_at: order.order_return_at,
      oi_status: status,
      oi_unavailable_until: unavailableUntil,
    });

    await newOrderItem.save();

    await Order.updateOne({ order_id: oi_order_fk_order_id }, { order_request_hold: false });

    res.status(201).json(newOrderItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const deleteOrderItem = async (req, res) => {
  // Add your delete order item logic here
  // Update the status of conflicting items as per README.md
};

module.exports = {
  createOrderItem,
  deleteOrderItem,
};
