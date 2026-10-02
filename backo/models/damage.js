const mongoose = require("mongoose");

const damageSchema = new mongoose.Schema(
    {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
        },

        qty: {
            type: Number,
            required: true,
        },

        reason: {
            type: String,
            default: "",
        },

        stockBefore: {
            type: Number,
            required: true,
        },
        stockAfter: {
            type: Number,
            required: true,
        },


        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        cashierId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Damage", damageSchema);