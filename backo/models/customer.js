const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
    {
        customerId: {
            type: Number,
            required: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        gstNumber: {
            type: String,
            default: "",
            trim: true,
            uppercase: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        whatsappNumber: {
            type: String,
            default: ""
        },

        bankDetails: {
            accountHolderName: { type: String, default: "" },
            bankName: { type: String, default: "" },
            accountNumber: { type: String, default: "" },
            ifscCode: { type: String, default: "" },
            branchName: { type: String, default: "" }
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

        state: {
            type: String,
            default: "",
            trim: true
        },

        city: {
            type: String,
            default: "",
            trim: true
        },

        pincode: {
            type: String,
            default: "",
            trim: true
        },

        panNumber: {
            type: String,
            default: "",
            trim: true,
            uppercase: true
        },

        totalPurchases: {
            type: Number,
            default: 0
        },

        loyaltyPoints: {
            type: Number,
            default: 0
        },


        totalSpent: {
            type: Number,
            default: 0
        },

        paymentHistory: [
            {
                billId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Bill"
                },
                invoiceNo: String,

                amount: Number,

                paymentMethod: {
                    type: String,
                    enum: ["cash", "upi", "card", "cheque", "sodexo"]
                },

                remarks: String,

                details: {
                    upiId: String,

                    cardType: String,
                    cardLast4: String,

                    chequeNo: String,
                    chequeDate: Date,
                    bankName: String,
                    accountHolder: String
                },

                paidAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

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
        },

        roleCreatedBy: {
            type: String,
            enum: ["super_admin", "admin", "cashier"]
        }
    },
    {
        timestamps: true
    }
);




customerSchema.index(
    { superAdminId: 1, customerId: 1 },
    { unique: true }
);


customerSchema.index(
    { superAdminId: 1, phone: 1 },
    { unique: true }
);


customerSchema.index({
    superAdminId: 1,
    name: 1
});




customerSchema.set("toJSON", {
    transform: (doc, ret) => {


        ret.id = ret.customerId;

        delete ret.customerId;
        delete ret.__v;

        return ret;
    }
});



module.exports =
    mongoose.models.Customer ||
    mongoose.model("Customer", customerSchema);