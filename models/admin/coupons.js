const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    farmacia: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farmacia'
    },
    name: String,
    code: String,
    discount: Number,
    startingDate: Date,
    expiryDate: Date,
    active: {
      type: Boolean,
      default: true,
    },
    data:{
      type: Date,
      default: Date.now(),
    }
  },
);

const couponCLTN = mongoose.model("Coupon", couponSchema);
module.exports = couponCLTN;

