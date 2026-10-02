const mongoose = require("mongoose");

const duePaymentSchema = new mongoose.Schema(
    {
        customerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Customer",
            required: true
        },

        billId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Bill"
        },

        totalAmount: {
            type: Number,
            required: true
        },

        paidAmount: {
            type: Number,
            default: 0
        },

        pendingAmount: {
            type: Number,
            required: true
        },

        paymentStatus: {
            type: String,
            enum: ["paid", "partial", "due"],
            default: "paid"
        },

        dueDate: {
            type: String
        },

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("DuePayment", duePaymentSchema);