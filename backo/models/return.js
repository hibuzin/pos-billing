const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema(
    {
        purchaseId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Purchase",
            required: true
        },

        supplierId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Supplier",
            required: true
        },

        returnNo: {
            type: String,
            required: true,
            unique: true,
            trim: true
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

                costPrice: {
                    type: Number,
                    default: 0
                },

                gstRate: {
                    type: mongoose.Schema.Types.Mixed,
                    enum: [0, 5, 12, 18, 40, "none"],
                    default: "none"
                },

                gstAmount: {
                    type: Number,
                    default: 0
                },

                totalAmount: {
                    type: Number,
                    default: 0
                },

                reason: {
                    type: String,
                    default: ""
                }
            }
        ],

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
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Return", returnSchema);