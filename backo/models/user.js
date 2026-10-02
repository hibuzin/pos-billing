const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        CompanyName: {
            type: String,
            required: true
        },

        CompanyPhone: {
            type: String,
            required: true
        },

        CompanyEmail: {
            type: String,
            required: true,
            unique: true
        },

        password: {
            type: String,
            required: true,
            minlength: 6,
            select: false
        },

        address: {
            type: String,
            default: ""
        },

        state: {
            type: String,
            default: ""
        },

        pincode: {
            type: String,
            default: ""
        },

        city: {
            type: String,
            default: ""
        },

        gstnumber: {
            type: String,
            default: ""
        },


        role: {
            type: String,
            enum: ["super_admin", "admin", "cashier"],
            default: "cashier"
        },

        isActive: {
            type: Boolean,
            default: true
        },

        lastLogin: {
            type: Date
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },


        resetToken: {
            type: String,
            select: false
        },

        resetTokenExpire: {
            type: Date,
            select: false
        },

    },
    {
        timestamps: true
    }
);



module.exports = mongoose.models.User || mongoose.model("User", userSchema);