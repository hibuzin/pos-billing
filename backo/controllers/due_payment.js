const DuePayment = require("../models/due_payment");
const { attachHierarchy } = require("../utils/hierarchy");

exports.createDuePayment = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            customerId,
            billId,
            totalAmount,
            paidAmount = 0,
            dueDate
        } = req.body;

        if (!customerId || !totalAmount) {
            return res.status(400).json({
                success: false,
                message: "Customer and total amount are required"
            });
        }

        const pendingAmount = totalAmount - paidAmount;

        let status = "pending";

        if (pendingAmount <= 0) {
            status = "paid";
        } else if (paidAmount > 0) {
            status = "partial";
        }

        const due = await DuePayment.create({
            customerId,
            billId,
            totalAmount,
            paidAmount,
            pendingAmount: pendingAmount < 0 ? 0 : pendingAmount,
            dueDate,
            status,
            superAdminId: hierarchy.superAdminId,
            adminId: hierarchy.adminId,
            createdBy: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: "Due payment created successfully",
            data: due
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAllDuePayments = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const dues = await DuePayment.find({
            superAdminId: hierarchy.superAdminId
        })
            .populate("customerId", "name phone")
            .populate("billId")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: dues.length,
            data: dues
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.payDuePayment = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Valid payment amount is required"
            });
        }

        const due = await DuePayment.findById(req.params.id);

        if (!due) {
            return res.status(404).json({
                success: false,
                message: "Due payment not found"
            });
        }

        if (due.status === "paid") {
            return res.status(400).json({
                success: false,
                message: "Due already paid"
            });
        }

        due.paidAmount += amount;
        due.pendingAmount -= amount;

        if (due.pendingAmount <= 0) {
            due.pendingAmount = 0;
            due.status = "paid";
        } else {
            due.status = "partial";
        }

        await due.save();

        res.json({
            success: true,
            message: "Due payment updated successfully",
            data: due
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};