const mongoose = require("mongoose");

// checking
const seperateSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        password: {
            type: String,
            required: true,
            select: false
        },

        address: {
            type: String,
            default: "",
            trim: true
        },

        state: {
            type: String,
            default: "",
            trim: true
        },

        pincode: {
            type: String,
            default: "",
            trim: true
        },

        city: {
            type: String,
            default: "",
            trim: true
        },
        gstnumber: {
            type: String,
            default: "",
            trim: true,
            uppercase: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Seperate", seperateSchema);