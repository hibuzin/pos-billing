const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        role: {
            type: String,
            enum: ["super_admin", "admin", "cashier"],
            required: true
        },

        module: {
            type: String,
            required: true
        },

        action: {
            type: String,
            required: true
        },

        description: {
            type: String,
            default: ""
        },

        referenceId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        documentId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null
        },

        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },

        oldData: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },

        newData: {
            type: mongoose.Schema.Types.Mixed,
            default: null
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
    {
        timestamps: true
    }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);