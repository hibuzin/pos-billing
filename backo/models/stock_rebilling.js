const mongoose = require("mongoose");

const counterStockRebillingSchema = new mongoose.Schema(
    {
        fromCounterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        toCounterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        items: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true
                },
                qty: {
                    type: Number,
                    required: true
                }
            }
        ],

        totalItems: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            enum: ["completed", "cancelled"],
            default: "completed"
        },

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model(
    "CounterStockRebilling",
    counterStockRebillingSchema
);