const mongoose = require("mongoose");

const gstReturnSchema = new mongoose.Schema(
    {
        returnType: {
            type: String,
            enum: ["GSTR1", "GSTR3B"],
            required: true
        },

        month: {
            type: Number,
            required: true
        },

        year: {
            type: Number,
            required: true
        },

        status: {
            type: String,
            enum: ["DRAFT", "READY", "FILED"],
            default: "DRAFT"
        },

        summary: {
            totalSales: { type: Number, default: 0 },
            taxableAmount: { type: Number, default: 0 },
            cgst: { type: Number, default: 0 },
            sgst: { type: Number, default: 0 },
            igst: { type: Number, default: 0 },
            totalTax: { type: Number, default: 0 }
        },

        filedDate: {
            type: Date,
            default: null
        },

        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
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
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("GstReturn", gstReturnSchema);