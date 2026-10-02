const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
    {

        supplierId: {
            type: String,
            unique: true,
            required: true
        },

        supplierName: {
            type: String,
            required: true,
            trim: true
        },


        mobile: {
            type: String,
            required: true,
            trim: true,
            match: [/^[0-9]{10}$/, "Invalid mobile number"]
        },

        paymentMethod: {
            type: String,
            enum: ["cash", "upi", "card", "bank", "cheque", "other"],
            default: "cash"
        },

        details: {
            upiId: {
                type: String,
                default: ""
            },

            bankName: {
                type: String,
                default: ""
            },

            accountHolder: {
                type: String,
                default: ""
            },

            accountNumber: {
                type: String,
                default: ""
            },

            ifscCode: {
                type: String,
                default: ""
            }
        },


        gstNumber: {
            type: String,
            trim: true,
            uppercase: true,
            match: [
                /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/,
                "Invalid GST number"
            ]
        },

        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: ""
        },

        address: {
            type: String,
            default: ""
        },

        city: {
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

        panNumber: {
            type: String,
            default: ""
        },

        bankDetails: {
            accountHolderName: {
                type: String,
                default: ""
            },
            bankName: {
                type: String,
                default: ""
            },
            accountNumber: {
                type: String,
                default: ""
            },
            ifscCode: {
                type: String,
                default: ""
            },
            branchName: {
                type: String,
                default: ""
            }
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
            ref: "User",
            required: true
        },
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Supplier", supplierSchema);