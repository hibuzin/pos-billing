const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
    {
        expenseNo: {
            type: String,
            required: true
        },


        name: {
            type: String,
            trim: true
        },


        originalInvoiceNo: {
            type: String,
            default: ""
        },

        expenseDate: {
            type: Date,
            required: true
        },

        amount: {
            type: Number,
            required: true
        },

        paymentMode: {
            type: String,
            enum: ["cash", "upi", "card", "bank", "cheque", "other"],
            default: "cash"
        },

        note: {
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
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Expense", expenseSchema);