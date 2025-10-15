const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const ORDER_ITEM_STATUS = {
  ON_HOLD_REQUEST: "on-hold-request",
  ON_HOLD: "on-hold",
  SECOND_HOLD_REQUEST: "2nd-hold-request",
  SECOND_HOLD: "2nd-hold",
  THIRD_HOLD_REQUEST: "3rd-hold-request",
  THIRD_HOLD: "3rd-hold",
  UNAVAILABLE: "unavailable",
  UNAVAILABLE_UNTIL: "unavailable-until",
  AVAILABLE: "available",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  CLEAN: "clean",
  LOSS: "loss",
  DAMAGE: "damage",
  OUT: "out",
  IN: "in",
};

const OrderItemSchema = new mongoose.Schema(
  {
    oi_id: { type: String, default: uuidv4 },
    oi_id: { type: String, default: uuidv4 },
    oi_created_fk_user_id: { type: String },
    oi_order_fk_order_id: { type: String },
    oi_order: { type: Object },
    oi_inventory_fk_inventory_id: { type: String },
    oi_inventory: { type: Object },
    oi_status: {
      type: String,
      enum: Object.values(ORDER_ITEM_STATUS),
    },
    oi_unavailable_until: { type: Date },
    oi_pickup_at: { type: Date },
    oi_return_at: { type: Date },
    oi_request_hold: { type: Boolean, default: false },
    oi_request_hold_at: { type: Date },
    oi_deleted: { type: Boolean, default: false },
  },
  {
    timestamps: {
      createdAt: "oi_created_at",
      updatedAt: "oi_updated_at",
    },
  }
);

module.exports = mongoose.model("OrderItem", OrderItemSchema);
