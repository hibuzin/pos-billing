const mongoose = require("mongoose");

const productPriceHistorySchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        barcode: {
            type: String,
            default: ""
        },

       

        purchaseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Purchase",
            default: null
        },

        invoiceNo: {
            type: String,
            default: ""
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
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model(
    "ProductPriceHistory",
    productPriceHistorySchema
);