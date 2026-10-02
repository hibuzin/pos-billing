const mongoose = require("mongoose");

const annexureReportSchema = new mongoose.Schema(
    {
        reportType: {
            type: String,
            enum: [
                "SALES_INVOICES",
                "PURCHASE_INVOICES",
                "GST_RATE_WISE"
            ],
            required: true
        },

        fromDate: {
            type: Date,
            required: true
        },

        toDate: {
            type: Date,
            required: true
        },

        summary: {
            totalInvoices: { type: Number, default: 0 },
            taxableAmount: { type: Number, default: 0 },
            taxAmount: { type: Number, default: 0 },
            totalAmount: { type: Number, default: 0 }
        },

        data: {
            type: Array,
            default: []
        },

        generatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        role: {
            type: String,
            enum: ["super_admin", "admin", "cashier"],
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

module.exports = mongoose.model("AnnexureReport", annexureReportSchema);