const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
    {

        Date: {
            type: String,
            default: ""
        },

        startTime: {
            type: Date,
            default: Date.now
        },

        endTime: {
            type: Date,
            default: null
        },

        cashier: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        adminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        superAdminId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        closedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        cashMovements: [
            {
                type: {
                    type: String,
                    enum: ["cash_in", "cash_out"],
                    required: true
                },
                amount: {
                    type: Number,
                    required: true
                },
                reason: {
                    type: String,
                    default: ""
                },
                remarks: {
                    type: String,
                    default: ""
                },

                supplierName: {
                    type: String,
                    default: ""
                },

                supplierId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Supplier",
                    default: null
                },

                createdAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        settledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        openingAmount: {
            type: Number,
            required: true,
            default: 0
        },

        openingDenomination: {
            coin1: { type: Number, default: 0 },
            coin2: { type: Number, default: 0 },
            coin5: { type: Number, default: 0 },
            coin10: { type: Number, default: 0 },
            coin20: { type: Number, default: 0 },

            note10: { type: Number, default: 0 },
            note20: { type: Number, default: 0 },
            note50: { type: Number, default: 0 },
            note100: { type: Number, default: 0 },
            note200: { type: Number, default: 0 },
            note500: { type: Number, default: 0 }
        },

        closingAmount: {
            type: Number,
            default: 0
        },



        totalSales: {
            type: Number,
            default: 0
        },

        totalBills: {
            type: Number,
            default: 0
        },


        cashSales: {
            type: Number,
            default: 0
        },

        upiSales: {
            type: Number,
            default: 0
        },

        cardSales: {
            type: Number,
            default: 0
        },

        dueSales: {
            type: Number,
            default: 0
        },

        cashIn: {
            type: Number,
            default: 0
        },

        expectedCash: {
            type: Number,
            default: 0
        },

        cashRefund: {
            type: Number,
            default: 0
        },

        upiRefund: {
            type: Number,
            default: 0
        },

        cardRefund: {
            type: Number,
            default: 0
        },

        cashIn: {
            type: Number,
            default: 0
        },

        cashOut: {
            type: Number,
            default: 0
        },


        customerBalancePayments: [
            {
                customerId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Customer",
                    default: null
                },

                customerName: {
                    type: String,
                    default: ""
                },

                customerPhone: {
                    type: String,
                    default: ""
                },

                billId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Bill",
                    default: null
                },

                invoiceNo: {
                    type: String,
                    default: ""
                },

                amount: {
                    type: Number,
                    required: true
                },

                paymentMethod: {
                    type: String,
                    enum: [
                        "cash",
                        "upi",
                        "card",
                        "cheque",
                        "sodexo"
                    ],
                    required: true
                },

                remarks: {
                    type: String,
                    default: ""
                },

                details: {
                    upiId: {
                        type: String,
                        default: ""
                    },

                    cardType: {
                        type: String,
                        default: ""
                    },

                    cardLast4: {
                        type: String,
                        default: ""
                    },

                    chequeNo: {
                        type: String,
                        default: ""
                    },

                    chequeDate: {
                        type: Date,
                        default: null
                    },

                    bankName: {
                        type: String,
                        default: ""
                    },

                    accountHolder: {
                        type: String,
                        default: ""
                    }
                },

                paidAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],


        cashInHistory: [
            {
                amount: {
                    type: Number,
                    required: true
                },
                remarks: {
                    type: String,
                    default: ""
                },
                addedAt: {
                    type: Date,
                    default: Date.now
                }
            }
        ],

        cashCounted: {
            type: Number,
            default: 0
        },



        closingDenomination: {
            coin1: { type: Number, default: 0 },
            coin2: { type: Number, default: 0 },
            coin5: { type: Number, default: 0 },
            coin10: { type: Number, default: 0 },
            coin20: { type: Number, default: 0 },

            note10: { type: Number, default: 0 },
            note20: { type: Number, default: 0 },
            note50: { type: Number, default: 0 },
            note100: { type: Number, default: 0 },
            note200: { type: Number, default: 0 },
            note500: { type: Number, default: 0 }
        },

        difference: {
            type: Number,
            default: 0
        },


        settlementStatus: {
            type: String,
            enum: ["not_settled", "matched", "short", "excess"],
            default: "not_settled"
        },

        settledAt: {
            type: Date
        },

        status: {
            type: String,
            enum: ["open", "settled", "closed"],
            default: "open"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Session", sessionSchema);