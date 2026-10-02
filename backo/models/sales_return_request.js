const mongoose = require("mongoose");

const salesReturnRequestSchema = new mongoose.Schema(
    {
        invoiceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "SalesInvoice",
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
                },
                reason: {
                    type: String,
                    default: ""
                },
                amount: {
                    type: Number,
                    default: 0
                }
            }
        ],

        totalReturnAmount: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending"
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
            ref: "User"
        },

        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        rejectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("SalesReturnRequest", salesReturnRequestSchema);