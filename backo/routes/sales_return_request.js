const express = require("express");
const router = express.Router();

const SalesReturnRequest = require("../models/sales_return_request");
const Bill = require("../models/bill");
const Product = require("../models/product");

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



router.post("/", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
    try {
        const { invoiceId, items } = req.body;

        if (!invoiceId || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "invoiceId and items are required"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const invoice = await SalesInvoice.findOne({
            _id: invoiceId,
            superAdminId: hierarchy.superAdminId,
            status: "completed"
        });

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: "Sales invoice not found"
            });
        }

        let totalReturnAmount = 0;
        const processedItems = [];

        for (const item of items) {
            const qty = Number(item.qty);

            if (!item.productId || isNaN(qty) || qty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Valid productId and qty required"
                });
            }

            const invoiceItem = invoice.items.find(
                x => x.productId.toString() === item.productId.toString()
            );

            if (!invoiceItem) {
                return res.status(400).json({
                    success: false,
                    message: "Product not found in this invoice"
                });
            }

            if (qty > invoiceItem.qty) {
                return res.status(400).json({
                    success: false,
                    message: "Return qty cannot be greater than sold qty"
                });
            }

            const amount = qty * invoiceItem.price;
            totalReturnAmount += amount;

            processedItems.push({
                productId: item.productId,
                qty,
                reason: item.reason || "",
                amount
            });
        }

        const request = await SalesReturnRequest.create({
            invoiceId,
            items: processedItems,
            totalReturnAmount,
            status: "pending",
            ...hierarchy,
            createdBy: req.user.userId
        });

        res.status(201).json({
            success: true,
            message: "Sales return request created successfully",
            data: request
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



router.get("/", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
    try {
        const { page = 1, limit = 10, status = "" } = req.query;
        const hierarchy = attachHierarchy(req.user);

        const query = {
            superAdminId: hierarchy.superAdminId
        };

        if (status) {
            query.status = status;
        }

        const requests = await SalesReturnRequest.find(query)
            .populate("invoiceId", "invoiceNumber grandTotal")
            .populate("items.productId", "name sellingPrice stock")
            .populate("createdBy", "name role")
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await SalesReturnRequest.countDocuments(query);

        res.json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
            data: requests
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



router.get("/:id", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const request = await SalesReturnRequest.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        })
            .populate("invoiceId", "invoiceNumber grandTotal")
            .populate("items.productId", "name sellingPrice stock")
            .populate("createdBy", "name role");

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Sales return request not found"
            });
        }

        res.json({
            success: true,
            data: request
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



router.put("/:id/approve", verifyToken, authorize("super_admin", "admin", "cashier"), async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const request = await SalesReturnRequest.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Sales return request not found"
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Request already ${request.status}`
            });
        }

        for (const item of request.items) {
            await Product.updateOne(
                {
                    _id: item.productId,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $inc: { stock: item.qty }
                }
            );
        }

        request.status = "approved";
        request.approvedBy = req.user.userId;
        await request.save();

        res.json({
            success: true,
            message: "Sales return request approved and stock updated",
            data: request
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
    "/:id/reject",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const request = await SalesReturnRequest.findOne({
                _id: req.params.id,
                superAdminId: hierarchy.superAdminId
            });

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: "Sales return request not found"
                });
            }

            if (request.status !== "pending") {
                return res.status(400).json({
                    success: false,
                    message: `Request already ${request.status}`
                });
            }

            request.status = "rejected";
            request.rejectedBy = req.user.userId;
            await request.save();

            res.json({
                success: true,
                message: "Sales return request rejected successfully",
                data: request
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