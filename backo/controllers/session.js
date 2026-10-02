const mongoose = require("mongoose");
const Session = require("../models/session");
const Customer = require("../models/customer");
const Bill = require("../models/bill");
const AdminAndCashier = require("../models/admin_and_cashier");
const User = require("../models/user");
const Supplier = require("../models/supplier");
const { attachHierarchy } = require("../utils/hierarchy");
const { blacklistToken } = require("../utils/tokenBlacklist");


exports.startSession = async (req, res) => {
    try {
        const {
            openingAmount = 0,
            openingDenomination = {}
        } = req.body || {};

        const hierarchy = attachHierarchy(req.user);
        const userId = req.user.userId || req.user.id;

        const alreadyOpen = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (alreadyOpen) {
            return res.status(400).json({
                success: false,
                message: "Session already opened"
            });
        }



        const d = openingDenomination || {};

        const denominationAmount =
            (Number(d.coin1 || 0) * 1) +
            (Number(d.coin2 || 0) * 2) +
            (Number(d.coin5 || 0) * 5) +
            (Number(d.coin10 || 0) * 10) +
            (Number(d.coin20 || 0) * 20) +
            (Number(d.note10 || 0) * 10) +
            (Number(d.note20 || 0) * 20) +
            (Number(d.note50 || 0) * 50) +
            (Number(d.note100 || 0) * 100) +
            (Number(d.note200 || 0) * 200) +
            (Number(d.note500 || 0) * 500);

        const hasDenomination =
            Object.keys(d).length > 0 &&
            Object.values(d).some(value => Number(value) > 0);

        const finalOpeningAmount = hasDenomination
            ? denominationAmount
            : Number(openingAmount);

        const session = await Session.create({
            cashier: userId,
            adminId: hierarchy.adminId || null,
            superAdminId: hierarchy.superAdminId,
            openingAmount: finalOpeningAmount,
            openingDenomination,
            expectedCash: finalOpeningAmount
        });


        const sessionObj = session.toObject();

        sessionObj.Date = session.createdAt.toLocaleDateString("en-GB");

        sessionObj.startTime = session.createdAt.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });


        return res.status(201).json({
            success: true,
            message: "Session started successfully",
            session: sessionObj
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



exports.getCurrentSession = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const userId = req.user.userId || req.user.id;

        const session = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            status: { $in: ["open", "settled", "closed"] }
        }).sort({ createdAt: -1 });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "No active session found"
            });
        }

        const bills = await Bill.find({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            createdAt: {
                $gte: session.startTime,
                $lte: new Date()
            }
        });

        let totalSales = 0;
        let cashSales = 0;
        let upiSales = 0;
        let cardSales = 0;
        let dueSales = 0;

        for (const bill of bills) {
            const grandTotal = Number(bill.summary?.grandTotal || 0);
            totalSales += grandTotal;

            for (const pay of bill.payments || []) {

                let amount = Number(pay.amount || 0);

                if (
                    pay.method === "cash" &&
                    Number(bill.returnAmount || 0) > 0
                ) {
                    amount = Number(
                        (amount - Number(bill.returnAmount)).toFixed(2)
                    );
                }

                const method = String(pay.method || "").toLowerCase();

                if (method === "cash") cashSales += amount;
                if (method === "upi") upiSales += amount;
                if (method === "card") cardSales += amount;
            }

            if (bill.paymentStatus === "due" || bill.paymentStatus === "partial") {
                const paidAmount = (bill.payments || []).reduce(
                    (sum, p) => {

                        let amount = Number(p.amount || 0);

                        if (
                            p.method === "cash" &&
                            Number(bill.returnAmount || 0) > 0
                        ) {
                            amount -= Number(bill.returnAmount);
                        }

                        return sum + amount;

                    },
                    0
                );

                dueSales += grandTotal - paidAmount;
            }
        }

        const expectedCash =
            Number(session.openingAmount || 0) +
            cashSales +
            Number(session.cashIn || 0) -
            Number(session.cashRefund || 0) -
            Number(session.cashOut || 0);

        session.totalSales = Number(totalSales.toFixed(2));
        session.totalBills = bills.length;
        session.cashSales = Number(cashSales.toFixed(2));
        session.upiSales = Number(upiSales.toFixed(2));
        session.cardSales = Number(cardSales.toFixed(2));
        session.dueSales = Number(dueSales.toFixed(2));
        session.expectedCash = Number(expectedCash.toFixed(2));

        await session.save();


        return res.status(200).json({
            success: true,
            session: {
                ...session.toObject(),

                denomination: {
                    openingDenomination: session.openingDenomination || {},
                    closingDenomination: session.closingDenomination || {},
                    startDate: session.startTime.toLocaleDateString("en-GB"),
                    startTime: session.startTime.toLocaleTimeString("en-IN")

                }
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.cashIn = async (req, res) => {
    try {
        const {
            customerId,
            amount,
            note = ""
        } = req.body;

        const cashAmount = Number(amount);

        // Validate amount
        if (!cashAmount || cashAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid cash amount is required"
            });
        }

        const hierarchy = attachHierarchy(req.user);
        const userId = req.user.userId || req.user.id;

        // Find cashier's open session
        const session = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (!session) {
            return res.status(400).json({
                success: false,
                message: "No open session found. Please start session first."
            });
        }

        /*
         * =====================================================
         * FLOW 1: CUSTOMER BALANCE PAYMENT
         * =====================================================
         */

        if (customerId) {

            // Find customer
            const customer = await Customer.findOne({
                _id: customerId,
                superAdminId: hierarchy.superAdminId
            });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found"
                });
            }

            // Current outstanding balance
            const currentBalance = Number(
                customer.balanceAmount || 0
            );

            // Customer has no outstanding balance
            if (currentBalance <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Customer has no outstanding balance"
                });
            }

            // Cannot pay more than outstanding balance
            if (cashAmount > currentBalance) {
                return res.status(400).json({
                    success: false,
                    message: `Customer balance is only ${currentBalance}`
                });
            }

            // Reduce customer balance
            customer.balanceAmount =
                currentBalance - cashAmount;

            // Optional total paid tracking
            customer.totalPaid =
                Number(customer.totalPaid || 0) + cashAmount;

            await customer.save();

            /*
             * Update session cash-in
             */
            session.cashIn =
                Number(session.cashIn || 0) + cashAmount;

            /*
             * Recalculate expected cash
             */
            session.expectedCash =
                Number(session.openingAmount || 0) +
                Number(session.cashSales || 0) +
                Number(session.cashIn || 0) -
                Number(session.cashOut || 0);

            /*
             * Make sure payment history exists
             */
            if (!Array.isArray(session.customerBalancePayments)) {
                session.customerBalancePayments = [];
            }

            /*
             * Store customer balance payment
             */
            session.customerBalancePayments.push({
                customerId: customer._id,
                customerName: customer.name || "",
                customerPhone: customer.phone || "",
                amount: cashAmount,
                paymentMethod: "cash",
                remarks: note || "",
                paidAt: new Date()
            });

            await session.save();

            return res.status(200).json({
                success: true,
                message: "Customer balance payment recorded successfully",

                cashIn: cashAmount,

                customer: {
                    id: customer._id,
                    name: customer.name,
                    previousBalance: currentBalance,
                    paidAmount: cashAmount,
                    remainingBalance: customer.balanceAmount
                },

                session: {
                    sessionId: session._id,
                    cashIn: session.cashIn,
                    expectedCash: session.expectedCash
                }
            });
        }

        /*
         * =====================================================
         * FLOW 2: GENERAL CASH-IN
         * =====================================================
         *
         * No customerId means this is a normal/general
         * cash addition to the cashier session.
         */

        session.cashIn =
            Number(session.cashIn || 0) + cashAmount;

        /*
         * Recalculate expected cash
         */
        session.expectedCash =
            Number(session.openingAmount || 0) +
            Number(session.cashSales || 0) +
            Number(session.cashIn || 0) -
            Number(session.cashOut || 0);

        /*
         * Optional general cash-in history
         */
        if (!Array.isArray(session.cashInHistory)) {
            session.cashInHistory = [];
        }

        session.cashInHistory.push({
            amount: cashAmount,
            remarks: note || "",
            addedAt: new Date()
        });

        await session.save();

        return res.status(200).json({
            success: true,
            message: "Cash in recorded successfully",

            cashIn: cashAmount,

            session: {
                sessionId: session._id,
                cashIn: session.cashIn,
                expectedCash: session.expectedCash
            }
        });

    } catch (error) {
        console.error("Cash In Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.cashOut = async (req, res) => {
    try {
        const { amount, reason } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid amount is required"
            });
        }

        const hierarchy = attachHierarchy(req.user);
        const userId = req.user.userId || req.user.id;

        const session = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "No active session found"
            });
        }

        const bills = await Bill.find({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            createdAt: {
                $gte: session.startTime,
                $lte: new Date()
            }
        });

        let cashSales = 0;

        for (const bill of bills) {
            for (const payment of bill.payments || []) {
                if (payment.method === "cash") {
                    cashSales += Number(payment.amount || 0);
                }
            }
        }

        const availableCash =
            Number(session.openingAmount || 0) +
            cashSales +
            Number(session.cashIn || 0) -
            Number(session.cashRefund || 0) -
            Number(session.cashOut || 0);

        if (Number(amount) > availableCash) {
            return res.status(400).json({
                success: false,
                message: "Cash out amount exceeds available cash"
            });
        }

        session.cashMovements.push({
            type: "cash_out",
            amount: Number(amount),
            reason: reason || "",
            createdAt: new Date()
        });

        session.cashOut += Number(amount);

        await session.save();



        return res.status(200).json({
            success: true,
            message: "Cash out successful",
            data: {
                cashOut: session.cashOut,
                cashOutHistory: session.cashMovements
                    .filter(item => item.type === "cash_out")
                    .map(item => ({
                        amount: item.amount,
                        reason: item.reason,
                        remarks: item.remarks,
                        date: item.createdAt.toLocaleDateString("en-GB"),
                        time: item.createdAt.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: true
                        })
                    }))
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.settleSession = async (req, res) => {
    try {
        const { cashCounted, closingDenomination = {} } = req.body;

        const hierarchy = attachHierarchy(req.user);
        const userId = req.user.userId || req.user.id;

        const session = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "No active session found"
            });
        }

        const bills = await Bill.find({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            createdAt: {
                $gte: session.startTime,
                $lte: new Date()
            }
        });

        let totalSales = 0;
        let cashSales = 0;
        let upiSales = 0;
        let cardSales = 0;
        let dueSales = 0;


        const cashIn = Number(session.cashIn || 0);
        const cashOut = Number(session.cashOut || 0);
        const cashRefund = Number(session.cashRefund || 0);

        for (const bill of bills) {
            const grandTotal = Number(bill.summary?.grandTotal || 0);
            totalSales += grandTotal;

            for (const pay of bill.payments || []) {

                let amount = Number(pay.amount || 0);


                if (
                    pay.method === "cash" &&
                    Number(bill.returnAmount || 0) > 0
                ) {
                    amount = Number(
                        (amount - Number(bill.returnAmount)).toFixed(2)
                    );
                }

                const method = String(pay.method || "").toLowerCase();

                if (method === "cash") cashSales += amount;
                if (method === "upi") upiSales += amount;
                if (method === "card") cardSales += amount;
            }

            if (bill.paymentStatus === "due" || bill.paymentStatus === "partial") {
                const paidAmount = (bill.payments || []).reduce(
                    (sum, p) => sum + Number(p.amount || 0),
                    0
                );

                dueSales += grandTotal - paidAmount;
            }
        }

        const d = closingDenomination || {};

        const denominationAmount =
            (Number(d.coin1 || 0) * 1) +
            (Number(d.coin2 || 0) * 2) +
            (Number(d.coin5 || 0) * 5) +
            (Number(d.coin10 || 0) * 10) +
            (Number(d.coin20 || 0) * 20) +
            (Number(d.note10 || 0) * 10) +
            (Number(d.note20 || 0) * 20) +
            (Number(d.note50 || 0) * 50) +
            (Number(d.note100 || 0) * 100) +
            (Number(d.note200 || 0) * 200) +
            (Number(d.note500 || 0) * 500);

        const hasDenomination = Object.keys(d).length > 0;

        const counted = hasDenomination
            ? denominationAmount
            : Number(cashCounted || 0);

        const expectedCash =
            Number(session.openingAmount || 0) +
            cashSales +
            cashIn -
            cashRefund -
            cashOut;

        const difference = counted - expectedCash;

        let settlementStatus = "matched";

        if (difference < 0) settlementStatus = "short";
        if (difference > 0) settlementStatus = "excess";

        session.totalSales = Number(totalSales.toFixed(2));
        session.totalBills = bills.length;
        session.cashSales = Number(cashSales.toFixed(2));
        session.upiSales = Number(upiSales.toFixed(2));
        session.cardSales = Number(cardSales.toFixed(2));
        session.dueSales = Number(dueSales.toFixed(2));

        session.cashIn = Number(cashIn.toFixed(2));
        session.cashOut = Number(cashOut.toFixed(2));
        session.cashRefund = Number(cashRefund.toFixed(2));

        session.closingDenomination = closingDenomination;
        session.cashCounted = Number(counted.toFixed(2));
        session.closingAmount = Number(counted.toFixed(2));
        session.expectedCash = Number(expectedCash.toFixed(2));
        session.difference = Number(difference.toFixed(2));
        session.settlementStatus = settlementStatus;
        session.settledBy = userId;
        session.settledAt = new Date();
        session.endTime = new Date();
        session.status = "settled";

        await session.save();

        const sessionObj = session.toObject();

        sessionObj.Date = session.createdAt.toLocaleDateString("en-GB");

        sessionObj.Time = session.createdAt.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });

        sessionObj.endDate = session.endTime.toLocaleDateString("en-GB");

        sessionObj.endTime = session.endTime.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });

        delete sessionObj.startTime;
        delete sessionObj.endTime;

        return res.status(200).json({
            success: true,
            message: "Session settled successfully",
            session: {
                ...session.toObject(),

                cashInHistory: session.cashInHistory || [],

                customerBalancePayments:
                    session.customerBalancePayments || []
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



exports.endSession = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const userId = req.user.userId || req.user.id;

        const session = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId
        }).sort({ createdAt: -1 });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "No session found."
            });
        }

        if (session.status === "closed") {
            return res.status(400).json({
                success: false,
                message: "Session is already closed."
            });
        }

        if (session.status !== "settled") {
            return res.status(400).json({
                success: false,
                message: "Please settle the session before ending it."
            });
        }

        session.closingAmount = session.cashCounted;
        session.endTime = new Date();
        session.closedBy = userId;
        session.status = "closed";


        session.status = "closed";

        await session.save();

        const updated = await Session.findById(session._id);



        let displayName = "";

        if (req.user.role === "super_admin") {
            const owner = await User.findById(userId).select("CompanyName");
            displayName = owner?.CompanyName || "";
        } else {
            const employee = await AdminAndCashier.findById(userId).select("name");
            displayName = employee?.name || "";
        }

        const token = req.token;
        blacklistToken(token);

        const sessionObj = session.toObject();

        sessionObj.name = displayName;
        sessionObj.role = req.user.role;

        delete sessionObj.createdAt;
        delete sessionObj.updatedAt;
        delete sessionObj.__v;
        delete sessionObj.Date;
        delete sessionObj.Time;

        sessionObj.Date = session.startTime.toLocaleDateString("en-GB");

        sessionObj.startTime = session.startTime.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });

        sessionObj.endDate = session.endTime.toLocaleDateString("en-GB");

        sessionObj.endTime = session.endTime.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });

        const diffMs = session.endTime - session.startTime;

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

        sessionObj.totalDuration =
            `${String(hours).padStart(2, "0")}:` +
            `${String(minutes).padStart(2, "0")}:` +
            `${String(seconds).padStart(2, "0")}`;

        return res.status(200).json({
            success: true,
            message: "Session ended and logged out successfully.",
            session: sessionObj
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



exports.getAllSessions = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        if (req.user.role !== "super_admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const sessions = await Session.find({
            superAdminId: hierarchy.superAdminId
        }).sort({ createdAt: -1 });

        const sessionList = [];

        for (const session of sessions) {
            const sessionObj = session.toObject();

            sessionObj.Date = session.createdAt
                ? session.createdAt.toLocaleDateString("en-GB")
                : "";

            sessionObj.startTime = session.createdAt
                ? session.createdAt.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true
                })
                : "";

            let activeUser = null;


            if (session.adminId) {
                activeUser = await AdminAndCashier.findById(session.adminId)
                    .select("name role");
            }

            else if (
                session.cashier &&
                session.cashier.toString() !== session.superAdminId.toString()
            ) {
                activeUser = await AdminAndCashier.findById(session.cashier)
                    .select("name role");
            }

            else {
                activeUser = await User.findById(session.superAdminId)
                    .select("CompanyName role");
            }

            sessionObj.activeUser = {
                role: activeUser?.role || null,
                name: activeUser?.CompanyName || activeUser?.name || null
            };

            sessionList.push(sessionObj);
        }
        return res.status(200).json({
            success: true,
            count: sessionList.length,
            sessions: sessionList
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.getSessionsByDate = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const { date, fromDate, toDate } = req.query;

        let startDate;
        let endDate;

        if (date) {
            // Single date
            startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);

        } else if (fromDate && toDate) {
            // Date range
            startDate = new Date(fromDate);
            startDate.setHours(0, 0, 0, 0);

            endDate = new Date(toDate);
            endDate.setHours(23, 59, 59, 999);

        } else {
            return res.status(400).json({
                success: false,
                message: "Provide either 'date' or both 'fromDate' and 'toDate'."
            });
        }

        const sessions = await Session.find({
            superAdminId: hierarchy.superAdminId,
            createdAt: {
                $gte: startDate,
                $lte: endDate
            }
        })
            .populate("cashier", "name email phone")
            .populate("adminId", "name")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            total: sessions.length,
            sessions
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getActiveSession = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const sessions = await Session.find({
            superAdminId: hierarchy.superAdminId,
            status: "open"
        }).sort({ createdAt: -1 });

        if (sessions.length === 0) {
            return res.status(200).json({
                success: true,
                active: false,
                message: "No active session found"
            });
        }

        const sessionList = [];

        for (const session of sessions) {

            const sessionObj = session.toObject();

            sessionObj.Date = session.createdAt
                ? session.createdAt.toLocaleDateString("en-GB")
                : "";

            sessionObj.startTime = session.createdAt
                ? session.createdAt.toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true
                })
                : "";

            let activeUser = null;

            if (session.adminId) {

                activeUser = await AdminAndCashier.findById(session.adminId)
                    .select("name role");

            } else if (
                session.cashier &&
                session.cashier.toString() !== session.superAdminId.toString()
            ) {

                activeUser = await AdminAndCashier.findById(session.cashier)
                    .select("name role");

            } else {

                activeUser = await User.findById(session.superAdminId)
                    .select("CompanyName role");
            }

            sessionObj.activeUser = {
                role: activeUser?.role || null,
                name: activeUser?.CompanyName || activeUser?.name || null
            };

            sessionList.push(sessionObj);
        }

        return res.status(200).json({
            success: true,
            active: true,
            count: sessionList.length,
            sessions: sessionList
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



exports.getMySessionHistory = async (req, res) => {
    try {
        const userId = req.user.userId || req.user.id;

        const sessions = await Session.find({
            cashier: userId
        }).sort({ createdAt: -1 });

        let displayName = "";

        if (req.user.role === "super_admin") {
            const owner = await User.findById(userId).select("CompanyName");
            displayName = owner?.CompanyName || "";
        } else {
            const employee = await AdminAndCashier.findById(userId).select("name");
            displayName = employee?.name || "";
        }

        const sessionList = sessions.map(session => ({
            ...session.toObject(),
            name: displayName,
            role: req.user.role
        }));

        return res.status(200).json({
            success: true,
            count: sessionList.length,
            sessions: sessionList
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.getUserSessionHistory = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        if (req.user.role !== "super_admin") {
            return res.status(403).json({
                success: false,
                message: "Access denied"
            });
        }

        const { userId } = req.params;

        // Get user details
        const user = await AdminAndCashier.findById(userId).select("name role");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const sessions = await Session.find({
            superAdminId: hierarchy.superAdminId,
            $or: [
                { cashier: userId },
                { adminId: userId }
            ]
        }).sort({ createdAt: -1 });

        const sessionList = sessions.map(session => ({
            ...session.toObject(),
            name: user.name,
            role: user.role
        }));

        return res.status(200).json({
            success: true,
            count: sessionList.length,
            sessions: sessionList
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


exports.todaySessions = async (req, res) => {
    try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const query = {
            createdAt: { $gte: start }
        };

        if (req.user.role === "cashier") {
            query.cashier = req.user.userId;
        }

        const sessions = await Session.find(query)
            .sort({ createdAt: -1 })
            .populate("cashier", "CompanyName CompanyEmail role");

        const formattedSessions = sessions.map((session) => {

            const obj = session.toObject();

            delete obj.createdAt;
            delete obj.updatedAt;
            delete obj.__v;
            delete obj.Date;

            const startTime = session.startTime
                ? new Date(session.startTime)
                : null;

            const endTime = session.endTime
                ? new Date(session.endTime)
                : null;

            // ADD THIS HERE
            const cashierName = session.cashier?.CompanyName || "";
            const cashierEmail = session.cashier?.CompanyEmail || "";

            obj.start = {
                name: cashierName,
                email: cashierEmail,
                date: startTime
                    ? startTime.toLocaleDateString("en-GB")
                    : "",
                time: startTime
                    ? startTime.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    })
                    : ""
            };

            obj.end = {
                name: cashierName,
                email: cashierEmail,
                date: endTime
                    ? endTime.toLocaleDateString("en-GB")
                    : "",
                time: endTime
                    ? endTime.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    })
                    : ""
            };

            // REMOVE OLD FIELDS
            delete obj.startDate;
            delete obj.startTime;
            delete obj.endDate;
            delete obj.endTime;

            if (startTime && endTime) {
                const diffMs = endTime - startTime;

                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

                obj.totalDuration =
                    `${String(hours).padStart(2, "0")}:` +
                    `${String(minutes).padStart(2, "0")}:` +
                    `${String(seconds).padStart(2, "0")}`;
            } else {
                obj.totalDuration = "";
            }

            return obj;
        });

        return res.status(200).json({
            success: true,
            count: formattedSessions.length,
            sessions: formattedSessions
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.sessionReport = async (req, res) => {
    try {
        const sessions = await Session.find()
            .sort({ createdAt: -1 })
            .populate("cashier", "CompanyName CompanyEmail role");

        const formattedSessions = sessions.map((session) => {

            const obj = session.toObject();

            delete obj.createdAt;
            delete obj.updatedAt;
            delete obj.__v;
            delete obj.Date;

            const startTime = session.startTime
                ? new Date(session.startTime)
                : null;

            const endTime = session.endTime
                ? new Date(session.endTime)
                : null;

            // ADD THIS HERE
            const cashierName = session.cashier?.CompanyName || "";
            const cashierEmail = session.cashier?.CompanyEmail || "";

            obj.start = {
                name: cashierName,
                email: cashierEmail,
                date: startTime
                    ? startTime.toLocaleDateString("en-GB")
                    : "",
                time: startTime
                    ? startTime.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    })
                    : ""
            };

            obj.end = {
                name: cashierName,
                email: cashierEmail,
                date: endTime
                    ? endTime.toLocaleDateString("en-GB")
                    : "",
                time: endTime
                    ? endTime.toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    })
                    : ""
            };

            // REMOVE OLD FIELDS
            delete obj.startDate;
            delete obj.startTime;
            delete obj.endDate;
            delete obj.endTime;

            if (startTime && endTime) {
                const diffMs = endTime - startTime;

                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

                obj.totalDuration =
                    `${String(hours).padStart(2, "0")}:` +
                    `${String(minutes).padStart(2, "0")}:` +
                    `${String(seconds).padStart(2, "0")}`;
            } else {
                obj.totalDuration = "";
            }

            return obj;
        });

        return res.status(200).json({
            success: true,
            count: formattedSessions.length,
            sessions: formattedSessions
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};