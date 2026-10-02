const express = require("express");
const router = express.Router();

const Bill = require("../models/bill");
const GstReturn = require("../models/gst_return");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



router.get(
    "/gstr1",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);
            const { month, year } = req.query;

            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            const bills = await Bill.find({
                superAdminId: hierarchy.superAdminId,
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            }).populate("customerId", "name phone gstin");

            res.json({
                success: true,
                returnType: "GSTR1",
                month: Number(month),
                year: Number(year),
                count: bills.length,
                data: bills
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);



router.get(
    "/gstr3b",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);
            const { month, year } = req.query;

            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0, 23, 59, 59);

            const bills = await Bill.find({
                superAdminId: hierarchy.superAdminId,
                createdAt: {
                    $gte: startDate,
                    $lte: endDate
                }
            });

            let taxableAmount = 0;
            let cgst = 0;
            let sgst = 0;
            let igst = 0;
            let totalSales = 0;

            bills.forEach((bill) => {
                taxableAmount += bill.taxableAmount || 0;
                cgst += bill.cgst || 0;
                sgst += bill.sgst || 0;
                igst += bill.igst || 0;
                totalSales += bill.totalAmount || 0;
            });

            res.json({
                success: true,
                returnType: "GSTR3B",
                month: Number(month),
                year: Number(year),
                data: {
                    totalSales,
                    taxableAmount,
                    cgst,
                    sgst,
                    igst,
                    totalTax: cgst + sgst + igst
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
);



router.post(
    "/save",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);
            const { returnType, month, year, summary } = req.body;

            const gstReturn = await GstReturn.findOneAndUpdate(
                {
                    returnType,
                    month,
                    year,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    returnType,
                    month,
                    year,
                    summary,
                    userId: req.user.id,
                    superAdminId: hierarchy.superAdminId,
                    adminId: hierarchy.adminId || null
                },
                {
                    new: true,
                    upsert: true
                }
            );

            res.status(201).json({
                success: true,
                message: "GST return saved as draft",
                data: gstReturn
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);



router.put(
    "/:id/filed",
    verifyToken,
    authorize("super_admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const gstReturn = await GstReturn.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    status: "FILED",
                    filedDate: new Date()
                },
                { new: true }
            );

            if (!gstReturn) {
                return res.status(404).json({
                    success: false,
                    message: "GST return not found"
                });
            }

            res.json({
                success: true,
                message: "GST return marked as filed",
                data: gstReturn
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);

module.exports = router;