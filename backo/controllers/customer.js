const mongoose = require("mongoose");
const Customer = require("../models/customer");
const user = require("../models/user");
const Counter = require("../models/counter");
const Bill = require("../models/bill");
const Session = require("../models/session");
const CashRegister = require("../models/cashregister");
const AuditLog = require("../models/audit_log");
const { attachHierarchy } = require("../utils/hierarchy");
const DuePayment = require("../models/due_payment");

const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const upload = multer({ dest: "uploads/" });


const getNextCustomerId = async () => {
    const counter = await Counter.findOneAndUpdate(
        { name: "customer" },
        { $inc: { seq: 1 } },
        { returnDocument: "after", upsert: true }
    );

    return counter.seq;
};


exports.createCustomer = async (req, res) => {
    try {

        const {
            name,
            phone,
            whatsappNumber,
            email,
            address,
            state,
            city,
            pincode,
            gstNumber,
            panNumber,
            bankDetails
        } = req.body;

        const { userId, role, superAdminId, adminId } = req.user;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: "Name and phone are required"
            });
        }

        let finalSuperAdminId = null;
        let finalAdminId = null;

        if (role === "super_admin") {
            finalSuperAdminId = userId;
            finalAdminId = null;
        } else if (role === "admin") {
            finalSuperAdminId = superAdminId;
            finalAdminId = userId;
        } else if (role === "cashier") {
            finalSuperAdminId = superAdminId;
            finalAdminId = adminId || null;
        }

        if (!finalSuperAdminId) {
            return res.status(403).json({
                success: false,
                message: "Invalid hierarchy"
            });
        }

        const cleanPhone = phone.trim();

        const cleanWhatsapp =
            whatsappNumber && whatsappNumber.trim()
                ? whatsappNumber.trim()
                : cleanPhone;

        const existing = await Customer.findOne({
            phone: cleanPhone,
            superAdminId: finalSuperAdminId
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: "Customer already exists"
            });
        }

        const customerId = await getNextCustomerId();

        const customer = await Customer.create({
            customerId,
            name: name.trim(),

            phone: cleanPhone,
            whatsappNumber: cleanWhatsapp,

            email,
            address,
            state: state || "",
            city: city || "",
            pincode: pincode || "",

            gstNumber: gstNumber
                ? gstNumber.trim().toUpperCase()
                : "",

            panNumber: panNumber
                ? panNumber.trim().toUpperCase()
                : "",

            bankDetails: {
                accountHolderName: bankDetails?.accountHolderName || "",
                bankName: bankDetails?.bankName || "",
                accountNumber: bankDetails?.accountNumber || "",
                ifscCode: bankDetails?.ifscCode || "",
                branchName: bankDetails?.branchName || ""
            },

            createdBy: userId,
            roleCreatedBy: role,
            superAdminId: finalSuperAdminId,
            adminId: finalAdminId
        });

        res.status(201).json({
            success: true,
            message: "Customer created successfully",
            data: customer
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}


exports.getCustomerBalanceTotals = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const result = await Bill.aggregate([
            {
                $match: {
                    superAdminId: hierarchy.superAdminId,
                    paymentStatus: { $in: ["due", "partial"] }
                }
            },
            {

                $group: {
                    _id: "$customerId",
                    totalAmount: { $sum: "$summary.grandTotal" },
                    paidAmount: { $sum: "$paidAmount" },
                    balanceAmount: { $sum: "$pendingAmount" },
                    totalBills: { $sum: 1 },
                    billIds: {
                        $push: "$_id"
                    }

                }

            },
            {
                $lookup: {
                    from: "customers",
                    localField: "_id",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            {
                $unwind: "$customer"
            },
            {
                $project: {
                    _id: "$customer._id",
                    customerId: "$customer.customerId",
                    name: "$customer.name",
                    mobile: "$customer.phone",

                    billIds: 1,

                    balanceAmount: {
                        $round: ["$balanceAmount", 2]
                    },
                    totalAmount: {
                        $round: ["$totalAmount", 2]
                    },
                    paidAmount: {
                        $round: ["$paidAmount", 2]
                    },
                    totalBills: 1
                }
            },
            {
                $sort: {
                    balanceAmount: -1
                }
            }
        ]);

        const totalBalance = result.reduce(
            (sum, item) => sum + Number(item.balanceAmount || 0),
            0
        );

        res.json({
            success: true,
            totalCustomers: result.length,
            totalCustomerBalance: Number(totalBalance.toFixed(2)),
            data: result
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getCustomerBalanceDetails = async (req, res) => {
    try {
        const { customerId } = req.params;

        const hierarchy = attachHierarchy(req.user);

        const customerFilter = {
            superAdminId: hierarchy.superAdminId,
            $or: []
        };

        if (mongoose.Types.ObjectId.isValid(customerId)) {
            customerFilter.$or.push({
                _id: customerId
            });
        }

        const numericCustomerId = Number(customerId);

        if (
            Number.isFinite(numericCustomerId) &&
            numericCustomerId > 0
        ) {
            customerFilter.$or.push({
                customerId: numericCustomerId
            });
        }

        if (customerFilter.$or.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        const customer = await Customer.findOne(customerFilter);


        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const bills = await Bill.find({
            customerId: customer._id,
            paymentStatus: { $in: ["due", "partial"] },
            superAdminId: hierarchy.superAdminId
        })
            .sort({ createdAt: -1 });

        const totalBalance = bills.reduce(
            (sum, bill) => sum + Number(bill.pendingAmount || 0),
            0
        );

        res.json({
            success: true,
            customer: {
                customerId: customer.customerId,
                name: customer.name,
                mobile: customer.phone
            },
            totalBills: bills.length,
            totalBalance: Number(totalBalance.toFixed(2)),
            data: bills.map(bill => ({
                billId: bill._id,
                invoiceNo: bill.invoiceNo,
                billDate: bill.createdAt,
                totalAmount: bill.summary.grandTotal,
                paidAmount: bill.paidAmount,
                balanceAmount: bill.pendingAmount,
                paymentStatus: bill.paymentStatus
            }))
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.getCustomers = async (req, res) => {
    try {
        const { search = "" } = req.query;

        const hierarchy = attachHierarchy(req.user);

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } }
            ];
        }

        const customers = await Customer.find(filter)
            .sort({ createdAt: -1 })
            .lean();


        const balanceData = await Bill.aggregate([
            {
                $match: {
                    superAdminId: hierarchy.superAdminId
                }
            },
            {
                $group: {
                    _id: "$customerId",

                    totalAmount: {
                        $sum: "$summary.grandTotal"
                    },

                    paidAmount: {
                        $sum: "$paidAmount"
                    },

                    balanceAmount: {
                        $sum: "$pendingAmount"
                    },

                    totalBills: {
                        $sum: 1
                    }
                }
            }
        ]);

        const balanceMap = new Map(
            balanceData.map(item => [
                String(item._id),
                item
            ])
        );


        const data = customers.map(customer => {

            const balance = balanceMap.get(String(customer._id)) || {};

            const loyaltyPoints = Number(
                customer.loyaltyPoints || 0
            );

            return {
                ...customer,

                loyaltyPoints,

                redeemValue: loyaltyPoints.toFixed(2),

                totalAmount: Number(
                    Number(balance.totalAmount || 0).toFixed(2)
                ),

                paidAmount: Number(
                    Number(balance.paidAmount || 0).toFixed(2)
                ),

                balanceAmount: Number(
                    Number(balance.balanceAmount || 0).toFixed(2)
                ),

                totalBills: Number(
                    balance.totalBills || 0
                )
            };
        });

        const total = await Customer.countDocuments(filter);

        const totalCustomerBalance = data.reduce(
            (sum, customer) =>
                sum + Number(customer.balanceAmount || 0),
            0
        );

        const totalLoyaltyPoints = data.reduce(
            (sum, customer) =>
                sum + Number(customer.loyaltyPoints || 0),
            0
        );

        res.json({
            success: true,

            total,



            totalCustomerBalance: Number(
                totalCustomerBalance.toFixed(2)
            ),

             totalLoyaltyPoints: totalLoyaltyPoints,

            data
        });


    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.customersSearch = async (req, res) => {
    try {
        const { q } = req.query;
        const { userId, role, superAdminId } = req.user;

        if (!q || q.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Search value is required"
            });
        }

        const search = q.trim();

        let finalSuperAdminId;

        if (role === "super_admin") {
            finalSuperAdminId = userId;
        } else {
            finalSuperAdminId = superAdminId;
        }

        if (!finalSuperAdminId) {
            return res.status(403).json({
                success: false,
                message: "Invalid hierarchy"
            });
        }

        const filter = {
            superAdminId: finalSuperAdminId,
            $or: [
                { phone: { $regex: search, $options: "i" } },
                { name: { $regex: search, $options: "i" } }
            ]
        };


        if (!isNaN(search)) {
            filter.$or.push({
                customerId: Number(search)
            });
        }

        const customers = await Customer.find(filter)
            .select("customerId name phone email address")
            .limit(10)
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: "Customers fetched successfully",
            data: customers
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}


exports.getCustomerById = async (req, res) => {
    try {

        const { id } = req.params;

        const hierarchy = attachHierarchy(req.user);

        let filter = {
            superAdminId: hierarchy.superAdminId
        };


        if (mongoose.Types.ObjectId.isValid(id)) {
            filter._id = id;
        } else {
            filter.customerId = Number(id);
        }

        const customer = await Customer.findOne(filter);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const bills = await Bill.find({
            customerId: customer._id,
            superAdminId: hierarchy.superAdminId
        })
            .select(
                "invoiceNo createdAt summary paidAmount pendingAmount paymentStatus"
            )
            .sort({ createdAt: -1 });

        const totalBills = bills.length;

        const totalPurchases = bills.reduce(
            (sum, bill) => sum + Number(bill.summary?.grandTotal || 0),
            0
        );

        const totalPaid = bills.reduce(
            (sum, bill) => sum + Number(bill.paidAmount || 0),
            0
        );

        const totalBalance = bills.reduce(
            (sum, bill) => sum + Number(bill.pendingAmount || 0),
            0
        );

        res.json({
            success: true,
            customer: {
                _id: customer._id,
                customerId: customer.customerId,

                name: customer.name,
                mobile: customer.phone,
                whatsappNumber: customer.whatsappNumber || "",

                email: customer.email,

                address: customer.address,
                city: customer.city,
                state: customer.state,
                pincode: customer.pincode,

                gstNumber: customer.gstNumber,
                panNumber: customer.panNumber,

                bankDetails: {
                    accountHolderName: customer.bankDetails?.accountHolderName || "",
                    bankName: customer.bankDetails?.bankName || "",
                    accountNumber: customer.bankDetails?.accountNumber || "",
                    ifscCode: customer.bankDetails?.ifscCode || "",
                    branchName: customer.bankDetails?.branchName || ""
                },

                loyaltyPoints: customer.loyaltyPoints || 0,
                redeemValue: Number(customer.loyaltyPoints || 0).toFixed(2),
                totalSpent: customer.totalSpent || 0,

                totalBills,
                totalPurchases: Number(totalPurchases.toFixed(2)),
                totalPaid: Number(totalPaid.toFixed(2)),
                totalBalance: Number(totalBalance.toFixed(2)),

                bills: bills.map(bill => ({
                    billId: bill._id,
                    invoiceNo: bill.invoiceNo,
                    billDate: bill.createdAt,
                    totalAmount: bill.summary?.grandTotal || 0,
                    paidAmount: bill.paidAmount,
                    balanceAmount: bill.pendingAmount,
                    paymentStatus: bill.paymentStatus
                }))

            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}


exports.payCustomerBalance = async (req, res) => {
    try {

        const {
            billId,
            amount,
            paymentMethod,
            remarks,
            details = {}
        } = req.body;

        const hierarchy = attachHierarchy(req.user);

        const userId = req.user.userId || req.user.id;

        const activeSession = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (!activeSession) {
            return res.status(400).json({
                success: false,
                message: "Please start a session."
            });
        }

        const bill = await Bill.findOne({
            _id: billId,
            superAdminId: hierarchy.superAdminId
        });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }

        if (bill.pendingAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "This bill is already fully paid."
            });
        }

        const payAmount = Number(amount);

        if (payAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount."
            });
        }

        if (payAmount > bill.pendingAmount) {
            return res.status(400).json({
                success: false,
                message: `Payment exceeds pending amount (${bill.pendingAmount}).`
            });
        }

        const allowedMethods = [
            "cash",
            "upi",
            "card",
            "cheque",
            "sodexo"
        ];

        if (!allowedMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: "Invalid payment method."
            });
        }

        if (paymentMethod === "upi") {
            if (!details.upiId) {
                return res.status(400).json({
                    success: false,
                    message: "UPI ID is required."
                });
            }
        }

        if (paymentMethod === "card") {
            if (!details.cardType || !details.cardLast4) {
                return res.status(400).json({
                    success: false,
                    message: "Card type and last 4 digits are required."
                });
            }
        }

        if (paymentMethod === "cheque") {
            if (
                !details.chequeNo ||
                !details.chequeDate ||
                !details.bankName ||
                !details.accountHolder
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Cheque details are required."
                });
            }
        }

        bill.payments.push({
            method: paymentMethod,
            amount: payAmount,
            remarks,
            paidAt: new Date(),

            details: {
                upiId: details.upiId || "",

                cardType: details.cardType || "",
                cardLast4: details.cardLast4 || "",

                chequeNo: details.chequeNo || "",
                chequeDate: details.chequeDate || null,
                bankName: details.bankName || "",
                accountHolder: details.accountHolder || ""
            }
        });

        bill.paidAmount = Number(
            (bill.paidAmount + payAmount).toFixed(2)
        );

        bill.pendingAmount = Number(
            (bill.pendingAmount - payAmount).toFixed(2)
        );

        if (bill.pendingAmount <= 0) {
            bill.pendingAmount = 0;
            bill.paymentStatus = "paid";
        } else {
            bill.paymentStatus = "partial";
        }

        await bill.save();

        const customer = await Customer.findOne({
            _id: bill.customerId,
            superAdminId: hierarchy.superAdminId
        });

        if (customer) {
            customer.paymentHistory.push({
                billId: bill._id,
                invoiceNo: bill.invoiceNo,
                amount: payAmount,
                paymentMethod,
                remarks,

                details: {
                    upiId: details.upiId || "",

                    cardType: details.cardType || "",
                    cardLast4: details.cardLast4 || "",

                    chequeNo: details.chequeNo || "",
                    chequeDate: details.chequeDate || null,
                    bankName: details.bankName || "",
                    accountHolder: details.accountHolder || ""
                },

                paidAt: new Date()
            });

            await customer.save();
        }

        activeSession.totalSales = Number(
            ((activeSession.totalSales || 0) + payAmount).toFixed(2)
        );


        activeSession.cashIn = Number(
            ((activeSession.cashIn || 0) + payAmount).toFixed(2)
        );

        switch (paymentMethod) {
            case "cash":
                activeSession.cashSales += payAmount;
                break;
            case "upi":
                activeSession.upiSales += payAmount;
                break;
            case "card":
                activeSession.cardSales += payAmount;
                break;
            case "cheque":
                activeSession.chequeSales += payAmount;
                break;
            case "sodexo":
                activeSession.sodexoSales += payAmount;
                break;
        }


        if (!Array.isArray(activeSession.customerBalancePayments)) {
            activeSession.customerBalancePayments = [];
        }

        activeSession.customerBalancePayments.push({
            customerId: customer
                ? customer._id
                : bill.customerId,

            customerName: customer
                ? customer.name || ""
                : "",

            customerPhone: customer
                ? customer.phone || ""
                : "",

            billId: bill._id,

            invoiceNo: bill.invoiceNo,

            amount: payAmount,

            paymentMethod,

            remarks: remarks || "",

            details: {
                upiId: details.upiId || "",

                cardType: details.cardType || "",
                cardLast4: details.cardLast4 || "",

                chequeNo: details.chequeNo || "",
                chequeDate: details.chequeDate || null,
                bankName: details.bankName || "",
                accountHolder: details.accountHolder || ""
            },

            paidAt: new Date()
        });




        activeSession.expectedCash =
            Number(activeSession.openingAmount || 0) +
            Number(activeSession.cashSales || 0) +
            Number(activeSession.cashIn || 0) -
            Number(activeSession.cashOut || 0);

        await activeSession.save();


        const cashRegister = await CashRegister.findOne({
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (cashRegister) {

            switch (paymentMethod) {
                case "cash":
                    cashRegister.cashSales += payAmount;
                    break;
                case "upi":
                    cashRegister.upiSales += payAmount;
                    break;
                case "card":
                    cashRegister.cardSales += payAmount;
                    break;
                case "cheque":
                    cashRegister.chequeSales += payAmount;
                    break;
                case "sodexo":
                    cashRegister.sodexoSales += payAmount;
                    break;
            }

            cashRegister.expectedCash =
                cashRegister.openingAmount +
                cashRegister.cashSales -
                cashRegister.cashOut;

            await cashRegister.save();
        }

        await AuditLog.create({
            userId: userId,
            role: req.user.role,
            module: "Bill",
            action: "Balance Payment",
            description: `Balance payment received for Invoice ${bill.invoiceNo}`,
            referenceId: bill._id,
            metadata: {
                invoiceNo: bill.invoiceNo,
                paymentMethod,
                amount: payAmount,
                paidAmount: bill.paidAmount,
                pendingAmount: bill.pendingAmount
            },
            ...hierarchy
        });

        const lastPayment = bill.payments[bill.payments.length - 1];

        return res.status(200).json({
            success: true,
            message: "Balance payment received successfully.",
            data: {
                invoiceNo: bill.invoiceNo,

                customer: customer
                    ? {
                        id: customer._id,
                        customerId: customer.customerId,
                        name: customer.name,
                        phone: customer.phone
                    }
                    : null,

                paidAmount: bill.paidAmount,
                pendingAmount: bill.pendingAmount,
                paymentStatus: bill.paymentStatus,

                payment: lastPayment
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};




exports.getCustomerPaymentDetails = async (req, res) => {
    try {
        const { customerId } = req.params;

        const hierarchy = attachHierarchy(req.user);

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "Customer ID is required"
            });
        }

        const customerFilter = {
            superAdminId: hierarchy.superAdminId,
            $or: []
        };

        if (mongoose.Types.ObjectId.isValid(customerId)) {
            customerFilter.$or.push({
                _id: customerId
            });
        }

        if (!isNaN(customerId)) {
            customerFilter.$or.push({
                customerId: Number(customerId)
            });
        }

        if (customerFilter.$or.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        const customer = await Customer.findOne(customerFilter).lean();

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const bills = await Bill.find({
            customerId: customer._id,
            superAdminId: hierarchy.superAdminId
        })
            .select(
                "invoiceNo summary grandTotal paidAmount pendingAmount paymentStatus payments createdAt"
            )
            .sort({ createdAt: -1 })
            .lean();

        const paymentHistory = [];

        for (const bill of bills) {
            for (const payment of bill.payments || []) {
                paymentHistory.push({
                    billId: bill._id,
                    invoiceNo: bill.invoiceNo,

                    amount: Number(payment.amount || 0),

                    paymentMethod: payment.method || "",

                    remarks: payment.remarks || "",

                    details: {
                        upiId: payment.details?.upiId || "",

                        cardType: payment.details?.cardType || "",
                        cardLast4: payment.details?.cardLast4 || "",

                        chequeNo: payment.details?.chequeNo || "",
                        chequeDate: payment.details?.chequeDate || null,
                        bankName: payment.details?.bankName || "",
                        accountHolder:
                            payment.details?.accountHolder || ""
                    },

                    paidAt: payment.paidAt
                        ? new Date(payment.paidAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false
                        })
                        : new Date(bill.createdAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false
                        }),

                    billTotal: Number(
                        bill.summary?.grandTotal || 0
                    ),

                    billPaidAmount: Number(
                        bill.paidAmount || 0
                    ),

                    billPendingAmount: Number(
                        bill.pendingAmount || 0
                    ),

                    billPaymentStatus:
                        bill.paymentStatus || "due"
                });
            }
        }

        paymentHistory.sort(
            (a, b) =>
                new Date(b.paidAt) - new Date(a.paidAt)
        );

        const totalBillAmount = bills.reduce(
            (sum, bill) =>
                sum + Number(bill.summary?.grandTotal || 0),
            0
        );

        const totalPaidAmount = bills.reduce(
            (sum, bill) =>
                sum + Number(bill.paidAmount || 0),
            0
        );

        const totalPendingAmount = bills.reduce(
            (sum, bill) =>
                sum + Number(bill.pendingAmount || 0),
            0
        );

        return res.status(200).json({
            success: true,

            data: {
                customer: {
                    _id: customer._id,
                    customerId: customer.customerId,
                    name: customer.name,
                    phone: customer.phone || "",
                    email: customer.email || "",
                    loyaltyPoints: customer.loyaltyPoints || 0
                },

                summary: {
                    totalBills: bills.length,

                    totalBillAmount: Number(
                        totalBillAmount.toFixed(2)
                    ),

                    totalPaidAmount: Number(
                        totalPaidAmount.toFixed(2)
                    ),

                    totalPendingAmount: Number(
                        totalPendingAmount.toFixed(2)
                    )
                },

                paymentHistory
            }
        });

    } catch (error) {
        console.error(
            "GET CUSTOMER PAYMENT DETAILS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};



exports.updateCustomer = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            phone,
            whatsappNumber,
            email,
            address,
            state,
            city,
            pincode,
            gstNumber,
            panNumber,
            bankDetails,
            loyaltyPoints
        } = req.body;

        const hierarchy = attachHierarchy(req.user);

        let filter = {
            superAdminId: hierarchy.superAdminId
        };

        if (mongoose.Types.ObjectId.isValid(id)) {
            filter._id = id;
        } else {
            filter.customerId = Number(id);
        }

        const customer = await Customer.findOne(filter);

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        if (name) customer.name = name.trim();
        if (phone) {
            const cleanPhone = phone.trim();

            const existing = await Customer.findOne({
                phone: cleanPhone,
                superAdminId: hierarchy.superAdminId,
                _id: { $ne: customer._id }
            });

            if (existing) {
                return res.status(400).json({
                    success: false,
                    message: "Phone number already exists"
                });
            }

            customer.phone = cleanPhone;
        }

        if (whatsappNumber !== undefined) {
            customer.whatsappNumber = whatsappNumber
                ? whatsappNumber.trim()
                : "";
        }

        if (email !== undefined) {
            customer.email = email
                ? email.trim().toLowerCase()
                : "";
        }

        if (address !== undefined) customer.address = address;
        if (state !== undefined) customer.state = state;
        if (city !== undefined) customer.city = city;
        if (pincode !== undefined) customer.pincode = pincode;

        if (gstNumber !== undefined) {
            customer.gstNumber = gstNumber
                ? gstNumber.trim().toUpperCase()
                : "";
        }

        if (panNumber !== undefined) {
            customer.panNumber = panNumber
                ? panNumber.trim().toUpperCase()
                : "";
        }

        if (bankDetails !== undefined) {
            customer.bankDetails = {
                accountHolderName: bankDetails?.accountHolderName || "",
                bankName: bankDetails?.bankName || "",
                accountNumber: bankDetails?.accountNumber || "",
                ifscCode: bankDetails?.ifscCode || "",
                branchName: bankDetails?.branchName || ""
            };
        }

        if (loyaltyPoints !== undefined) {
            const points = Number(loyaltyPoints);

            if (isNaN(points)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid loyalty points"
                });
            }

            customer.loyaltyPoints = (customer.loyaltyPoints || 0) + points;

            if (customer.loyaltyPoints < 0) {
                customer.loyaltyPoints = 0;
            }
        }


        customer.lastUpdatedBy = req.user.userId;

        await customer.save();

        res.json({
            success: true,
            message: "Customer updated successfully",
            data: customer
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}

exports.deleteCustomer = async (req, res) => {
    try {
        const { superAdminId } = req.user;
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid customer ID"
            });
        }

        const deleted = await Customer.findOneAndDelete({
            _id: id,
            superAdminId: superAdminId
        });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Customer not found or not authorized"
            });
        }

        res.json({
            success: true,
            message: "Customer deleted successfully"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}

exports.customersExport = async (req, res) => {
    try {
        const { userId, role, superAdminId } = req.user;

        const finalSuperAdminId =
            role === "super_admin" ? userId : superAdminId;

        const customers = await Customer.find({
            superAdminId: finalSuperAdminId
        }).lean();


        let csv = "Name,Phone,Email,Address,Points,TotalSpent\n";


        customers.forEach(c => {
            csv += `${c.name || ""},${c.phone || ""},${c.email || ""},${c.address || ""},${c.loyaltyPoints || 0},${c.totalSpent || 0}\n`;
        });

        res.header("Content-Type", "text/csv");
        res.attachment("customers.csv");

        return res.send(csv);

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}

exports.customersImport = async (req, res) => {
    try {
        const { userId, role, superAdminId } = req.user;

        const finalSuperAdminId =
            role === "super_admin" ? userId : superAdminId;

        const results = [];

        fs.createReadStream(req.file.path)
            .pipe(csv())
            .on("data", (data) => results.push(data))
            .on("end", async () => {

                const bulk = results.map(item => ({
                    insertOne: {
                        document: {
                            name: item.Name,
                            phone: item.Phone,
                            email: item.Email,
                            address: item.Address,
                            loyaltyPoints: Number(item.Points) || 0,
                            totalSpent: Number(item.TotalSpent) || 0,
                            superAdminId: finalSuperAdminId,
                            createdBy: userId
                        }
                    }
                }));

                if (bulk.length > 0) {
                    await Customer.bulkWrite(bulk);
                }


                fs.unlinkSync(req.file.path);

                res.json({
                    success: true,
                    message: `${bulk.length} customers imported`
                });
            });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
}