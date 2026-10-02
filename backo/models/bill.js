const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
    items: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product"
            },

            barcodeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Barcode"
            },
            barcode: String,

            comboOfferId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "ComboOffer",
                default: null
            },

            comboProducts: [
                {
                    productId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "Product"
                    },
                    productName: String,
                    qty: Number
                }
            ],

            name: String,
            unit: {
                type: String,
                enum: ["pcs", "kg", "g"],
                default: "pcs"
            },
            unitValue: {
                type: Number,
                default: 1
            },
            unitText: String,

            totalkg: String,

            mrp: Number,

            productName: String,

            sellingPrice: Number,
            costPrice: Number,

            totalAmount: Number,

            discountPercent: {
                type: Number,
                default: 0
            },

            discountAmount: {
                type: Number,
                default: 0
            },

            appliedPriceLevel: {
                type: String,
                default: "normal"
            },

            appliedSlab: {
                minQty: Number,
                maxQty: {
                    type: Number,
                    default: null
                },
                price: Number
            },

            price: Number,

            qty: {
                type: Number,
                default: 1
            },

            freeQty: {
                type: Number,
                default: 0
            },


            freeProductId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Product",
                default: null
            },

            freeProductName: {
                type: String,
                default: ""
            },

            freeProductUnit: {
                type: String,
                default: ""
            },

            freeProductUnitValue: {
                type: Number,
                default: 0
            },


            totalGivenQty: {
                type: Number,
                default: 0
            },

            gstRate: {
                type: mongoose.Schema.Types.Mixed,
                enum: [0, 5, 12, 18, 40, "none"]
            },

            gstAmount: Number,
            finalPrice: Number
        }
    ],

    invoiceNo: {
        type: String,
        sparse: true
    },

    summary: {
        subTotal: {
            type: Number,
            default: 0
        },

        totalGST: {
            type: Number,
            default: 0
        },

        discount: {
            type: Number,
            default: 0
        },

        itemDiscountAmount: {
            type: Number,
            default: 0
        },

        billDiscountAmount: {
            type: Number,
            default: 0
        },

        billDiscountPercentage: {
            type: Number,
            default: 0
        },

        totalAmount: {
            type: Number,
            default: 0
        },

        offerDiscountAmount: {
            type: Number,
            default: 0
        },

        grandTotal: {
            type: Number,
            default: 0
        }

    },

    offer: {
        offerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Offer"
        },
        offerName: String,
        discountAmount: {
            type: Number,
            default: 0
        }
    },

    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        default: null
    },

    payments: [
        {
            method: {
                type: String,
                enum: ["cash", "upi", "card", "cheque", "sodexo"]
            },
            amount: Number,

            paidAt: {
                type: Date,
                default: Date.now
            },

            details: {
                upiId: String,

                cardType: String,
                cardLast4: String,

                chequeNo: String,
                chequeDate: Date,
                bankName: String,
                accountHolder: String
            }
        }
    ],

    sodexoSales: {
        type: Number,
        default: 0
    },


    paymentMethod: {
        type: String,
        enum: ["cash", "upi", "card", "cheque", "sodexo", "split", "due"],
        default: "cash"
    },

    paymentStatus: {
        type: String,
        enum: ["paid", "partial", "due"],
        default: "paid"
    },

    paidAmount: {
        type: Number,
        default: 0
    },

    returnAmount: {
        type: Number,
        default: 0
    },

    pendingAmount: {
        type: Number,
        default: 0
    },

    role: {
        type: String,
        default: ""
    },

    superAdminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
        index: true
    },

    cashier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true });

billSchema.index({ superAdminId: 1, invoiceNo: 1 }, { unique: true });

module.exports = mongoose.models.Bill || mongoose.model("Bill", billSchema);