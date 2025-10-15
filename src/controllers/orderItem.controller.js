const Order = require("../schemas/order.schema");
const OrderItem = require("../schemas/orderItem.schema");
const { ORDER_STATUS, ORDER_ITEM_STATUS } = require("../constants/status");
const { 
    getStatus,
    promoteConflictingHolds,
    updateUnavailableItemsAfterConfirmedRemoval 
} = require("../helper/orderItem");

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
  try {
    const { oi_id } = req.params;

    // 1. Find the order item
    const orderItem = await OrderItem.findOne({
      oi_id,
      oi_deleted: false
    });

    if (!orderItem) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    // 2. Find the parent order
    const order = await Order.findOne({ order_id: orderItem.oi_order_fk_order_id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Parent order not found"
      });
    }

    // 3. Store the status BEFORE deletion for flow determination
    const deletedItemStatus = orderItem.oi_status;

    // 4. Soft delete the order item
    orderItem.oi_deleted = true;
    orderItem.oi_updated_at = new Date();
    await orderItem.save();

    // 5. Handle status updates based on the deleted item's status
    let updatedConflictingItemsCount = 0;
    let action = '';

    // FLOW 1: unavailable or unavailable-until - NO CHANGES NEEDED
    if (deletedItemStatus === ORDER_ITEM_STATUS.UNAVAILABLE || deletedItemStatus === ORDER_ITEM_STATUS.UNAVAILABLE_UNTIL) {
      action = 'no_changes_needed';
      // No updates required for conflicting orders as per requirements
    }
    
    // FLOW 2: on-hold or on-hold-request - PROMOTE HOLD HIERARCHY
    else if (deletedItemStatus === ORDER_ITEM_STATUS.ON_HOLD || deletedItemStatus === ORDER_ITEM_STATUS.ON_HOLD_REQUEST) {
      action = 'promote_holds';
      updatedConflictingItemsCount = await promoteConflictingHolds(orderItem, order);
    }
    
    // FLOW 3: confirmed - UPDATE UNAVAILABLE ITEMS TO AVAILABLE IF NO OTHER CONFLICTS
    else if (deletedItemStatus === ORDER_ITEM_STATUS.CONFIRMED) {
      action = 'update_unavailable_to_available';
      updatedConflictingItemsCount = await updateUnavailableItemsAfterConfirmedRemoval(orderItem, order);
    }

    // 6. Check if all items in the order are deleted
    const remainingItems = await OrderItem.find({
      oi_order_fk_order_id: order.order_id,
      oi_deleted: false
    });

    // 7. If no items remain, update order status to cancelled
    if (remainingItems.length === 0) {
      order.order_status = ORDER_STATUS.CANCELLED;
      order.order_updated_at = new Date();
      await order.save();
    }

    // 8. Return success response with detailed information
    res.status(200).json({
      success: true,
      message: "Order item deleted successfully",
      data: {
        deletedItem: {
          oi_id: orderItem.oi_id,
          oi_inventory_fk_inventory_id: orderItem.oi_inventory_fk_inventory_id,
          oi_status: deletedItemStatus
        },
        action: action,
        updatedConflictingItemsCount: updatedConflictingItemsCount,
        orderStatus: remainingItems.length === 0 ? 'cancelled' : order.order_status,
        remainingItemsCount: remainingItems.length
      }
    });

  } catch (error) {
    console.error('Delete order item error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete order item',
      error: error.message
    });
  }
};

module.exports = {
  createOrderItem,
  deleteOrderItem,
};
