const mongoose = require("mongoose");

const adminandcashierSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            lowercase: true,
            trim: true,
            default: ""
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false
        },

        role: {
            type: String,
            enum: ["admin", "cashier"],
            required: true
        },

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "adminandcashier",
            default: null
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        isActive: {
            type: Boolean,
            default: true
        },

        lastLogin: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

adminandcashierSchema.index(
    { phone: 1, superAdminId: 1 },
    { unique: true }
);

module.exports = mongoose.models.adminandcashier || mongoose.model("adminandcashier", adminandcashierSchema);