const mongoose = require("mongoose");

const stockLedgerSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        type: {
            type: String,
            enum: [
                "OPENING",
                "PURCHASE",
                "GRN",
                "SALE",
                "SALE_RETURN",
                "PURCHASE_RETURN",
                "DAMAGE",
                "ADJUSTMENT"
            ],
            required: true
        },

        direction: {
            type: String,
            enum: ["IN", "OUT"],
            required: true
        },

        qty: {
            type: Number,
            required: true
        },

        beforeStock: {
            type: Number,
            required: true
        },

        afterStock: {
            type: Number,
            required: true
        },

        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        referenceModel: {
            type: String,
            default: ""
        },

        note: {
            type: String,
            default: ""
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        role: {
            type: String,
            enum: ["super_admin", "admin", "cashier"],
            required: true
        },

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports =
    mongoose.models.StockLedger ||
    mongoose.model("StockLedger", stockLedgerSchema);