const OrderItem = require("../schemas/orderItem.schema");
const Order = require("../schemas/order.schema");
const { ORDER_ITEM_STATUS } = require("../constants/status");

/**
 * Find all conflicting order items for a given inventory and date range
 * A conflict occurs when:
 * - Same inventory item
 * - Different order
 * - Overlapping date ranges (pickup/return dates)
 *
 * @param {String} inventoryId - The inventory item ID to check for conflicts
 * @param {String} currentOrderId - The current order ID to exclude from conflicts
 * @param {Date} pickupDate - The pickup date to check for conflicts
 * @param {Date} returnDate - The return date to check for conflicts
 * @returns {Array} - Array of conflicting order items
 */
const findConflictingOrderItems = async (
    inventoryId,
    currentOrderId,
    pickupDate,
    returnDate
) => {
    try {
        // Find all order items with the same inventory item ID and different order ID
        const conflictingItems = await OrderItem.find({
            oi_inventory_fk_inventory_id: inventoryId,
            oi_order_fk_order_id: { $ne: currentOrderId }, // exclude current order ID
            oi_deleted: false, // exclude deleted order items
            $or: [
                // Case 1: Conflicting item's pickup falls within this order's date range
                {
                    oi_pickup_at: {
                        $lte: returnDate, // pickup date is less than or equal to return date
                        $gte: pickupDate, // pickup date is greater than or equal to pickup date
                    },
                },
                // Case 2: Conflicting item's return falls within this order's date range
                {
                    oi_return_at: {
                        $lte: returnDate, // return date is less than or equal to return date
                        $gte: pickupDate, // return date is greater than or equal to pickup date
                    },
                },
                // Case 3: Conflicting item completely encompasses this order's date range
                {
                    $and: [
                        { oi_pickup_at: { $lte: pickupDate } }, // pickup date is less than or equal to pickup date
                        { oi_return_at: { $gte: returnDate } }, // return date is greater than or equal to return date
                    ],
                },
            ],
        });

        return conflictingItems;
    } catch (error) {
        console.error("Error finding conflicting order items:", error);
        throw error;
    }
};

/**
 * Calculate the status for an order item based on conflicting orders
 * Status priority:
 * 1. unavailable-until: If any confirmed order conflicts
 * 2. unavailable: If 3+ hold requests exist for conflicting dates
 * 3. on-hold-request: First request (no conflicts)
 * 4. 2nd-hold-request: Second request (1 conflicting hold)
 * 5. 3rd-hold-request: Third request (2 conflicting holds)
 *
 * @param {Object} orderItem - The order item to calculate status for
 * @param {Object} order - The parent order containing pickup and return dates
 * @returns {Object} - Object containing the new status and unavailable_until date if applicable
 */
const calculateOrderItemStatus = async (orderItem, order) => {
    try {
        // Find all conflicting order items for the same inventory with overlapping dates
        const conflictingItems = await findConflictingOrderItems(
            orderItem.oi_inventory_fk_inventory_id,
            order.order_id,
            order.order_pickup_at,
            order.order_return_at
        );

        // Check if any conflicting order has confirmed status
        const confirmedItem = conflictingItems.find(
            (item) => item.oi_status === ORDER_ITEM_STATUS.CONFIRMED
        );
        if (confirmedItem) {
            return {
                status: ORDER_ITEM_STATUS.UNAVAILABLE_UNTIL,
                unavailable_until: confirmedItem.oi_return_at,
            };
        }

        // Count the number of hold requests and holds in conflicting orders
        const holdStatuses = [
            ORDER_ITEM_STATUS.ON_HOLD_REQUEST,
            ORDER_ITEM_STATUS.ON_HOLD,
            ORDER_ITEM_STATUS.SECOND_HOLD_REQUEST,
            ORDER_ITEM_STATUS.SECOND_HOLD,
            ORDER_ITEM_STATUS.THIRD_HOLD_REQUEST,
            ORDER_ITEM_STATUS.THIRD_HOLD,
        ];

        const conflictingHoldItems = conflictingItems.filter((item) =>
            holdStatuses.includes(item.oi_status)
        );

        // If more than 3 hold requests exist, mark as unavailable
        if (conflictingHoldItems.length >= 3) {
            return {
                status: ORDER_ITEM_STATUS.UNAVAILABLE,
                unavailable_until: null,
            };
        }

        // Determine the hold request level based on existing conflicts
        if (conflictingHoldItems.length === 0) {
            // First request - no conflicting holds
            return {
                status: ORDER_ITEM_STATUS.ON_HOLD_REQUEST,
                unavailable_until: null,
            };
        } else if (conflictingHoldItems.length === 1) {
            // Second request - one conflicting hold exists
            const hasFirstHold = conflictingHoldItems.some(
                (item) =>
                    item.oi_status === ORDER_ITEM_STATUS.ON_HOLD || item.oi_status === ORDER_ITEM_STATUS.ON_HOLD_REQUEST
            );
            if (hasFirstHold) {
                return {
                    status: ORDER_ITEM_STATUS.SECOND_HOLD_REQUEST,
                    unavailable_until: null,
                };
            }
        } else if (conflictingHoldItems.length === 2) {
            // Third request - two conflicting holds exist
            const validSecondHoldStatuses = [
                ORDER_ITEM_STATUS.ON_HOLD,
                ORDER_ITEM_STATUS.ON_HOLD_REQUEST,
                ORDER_ITEM_STATUS.SECOND_HOLD,
                ORDER_ITEM_STATUS.SECOND_HOLD_REQUEST,
            ];
            const hasValidStatuses = conflictingHoldItems.every((item) =>
                validSecondHoldStatuses.includes(item.oi_status)
            );

            if (hasValidStatuses) {
                return {
                    status: ORDER_ITEM_STATUS.THIRD_HOLD_REQUEST,
                    unavailable_until: null,
                };
            }
        }

        // Fallback: If no specific conditions met, default to on-hold-request
        return {
            status: ORDER_ITEM_STATUS.ON_HOLD_REQUEST,
            unavailable_until: null,
        };
    } catch (error) {
        console.error("Error calculating order item status:", error);
        throw error;
    }
};

/**
 * Update all order items in an order with their calculated statuses
 * This is used when requesting a hold on an order
 *
 * @param {String} orderId - The order ID to update items for
 * @param {Object} order - The order object with pickup/return dates
 * @returns {Array} - Array of updated order items
 */
const updateOrderItemsStatusForHold = async (orderId, order) => {
    try {
        // Find all order items belonging to this order
        const orderItems = await OrderItem.find({
            oi_order_fk_order_id: orderId,
            oi_deleted: false,
        });

        if (!orderItems || orderItems.length === 0) {
            throw new Error("No order items found for this order");
        }

        // Calculate and update status for each order item
        const updatePromises = orderItems.map(async (orderItem) => {
            const { status, unavailable_until } = await calculateOrderItemStatus(
                orderItem,
                order
            );

            // Update the order item with new status and metadata
            orderItem.oi_status = status;
            orderItem.oi_request_hold = true;
            orderItem.oi_request_hold_at = new Date();

            // Set unavailable_until date if applicable
            if (unavailable_until) {
                orderItem.oi_unavailable_until = unavailable_until;
            }

            return await orderItem.save();
        });

        // Wait for all order items to be updated
        const updatedOrderItems = await Promise.all(updatePromises);
        return updatedOrderItems;
    } catch (error) {
        console.error("Error updating order items status:", error);
        throw error;
    }
};

/**
 * Get status for a new order item being added
 * This is used by the createOrderItem controller
 * so we need to pass inventory_id separately
 *
 * @param {Object} order - The order object
 * @param {String} inventoryId - The inventory ID for the item being added
 * @returns {Object} - Object containing status and unavailableUntil date
 */
const getStatus = async (order, inventoryId) => {
    try {
        // Find conflicting items for this inventory and order date range
        const conflictingItems = await findConflictingOrderItems(
            inventoryId,
            order.order_id,
            order.order_pickup_at,
            order.order_return_at
        );

        // If no conflicts, item is available
        if (conflictingItems.length === 0) {
            return { status: ORDER_ITEM_STATUS.AVAILABLE };
        }

        // Check if any conflicting order has confirmed status
        const confirmedItem = conflictingItems.find(
            (item) => item.oi_status === ORDER_ITEM_STATUS.CONFIRMED
        );
        if (confirmedItem) {
            return {
                status: ORDER_ITEM_STATUS.UNAVAILABLE_UNTIL,
                unavailableUntil: confirmedItem.oi_return_at,
            };
        }

        // Check if all three hold levels exist (on-hold, 2nd-hold, 3rd-hold)
        const statuses = conflictingItems.map((item) => item.oi_status);
        if (
            statuses.includes(ORDER_ITEM_STATUS.ON_HOLD) &&
            statuses.includes(ORDER_ITEM_STATUS.SECOND_HOLD) &&
            statuses.includes(ORDER_ITEM_STATUS.THIRD_HOLD)
        ) {
            return { status: ORDER_ITEM_STATUS.UNAVAILABLE };
        }

        // Otherwise, item is available (conflicts exist but not blocking)
        return { status: ORDER_ITEM_STATUS.AVAILABLE };
    } catch (error) {
        console.error("Error getting status:", error);
        throw error;
    }
};

/**
 * Calculate new statuses for order items with updated dates
 * This is used when admin updates order dates to preview status changes
 * 
 * @param {String} orderId - The order ID
 * @param {Date} newPickupDate - The new pickup date
 * @param {Date} newReturnDate - The new return date
 * @returns {Object} - Object containing items with current and new statuses
 */
const calculateStatusesForDateUpdate = async (orderId, newPickupDate, newReturnDate) => {
    try {
        // Find all order items belonging to this order
        const orderItems = await OrderItem.find({
            oi_order_fk_order_id: orderId,
            oi_deleted: false,
        });

        if (!orderItems || orderItems.length === 0) {
            return { items: [], hasConfirmedConflicts: false };
        }

        // Create a temporary order object with new dates for calculation
        const tempOrder = {
            order_id: orderId,
            order_pickup_at: newPickupDate,
            order_return_at: newReturnDate,
        };

        const itemsWithStatuses = [];
        let hasConfirmedConflicts = false;

        // Calculate new status for each item
        for (const item of orderItems) {
            // Find conflicts with new dates
            const conflictingItems = await findConflictingOrderItems(
                item.oi_inventory_fk_inventory_id,
                orderId,
                newPickupDate,
                newReturnDate
            );

            // Check if any conflict is confirmed
            const confirmedConflict = conflictingItems.find(
                (conflictItem) => conflictItem.oi_status === ORDER_ITEM_STATUS.CONFIRMED
            );

            if (confirmedConflict) {
                hasConfirmedConflicts = true;
                itemsWithStatuses.push({
                    itemId: item.oi_id,
                    inventoryId: item.oi_inventory_fk_inventory_id,
                    currentStatus: item.oi_status,
                    newStatus: null,
                    error: "Confirmed conflict exists",
                    conflictingOrder: confirmedConflict.oi_order_fk_order_id,
                    unavailableUntil: confirmedConflict.oi_return_at
                });
            } else {
                // Calculate new status using the same logic as request hold
                const { status: newStatus, unavailable_until } = await calculateOrderItemStatus(
                    item,
                    tempOrder
                );

                itemsWithStatuses.push({
                    itemId: item.oi_id,
                    inventoryId: item.oi_inventory_fk_inventory_id,
                    currentStatus: item.oi_status,
                    newStatus: newStatus,
                    unavailableUntil: unavailable_until || null,
                    statusChanged: item.oi_status !== newStatus
                });
            }
        }

        return {
            items: itemsWithStatuses,
            hasConfirmedConflicts
        };
    } catch (error) {
        console.error("Error calculating statuses for date update:", error);
        throw error;
    }
};

/**
 * Promote hold statuses when a higher-priority hold is removed
 * Used when an on-hold or on-hold-request item is deleted
 * 
 * @param {Object} deletedItem - The deleted order item
 * @param {Object} order - The parent order of the deleted item
 * @returns {Number} - Number of items updated
 */
const promoteConflictingHolds = async (deletedItem, order) => {
    try {
        // Find all conflicting items
        const conflictingItems = await findConflictingOrderItems(
            deletedItem.oi_inventory_fk_inventory_id,
            order.order_id,
            order.order_pickup_at,
            order.order_return_at
        );

        let updatedCount = 0;

        // Promote each item's status according to the hierarchy
        for (const item of conflictingItems) {
            let newStatus = null;

            switch (item.oi_status) {
                case ORDER_ITEM_STATUS.SECOND_HOLD_REQUEST:
                    newStatus = ORDER_ITEM_STATUS.ON_HOLD_REQUEST;
                    break;
                case ORDER_ITEM_STATUS.SECOND_HOLD:
                    newStatus = ORDER_ITEM_STATUS.ON_HOLD;
                    break;
                case ORDER_ITEM_STATUS.THIRD_HOLD_REQUEST:
                    newStatus = ORDER_ITEM_STATUS.SECOND_HOLD_REQUEST;
                    break;
                case ORDER_ITEM_STATUS.THIRD_HOLD:
                    newStatus = ORDER_ITEM_STATUS.SECOND_HOLD;
                    break;
                // Items beyond third-hold (if any) or other statuses become available
                case ORDER_ITEM_STATUS.ON_HOLD:
                case ORDER_ITEM_STATUS.ON_HOLD_REQUEST:
                    // These don't get promoted, they stay as is
                    break;
                default:
                    // Any other lower-level holds become available
                    if (item.oi_status !== ORDER_ITEM_STATUS.AVAILABLE && 
                        item.oi_status !== ORDER_ITEM_STATUS.CONFIRMED && 
                        item.oi_status !== ORDER_ITEM_STATUS.UNAVAILABLE &&
                        item.oi_status !== ORDER_ITEM_STATUS.UNAVAILABLE_UNTIL) {
                        newStatus = ORDER_ITEM_STATUS.AVAILABLE;
                    }
            }

            // Update if status changed
            if (newStatus && newStatus !== item.oi_status) {
                await OrderItem.updateOne(
                    { _id: item._id },
                    {
                        oi_status: newStatus,
                        oi_updated_at: new Date()
                    }
                );
                updatedCount++;
            }
        }

        return updatedCount;
    } catch (error) {
        console.error("Error promoting conflicting holds:", error);
        throw error;
    }
};

/**
 * Update unavailable items after a confirmed order item is removed
 * Checks if items are blocked ONLY by the removed confirmed order
 * 
 * @param {Object} deletedItem - The deleted confirmed order item
 * @param {Object} order - The parent order of the deleted item
 * @returns {Number} - Number of items updated
 */
const updateUnavailableItemsAfterConfirmedRemoval = async (deletedItem, order) => {
    try {
        // Find conflicting items with unavailable or unavailable-until status
        const conflictingItems = await findConflictingOrderItems(
            deletedItem.oi_inventory_fk_inventory_id,
            order.order_id,
            order.order_pickup_at,
            order.order_return_at
        );

        // Filter to only unavailable and unavailable-until items
        const unavailableItems = conflictingItems.filter(
            item => item.oi_status === ORDER_ITEM_STATUS.UNAVAILABLE || item.oi_status === ORDER_ITEM_STATUS.UNAVAILABLE_UNTIL
        );

        let updatedCount = 0;

        for (const item of unavailableItems) {
            // Get the parent order for this item to check its dates
            const itemOrder = await Order.findOne({ order_id: item.oi_order_fk_order_id });
            
            if (!itemOrder) continue;

            // Check if there are any OTHER confirmed conflicts for this item
            // (excluding the order being deleted)
            const otherConfirmedConflicts = await OrderItem.find({
                oi_inventory_fk_inventory_id: item.oi_inventory_fk_inventory_id,
                oi_order_fk_order_id: { 
                    $ne: item.oi_order_fk_order_id,  // Not the item's own order
                    $ne: order.order_id  // Not the deleted order
                },
                oi_deleted: false,
                oi_status: ORDER_ITEM_STATUS.CONFIRMED,
                // Check for date overlap with this item's order
                oi_pickup_at: { $lte: itemOrder.order_return_at },
                oi_return_at: { $gte: itemOrder.order_pickup_at }
            });

            // If no other confirmed conflicts exist, make it available
            if (otherConfirmedConflicts.length === 0) {
                await OrderItem.updateOne(
                    { _id: item._id },
                    {
                        oi_status: ORDER_ITEM_STATUS.AVAILABLE,
                        oi_unavailable_until: null,
                        oi_updated_at: new Date()
                    }
                );
                updatedCount++;
            }
        }

        return updatedCount;
    } catch (error) {
        console.error("Error updating unavailable items after confirmed removal:", error);
        throw error;
    }
};

module.exports = {
    findConflictingOrderItems,
    calculateOrderItemStatus,
    updateOrderItemsStatusForHold,
    getStatus,
    calculateStatusesForDateUpdate,
    promoteConflictingHolds,
    updateUnavailableItemsAfterConfirmedRemoval,
};
