const mongoose = require("mongoose");

const cashRegisterSchema = new mongoose.Schema({
    openingAmount: { type: Number, required: true },
    cashSales: { type: Number, default: 0 },
    upiSales: { type: Number, default: 0 },
    cardSales: { type: Number, default: 0 },
    cashOut: { type: Number, default: 0 },

    cashOut: {
        type: Number,
        default: 0
    },

    cashOutHistory: [
        {
            amount: {
                type: Number,
                required: true
            },
            note: {
                type: String,
                default: ""
            },
            date: {
                type: Date,
                default: Date.now
            },
            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        }
    ],

    closingAmount: { type: Number, default: 0 },
    expectedCash: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ["open", "closed"],
        default: "open"
    },

    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },

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

    openedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }

}, { timestamps: true });

module.exports =
    mongoose.models.CashRegister ||
    mongoose.model("CashRegister", cashRegisterSchema);