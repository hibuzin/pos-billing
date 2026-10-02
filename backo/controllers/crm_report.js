const mongoose = require("mongoose");
const Customer = require("../models/customer");
const user = require("../models/user");
const Bill = require("../models/bill");
const Counter = require("../models/counter");
const { attachHierarchy } = require("../utils/hierarchy");

exports.getCRMReport = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = "",
            fromDate,
            toDate
        } = req.query;

        const { userId, role, superAdminId } = req.user;

        const finalSuperAdminId =
            role === "super_admin" ? userId : superAdminId;


        let match = {
            superAdminId: new mongoose.Types.ObjectId(finalSuperAdminId)
        };

        if (search) {
            match.name = { $regex: search, $options: "i" };
        }

        if (fromDate && toDate) {
            match.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate)
            };
        }


        const summary = await Customer.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalCustomers: { $sum: 1 },
                    totalRevenue: { $sum: "$totalSpent" },
                    totalPoints: { $sum: "$loyaltyPoints" },
                    avgSpend: { $avg: "$totalSpent" }
                }
            }
        ]);


        const topCustomers = await Customer.find(match)
            .sort({ totalSpent: -1 })
            .limit(5)
            .select("name totalSpent loyaltyPoints");


        const repeatCustomers = await Customer.countDocuments({
            ...match,
            totalSpent: { $gt: 0 }
        });

        const newCustomers = await Customer.countDocuments({
            ...match,
            totalSpent: 0
        });


        const inactiveCustomers = await Customer.countDocuments({
            ...match,
            updatedAt: {
                $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
        });


        const customers = await Customer.find(match)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .sort({ createdAt: -1 });

        const total = await Customer.countDocuments(match);

        return res.json({
            success: true,


            summary: summary[0] || {
                totalCustomers: 0,
                totalRevenue: 0,
                totalPoints: 0,
                avgSpend: 0
            },

            insights: {
                repeatCustomers,
                newCustomers,
                inactiveCustomers
            },

            topCustomers,


            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / limit)
            },

            data: customers
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
}


exports.customerItemWiseReport = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const { fromDate, toDate, customerId } = req.query;

        const match = {
            superAdminId: hierarchy.superAdminId
        };

        if (fromDate && toDate) {
            match.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate + "T23:59:59.999Z")
            };
        }

        const pipeline = [
            { $match: match },

            { $unwind: "$items" },

            {
                $lookup: {
                    from: "customers",
                    localField: "customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },

            {
                $unwind: "$customer"
            }
        ];

        if (customerId) {
            pipeline.push({
                $match: {
                    "customer.customerId": Number(customerId)
                }
            });
        }

        pipeline.push(
            {
                $group: {
                    _id: {
                        customerNo: "$customer.customerId",
                        customerName: "$customer.name",
                        productId: "$items.productId",
                        productName: "$items.name"
                    },
                    totalQty: { $sum: "$items.qty" },
                    totalAmount: { $sum: "$items.finalPrice" },
                    totalGST: { $sum: "$items.gstAmount" },
                    totalBills: { $addToSet: "$_id" }
                }
            },

            {
                $project: {
                    _id: 0,
                    customerId: "$_id.customerNo",
                    customerName: "$_id.customerName",
                    productId: "$_id.productId",
                    productName: "$_id.productName",
                    totalQty: 1,
                    totalGST: { $round: ["$totalGST", 2] },
                    totalAmount: { $round: ["$totalAmount", 2] },
                    totalBills: { $size: "$totalBills" }
                }

            },
            { $sort: { customerName: 1, productName: 1 } }
        );

        const report = await Bill.aggregate(pipeline);

        res.json({
            success: true,
            count: report.length,
            data: report
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.productWiseCustomerReport = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { fromDate, toDate, productId } = req.query;

        const match = {
            superAdminId: hierarchy.superAdminId,
            customerId: { $ne: null }
        };

        if (fromDate && toDate) {
            match.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate + "T23:59:59.999Z")
            };
        }

        const pipeline = [
            { $match: match },
            { $unwind: "$items" }
        ];

        if (productId) {
            pipeline.push({
                $match: {
                    "items.productId": new mongoose.Types.ObjectId(productId)
                }
            });
        }

        pipeline.push(
            {
                $lookup: {
                    from: "customers",
                    localField: "customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            { $unwind: "$customer" },
            {
                
                $group: {
                    _id: {
                        productName: "$items.name",
                        customerNo: "$customer.customerId",
                        customerName: "$customer.name",
                        customerPhone: "$customer.phone"
                    },
                    productIds: { $addToSet: "$items.productId" },
                    totalQty: { $sum: "$items.qty" },
                    totalAmount: { $sum: "$items.finalPrice" },
                    totalGST: { $sum: "$items.gstAmount" },
                    totalBills: { $addToSet: "$_id" }
                }
            },
            {
                $project: {
                    _id: 0,
                    productId: "$_id.productId",
                    productName: "$_id.productName",
                    customerId: "$_id.customerNo",
                    customerName: "$_id.customerName",
                    customerPhone: "$_id.customerPhone",
                    totalQty: 1,
                    totalGST: { $round: ["$totalGST", 2] },
                    totalAmount: { $round: ["$totalAmount", 2] },
                    totalBills: { $size: "$totalBills" }
                }
            },
            { $sort: { productName: 1, customerName: 1 } }
        );

        const report = await Bill.aggregate(pipeline);

        res.json({
            success: true,
            count: report.length,
            data: report
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.customerPurchaseDetails = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { customerId, fromDate, toDate } = req.query;

        if (!customerId) {
            return res.status(400).json({
                success: false,
                message: "customerId is required"
            });
        }

        const match = {
            superAdminId: hierarchy.superAdminId
        };

        if (fromDate && toDate) {
            match.createdAt = {
                $gte: new Date(fromDate),
                $lte: new Date(toDate + "T23:59:59.999Z")
            };
        }

        const pipeline = [
            { $match: match },

            {
                $lookup: {
                    from: "customers",
                    localField: "customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            { $unwind: "$customer" },

            {
                $match: {
                    "customer.customerId": Number(customerId)
                }
            },

            {
                $project: {
                    _id: 0,
                    billId: "$_id",
                    invoiceNo: 1,
                    billDate: {
                        $dateToString: {
                            format: "%d-%m-%Y",
                            date: "$createdAt",
                            timezone: "Asia/Kolkata"
                        }
                    },
                    customerId: "$customer.customerId",
                    customerName: "$customer.name",
                    customerPhone: "$customer.phone",
                    items: {
                        $map: {
                            input: "$items",
                            as: "item",
                            in: {
                                productId: "$$item.productId",
                                productName: "$$item.name",
                                barcode: "$$item.barcode",
                                qty: "$$item.qty",
                                mrp: "$$item.mrp",
                                sellingPrice: "$$item.sellingPrice",
                                gstRate: "$$item.gstRate",
                                gstAmount: {
                                    $round: ["$$item.gstAmount", 2]
                                },
                                finalPrice: {
                                    $round: ["$$item.finalPrice", 2]
                                }
                            }
                        }
                    },
                    totalQty: { $sum: "$items.qty" },
                    grandTotal: "$summary.grandTotal",
                    totalGST: "$summary.totalGST",
                    paymentStatus: 1,
                    paymentMethod: 1
                }
            },

            { $sort: { billDate: -1 } }
        ];

        const data = await Bill.aggregate(pipeline);

        res.json({
            success: true,
            count: data.length,
            data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};