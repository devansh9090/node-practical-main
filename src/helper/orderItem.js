const getStatus = async (order) => {
  const conflictingItems = await OrderItem.find({
    oi_inventory_fk_inventory_id,
    oi_order_fk_order_id: { $ne: oi_order_fk_order_id },
    $or: [
      {
        oi_pickup_at: {
          $lte: order.order_return_at,
          $gte: order.order_pickup_at,
        },
      },
      {
        oi_return_at: {
          $lte: order.order_return_at,
          $gte: order.order_pickup_at,
        },
      },
      {
        $and: [
          { oi_pickup_at: { $lte: order.order_pickup_at } },
          { oi_return_at: { $gte: order.order_return_at } },
        ],
      },
    ],
  });

  if (conflictingItems.length === 0) {
    return { status: "available" };
  }

  const confirmedItem = conflictingItems.find(
    (item) => item.oi_status === "confirmed"
  );
  if (confirmedItem) {
    return {
      status: "unavailable-until",
      unavailableUntil: confirmedItem.oi_return_at,
    };
  }

  const statuses = conflictingItems.map((item) => item.oi_status);
  if (
    statuses.includes("on-hold") &&
    statuses.includes("2nd-hold") &&
    statuses.includes("3rd-hold")
  ) {
    return { status: "unavailable" };
  }

  return { status: "available" };
};

module.exports = {
  getStatus,
};
