const mongoose = require("mongoose");

const priceHistorySchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        itemCode: {
            type: String,
            default: ""
        },

        productName: {
            type: String,
            default: ""
        },

        oldCostPrice: {
            type: Number,
            default: 0
        },

        newCostPrice: {
            type: Number,
            default: 0
        },

        oldSellingPrice: {
            type: Number,
            default: 0
        },

        newSellingPrice: {
            type: Number,
            default: 0
        },

        oldMrp: {
            type: Number,
            default: 0
        },

        newMrp: {
            type: Number,
            default: 0
        },

        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.PriceHistory ||
    mongoose.model("PriceHistory", priceHistorySchema);