const Order = require("../schemas/order.schema");
const OrderItem = require("../schemas/orderItem.schema");
const { ORDER_STATUS, ORDER_ITEM_STATUS } = require("../constants/status");
const {
    updateOrderItemsStatusForHold,
    findConflictingOrderItems,
    calculateStatusesForDateUpdate
} = require("../helper/orderItem");

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
    try {
        const { order_id } = req.params;

        // Find the order by ID - Remove .lean() to get Mongoose document
        const order = await Order.findOne({ order_id: order_id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Update all order items with calculated statuses using helper function
        const updatedOrderItems = await updateOrderItemsStatusForHold(
            order_id,
            order
        );

        // Update the order to reflect the hold request
        order.order_request_hold = true;
        order.order_status = ORDER_STATUS.HOLD;
        await order.save();

        // Return success response with updated order and order items
        res.status(200).json({
            success: true,
            message: "Hold request processed successfully",
            data: {
                order: order,
                orderItems: updatedOrderItems,
            },
        });
    } catch (error) {
        console.error("Error processing hold request:", error);
        res.status(500).json({
            success: false,
            message: "Error processing hold request",
            error: error.message,
        });
    }
};

const updateOrder = async (req, res) => {
    try {
        const { order_id } = req.params;
        const { order_pickup_at, order_return_at, status, confirmed } = req.body;

        // 1. Find the order
        const order = await Order.findOne({ order_id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // 2. Check if order can be updated
        if (order.order_status === ORDER_STATUS.CONFIRM) {
            return res.status(400).json({
                success: false,
                message: 'Cannot update a confirmed order'
            });
        }

        // 3. Handle date updates with two-step confirmation flow
        if (order_pickup_at || order_return_at) {
            const newPickupDate = order_pickup_at ? new Date(order_pickup_at) : order.order_pickup_at;
            const newReturnDate = order_return_at ? new Date(order_return_at) : order.order_return_at;

            // Calculate status changes for new dates
            const { items: itemsWithStatuses, hasConfirmedConflicts } = await calculateStatusesForDateUpdate(
                order_id,
                newPickupDate,
                newReturnDate
            );

            // VALIDATION: Reject if any confirmed conflicts exist
            if (hasConfirmedConflicts) {
                const conflictedItems = itemsWithStatuses.filter(item => item.error);
                return res.status(409).json({
                    success: false,
                    message: 'Cannot update order dates due to confirmed conflicts',
                    conflictedItems: conflictedItems
                });
            }

            // If not confirmed by admin, return preview of status changes
            if (!confirmed) {
                return res.status(200).json({
                    success: true,
                    requiresConfirmation: true,
                    message: 'Date update will cause status changes. Please review and confirm.',
                    data: {
                        currentDates: {
                            pickup: order.order_pickup_at,
                            return: order.order_return_at
                        },
                        newDates: {
                            pickup: newPickupDate,
                            return: newReturnDate
                        },
                        itemStatusChanges: itemsWithStatuses,
                        changedItemsCount: itemsWithStatuses.filter(item => item.statusChanged).length
                    }
                });
            }

            // Admin confirmed: Apply the date updates and status changes
            // Update order dates
            order.order_pickup_at = newPickupDate;
            order.order_return_at = newReturnDate;
            order.order_updated_at = new Date();

            if (status) {
                order.order_status = status;
            }

            await order.save();

            // Update each order item with new dates and calculated status
            const updatePromises = itemsWithStatuses.map(async (itemStatus) => {
                const updateData = {
                    oi_pickup_at: newPickupDate,
                    oi_return_at: newReturnDate,
                    oi_status: itemStatus.newStatus,
                    oi_updated_at: new Date()
                };

                // Set unavailable_until if applicable
                if (itemStatus.unavailableUntil) {
                    updateData.oi_unavailable_until = itemStatus.unavailableUntil;
                }

                return await OrderItem.updateOne(
                    { oi_id: itemStatus.itemId, oi_deleted: false },
                    { $set: updateData }
                );
            });

            await Promise.all(updatePromises);

            // Get updated order with items
            const updatedOrder = await Order.findOne({ order_id });
            const updatedOrderItems = await OrderItem.find({
                oi_order_fk_order_id: order_id,
                oi_deleted: false
            });

            return res.status(200).json({
                success: true,
                message: 'Order dates and item statuses updated successfully',
                data: {
                    order: updatedOrder,
                    orderItems: updatedOrderItems,
                    statusChanges: itemsWithStatuses
                }
            });
        }

        // 4. Handle non-date updates (status only)
        const updates = {};
        if (status) updates.order_status = status;
        updates.order_updated_at = new Date();

        const updatedOrder = await Order.findOneAndUpdate(
            { order_id },
            { $set: updates },
            { new: true }
        );

        // If order status is being updated to hold, update order items
        if (status === ORDER_STATUS.HOLD) {
            await updateOrderItemsStatusForHold(order_id, updatedOrder);
        }

        // Get updated order with items
        const orderWithItems = await Order.findOne({ order_id });
        const orderItems = await OrderItem.find({
            oi_order_fk_order_id: order_id,
            oi_deleted: false
        });

        res.status(200).json({
            success: true,
            message: 'Order updated successfully',
            data: {
                order: orderWithItems,
                orderItems
            }
        });

    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update order',
            error: error.message
        });
    }
};

const confirmOrder = async (req, res) => {
    try {
        const { order_id } = req.params;

        // 1. Find the order
        const order = await Order.findOne({ order_id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        // 2. Check if order can be confirmed
        if (order.order_status === ORDER_STATUS.CANCELLED) {
            return res.status(400).json({
                success: false,
                message: 'Cannot confirm a cancelled order'
            });
        }

        if (order.order_status === ORDER_STATUS.CONFIRM) {
            return res.status(400).json({
                success: false,
                message: 'Order is already confirmed'
            });
        }

        // 3. Get all order items
        const orderItems = await OrderItem.find({
            oi_order_fk_order_id: order_id,
            oi_deleted: false
        });

        if (!orderItems || orderItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Order has no items to confirm'
            });
        }

        // 4. VALIDATION: Check if all items have status 'available' or 'on-hold'
        const invalidItems = orderItems.filter(
            item => item.oi_status !== ORDER_ITEM_STATUS.AVAILABLE && item.oi_status !== ORDER_ITEM_STATUS.ON_HOLD
        );

        if (invalidItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Order can only be confirmed if all items have status "available" or "on-hold"',
                invalidItems: invalidItems.map(item => ({
                    itemId: item.oi_id,
                    inventoryId: item.oi_inventory_fk_inventory_id,
                    currentStatus: item.oi_status
                }))
            });
        }

        // 5. Update order status to confirmed
        order.order_status = ORDER_STATUS.CONFIRM;
        order.order_updated_at = new Date();

        // 6. Update all order items to confirmed
        await Promise.all([
            order.save(),
            OrderItem.updateMany(
                { oi_order_fk_order_id: order_id, oi_deleted: false },
                {
                    oi_status: ORDER_ITEM_STATUS.CONFIRMED,
                    oi_updated_at: new Date()
                }
            )
        ]);

        // 7. Find and update conflicting items in other orders to unavailable-until
        // Statuses to exclude from update (per requirements)
        const excludedStatuses = [
            ORDER_ITEM_STATUS.CANCELLED,
            ORDER_ITEM_STATUS.AVAILABLE,
            ORDER_ITEM_STATUS.IN,
            ORDER_ITEM_STATUS.UNAVAILABLE,
            ORDER_ITEM_STATUS.UNAVAILABLE_UNTIL
        ];

        for (const item of orderItems) {
            // Use helper function to find all conflicting order items
            const allConflictingItems = await findConflictingOrderItems(
                item.oi_inventory_fk_inventory_id,
                order_id,
                order.order_pickup_at,
                order.order_return_at
            );

            // Apply additional filters specific to confirm order flow
            const conflictingItems = allConflictingItems.filter(conflictItem =>
                conflictItem.oi_request_hold === true &&  // Only items that have been requested for hold
                !excludedStatuses.includes(conflictItem.oi_status)  // Exclude specified statuses
            );

            if (conflictingItems.length > 0) {
                // Update conflicting items to unavailable-until
                await OrderItem.updateMany(
                    { _id: { $in: conflictingItems.map(i => i._id) } },
                    {
                        oi_status: ORDER_ITEM_STATUS.UNAVAILABLE_UNTIL,
                        oi_unavailable_until: order.order_return_at,  // Set to confirmed order's return date
                        oi_updated_at: new Date()
                    }
                );
            }
        }

        // 8. Get final order with updated items
        const confirmedOrder = await Order.findOne({ order_id });
        const confirmedOrderItems = await OrderItem.find({
            oi_order_fk_order_id: order_id,
            oi_deleted: false
        });

        res.status(200).json({
            success: true,
            message: 'Order confirmed successfully',
            data: {
                order: confirmedOrder,
                orderItems: confirmedOrderItems
            }
        });

    } catch (error) {
        console.error('Confirm order error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm order',
            error: error.message
        });
    }
};

module.exports = {
    createOrder,
    updateOrder,
    requestHold,
    confirmOrder,
};
