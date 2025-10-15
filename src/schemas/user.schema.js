const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const UserSchema = new mongoose.Schema(
  {
    user_id: { type: String, default: uuidv4 },
    user_full_name: { type: String },
    user_first_name: { type: String },
    user_last_name: { type: String },
    user_dob: { type: Date },
    user_mobile_no: { type: String },
    user_country_code: { type: String },
    user_email: { type: String, required: true, unique: true },
    user_password: { type: String, sensitive: true },
  },
  {
    timestamps: {
      createdAt: "user_created_at",
      updatedAt: "user_updated_at",
    },
  }
);

module.exports = mongoose.model("User", UserSchema);