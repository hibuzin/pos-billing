const mongoose = require("mongoose");

const holdBillSchema = new mongoose.Schema({
    holdNo: {
        type: Number,
        required: true
    },

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null
    },

    customerName: {
        type: String,
        default: "Walk-in Customer"
    },

    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                required: true
            },

            name: String,
            brand: String,
            categoryId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Category"
            },
            categoryName: String,

            flavor: String,
            litters: String,

            qty: {
                type: Number,
                required: true
            },

            mrp: Number,
            sellingPrice: Number,
            gst: {
                type: Number,
                default: 0
            },

            barcode: String,

            subtotal: {
                type: Number,
                required: true
            }
        }
    ],

    totalAmount: {
        type: Number,
        required: true
    },

    note: {
        type: String,
        default: ""
    },

    status: {
        type: String,
        enum: ["hold", "billed", "cancelled"],
        default: "hold"
    },

    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }

}, { timestamps: true });

module.exports = mongoose.model("HoldBill", holdBillSchema);