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
  IN: "in"
};

module.exports = {
  ORDER_STATUS,
  ORDER_ITEM_STATUS
};
