const mongoose = require("mongoose");
const Supplier = require("../models/supplier");
const Product = require("../models/product");
const Counter = require("../models/counter");
const Purchase = require("../models/purchase");
const Bill = require("../models/bill");
const { attachHierarchy } = require("../utils/hierarchy");


const getNextSupplierId = async () => {
    const counter = await Counter.findOneAndUpdate(
        { name: "supplier" },
        { $inc: { seq: 1 } },
        { returnDocument: "after", upsert: true }
    );

    return `SUP${String(counter.seq).padStart(3, "0")}`;
};




exports.addsupplier = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            supplierName,
            mobile,
            gstNumber,
            panNumber,
            email,
            address,
            city,
            state,
            pincode,
            bankDetails
        } = req.body;


        if (!supplierName || !mobile) {
            return res.status(400).json({
                success: false,
                message: "Supplier name and mobile number are required"
            });
        }

        const supplierId = await getNextSupplierId();

        const supplier = await Supplier.create({
            supplierId,
            supplierName,
            mobile,
            gstNumber,
            panNumber,
            email,
            address,
            city,
            state,
            pincode,

            bankDetails: {
                accountHolderName: bankDetails?.accountHolderName || "",
                bankName: bankDetails?.bankName || "",
                accountNumber: bankDetails?.accountNumber || "",
                ifscCode: bankDetails?.ifscCode || "",
                branchName: bankDetails?.branchName || ""
            },

            superAdminId: hierarchy.superAdminId,
            adminId: hierarchy.adminId || null,
            createdBy: hierarchy.userId || hierarchy.adminId || hierarchy.superAdminId
        });

        res.status(201).json({
            success: true,
            message: "Supplier created successfully",
            data: supplier
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getSupplierTotals = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const result = await Purchase.aggregate([
            {
                $match: {
                    superAdminId: hierarchy.superAdminId
                }
            },
            {
                $group: {
                    _id: null,
                    totalSupplierPurchase: {
                        $sum: { $toDouble: "$supplierBillAmount" }
                    },
                    totalSupplierBalance: {
                        $sum: { $toDouble: "$balanceAmount" }
                    },
                    totalPaidAmount: {
                        $sum: { $toDouble: "$paidAmount" }
                    },
                    totalBills: {
                        $sum: 1
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalSupplierPurchase: {
                        $round: ["$totalSupplierPurchase", 2]
                    },
                    totalSupplierBalance: {
                        $round: ["$totalSupplierBalance", 2]
                    },
                    totalPaidAmount: {
                        $round: ["$totalPaidAmount", 2]
                    },
                    totalBills: 1
                }
            }
        ]);

        const data = result[0] || {
            totalSupplierPurchase: 0,
            totalSupplierBalance: 0,
            totalPaidAmount: 0,
            totalBills: 0
        };

        res.json({
            success: true,
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


exports.getSupplierBalances = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const suppliers = await Supplier.find({
            superAdminId: hierarchy.superAdminId
        }).select("supplierName mobile gstNumber");

        const data = await Promise.all(
            suppliers.map(async (supplier) => {

                const balance = await Purchase.aggregate([
                    {
                        $match: {
                            supplierId: supplier._id
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalBalance: {
                                $sum: { $toDouble: "$balanceAmount" }
                            }
                        }
                    }
                ]);

                return {
                    supplierId: supplier._id,
                    supplierName: supplier.supplierName,
                    mobile: supplier.mobile,
                    gstNumber: supplier.gstNumber,
                    balance: Number(
                        (balance[0]?.totalBalance || 0).toFixed(2)
                    )
                };
            })
        );

        const totalBalance = Number(
            data
                .reduce((total, supplier) => total + supplier.balance, 0)
                .toFixed(2)
        );

        res.json({
            success: true,
            count: data.length,
            totalBalance,
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


exports.getallsuppliers = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const suppliers = await Supplier.find({
            superAdminId: hierarchy.superAdminId,
            isActive: true
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            count: suppliers.length,
            data: suppliers
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


exports.suppliersearch = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const { q } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: "Search value required"
            });
        }

        const searchValue = q.trim();

        const suppliers = await Supplier.find({
            superAdminId: hierarchy.superAdminId,
            isActive: true,
            $or: [
                { supplierName: { $regex: searchValue, $options: "i" } },
                { mobile: { $regex: searchValue, $options: "i" } },
                { gstNumber: { $regex: searchValue.toUpperCase(), $options: "i" } },
                { contactPerson: { $regex: searchValue, $options: "i" } }
            ]
        })
            .select("supplierName mobile gstNumber email address city state pincode contactPerson")
            .limit(10)
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: suppliers.length,
            data: suppliers
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


exports.getAllSupplierPurchases = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const purchases = await Purchase.find({
            superAdminId: hierarchy.superAdminId
        })
            .populate("supplierId", "supplierName gstNumber")
            .sort({ createdAt: -1 });

        const data = purchases.map(purchase => ({
            purchaseId: purchase._id,
            invoiceNo: purchase.invoiceNo,
            invoiceDate: purchase.invoiceDate,

            supplierName: purchase.supplierId?.supplierName || "",
            supplierGstNumber: purchase.supplierId?.gstNumber || "",

            totalAmount: purchase.totalAmount,
            paidAmount: purchase.paidAmount,
            balanceAmount: purchase.balanceAmount,

            paymentMode:
                purchase.paidAmount === 0
                    ? "Unpaid"
                    : purchase.balanceAmount > 0
                        ? "Partial Paid"
                        : "Paid"
        }));

        res.status(200).json({
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


exports.supplierPurchases = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { supplierId } = req.params;
        const { fromDate, toDate, paymentStatus, search } = req.query;

        const supplier = await Supplier.findOne({
            _id: supplierId,
            superAdminId: hierarchy.superAdminId,
            isActive: true
        });

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        const filter = {
            supplierId,
            superAdminId: hierarchy.superAdminId
        };

        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }

        if (fromDate || toDate) {
            filter.invoiceDate = {};

            if (fromDate) {
                filter.invoiceDate.$gte = new Date(fromDate);
            }

            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);
                filter.invoiceDate.$lte = endDate;
            }
        }

        const purchases = await Purchase.find(filter)
            .populate("items.productId", "name brand")
            .sort({ createdAt: -1 });

        let data = purchases.map((purchase) => ({
            purchaseId: purchase._id,
            invoiceNo: purchase.invoiceNo,
            invoiceDate: purchase.invoiceDate
                ? new Date(purchase.invoiceDate).toLocaleDateString("en-CA")
                : "",

            supplierBillAmount: purchase.supplierBillAmount,
            paidAmount: purchase.paidAmount,
            balanceAmount: purchase.balanceAmount,
            paymentStatus: purchase.paymentStatus,

            paymentHistory: (purchase.paymentHistory || []).map((pay) => ({
                amount: pay.amount || 0,
                paymentType: pay.paymentType || "cash",
                note: pay.note || "",

                paidDate: pay.paidDate
                    ? new Date(pay.paidDate).toLocaleDateString("en-CA")
                    : "",


                chequeDetails:
                    pay.paymentType === "cheque"
                        ? {
                            chequeNo: pay.details?.chequeNo || "",
                            bankName: pay.details?.bankName || "",
                            chequeDate: pay.details?.chequeDate
                                ? new Date(pay.details.chequeDate).toLocaleDateString("en-CA")
                                : "",
                            status: pay.details?.status || ""
                        }
                        : null,


                cardDetails:
                    pay.paymentType === "card"
                        ? {
                            cardType: pay.details?.cardType || "",
                            cardLast4: pay.details?.cardLast4 || "",
                            transactionId: pay.details?.transactionId || "",
                            approvalCode: pay.details?.approvalCode || "",
                            bankName: pay.details?.bankName || ""
                        }
                        : null,

                upiDetails:
                    pay.paymentType === "upi"
                        ? {
                            upiId: pay.details?.upiId || "",
                            transactionId: pay.details?.transactionId || "",
                            provider: pay.details?.provider || ""
                        }
                        : null,

                bankDetails:
                    pay.paymentType === "bank"
                        ? {
                            bankName: pay.details?.bankName || "",
                            accountNo: pay.details?.accountNo || "",
                            referenceNo: pay.details?.referenceNo || "",
                            transactionId: pay.details?.transactionId || ""
                        }
                        : null,

                otherDetails:
                    pay.paymentType === "other"
                        ? {
                            methodName: pay.details?.methodName || "",
                            referenceNo: pay.details?.referenceNo || "",
                            remarks: pay.details?.remarks || ""
                        }
                        : null,
            })),

            items: purchase.items.map((item) => ({
                productId: item.productId?._id,
                productName: item.productId?.name || item.productName || "",
                brand: item.productId?.brand || item.brand || "",
                barcode: item.barcode || "",
                qty: item.qty || 0,
                costPrice: item.costPrice || 0,
                mrp: item.mrp || 0,
                sellingPrice: item.sellingPrice || 0,
                gst: item.gst || 0,
                gstpercentage: item.gstpercentage || 0

            }))
        }));

        if (search) {
            const keyword = search.toLowerCase();

            data = data
                .map((purchase) => ({
                    ...purchase,
                    items: purchase.items.filter((item) =>
                        item.productName.toLowerCase().includes(keyword) ||
                        item.brand.toLowerCase().includes(keyword) ||
                        item.barcode.toLowerCase().includes(keyword)

                    )
                }))
                .filter((purchase) => purchase.items.length > 0);
        }

        return res.status(200).json({
            success: true,
            message: "Supplier purchase bills fetched successfully",
            supplier: {
                id: supplier._id,
                name: supplier.supplierName,
                mobile: supplier.mobile,
                email: supplier.email,
                gstNumber: supplier.gstNumber || ""
            },
            count: data.length,
            data
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


exports.supplierProductWiseSummary = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { supplierId } = req.params;

        const supplier = await Supplier.findOne({
            _id: supplierId,
            superAdminId: hierarchy.superAdminId,
            isActive: true
        });

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        const purchases = await Purchase.find({
            supplierId,
            superAdminId: hierarchy.superAdminId
        }).populate("items.productId", "name stock");

        const productMap = {};

        purchases.forEach((purchase) => {
            purchase.items.forEach((item) => {
                const productId = item.productId?._id
                    ? String(item.productId._id)
                    : null;

                if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
                    return;
                }

                if (!productMap[productId]) {
                    productMap[productId] = {
                        productId,
                        productName: item.productId?.name || item.productName || "",


                        purchaseQty: 0,
                        purchaseAmount: 0,

                        salesQty: 0,
                        salesAmount: 0,

                        currentStock: Number(item.productId?.stock || 0)
                    };
                }

                const qty = Number(item.qty || 0);

                productMap[productId].purchaseQty += qty;
                productMap[productId].purchaseAmount += Number(item.totalCostWithGST || 0);



            });
        });

        const productIds = Object.keys(productMap);

        const bills = await Bill.find({
            superAdminId: hierarchy.superAdminId,
            "items.productId": { $in: productIds }
        });

        bills.forEach((bill) => {
            bill.items.forEach((item) => {
                const productId = String(item.productId);

                if (productMap[productId]) {
                    const qty = Number(item.qty || 0);
                    const amount = Number(item.finalPrice || 0);

                    productMap[productId].salesQty += qty;
                    productMap[productId].salesAmount += amount;
                }
            });
        });


        const round2 = (num) =>
            Math.round((Number(num) + Number.EPSILON) * 100) / 100;

        const data = Object.values(productMap).map((item) => ({
            productId: item.productId,
            productName: item.productName,

            purchaseQty: item.purchaseQty,
            purchaseAmount: round2(item.purchaseAmount),

            salesQty: item.salesQty,
            salesAmount: round2(item.salesAmount),

            balanceStock: item.currentStock
        }));

        return res.status(200).json({
            success: true,
            message: "Supplier product wise summary fetched successfully",
            supplier: {
                id: supplier._id,
                name: supplier.supplierName,
                mobile: supplier.mobile,
                email: supplier.email
            },
            count: data.length,
            data
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


exports.supplierbyid = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid supplier id"
            });
        }

        const supplier = await Supplier.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId,
            isActive: true
        });

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        res.json({
            success: true,
            data: supplier
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}

exports.updateSupplier = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const supplier = await Supplier.findOneAndUpdate(
            {
                _id: req.params.id,
                superAdminId: hierarchy.superAdminId
            },
            req.body,
            { new: true, runValidators: true }
        );

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        res.json({
            success: true,
            message: "Supplier updated successfully",
            data: supplier
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


exports.deletesupplier = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid supplier id"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const supplier = await Supplier.findOneAndUpdate(
            {
                _id: req.params.id,
                superAdminId: hierarchy.superAdminId,
                isActive: true
            },
            { isActive: false },
            { new: true }
        );

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        res.json({
            success: true,
            message: "Supplier deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};