const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({

    offerName: {
        type: String,
        required: true
    },

  
    minimumPurchase: {
        type: Number,
        default: 0
    },

    discountType: {
        type: String,
        enum: ["amount", "percentage"],
        default: "amount"
    },

    discountValue: {
        type: Number,
        default: 0
    },

    // Offer Type
    offerType: {
        type: String,
        enum: ["bill", "buy_get"],
        default: "bill"
    },

    // Buy X Get Y
    buyProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },

    buyQty: {
        type: Number,
        default: 0
    },

    freeProductId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
    },

    freeQty: {
        type: Number,
        default: 0
    },

    startDate: Date,

    endDate: Date,

    isActive: {
        type: Boolean,
        default: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });

module.exports = mongoose.models.Offer || mongoose.model("Offer", offerSchema);