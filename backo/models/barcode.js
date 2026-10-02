const mongoose = require("mongoose");

const barcodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    comboOfferId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ComboOffer",
        default: null
    },

    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null
    },

    purchaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Purchase"
    },

    mrp: {
        type: Number,
        default: 0
    },

    sellingPrice: {
        type: Number,
        default: 0
    },

    costPrice: {
        type: Number,
        default: 0
    },

    gstRate: {
        type: mongoose.Schema.Types.Mixed,
        enum: [0, 5, 12, 18, 40, "none"],
        default: 0
    },

    unit: {
        type: String,
        enum: ["pcs", "kg", "g"],
        default: "pcs"
    },
    unitValue: {
        type: Number,
        default: 1
    },
    qty: {
        type: Number,
        default: 0
    },

    availableQty: {
        type: Number,
        default: 0
    },

    printQty: {
        type: Number,
        default: 1,
        min: 1
    },

    isSold: {
        type: Boolean,
        default: false
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

    cashierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

}, { timestamps: true });


barcodeSchema.index(
    {
        code: 1,
        superAdminId: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model("Barcode", barcodeSchema);