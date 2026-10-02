

const mongoose = require("mongoose");

const SalesReturnSchema = new mongoose.Schema({
    returnNo: String,

    billId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Bill"
    },

    invoiceNo: String,

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer"
    },

    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product"
            },
            barcodeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Barcode"
            },
            barcode: String,

            productName: String,

            soldQty: Number,
            returnQty: Number,

            sellingPrice: Number,
            gstRate: {
                type: mongoose.Schema.Types.Mixed,
                enum: [0, 5, 12, 18, 40, "none"],
                default: "none"
            },
            
            gstAmount: Number,

            returnAmount: Number
        }
    ],

    totalReturnAmount: Number,

    refundMethod: {
        type: String,
        enum: ["cash", "upi", "card", "adjust"]
    },

    reason: String,

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    superAdminId: mongoose.Schema.Types.ObjectId,
    adminId: mongoose.Schema.Types.ObjectId

}, {
    timestamps: true
});


SalesReturnSchema.index({
    billId: 1,
    "items.productId": 1,
    "items.barcodeId": 1
});

module.exports = mongoose.model("SalesReturn", SalesReturnSchema);