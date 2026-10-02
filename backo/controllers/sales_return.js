
const mongoose = require("mongoose");
const Bill = require("../models/bill");
const Product = require("../models/product");
const Barcode = require("../models/barcode");
const SalesReturn = require("../models/sales_return");
const Counter = require("../models/counter");
const CashRegister = require("../models/cashregister");
const { attachHierarchy } = require("../utils/hierarchy");

const getNextSalesReturnNo = async (superAdminId) => {
    const result = await Counter.findOneAndUpdate(
        { name: `sales_return_${superAdminId}` },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: "after" }
    );

    return `SR-${String(result.seq).padStart(5, "0")}`;
};

exports.createSalesReturn = async (req, res) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const {
            invoiceNo,
            items,
            refundMethod = "cash",
            reason = ""
        } = req.body;

        if (!invoiceNo) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "Invoice no is required"
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "Return items required"
            });
        }

        const allowedRefundMethods = ["cash", "upi", "card", "adjust"];

        if (!allowedRefundMethods.includes(refundMethod)) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "Refund method must be cash, upi, card or adjust"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const bill = await Bill.findOne({
            invoiceNo,
            superAdminId: hierarchy.superAdminId
        }).session(session);

        if (!bill) {
            await session.abortTransaction();
            session.endSession();

            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }

        const returnNo = await getNextSalesReturnNo(hierarchy.superAdminId);

        let totalReturnAmount = 0;
        let totalGST = 0;
        const returnItems = [];

        for (const item of items) {
            const { productId, barcode, returnQty } = item;

            const qty = Number(returnQty);

            if (!productId || isNaN(qty) || qty <= 0) {
                await session.abortTransaction();
                session.endSession();

                return res.status(400).json({
                    success: false,
                    message: "Valid productId and returnQty required"
                });
            }

            const soldItem = bill.items.find((bi) => {
                const sameProduct =
                    bi.productId?.toString() === productId.toString();

                const sameBarcode = barcode
                    ? bi.barcode === barcode
                    : true;

                return sameProduct && sameBarcode;
            });

            if (!soldItem) {
                await session.abortTransaction();
                session.endSession();

                return res.status(400).json({
                    success: false,
                    message: "Product not found in this bill"
                });
            }

            const soldQty = Number(soldItem.qty || 0);

            const previousReturns = await SalesReturn.aggregate([
                {
                    $match: {
                        billId: bill._id,
                        superAdminId: hierarchy.superAdminId
                    }
                },
                {
                    $unwind: "$items"
                },
                {
                    $match: {
                        "items.productId": soldItem.productId,
                        "items.barcodeId": soldItem.barcodeId
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalReturnedQty: {
                            $sum: "$items.returnQty"
                        }
                    }
                }
            ]);


            const alreadyReturnedQty =
                previousReturns.length > 0
                    ? previousReturns[0].totalReturnedQty
                    : 0;


            const availableReturnQty =
                soldQty - alreadyReturnedQty;

            if (availableReturnQty <= 0) {
                await session.abortTransaction();
                session.endSession();

                return res.status(400).json({
                    success: false,
                    message: "This product has already been fully returned"
                });
            }

            if (qty > availableReturnQty) {
                await session.abortTransaction();
                session.endSession();

                return res.status(400).json({
                    success: false,
                    message: `Return qty exceeded. Available return qty: ${availableReturnQty}`
                });

            }

            const unitFinalPrice =
                Number(soldItem.finalPrice || 0) / Number(soldItem.qty || 1);

            const returnAmount = Number((unitFinalPrice * qty).toFixed(2));

            const rawGstRate = soldItem.gstRate ?? "none";

            const gstRate =
                rawGstRate === "none"
                    ? "none"
                    : Number(rawGstRate);

            let taxableAmount = returnAmount;
            let gstAmount = 0;

            if (gstRate !== "none" && Number(gstRate) > 0) {
                taxableAmount = Number(
                    (returnAmount / (1 + Number(gstRate) / 100)).toFixed(2)
                );

                gstAmount = Number(
                    (returnAmount - taxableAmount).toFixed(2)
                );
            }

            totalReturnAmount += returnAmount;
            totalGST += gstAmount;

            await Barcode.updateOne(
                {
                    _id: soldItem.barcodeId,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $inc: {
                        availableQty: qty
                    }
                },
                { session }
            );

            await Product.updateOne(
                {
                    _id: soldItem.productId,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $inc: {
                        stock: qty
                    }
                },
                { session }
            );


            returnItems.push({
                productId: soldItem.productId,
                barcodeId: soldItem.barcodeId,
                barcode: soldItem.barcode,
                productName: soldItem.productName || soldItem.name || "",
                soldQty: soldItem.qty,
                returnQty: qty,
                sellingPrice: soldItem.sellingPrice || soldItem.normalSellingPrice || 0,
                gstRate,
                gstAmount,
                returnAmount
            });
        }

        totalReturnAmount = Number(totalReturnAmount.toFixed(2));
        totalGST = Number(totalGST.toFixed(2));

        const salesReturn = await SalesReturn.create([{
            returnNo,
            billId: bill._id,
            invoiceNo: bill.invoiceNo,
            customerId: bill.customerId || null,
            items: returnItems,
            totalReturnAmount,
            totalGST,
            refundMethod,
            reason,
            createdBy: req.user.userId || req.user.id,
            ...hierarchy
        }], { session });

        if (refundMethod === "cash") {
            const cashRegister = await CashRegister.findOne({
                superAdminId: hierarchy.superAdminId,
                status: "open"
            }).session(session);

            if (cashRegister) {
                cashRegister.cashOut += totalReturnAmount;

                cashRegister.expectedCash =
                    cashRegister.openingAmount +
                    cashRegister.cashSales -
                    cashRegister.cashOut;

                await cashRegister.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
            success: true,
            message: "Sales return created successfully",
            data: {
                returnId: salesReturn[0]._id,
                returnNo,
                invoiceNo: bill.invoiceNo,
                refundMethod,
                items: returnItems,
                summary: {
                    totalReturnAmount,
                    totalGST,
                    cgst: Number((totalGST / 2).toFixed(2)),
                    sgst: Number((totalGST / 2).toFixed(2))
                }
            }
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error("SALES RETURN ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};



exports.getBillWiseSalesReturnReport = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            date,
            fromDate,
            toDate,
            period,
            invoiceNo,
            gst
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        if (invoiceNo) {
            filter.invoiceNo = invoiceNo;
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
            const now = new Date();

            let startDate;
            let endDate;

            switch (period.toLowerCase()) {


                case "yesterday":
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 1);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(now);
                    endDate.setDate(now.getDate() - 1);
                    endDate.setHours(23, 59, 59, 999);
                    break;


                case "today":
                    startDate = new Date(now);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(now);
                    endDate.setHours(23, 59, 59, 999);
                    break;


                case "week": {
                    const day = now.getDay();

                    const diff = day === 0
                        ? -6
                        : 1 - day;

                    startDate = new Date(now);
                    startDate.setDate(now.getDate() + diff);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    endDate.setHours(23, 59, 59, 999);

                    break;
                }


                case "month":
                    startDate = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1
                    );
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0
                    );
                    endDate.setHours(23, 59, 59, 999);
                    break;


                case "year":
                    startDate = new Date(
                        now.getFullYear(),
                        0,
                        1
                    );
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(
                        now.getFullYear(),
                        11,
                        31
                    );
                    endDate.setHours(23, 59, 59, 999);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message:
                            "Invalid period. Use yesterday, today, tomorrow, week, month, or year"
                    });
            }

            filter.createdAt = {
                $gte: startDate,
                $lte: endDate
            };

        } else if (date) {


            const [day, month, year] = date.split("/");

            const start = new Date(year, month - 1, day);
            start.setHours(0, 0, 0, 0);

            const end = new Date(year, month - 1, day);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };

        } else if (fromDate && toDate) {

            const [fDay, fMonth, fYear] = fromDate.split("/");
            const [tDay, tMonth, tYear] = toDate.split("/");

            const start = new Date(fYear, fMonth - 1, fDay);
            start.setHours(0, 0, 0, 0);

            const end = new Date(tYear, tMonth - 1, tDay);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        const salesReturns = await SalesReturn.find(filter)
            .populate("customerId", "name phone")
            .sort({ createdAt: -1 });

        let totalReturnAmount = 0;
        let totalGST = 0;

        const data = [];

        for (const item of salesReturns) {

            if (!Array.isArray(item.items)) {
                continue;
            }

            const filteredItems = [];

            for (const returnItem of item.items) {

                const rawGst = returnItem.gstRate;

                const gstText = String(rawGst ?? "")
                    .trim()
                    .toLowerCase();

                const isNonGst =
                    returnItem.isNonGst === true ||
                    gstText === "none" ||
                    gstText === "non-gst" ||
                    gstText === "non gst";

                const gstRate = isNonGst
                    ? "none"
                    : Number(rawGst || 0);



                if (gst && gst.toLowerCase() !== "all") {

                    const gstFilter = gst.toLowerCase();


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
                            gstRate === "none" ||
                            Number(gstRate) !== Number(gstFilter)
                        ) {
                            continue;
                        }
                    }
                }

                filteredItems.push({
                    productId: returnItem.productId,
                    barcode: returnItem.barcode,
                    productName: returnItem.productName,

                    soldQty: Number(returnItem.soldQty || 0),
                    returnQty: Number(returnItem.returnQty || 0),

                    sellingPrice: Number(
                        returnItem.sellingPrice || 0
                    ),

                    gstRate: gstRate,

                    gstAmount: Number(
                        returnItem.gstAmount || 0
                    ).toFixed(2),

                    returnAmount: Number(
                        returnItem.returnAmount || 0
                    ).toFixed(2)
                });
            }


            if (
                gst &&
                gst.toLowerCase() !== "all" &&
                filteredItems.length === 0
            ) {
                continue;
            }


            const totalQty = filteredItems.reduce(
                (sum, i) => sum + Number(i.returnQty || 0),
                0
            );

            const filteredReturnAmount = filteredItems.reduce(
                (sum, i) => sum + Number(i.returnAmount || 0),
                0
            );

            const filteredGST = filteredItems.reduce(
                (sum, i) => sum + Number(i.gstAmount || 0),
                0
            );


            totalReturnAmount += filteredReturnAmount;
            totalGST += filteredGST;


            data.push({
                returnId: item._id,
                returnNo: item.returnNo,
                invoiceNo: item.invoiceNo,

                returnDate: item.createdAt.toLocaleDateString("en-GB"),
                returnTime: item.createdAt.toLocaleTimeString("en-IN"),

                customer: item.customerId
                    ? {
                        id: item.customerId._id,
                        name: item.customerId.name,
                        phone: item.customerId.phone
                    }
                    : null,

                refundMethod: item.refundMethod,

                totalItems: item.items.length,
                totalQty,

                totalReturnAmount: Number(
                    item.totalReturnAmount || 0
                ).toFixed(2),

                totalGST: Number(item.totalGST || 0).toFixed(2)
            });
        };

        return res.status(200).json({
            success: true,
            totalBills: data.length,

            summary: {
                totalReturnAmount: Number(
                    totalReturnAmount.toFixed(2)
                ),
                totalGST: Number(totalGST.toFixed(2))
            },

            data
        });

    } catch (error) {
        console.error("BILL WISE SALES RETURN REPORT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};



exports.getItemWiseSalesReturnReport = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            date,
            fromDate,
            toDate,
            period,
            productId,
            gst
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

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
            const now = new Date();

            let startDate;
            let endDate;

            switch (period.toLowerCase()) {

                case "yesterday":
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 1);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(now);
                    endDate.setDate(now.getDate() - 1);
                    endDate.setHours(23, 59, 59, 999);
                    break;

                case "today":
                    startDate = new Date(now);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(now);
                    endDate.setHours(23, 59, 59, 999);
                    break;



                case "week": {
                    const day = now.getDay();

                    const diff = day === 0
                        ? -6
                        : 1 - day;

                    startDate = new Date(now);
                    startDate.setDate(now.getDate() + diff);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    endDate.setHours(23, 59, 59, 999);

                    break;
                }

                case "month":
                    startDate = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1
                    );
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0
                    );
                    endDate.setHours(23, 59, 59, 999);
                    break;

                case "year":
                    startDate = new Date(
                        now.getFullYear(),
                        0,
                        1
                    );
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(
                        now.getFullYear(),
                        11,
                        31
                    );
                    endDate.setHours(23, 59, 59, 999);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message:
                            "Invalid period. Use yesterday, today, tomorrow, week, month, or year"
                    });
            }

            filter.createdAt = {
                $gte: startDate,
                $lte: endDate
            };

        } else if (date) {

            const [day, month, year] = date.split("/");

            const start = new Date(year, month - 1, day);
            start.setHours(0, 0, 0, 0);

            const end = new Date(year, month - 1, day);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };

        } else if (fromDate && toDate) {

            // CUSTOM DATE RANGE - DD/MM/YYYY
            const [fDay, fMonth, fYear] = fromDate.split("/");
            const [tDay, tMonth, tYear] = toDate.split("/");

            const start = new Date(fYear, fMonth - 1, fDay);
            start.setHours(0, 0, 0, 0);

            const end = new Date(tYear, tMonth - 1, tDay);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        const salesReturns = await SalesReturn.find(filter)
            .populate("customerId", "name phone")
            .sort({ createdAt: -1 });

        const data = [];
        let totalQty = 0;
        let totalReturnAmount = 0;
        let totalGST = 0;

        salesReturns.forEach((saleReturn) => {

            saleReturn.items.forEach((item) => {

                if (
                    productId &&
                    item.productId.toString() !== productId.toString()
                ) {
                    return;
                }


                const rawGst = item.gstRate;

                const gstText = String(rawGst ?? "")
                    .trim()
                    .toLowerCase();

                const isNonGst =
                    item.isNonGst === true ||
                    gstText === "none" ||
                    gstText === "non-gst" ||
                    gstText === "non gst";

                const gstRate = isNonGst
                    ? "none"
                    : Number(rawGst || 0);



                if (gst && gst.toLowerCase() !== "all") {

                    const gstFilter = gst.toLowerCase();

                    if (gstFilter === "gst") {

                        if (gstRate === "none") {
                            return;
                        }
                    }


                    else if (gstFilter === "none") {

                        if (gstRate !== "none") {
                            return;
                        }
                    }


                    else {

                        if (
                            gstRate === "none" ||
                            Number(gstRate) !== Number(gstFilter)
                        ) {
                            return;
                        }
                    }
                }


                totalQty += Number(item.returnQty || 0);
                totalReturnAmount += Number(item.returnAmount || 0);
                totalGST += Number(item.gstAmount || 0);

                data.push({
                    returnId: saleReturn._id,
                    returnNo: saleReturn.returnNo,

                    invoiceNo: saleReturn.invoiceNo,

                    returnDate: saleReturn.createdAt.toLocaleDateString("en-GB"),
                    returnTime: saleReturn.createdAt.toLocaleTimeString("en-IN"),

                    customer: saleReturn.customerId
                        ? {
                            id: saleReturn.customerId._id,
                            name: saleReturn.customerId.name,
                            phone: saleReturn.customerId.phone
                        }
                        : null,

                    refundMethod: saleReturn.refundMethod,

                    productId: item.productId,
                    barcode: item.barcode,
                    productName: item.productName,

                    soldQty: item.soldQty,
                    returnQty: item.returnQty,

                    sellingPrice: item.sellingPrice,

                    gstRate: gstRate,
                    gstAmount: Number(item.gstAmount || 0).toFixed(2),

                    returnAmount: Number(item.returnAmount || 0).toFixed(2)
                });

            });

        });

        return res.status(200).json({
            success: true,
            totalItems: data.length,

            summary: {
                totalQty,
                totalReturnAmount: Number(totalReturnAmount.toFixed(2)),
                totalGST: Number(totalGST.toFixed(2)),
                cgst: Number((totalGST / 2).toFixed(2)),
                sgst: Number((totalGST / 2).toFixed(2))
            },

            data
        });

    } catch (error) {
        console.error("ITEM WISE SALES RETURN REPORT ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};



exports.getInvoiceForSalesReturn = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const { invoiceNo } = req.params;

        const bill = await Bill.findOne({
            invoiceNo,
            superAdminId: hierarchy.superAdminId
        }).populate("customerId", "name mobile");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: {
                invoiceNo: bill.invoiceNo,
                customer: bill.customerId,
                billDate: bill.createdAt,
                items: bill.items.map(item => ({
                    productId: item.productId,
                    productName: item.productName || item.name,
                    barcode: item.barcode,
                    qty: item.qty,
                    returnedQty: item.returnedQty || 0,
                    availableReturnQty:
                        item.qty - (item.returnedQty || 0),
                    sellingPrice: item.sellingPrice,
                    finalPrice: item.finalPrice
                }))
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getSalesReturns = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            fromDate,
            toDate,
            period,
            gst
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        // =====================================================
        // GST VALIDATION
        // =====================================================

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


        const now = new Date();

        if (period) {
            const periodValue = period.toLowerCase();

            let startDate;
            let endDate;

            // TODAY
            if (periodValue === "today") {
                startDate = new Date(now);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            // YESTERDAY
            else if (periodValue === "yesterday") {
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 1);
                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setDate(endDate.getDate() - 1);
                endDate.setHours(23, 59, 59, 999);
            }

            // WEEK
            else if (periodValue === "week") {
                startDate = new Date(now);

                const day = startDate.getDay();

                const diff = day === 0
                    ? 6
                    : day - 1;

                startDate.setDate(
                    startDate.getDate() - diff
                );

                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            // MONTH
            else if (periodValue === "month") {
                startDate = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    1
                );

                startDate.setHours(0, 0, 0, 0);

                endDate = new Date(now);
                endDate.setHours(23, 59, 59, 999);
            }

            // YEAR
            else if (periodValue === "year") {
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


        else if (fromDate || toDate) {
            filter.createdAt = {};

            
            if (fromDate) {
                const [fDay, fMonth, fYear] = fromDate.split("/");

                const startDate = new Date(
                    Number(fYear),
                    Number(fMonth) - 1,
                    Number(fDay)
                );

                startDate.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = startDate;
            }

           
            if (toDate) {
                const [tDay, tMonth, tYear] = toDate.split("/");

                const endDate = new Date(
                    Number(tYear),
                    Number(tMonth) - 1,
                    Number(tDay)
                );

                endDate.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = endDate;
            }
        }

        const salesReturns = await SalesReturn.find(filter)
            .populate(
                "customerId",
                "customerId name phone"
            )
            .populate(
                "items.productId",
                "itemCode name"
            )
            .sort({
                createdAt: -1
            });


        const data = [];

        for (const item of salesReturns) {

            if (!Array.isArray(item.items)) {
                continue;
            }

            let filteredItems = item.items;

            if (
                gst &&
                gst.toLowerCase() !== "all"
            ) {

                const gstFilter = gst.toLowerCase();

                filteredItems = item.items.filter(
                    (returnItem) => {

                        const rawGst =
                            returnItem.gstRate;

                        const gstText =
                            String(rawGst ?? "")
                                .trim()
                                .toLowerCase();

                        const isNonGst =
                            returnItem.isNonGst === true ||
                            gstText === "none" ||
                            gstText === "non-gst" ||
                            gstText === "non gst";

                        const gstRate = isNonGst
                            ? "none"
                            : Number(rawGst || 0);

                        if (gstFilter === "gst") {
                            return gstRate !== "none";
                        }

                        if (gstFilter === "none") {
                            return gstRate === "none";
                        }

                        return (
                            gstRate !== "none" &&
                            Number(gstRate) ===
                            Number(gstFilter)
                        );
                    }
                );
            }


            if (
                gst &&
                gst.toLowerCase() !== "all" &&
                filteredItems.length === 0
            ) {
                continue;
            }


            const returnData = item.toObject();

            returnData.items = filteredItems;

            data.push(returnData);
        }


        return res.status(200).json({
            success: true,
            count: data.length,
            data
        });

    } catch (error) {

        console.error(
            "GET SALES RETURNS ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getSalesReturnById = async (req, res) => {
    try {

        const { id } = req.params;

        const hierarchy = attachHierarchy(req.user);

        const salesReturn = await SalesReturn.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        })
            .populate("customerId", "customerId name phone");

        if (!salesReturn) {
            return res.status(404).json({
                success: false,
                message: "Sales return not found"
            });
        }

        res.json({
            success: true,
            data: salesReturn
        });

    } catch (error) {
        console.error("GET SALES RETURN ERROR:", error);

        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};