const mongoose = require("mongoose");

const grnItemSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        receivedQty: {
            type: Number,
            required: true,
            default: 1
        },

        costPrice: {
            type: Number,
            default: 0
        },

        barcodeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Barcode",
            default: null
        },

        barcode: {
            type: String,
            default: null
        }
    },
    { _id: false }
);

const grnSchema = new mongoose.Schema(
    {
        purchaseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Purchase",
            required: true
        },

        items: [grnItemSchema],

        totalItems: {
            type: Number,
            default: 0
        },

        isPartial: {
            type: Boolean,
            default: false
        },

        receivedByScan: {
            type: Boolean,
            default: false
        },

        notes: {
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

        cashierId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

grnSchema.index({
    purchaseId: 1,
    superAdminId: 1
});

module.exports = mongoose.model("GRN", grnSchema);