const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const ORDER_STATUS = {
  HOLD: 'hold',
  WORKING: 'working',
  CANCELLED: 'cancelled',
  CONFIRM: 'confirm',
  CHECK_OUT: 'check-out',
  PACK: 'pack',
  PICK_UP: 'pick-up',
  SHIP: 'ship',
  OUT: 'out',
  RETURNED: 'returned',
  CHECK_IN: 'check-in',
  ISSUE: 'issue',
  IN: 'in',
  RUSH_ORDER: 'rush-order'
};

const OrderSchema = new mongoose.Schema(
  {
    order_id: { type: String, default: uuidv4 },
    order_created_fk_user_id: { type: String },
    order_order_number: { type: String },
    order_name: { type: String },
    order_pickup_at: { type: Date },
    order_return_at: { type: Date },
    order_status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.WORKING,
    },
    order_request_hold: { type: Boolean, default: false },
  },
  {
    timestamps: {
      createdAt: "order_created_at",
      updatedAt: "order_updated_at",
    },
  }
);

module.exports = mongoose.model("Order", OrderSchema);
