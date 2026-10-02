const mongoose = require("mongoose");
const Bill = require("../models/bill");
const Purchase = require("../models/purchase");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



exports.getsalesSummary = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const { date, fromDate, toDate, period } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        const now = new Date();

       
        if (period) {
            let start;
            let end;

            switch (period.toLowerCase()) {

               
                case "today":
                    start = new Date(now);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(now);
                    end.setHours(23, 59, 59, 999);
                    break;

               
                case "yesterday":
                    start = new Date(now);
                    start.setDate(start.getDate() - 1);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(now);
                    end.setDate(end.getDate() - 1);
                    end.setHours(23, 59, 59, 999);
                    break;

                case "week":
                    start = new Date(now);

                    const day = start.getDay();

                   
                    const diff = day === 0 ? 6 : day - 1;

                    start.setDate(start.getDate() - diff);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(start);
                    end.setDate(start.getDate() + 6);
                    end.setHours(23, 59, 59, 999);
                    break;

               
                case "month":
                    start = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1
                    );
                    start.setHours(0, 0, 0, 0);

                    end = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0
                    );
                    end.setHours(23, 59, 59, 999);
                    break;

               
                case "year":
                    start = new Date(
                        now.getFullYear(),
                        0,
                        1
                    );
                    start.setHours(0, 0, 0, 0);

                    end = new Date(
                        now.getFullYear(),
                        11,
                        31
                    );
                    end.setHours(23, 59, 59, 999);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message:
                            "Invalid period. Use today, yesterday, week, month, or year."
                    });
            }

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

       
        else if (date) {

            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

       
        else if (fromDate || toDate) {

            filter.createdAt = {};

            if (fromDate) {
                const start = new Date(fromDate);
                start.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = start;
            }

            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = end;
            }
        }

        
        const bills = await Bill.find(filter);

        let totalSales = 0;
        let taxableAmount = 0;
        let cgst = 0;
        let sgst = 0;
        let igst = 0;

        let gstBills = 0;
        let nonGstBills = 0;

        let taxableSales = 0;
        let exemptSales = 0;

        let discountAmount = 0;

        bills.forEach((bill) => {

            const summary = bill.summary || {};

            discountAmount += Number(
                summary.totalDiscount || 0
            );

            totalSales += Number(
                bill.totalAmount ||
                summary.grandTotal ||
                0
            );

            taxableAmount += Number(
                bill.taxableAmount ||
                summary.subTotal ||
                0
            );

            cgst += Number(bill.cgst || 0);
            sgst += Number(bill.sgst || 0);
            igst += Number(bill.igst || 0);

            
            if (
                !bill.cgst &&
                !bill.sgst &&
                summary.totalGST
            ) {
                cgst += Number(summary.totalGST) / 2;
                sgst += Number(summary.totalGST) / 2;
            }

            let totalGST =
                Number(bill.cgst || 0) +
                Number(bill.sgst || 0) +
                Number(bill.igst || 0);

            if (totalGST === 0) {
                totalGST = Number(
                    summary.totalGST || 0
                );
            }

            const subTotal = Number(
                bill.taxableAmount ||
                summary.subTotal ||
                0
            );

            if (totalGST > 0) {
                gstBills++;
                taxableSales += subTotal;
            } else {
                nonGstBills++;
                exemptSales += subTotal;
            }
        });

      
        const round2 = (num) =>
            Number(Number(num).toFixed(2));

        totalSales = round2(totalSales);
        taxableAmount = round2(taxableAmount);
        taxableSales = round2(taxableSales);
        exemptSales = round2(exemptSales);

        cgst = round2(cgst);
        sgst = round2(sgst);
        igst = round2(igst);

        discountAmount = round2(discountAmount);

        const averageBillValue =
            bills.length > 0
                ? round2(totalSales / bills.length)
                : 0;

       
        res.json({
            success: true,

            filter: {
                period: period || null,
                date: date || null,
                fromDate: fromDate || null,
                toDate: toDate || null
            },

            data: {
                totalBills: bills.length,

                gstBills,
                nonGstBills,

                totalSales,
                taxableAmount,

                taxableSales,
                exemptSales,

                discountAmount,
                averageBillValue,

                cgst,
                sgst,
                igst,

                totalTax: round2(
                    cgst + sgst + igst
                ),

                  bills: bills
            }
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getpurchaseSummary = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);
        const {
            date,
            fromDate,
            toDate,
            period
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        const now = new Date();

       
        if (period) {
            let start;
            let end;

            switch (period.toLowerCase()) {

              
                case "today":
                    start = new Date(now);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(now);
                    end.setHours(23, 59, 59, 999);
                    break;

                
                case "yesterday":
                    start = new Date(now);
                    start.setDate(start.getDate() - 1);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(now);
                    end.setDate(end.getDate() - 1);
                    end.setHours(23, 59, 59, 999);
                    break;

              
                case "week":
                    start = new Date(now);

                    const day = start.getDay();

                   
                    const diff = day === 0 ? 6 : day - 1;

                    start.setDate(start.getDate() - diff);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(start);
                    end.setDate(start.getDate() + 6);
                    end.setHours(23, 59, 59, 999);
                    break;

                case "month":
                    start = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1
                    );

                    start.setHours(0, 0, 0, 0);

                    end = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0
                    );

                    end.setHours(23, 59, 59, 999);
                    break;

               
                case "year":
                    start = new Date(
                        now.getFullYear(),
                        0,
                        1
                    );

                    start.setHours(0, 0, 0, 0);

                    end = new Date(
                        now.getFullYear(),
                        11,
                        31
                    );

                    end.setHours(23, 59, 59, 999);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message:
                            "Invalid period. Use today, yesterday, week, month, or year."
                    });
            }

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

       
        else if (date) {

            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

       
        else if (fromDate || toDate) {

            filter.createdAt = {};

            if (fromDate) {
                const start = new Date(fromDate);
                start.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = start;
            }

            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = end;
            }
        }

       
        const purchases = await Purchase.find(filter);

        let totalPurchase = 0;

        let taxablePurchase = 0;
        let exemptPurchase = 0;

        let gstPurchases = 0;
        let nonGstPurchases = 0;

        let discountAmount = 0;

        let inputCGST = 0;
        let inputSGST = 0;
        let inputIGST = 0;

       
        purchases.forEach((purchase) => {

            totalPurchase += Number(
                purchase.totalAmount || 0
            );

            discountAmount += Number(
                purchase.billDiscountAmount || 0
            );

            let purchaseGST = 0;
            let purchaseTaxable = 0;

            (purchase.items || []).forEach((item) => {

                purchaseGST += Number(
                    item.taxAmount || 0
                );

                purchaseTaxable += Number(
                    item.amount || 0
                );
            });

            if (purchaseGST > 0) {

                gstPurchases++;

                taxablePurchase += purchaseTaxable;

                inputCGST += purchaseGST / 2;
                inputSGST += purchaseGST / 2;

            } else {

                nonGstPurchases++;

                exemptPurchase += purchaseTaxable;
            }
        });


        const round2 = (num) =>
            Number(Number(num).toFixed(2));

        totalPurchase = round2(totalPurchase);

        taxablePurchase = round2(taxablePurchase);

        exemptPurchase = round2(exemptPurchase);

        discountAmount = round2(discountAmount);

        inputCGST = round2(inputCGST);
        inputSGST = round2(inputSGST);
        inputIGST = round2(inputIGST);

        const averagePurchaseValue =
            purchases.length > 0
                ? round2(
                    totalPurchase / purchases.length
                )
                : 0;

       
        res.json({
            success: true,

            filter: {
                period: period || null,
                date: date || null,
                fromDate: fromDate || null,
                toDate: toDate || null
            },

            data: {
                totalPurchases: purchases.length,

                gstPurchases,
                nonGstPurchases,

                totalPurchase,

                taxablePurchase,
                exemptPurchase,

                discountAmount,

                averagePurchaseValue,

                inputCGST,
                inputSGST,
                inputIGST,

                inputGST: round2(
                    inputCGST +
                    inputSGST +
                    inputIGST
                ),

                 purchases: purchases
            }
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.getrateWiseSales = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            date,
            fromDate,
            toDate,
            period
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        const now = new Date();

       
        if (period) {
            let start;
            let end;

            switch (period.toLowerCase()) {

                case "today":
                    start = new Date(now);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(now);
                    end.setHours(23, 59, 59, 999);
                    break;

                case "yesterday":
                    start = new Date(now);
                    start.setDate(start.getDate() - 1);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(now);
                    end.setDate(end.getDate() - 1);
                    end.setHours(23, 59, 59, 999);
                    break;

                
                case "week":
                    start = new Date(now);

                    const day = start.getDay();

                   
                    const diff = day === 0 ? 6 : day - 1;

                    start.setDate(start.getDate() - diff);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(start);
                    end.setDate(start.getDate() + 6);
                    end.setHours(23, 59, 59, 999);
                    break;

                case "month":
                    start = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1
                    );

                    start.setHours(0, 0, 0, 0);

                    end = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0
                    );

                    end.setHours(23, 59, 59, 999);
                    break;

                case "year":
                    start = new Date(
                        now.getFullYear(),
                        0,
                        1
                    );

                    start.setHours(0, 0, 0, 0);

                    end = new Date(
                        now.getFullYear(),
                        11,
                        31
                    );

                    end.setHours(23, 59, 59, 999);
                    break;

                default:
                    return res.status(400).json({
                        success: false,
                        message:
                            "Invalid period. Use today, yesterday, week, month, or year."
                    });
            }

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

       
        else if (date) {

            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

     
        else if (fromDate || toDate) {

            filter.createdAt = {};

            if (fromDate) {
                const start = new Date(fromDate);
                start.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = start;
            }

            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = end;
            }
        }

       
        const bills = await Bill.find(filter);

        const summary = {};

       
        bills.forEach((bill) => {

            (bill.items || []).forEach((item) => {

                const gstRate = Number(
                    item.gstRate || 0
                );

                const finalPrice = Number(
                    item.finalPrice || 0
                );

                const gstAmount = Number(
                    item.gstAmount || 0
                );

                const taxable =
                    finalPrice - gstAmount;

                const tax = gstAmount;

                if (!summary[gstRate]) {

                    summary[gstRate] = {
                        gstRate,
                        taxableAmount: 0,
                        taxAmount: 0
                    };
                }

                summary[gstRate].taxableAmount += taxable;

                summary[gstRate].taxAmount += tax;
            });
        });

      
        const round2 = (num) =>
            Number(Number(num).toFixed(2));

        Object.values(summary).forEach((item) => {

            item.taxableAmount =
                round2(item.taxableAmount);

            item.taxAmount =
                round2(item.taxAmount);
        });

        
        const data = Object.values(summary).sort(
            (a, b) => a.gstRate - b.gstRate
        );

      
        res.json({
            success: true,

            filter: {
                period: period || null,
                date: date || null,
                fromDate: fromDate || null,
                toDate: toDate || null
            },

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


exports.getpurchaseregister = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);
        const { fromDate, toDate, invoiceNo, period } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        const parseDate = (dateStr, endOfDay = false) => {

            const [day, month, year] = dateStr.split("-");

            if (endOfDay) {
                return new Date(year, month - 1, day, 23, 59, 59);
            }

            return new Date(year, month - 1, day);
        };

        if (fromDate || toDate) {

            filter.createdAt = {};

            if (fromDate) {
                filter.createdAt.$gte = parseDate(fromDate);
            }

            if (toDate) {
                filter.createdAt.$lte = parseDate(toDate, true);
            }
        }


        if (invoiceNo && invoiceNo.trim() !== "") {
            filter.$or = [
                { invoiceNo: { $regex: invoiceNo.trim(), $options: "i" } },
                { purchaseNumber: { $regex: invoiceNo.trim(), $options: "i" } }
            ];
        }

        const purchases = await Purchase.find(filter)
            .populate("supplierId", "supplierName gstin")
            .sort({ createdAt: -1 });

        const data = purchases.map((purchase, index) => {

            const gstSummary = {
                0: 0,
                5: 0,
                12: 0,
                18: 0,
                28: 0
            };

            let goodsAmount = 0;

            purchase.items.forEach((item) => {

                const qty = Number(item.qty || 0);
                const price = Number(item.costPrice || 0);
                const gst = Number(item.gstpercentage || 0);

                const taxable = qty * price;

                goodsAmount += taxable;

                if (gstSummary[gst] !== undefined) {
                    gstSummary[gst] += taxable;
                }
            });

            return {
                sno: index + 1,

                date: purchase.createdAt,

                invoiceNo:
                    purchase.purchaseNumber ||
                    purchase.invoiceNo ||
                    purchase._id,

                invoiceDate:
                    purchase.invoiceDate ||
                    purchase.createdAt,

                distributor:
                    purchase.supplierId?.name || "",

                gstin:
                    purchase.supplierId?.gstin || "",

                goodsAmount,

                gst0: gstSummary[0],

                gst5: gstSummary[5],

                gst12: gstSummary[12],

                gst18: gstSummary[18],

                gst28: gstSummary[28]
            };
        });

        res.json({
            success: true,
            count: data.length,
            data
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}