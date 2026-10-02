const CashRegister = require("../models/cashregister");
const { attachHierarchy } = require("../utils/hierarchy");

exports.openCashRegister = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const openingAmount = Number(req.body.openingAmount);

        if (isNaN(openingAmount) || openingAmount < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid opening amount"
            });
        }

        const alreadyOpen = await CashRegister.findOne({
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (alreadyOpen) {
            return res.status(400).json({
                success: false,
                message: "Cash register already opened"
            });
        }

        const cashRegister = await CashRegister.create({
            openingAmount,
            expectedCash: openingAmount,
            superAdminId: hierarchy.superAdminId,
            adminId: hierarchy.adminId || null,
            openedBy: hierarchy.userId || hierarchy.adminId || hierarchy.superAdminId
        });

        res.status(201).json({
            success: true,
            message: "Cash register opened successfully",
            data: cashRegister
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.getCurrentCashRegister = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const cashRegister = await CashRegister.findOne({
            superAdminId: hierarchy.superAdminId,
            status: "open"
        }).sort({ createdAt: -1 });

        if (!cashRegister) {
            return res.status(404).json({
                success: false,
                message: "No open cash register found"
            });
        }

        res.json({
            success: true,
            data: cashRegister
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.addCashOut = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const amount = Number(req.body.amount);
        const note = String(req.body.note || "").trim();

        if (isNaN(amount) || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid cash out amount"
            });
        }

        const cashRegister = await CashRegister.findOne({
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (!cashRegister) {
            return res.status(404).json({
                success: false,
                message: "Cash register not opened"
            });
        }

        cashRegister.cashOut += amount;
        cashRegister.expectedCash =
            cashRegister.openingAmount +
            cashRegister.cashSales -
            cashRegister.cashOut;

        cashRegister.cashOutHistory.push({
            amount,
            note,
            date: new Date(),
            createdBy: req.user.userId
        });

        await cashRegister.save();

        res.json({
            success: true,
            message: "Cash out added successfully",
            data: cashRegister
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.closeCashRegister = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const closingAmount = Number(req.body.closingAmount);

        if (isNaN(closingAmount) || closingAmount < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid closing amount"
            });
        }

        const cashRegister = await CashRegister.findOne({
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (!cashRegister) {
            return res.status(404).json({
                success: false,
                message: "Cash register not opened"
            });
        }

        const expectedCash =
            cashRegister.openingAmount +
            cashRegister.cashSales -
            cashRegister.cashOut;

        cashRegister.closingAmount = closingAmount;
        cashRegister.expectedCash = Number(expectedCash.toFixed(2));
        cashRegister.difference = Number((closingAmount - expectedCash).toFixed(2));
        cashRegister.status = "closed";
        cashRegister.closedAt = new Date();
        cashRegister.closedBy = hierarchy.userId || hierarchy.adminId || hierarchy.superAdminId;

        await cashRegister.save();

        const totalSalesAmount =
            Number(cashRegister.cashSales || 0) +
            Number(cashRegister.upiSales || 0) +
            Number(cashRegister.cardSales || 0);

        res.json({
            success: true,
            message: "Cash register closed successfully",
            data: {
                ...cashRegister.toObject(),

                totalSalesAmount: Number(totalSalesAmount.toFixed(2)),

                salesSummary: {
                    cashSales: Number(cashRegister.cashSales || 0),
                    upiSales: Number(cashRegister.upiSales || 0),
                    cardSales: Number(cashRegister.cardSales || 0),
                    totalSalesAmount: Number(totalSalesAmount.toFixed(2))
                }
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};