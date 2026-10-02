const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        manufacturerName: {
            type: String,
            default: "",
            trim: true
        },

        contactPerson: {
            type: String,
            default: "",
            trim: true
        },

        phone: {
            type: String,
            default: "",
            trim: true
        },

        email: {
            type: String,
            default: "",
            trim: true
        },

        address: {
            type: String,
            default: "",
            trim: true
        },

        gstin: {
            type: String,
            default: "",
            trim: true
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

brandSchema.index(
    { name: 1, superAdminId: 1 },
    { unique: true }
);

module.exports = mongoose.model("Brand", brandSchema);