const Return = require("../models/return");
const Purchase = require("../models/purchase");
const Product = require("../models/product");
const Barcode = require("../models/barcode");
const Supplier = require("../models/supplier");
const { attachHierarchy } = require("../utils/hierarchy");
const Counter = require("../models/counter");


const getNextPurchaseReturnNo = async (superAdminId) => {
    const counter = await Counter.findOneAndUpdate(
        {
            name: "purchaseReturnNo",
            superAdminId
        },
        {
            $inc: { seq: 1 }
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    return `PR-${String(counter.seq).padStart(5, "0")}`;
};

exports.createPurchaseReturn = async (req, res) => {
    try {
        const {
            purchaseId,
            items,
            supplierId
        } = req.body;

        if (
            !purchaseId ||
            !Array.isArray(items) ||
            items.length === 0
        ) {
            return res.status(400).json({
                success: false,
                message: "purchaseId and items are required"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const purchase = await Purchase.findOne({
            _id: purchaseId,
            superAdminId: hierarchy.superAdminId
        });

        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase not found"
            });
        }

        const finalSupplierId =
            supplierId || purchase.supplierId;

        const supplier = await Supplier.findOne({
            _id: finalSupplierId,
            superAdminId: hierarchy.superAdminId
        });

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: "Supplier not found"
            });
        }

        const processedItems = [];

        for (const item of items) {

            const qty = Number(item.qty);

            if (
                !item.productId ||
                isNaN(qty) ||
                qty <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Valid productId and qty required"
                });
            }

            const product = await Product.findOne({
                _id: item.productId,
                superAdminId: hierarchy.superAdminId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            const barcode = await Barcode.findOne({
                productId: product._id,
                superAdminId: hierarchy.superAdminId
            });

            const productStock = Number(product.stock || 0);

            if (productStock < qty) {
                return res.status(400).json({
                    success: false,
                    message: `${product.name} stock is insufficient`
                });
            }


            const purchaseItem = purchase.items.find(
                (purchaseItem) =>
                    String(purchaseItem.productId) === String(item.productId)
            );

            if (!purchaseItem) {
                return res.status(400).json({
                    success: false,
                    message: `${product.name} is not available in this purchase`
                });
            }

            const purchaseQty = Number(purchaseItem.qty || 0);

            if (qty > purchaseQty) {
                return res.status(400).json({
                    success: false,
                    message: `Return qty cannot be greater than purchased qty for ${product.name}`
                });
            }


            const costPrice = Number(
                purchaseItem.netcost || 0
            );

            const gstRate =
                purchaseItem.taxPercentage === "none"
                    ? 0
                    : Number(purchaseItem.taxPercentage || 0);


            const gstPerUnit =
                purchaseQty > 0
                    ? Number(
                        (Number(purchaseItem.taxAmount || 0) / purchaseQty)
                            .toFixed(2)
                    )
                    : 0;

            const gstAmount = Number(
                (gstPerUnit * qty).toFixed(2)
            );

            const totalAmount = Number(
                (costPrice * qty).toFixed(2)
            );

            processedItems.push({
                productId: item.productId,
                qty,

                costPrice,

                gstRate,

                gstAmount,

                totalAmount,

                reason: item.reason || ""
            });
        }

        const returnNo = await getNextPurchaseReturnNo(
            hierarchy.superAdminId
        );


        const request = await Return.create({
            returnNo,
            purchaseId,
            supplierId: finalSupplierId,
            items: processedItems,
            status: "pending",
            ...hierarchy,
            createdBy: req.user.userId
        });

        return res.status(201).json({
            success: true,
            message: "Purchase return request created successfully",
            data: request
        });

    } catch (err) {

        console.error(
            "CREATE PURCHASE RETURN ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getPurchaseByInvoiceNo = async (req, res) => {
    try {

        const { invoiceNo } = req.params;

        if (!invoiceNo) {
            return res.status(400).json({
                success: false,
                message: "Invoice number is required"
            });
        }


        const hierarchy = attachHierarchy(req.user);


        const purchase = await Purchase.findOne({
            invoiceNo: invoiceNo,
            superAdminId: hierarchy.superAdminId
        })
            .populate("supplierId", "supplierName mobile email")
            .populate("items.productId", "name itemCode stock unit");


        if (!purchase) {
            return res.status(404).json({
                success: false,
                message: "Purchase invoice not found"
            });
        }


        res.json({
            success: true,
            data: purchase
        });


    } catch (err) {

        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });

    }
};


exports.getBillWisePurchaseReturnReport = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            date,
            fromDate,
            toDate,
            period,
            status,
            gst
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        const round2 = (num) =>
            Math.round((Number(num) + Number.EPSILON) * 100) / 100;


        if (status) {
            filter.status = status;
        }


        const allowedGstRates = [
            "gst",
            "0",
            "5",
            "12",
            "18",
            "40",
            "none",
            "all"
        ];

        if (
            gst &&
            !allowedGstRates.includes(gst.toLowerCase())
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid GST filter. Use gst, 0, 5, 12, 18, 40, none or all"
            });
        }


        if (period) {
            let startDate;
            let endDate;

            const now = new Date();


            if (period === "today") {
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "yesterday") {
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setDate(endDate.getDate() - 1);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "week") {
                startDate = new Date(now);

                const day = startDate.getDay();
                const diff = day === 0 ? 6 : day - 1;

                startDate.setDate(startDate.getDate() - diff);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "month") {
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                );

                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "year") {
                startDate = new Date(
                    now.getFullYear(),
                    0,
                    1
                );

                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid period. Use today, yesterday, week, month or year."
                });
            }

            filter.createdAt = {
                $gte: startDate,
                $lte: endDate
            };
        }

        else if (date) {
            const [day, month, year] = date.split("/");

            const start = new Date(year, month - 1, day);
            start.setHours(0, 0, 0, 0);

            const end = new Date(year, month - 1, day);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        else if (fromDate || toDate) {
            filter.createdAt = {};

            if (fromDate) {
                const [fDay, fMonth, fYear] = fromDate.split("/");

                const start = new Date(fYear, fMonth - 1, fDay);
                start.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = start;
            }

            if (toDate) {
                const [tDay, tMonth, tYear] = toDate.split("/");

                const end = new Date(tYear, tMonth - 1, tDay);
                end.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = end;
            }
        }
        const returns = await Return.find(filter)
            .populate({
                path: "purchaseId",
                select: "grnNo invoiceNo invoiceDate supplierId",
                populate: {
                    path: "supplierId",
                    select: "supplierName mobile"
                }
            })
            .populate({
                path: "items.productId",
                select: "name itemCode gstRate"
            })

            .sort({ createdAt: -1 });

        const data = [];

        for (const ret of returns) {

            if (!Array.isArray(ret.items)) {
                continue;
            }

            const filteredItems = [];

            for (const item of ret.items) {

                if (!item.productId) {
                    continue;
                }

                const productGstRate =
                    item.productId?.gstRate;

                const itemGstRate =
                    item.gstRate;

                const isNonGst =
                    item.isNonGst === true ||
                    String(productGstRate ?? "").toLowerCase() === "none" ||
                    String(itemGstRate ?? "").toLowerCase() === "none";

                const gstRate = isNonGst
                    ? "none"
                    : Number(
                        itemGstRate ??
                        productGstRate ??
                        0
                    );

                if (gst) {
                    const gstFilter =
                        gst.toLowerCase();

                    if (gstFilter !== "all") {

                        if (gstFilter === "gst") {
                            if (gstRate === "none") {
                                continue;
                            }
                        }

                        else if (gstFilter === "none") {
                            if (gstRate !== "none") {
                                continue;
                            }
                        }

                        else {
                            if (
                                String(gstRate) !==
                                gstFilter
                            ) {
                                continue;
                            }
                        }
                    }
                }

                filteredItems.push({
                    rawProductId: item.productId,
                    productId:
                        item.productId?._id || null,
                    productName:
                        item.productId?.name || "",
                    itemCode:
                        item.productId?.itemCode || "",
                    gstPercentage:
                        gstRate,

                    costPrice:
                        round2(item.costPrice || 0),

                    gstAmount:
                        round2(item.gstAmount || 0),

                    totalAmount:
                        round2(item.totalAmount || 0),

                    qty:
                        Number(item.qty || 0),
                    reason:
                        item.reason || ""
                });
            }

            if (filteredItems.length === 0) {
                continue;
            }

            const totalQty = round2(
                filteredItems.reduce(
                    (sum, item) => sum + Number(item.qty || 0),
                    0
                )
            );

            const totalGST = round2(
                filteredItems.reduce(
                    (sum, item) => sum + Number(item.gstAmount || 0),
                    0
                )
            );

            const totalAmount = round2(
                filteredItems.reduce(
                    (sum, item) => sum + Number(item.totalAmount || 0),
                    0
                )
            );

            data.push({
                returnId:
                    ret._id,

                returnNo:
                    ret.returnNo || "",

                purchaseId:
                    ret.purchaseId?._id,

                grnNo:
                    ret.purchaseId?.grnNo || "",

                invoiceNo:
                    ret.purchaseId?.invoiceNo || "",

                invoiceDate:
                    ret.purchaseId?.invoiceDate
                        ? new Date(
                            ret.purchaseId.invoiceDate
                        )
                            .toLocaleDateString("en-GB")
                            .replace(/\//g, "-")
                        : "",

                supplier: {
                    supplierId:
                        ret.purchaseId?.supplierId?._id,

                    supplierName:
                        ret.purchaseId?.supplierId
                            ?.supplierName || "",

                    mobile:
                        ret.purchaseId?.supplierId
                            ?.mobile || ""
                },

                totalItems:
                    filteredItems.length,

                totalQty:
                    Number(totalQty),

                totalGST,

                totalAmount,

                status:
                    ret.status,

                items:
                    filteredItems,

                createdAt:
                    new Date(ret.createdAt)
                        .toLocaleDateString("en-GB")
                        .replace(/\//g, "-")
            });
        }


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};



exports.getItemWisePurchaseReturnReport = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            date,
            fromDate,
            toDate,
            period,
            status,
            gst
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        const round2 = (num) =>
            Math.round((Number(num) + Number.EPSILON) * 100) / 100;

        if (status) {
            filter.status = status;
        }


        const allowedGstRates = [
            "gst",
            "0",
            "5",
            "12",
            "18",
            "40",
            "none",
            "all"
        ];

        if (
            gst &&
            !allowedGstRates.includes(gst.toLowerCase())
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid GST filter. Use gst, 0, 5, 12, 18, 40, none or all"
            });
        }

        if (period) {
            let startDate;
            let endDate;

            const now = new Date();

            if (period === "today") {
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "yesterday") {
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setDate(endDate.getDate() - 1);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "week") {
                startDate = new Date(now);

                const day = startDate.getDay();
                const diff = day === 0 ? 6 : day - 1;

                startDate.setDate(startDate.getDate() - diff);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "month") {
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                );

                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "year") {
                startDate = new Date(
                    now.getFullYear(),
                    0,
                    1
                );

                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid period. Use today, yesterday, week, month or year."
                });
            }

            filter.createdAt = {
                $gte: startDate,
                $lte: endDate
            };
        }


        else if (date) {
            const [day, month, year] = date.split("/");

            const start = new Date(
                year,
                month - 1,
                day
            );

            start.setHours(0, 0, 0, 0);

            const end = new Date(
                year,
                month - 1,
                day
            );

            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }


        else if (fromDate || toDate) {
            filter.createdAt = {};

            if (fromDate) {
                const [fDay, fMonth, fYear] =
                    fromDate.split("/");

                const start = new Date(
                    fYear,
                    fMonth - 1,
                    fDay
                );

                start.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = start;
            }

            if (toDate) {
                const [tDay, tMonth, tYear] =
                    toDate.split("/");

                const end = new Date(
                    tYear,
                    tMonth - 1,
                    tDay
                );

                end.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = end;
            }
        }


        const returns = await Return.find(filter)
            .populate({
                path: "purchaseId",
                select: "grnNo invoiceNo invoiceDate"
            })
            .populate({
                path: "supplierId",
                select: "supplierName mobile"
            })
            .populate({
                path: "items.productId",
                select: "name itemCode mrp unit unitValue costPrice gstRate"
            })
            .sort({ createdAt: -1 });


        const report = {};

        for (const ret of returns) {

            if (!Array.isArray(ret.items)) {
                continue;
            }

            for (const item of ret.items) {

                if (!item.productId) {
                    continue;
                }

                const productId =
                    item.productId._id.toString();

                const qty =
                    Number(item.qty || 0);


                const productGstRate =
                    item.productId?.gstRate;

                const itemGstRate =
                    item.gstRate;

                const isNonGst =
                    item.isNonGst === true ||
                    String(productGstRate ?? "").toLowerCase() === "none" ||
                    String(itemGstRate ?? "").toLowerCase() === "none";

                const gstRate = isNonGst
                    ? "none"
                    : Number(
                        itemGstRate ??
                        productGstRate ??
                        0
                    );

                if (gst) {
                    const gstFilter = gst.toLowerCase();

                    if (gstFilter !== "all") {
                        if (gstFilter === "gst") {
                            if (gstRate === "none") {
                                continue;
                            }
                        }

                        else if (gstFilter === "none") {
                            if (gstRate !== "none") {
                                continue;
                            }
                        }

                        else {
                            if (
                                String(gstRate) !== gstFilter
                            ) {
                                continue;
                            }
                        }
                    }
                }


                const costPrice =
                    Number(item.productId.costPrice || 0);

                const returnAmount =
                    qty * costPrice;

                const gstValue =
                    Number(item.gstAmount || 0);

                if (
                    gstRate !== "none" &&
                    Number(gstRate) > 0
                ) {
                    gstValue = Number(
                        (
                            returnAmount -
                            (
                                returnAmount /
                                (
                                    1 +
                                    Number(gstRate) / 100
                                )
                            )
                        ).toFixed(2)
                    );
                }

                if (!report[productId]) {

                    report[productId] = {
                        productId: item.productId._id,

                        productName:
                            item.productId.name || "",

                        itemCode:
                            item.productId.itemCode || "",

                        mrp:
                            Number(item.productId.mrp || 0),

                        unit:
                            item.productId.unit || "",

                        unitValue:
                            item.productId.unitValue || "",

                        returnedQty: 0,

                        returnCount: 0,

                        gstPercentage: gstRate,

                        returnAmount: 0,

                        gstValue: 0
                    };
                }

                report[productId].returnedQty += qty;

                report[productId].returnCount += 1;

                report[productId].returnAmount += returnAmount;

                report[productId].gstValue += gstValue;
            }
        }

        const data = Object.values(report).map(item => ({
            ...item,

            returnedQty:
                Number(item.returnedQty.toFixed(2)),

            returnAmount:
                round2(item.returnAmount),

            gstValue:
                Number(item.gstValue.toFixed(2))
        }));


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });

    } catch (err) {

        console.error(
            "getItemWisePurchaseReturnReport ERROR:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getPurchaseReturn = async (req, res) => {
    try {


        const { userId, role, superAdminId } = req.user;

        const {
            status,
            date,
            fromDate,
            toDate,
            period
        } = req.query;

        const finalSuperAdminId =
            role === "super_admin" ? userId : superAdminId;


        const query = {
            superAdminId: finalSuperAdminId
        };

        if (status) {
            query.status = status;
        }

        if (period) {
            let startDate;
            let endDate;

            const now = new Date();

            if (period === "today") {
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "yesterday") {
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setDate(endDate.getDate() - 1);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "week") {
                startDate = new Date(now);

                const day = startDate.getDay();
                const diff = day === 0 ? 6 : day - 1;

                startDate.setDate(startDate.getDate() - diff);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "month") {
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                );

                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else if (period === "year") {
                startDate = new Date(
                    now.getFullYear(),
                    0,
                    1
                );

                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            else {
                return res.status(400).json({
                    success: false,
                    message:
                        "Invalid period. Use today, yesterday, week, month or year."
                });
            }

            query.createdAt = {
                $gte: startDate,
                $lte: endDate
            };
        }

        else if (date) {
            const [day, month, year] = date.split("/");

            const start = new Date(year, month - 1, day);
            start.setHours(0, 0, 0, 0);

            const end = new Date(year, month - 1, day);
            end.setHours(23, 59, 59, 999);

            query.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        else if (fromDate || toDate) {
            query.createdAt = {};

            if (fromDate) {
                const [fd, fm, fy] = fromDate.split("/");

                const start = new Date(fy, fm - 1, fd);
                start.setHours(0, 0, 0, 0);

                query.createdAt.$gte = start;
            }

            if (toDate) {
                const [td, tm, ty] = toDate.split("/");

                const end = new Date(ty, tm - 1, td);
                end.setHours(23, 59, 59, 999);

                query.createdAt.$lte = end;
            }
        }

        const requests = await Return.find(query)
            .populate("purchaseId")
            .populate("supplierId", "name phone")
            .populate("items.productId", "name sellingPrice stock")
            .sort({ createdAt: -1 });

        const total = await Return.countDocuments(query);

        res.json({
            success: true,
            total,
            data: requests
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getByIdPurchaseReturn = async (req, res) => {
    try {

        const { id } = req.params;

        const { userId, role, superAdminId } = req.user;

        const finalSuperAdminId =
            role === "super_admin" ? userId : superAdminId;


        const request = await Return.findOne({
            _id: id,
            superAdminId: finalSuperAdminId
        })
            .populate("purchaseId")
            .populate("supplierId", "name phone email")
            .populate(
                "items.productId",
                "name sellingPrice costPrice stock"
            )
            .lean();

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Purchase return request not found"
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
};

exports.update_purchase_return_approve = async (req, res) => {
    try {
        const { id } = req.params;

        const { userId, role, superAdminId } = req.user;

        const finalSuperAdminId =
            role === "super_admin" ? userId : superAdminId;

        const request = await Return.findOne({
            _id: id,
            superAdminId: finalSuperAdminId
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Purchase return request not found"
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Request already ${request.status}`
            });
        }

        for (const item of request.items) {
            const product = await Product.findOne({
                _id: item.productId,
                superAdminId: finalSuperAdminId
            });

            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found"
                });
            }

            if (Number(product.stock) < Number(item.qty)) {
                return res.status(400).json({
                    success: false,
                    message: `${product.name} insufficient stock`
                });
            }

            await Product.updateOne(
                {
                    _id: item.productId,
                    superAdminId: finalSuperAdminId
                },
                {
                    $inc: {
                        stock: -Number(item.qty)
                    }
                }
            );
        }

        request.status = "approved";
        await request.save();

        res.json({
            success: true,
            message: "Purchase return request approved successfully",
            data: request
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.update_purchase_return_reject = async (req, res) => {
    try {

        const { id } = req.params;

        const { userId, role, superAdminId } = req.user;

        const finalSuperAdminId =
            role === "super_admin" ? userId : superAdminId;


        const request = await Return.findOne({
            _id: id,
            superAdminId: finalSuperAdminId
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Purchase return request not found"
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Request already ${request.status}`
            });
        }

        request.status = "rejected";

        await request.save();

        res.json({
            success: true,
            message: "Purchase return request rejected successfully",
            data: request
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};