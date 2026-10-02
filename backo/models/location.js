const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        type: {
            type: String,
            enum: ["STORE", "WAREHOUSE", "COUNTER", "RACK", "DELIVERY_ZONE"],
            required: true
        },

        code: {
            type: String,
            trim: true,
            default: ""
        },

        address: {
            type: String,
            trim: true,
            default: ""
        },

        city: {
            type: String,
            trim: true,
            default: ""
        },

        pincode: {
            type: String,
            trim: true,
            default: ""
        },

        contactPerson: {
            type: String,
            trim: true,
            default: ""
        },

        phone: {
            type: String,
            trim: true,
            default: ""
        },

        isActive: {
            type: Boolean,
            default: true
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
        }
    },
    { timestamps: true }
);

locationSchema.index(
    { name: 1, type: 1, superAdminId: 1 },
    { unique: true }
);

module.exports = mongoose.model("Location", locationSchema);