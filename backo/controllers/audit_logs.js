const AuditLog = require("../models/audit_log");
const { attachHierarchy } = require("../utils/hierarchy");

exports.getAuditLogs = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            module,
            action,
            userId,
            fromDate,
            toDate
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        if (module) filter.module = module;
        if (action) filter.action = action;
        if (userId) filter.userId = userId;

        if (fromDate || toDate) {
            filter.createdAt = {};

            if (fromDate) {
                filter.createdAt.$gte = new Date(fromDate);
            }

            if (toDate) {
                filter.createdAt.$lte = new Date(toDate);
            }
        }

        const logs = await AuditLog.find(filter)
            .populate("userId", "name email role")
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: logs.length,
            data: logs
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};



exports.getPurchaseBillWiseItemAudit = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            fromDate,
            toDate,
            period,
            action,
            search
        } = req.query;



        const filter = {
            superAdminId: hierarchy.superAdminId,
            module: "Purchase"
        };

        if (action) {
            filter.action = action;
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


                case "tomorrow":
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() + 1);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(now);
                    endDate.setDate(now.getDate() + 1);
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

        } else if (fromDate || toDate) {

            // CUSTOM DATE FILTER
            filter.createdAt = {};

            if (fromDate) {
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = startDate;
            }

            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = endDate;
            }
        }


        const logs = await AuditLog.find(filter)
            .populate("userId", "name email role")
            .sort({ createdAt: -1 })
            .lean();



        const billWiseData = [];

        for (const log of logs) {

            const purchaseData =
                log.newData ||
                log.oldData ||
                {};

            const items =
                purchaseData.items ||
                purchaseData.products ||
                purchaseData.purchaseItems ||
                [];

            if (!Array.isArray(items) || items.length === 0) {
                continue;
            }

            const billItems = items.map((item, index) => {


                const gstRate = Number(
                    item.gst ??
                    item.gstRate ??
                    0
                );

                const cgstRate = Number(
                    item.cgst ??
                    item.cgstRate ??
                    0
                );

                const sgstRate = Number(
                    item.sgst ??
                    item.sgstRate ??
                    0
                );

                const igstRate = Number(
                    item.igst ??
                    item.igstRate ??
                    0
                );



                const cgstAmount = Number(
                    item.cgstAmount || 0
                );

                const sgstAmount = Number(
                    item.sgstAmount || 0
                );

                const igstAmount = Number(
                    item.igstAmount || 0
                );

                const taxAmount = Number(
                    item.taxAmount ??
                    item.totalTaxAmount ??
                    (
                        cgstAmount +
                        sgstAmount +
                        igstAmount
                    )
                );



                const qty = Number(
                    item.qty ??
                    item.quantity ??
                    item.purchaseQty ??
                    0
                );



                const rate = Number(
                    item.rate ??
                    item.Rate ??
                    item.netcost ??
                    item.costPrice ??
                    item.purchasePrice ??
                    0
                );

                const costPriceWithGst = Number(
                    (rate + (rate * gstRate / 100)).toFixed(2)
                );

                const grossAmount = Number(
                    item.grossAmount ??
                    item.amount ??
                    item.total ??
                    (qty * rate)
                );



                const taxableAmount = Number(
                    item.taxableAmount ??
                    grossAmount
                );



                const itemTotalAmount = Number(
                    (
                        taxableAmount +
                        taxAmount
                    ).toFixed(2)
                );



                return {

                    itemIndex: index + 1,

                    productId:
                        item.productId?._id ||
                        item.productId ||
                        item._id ||
                        null,

                    itemCode:
                        item.itemCode ||
                        item.productCode ||
                        item.code ||
                        "",

                    itemName:
                        item.itemName ||
                        item.productName ||
                        item.name ||
                        "",

                    hsnCode:
                        item.hsnCode ||
                        item.hsn ||
                        "",

                    unit:
                        item.unit ||
                        "",

                    unitValue:
                        Number(
                            item.unitValue || 0
                        ),

                    qty,

                    freeQty:
                        Number(
                            item.freeQty || 0
                        ),

                    mrp:
                        Number(
                            item.mrp || 0
                        ),

                    costPrice: costPriceWithGst,

                    purchasePrice:
                        rate,

                    sellingPrice:
                        Number(
                            item.sellingPrice || 0
                        ),

                    rate,

                    grossAmount,

                    discountPercent:
                        Number(
                            item.discountPercent || 0
                        ),

                    discountAmount:
                        Number(
                            item.discountAmount || 0
                        ),

                    taxableAmount,


                    gstRate,

                    cgstRate,

                    cgstAmount,

                    sgstRate,

                    sgstAmount,

                    igstRate,

                    igstAmount,

                    taxAmount,

                    totalAmount:
                        itemTotalAmount,

                    itemTotalAmount,

                    netAmount:
                        Number(
                            item.netAmount ??
                            item.totalAmount ??
                            itemTotalAmount
                        )
                };
            });



            const calculatedItemsTotal = Number(
                billItems
                    .reduce(
                        (sum, item) =>
                            sum +
                            Number(item.itemTotalAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            const calculatedTotalTaxAmount = Number(
                billItems
                    .reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.taxAmount || 0
                            ),
                        0
                    )
                    .toFixed(2)
            );

            const calculatedCgstAmount = Number(
                billItems
                    .reduce(
                        (sum, item) =>
                            sum +
                            Number(item.cgstAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            const calculatedSgstAmount = Number(
                billItems
                    .reduce(
                        (sum, item) =>
                            sum +
                            Number(item.sgstAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            const calculatedTotalGstAmount = Number(
                (
                    calculatedCgstAmount +
                    calculatedSgstAmount +
                    billItems.reduce(
                        (sum, item) =>
                            sum +
                            Number(item.igstAmount || 0),
                        0
                    )
                ).toFixed(2)
            );

            const calculatedBillTotal = Number(
                billItems
                    .reduce(
                        (sum, item) =>
                            sum +
                            Number(
                                item.itemTotalAmount || 0
                            ),
                        0
                    )
                    .toFixed(2)
            );


            billWiseData.push({

                auditId: log._id,

                documentId:
                    log.documentId ||
                    log.referenceId ||
                    purchaseData._id ||
                    null,

                action:
                    log.action,

                description:
                    log.description || "",

                date:
                    log.createdAt,



                user: {

                    id:
                        log.userId?._id ||
                        log.userId ||
                        null,

                    name:
                        log.userId?.name ||
                        "",

                    email:
                        log.userId?.email ||
                        "",

                    role:
                        log.userId?.role ||
                        log.role ||
                        ""
                },



                grnNo:
                    purchaseData.grnNo ||
                    purchaseData.grnNumber ||
                    "",

                invoiceNo:
                    purchaseData.invoiceNo ||
                    purchaseData.supplierInvoiceNo ||
                    purchaseData.originalInvoiceNo ||
                    "",

                grnDate:
                    purchaseData.grnDate ||
                    purchaseData.purchaseDate ||
                    purchaseData.invoiceDate ||
                    null,





                supplierId:
                    purchaseData.supplierId?._id ||
                    purchaseData.supplierId ||
                    null,

                supplierName:
                    purchaseData.supplierName ||
                    purchaseData.supplier?.name ||
                    "",

                supplierGstNumber:
                    purchaseData.supplierGstNumber ||
                    purchaseData.supplierGST ||
                    purchaseData.supplier?.gstNumber ||
                    "",

                placeOfSupply:
                    purchaseData.placeOfSupply ||
                    "",

                // ==========================================
                // ITEMS
                // ==========================================

                items: billItems,



                itemsTotal: Number(
                    purchaseData.itemsTotal ??
                    purchaseData.subTotal ??
                    calculatedItemsTotal
                ),

                cgstAmount: Number(
                    purchaseData.totalCgstAmount ??
                    purchaseData.cgstAmount ??
                    calculatedCgstAmount
                ),

                sgstAmount: Number(
                    purchaseData.totalSgstAmount ??
                    purchaseData.sgstAmount ??
                    calculatedSgstAmount
                ),

                totalGstAmount: Number(
                    purchaseData.totalGstAmount ??
                    purchaseData.totalTaxAmount ??
                    purchaseData.totalTax ??
                    calculatedTotalTaxAmount
                ),

                totalTaxAmount: Number(
                    purchaseData.totalTaxAmount ??
                    purchaseData.totalTax ??
                    calculatedTotalTaxAmount
                ),


                freightCharge:
                    Number(
                        purchaseData.freightCharge || 0
                    ),

                packagingCharge:
                    Number(
                        purchaseData.packagingCharge || 0
                    ),

                billDiscountPercent:
                    Number(
                        purchaseData.billDiscountPercent || 0
                    ),

                billDiscountAmount:
                    Number(
                        purchaseData.billDiscountAmount || 0
                    ),

                paidAmount:
                    Number(
                        purchaseData.paidAmount || 0
                    ),

                balanceAmount:
                    Number(
                        purchaseData.balanceAmount ??
                        purchaseData.pendingAmount ??
                        0
                    ),

                paymentStatus:
                    purchaseData.paymentStatus ||
                    "",

                paymentMode:
                    purchaseData.paymentMode ||
                    purchaseData.paymentMethod ||
                    ""
            });
        }

        // ==========================================
        // SEARCH
        // ==========================================

        let finalData = billWiseData;

        if (search) {

            const keyword =
                search.toLowerCase().trim();

            finalData =
                billWiseData.filter((bill) => {

                    // BILL SEARCH
                    const billMatch =
                        String(
                            bill.grnNo || ""
                        )
                            .toLowerCase()
                            .includes(keyword) ||

                        String(
                            bill.invoiceNo || ""
                        )
                            .toLowerCase()
                            .includes(keyword) ||

                        String(
                            bill.supplierName || ""
                        )
                            .toLowerCase()
                            .includes(keyword) ||

                        String(
                            bill.action || ""
                        )
                            .toLowerCase()
                            .includes(keyword);

                    // ITEM SEARCH
                    const itemMatch =
                        bill.items.some((item) => {

                            return (
                                String(
                                    item.itemName || ""
                                )
                                    .toLowerCase()
                                    .includes(keyword) ||

                                String(
                                    item.itemCode || ""
                                )
                                    .toLowerCase()
                                    .includes(keyword) ||

                                String(
                                    item.hsnCode || ""
                                )
                                    .toLowerCase()
                                    .includes(keyword)
                            );
                        });

                    return (
                        billMatch ||
                        itemMatch
                    );
                });
        }


        return res.status(200).json({

            success: true,

            count:
                finalData.length,

            data:
                finalData
        });

    } catch (error) {

        console.error(
            "PURCHASE BILL ITEM-WISE AUDIT ERROR:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error",

            error:
                error.message
        });
    }
};



exports.getBillWiseItemAudit = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            fromDate,
            toDate,
            period,
            action,
            search
        } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId,
            module: "Bill"
        };

        if (action) {
            filter.action = action;
        }


        // =====================================================
        // DATE FILTER
        // =====================================================

        if (period) {
            const now = new Date();

            let startDate;
            let endDate;

            switch (period.toLowerCase()) {

                // YESTERDAY
                case "yesterday":
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() - 1);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(now);
                    endDate.setDate(now.getDate() - 1);
                    endDate.setHours(23, 59, 59, 999);
                    break;

                // TODAY
                case "today":
                    startDate = new Date(now);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(now);
                    endDate.setHours(23, 59, 59, 999);
                    break;

                // TOMORROW
                case "tomorrow":
                    startDate = new Date(now);
                    startDate.setDate(now.getDate() + 1);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(now);
                    endDate.setDate(now.getDate() + 1);
                    endDate.setHours(23, 59, 59, 999);
                    break;

                // THIS WEEK
                case "week": {
                    const day = now.getDay();

                    // Monday = start of week
                    const diff = day === 0 ? -6 : 1 - day;

                    startDate = new Date(now);
                    startDate.setDate(now.getDate() + diff);
                    startDate.setHours(0, 0, 0, 0);

                    endDate = new Date(startDate);
                    endDate.setDate(startDate.getDate() + 6);
                    endDate.setHours(23, 59, 59, 999);

                    break;
                }

                // THIS MONTH
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

                // THIS YEAR
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

        } else if (fromDate || toDate) {

            // CUSTOM DATE FILTER
            filter.createdAt = {};

            if (fromDate) {
                const startDate = new Date(fromDate);
                startDate.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = startDate;
            }

            if (toDate) {
                const endDate = new Date(toDate);
                endDate.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = endDate;
            }
        }

        const logs = await AuditLog.find(filter)
            .populate("userId", "name email role")
            .sort({ createdAt: -1 })
            .lean();

        let billWiseData = [];

        for (const log of logs) {
            const auditData = log.newData || {};

            const items = Array.isArray(auditData.items)
                ? auditData.items
                : [];


            const gstItems = items
                .filter(
                    (item) =>
                        item.gstRate !== "none" &&
                        item.gstRate !== null &&
                        item.gstRate !== undefined &&
                        [0, 5, 12, 18, 40].includes(Number(item.gstRate))
                )
                .map((item) => ({
                    productId: item.productId || null,
                    barcodeId: item.barcodeId || null,
                    barcode: item.barcode || "",

                    itemName: item.itemName || "",
                    hsnCode: item.hsnCode || "",

                    qty: Number(item.qty || 0),
                    freeQty: Number(item.freeQty || 0),

                    totalGivenQty: Number(
                        item.totalGivenQty ??
                        (Number(item.qty || 0) + Number(item.freeQty || 0))
                    ),

                    unit: item.unit || "pcs",
                    unitValue: Number(item.unitValue || 1),
                    unitText: item.unitText || "",
                    totalKg: item.totalKg || "",

                    mrp: Number(item.mrp || 0),

                    // IMPORTANT
                    sellingPrice: Number(item.sellingPrice || 0),

                    rate: Number(item.rate || 0),

                    appliedPriceLevel:
                        item.appliedPriceLevel || "normal",

                    appliedSlab:
                        item.appliedSlab || null,

                    discountAmount:
                        Number(item.discountAmount || 0),

                    taxableAmount:
                        Number(item.taxableAmount || 0),

                    gstRate:
                        Number(item.gstRate || 0),

                    cgstRate:
                        Number(
                            item.cgstRate ??
                            (Number(item.gstRate || 0) / 2)
                        ),

                    sgstRate:
                        Number(
                            item.sgstRate ??
                            (Number(item.gstRate || 0) / 2)
                        ),

                    gstAmount:
                        Number(item.gstAmount || 0),

                    cgstAmount:
                        Number(
                            item.cgstAmount ??
                            (Number(item.gstAmount || 0) / 2)
                        ),

                    sgstAmount:
                        Number(
                            item.sgstAmount ??
                            (Number(item.gstAmount || 0) / 2)
                        ),

                    totalAmount:
                        Number(item.totalAmount || 0),

                    finalAmount:
                        Number(item.finalAmount || 0),

                    itemTotalAmount:
                        Number(
                            item.itemTotalAmount ??
                            item.finalAmount ??
                            0
                        )
                }));



            if (gstItems.length === 0) {
                continue;
            }




            // =====================================================
            // GST ITEMS ONLY SUMMARY
            // =====================================================

            const gstSubTotal = Number(
                gstItems
                    .reduce(
                        (total, item) =>
                            total + Number(item.taxableAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            const gstTotalGST = Number(
                gstItems
                    .reduce(
                        (total, item) =>
                            total + Number(item.gstAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            const gstTotalCGST = Number(
                gstItems
                    .reduce(
                        (total, item) =>
                            total + Number(item.cgstAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            const gstTotalSGST = Number(
                gstItems
                    .reduce(
                        (total, item) =>
                            total + Number(item.sgstAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            const gstTotalCGSTRate = Number(
                gstItems
                    .reduce(
                        (total, item) =>
                            total + Number(item.cgstRate || 0),
                        0
                    )
                    .toFixed(2)
            );

            const gstTotalSGSTRate = Number(
                gstItems
                    .reduce(
                        (total, item) =>
                            total + Number(item.sgstRate || 0),
                        0
                    )
                    .toFixed(2)
            );

            const gstItemDiscount = Number(
                gstItems
                    .reduce(
                        (total, item) =>
                            total + Number(item.discountAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            const gstGrandTotal = Number(
                gstItems
                    .reduce(
                        (total, item) =>
                            total + Number(item.itemTotalAmount || 0),
                        0
                    )
                    .toFixed(2)
            );

            billWiseData.push({
                auditId: log._id,
                documentId: log.documentId,

                action: log.action,
                description: log.description || "",

                date: log.createdAt,

                user: log.userId
                    ? {
                        id: log.userId._id,
                        name: log.userId.name || "",
                        email: log.userId.email || "",
                        role:
                            log.userId.role ||
                            log.role ||
                            ""
                    }
                    : {
                        id: null,
                        name: "",
                        email: "",
                        role: log.role || ""
                    },


                invoiceNo: auditData.invoiceNo || "",

                invoiceDate:
                    auditData.invoiceDate || null,

                customerId:
                    auditData.customerId || null,

                customerName:
                    auditData.customerName ||
                    "Walk-in Customer",

                customerGstNumber:
                    auditData.customerGstNumber || "",

                placeOfSupply:
                    auditData.placeOfSupply || "",


                itemCount: gstItems.length,

                items: gstItems,


                summary: {
                    subTotal: gstSubTotal,

                    totalGST: gstTotalGST,

                    totalCGST: gstTotalCGST,

                    totalSGST: gstTotalSGST,

                    totalCGSTRate: gstTotalCGSTRate,

                    totalSGSTRate: gstTotalSGSTRate,

                    itemDiscountAmount: gstItemDiscount,

                    billDiscountAmount: 0,

                    billDiscountPercentage: 0,

                    loyaltyDiscount: 0,

                    grandTotal: gstGrandTotal
                },

                paymentMethod:
                    auditData.paymentMethod || "",

            });
        }


        if (search && String(search).trim()) {
            const searchText = String(search)
                .trim()
                .toLowerCase();

            billWiseData = billWiseData.filter((bill) => {
                const itemMatch = bill.items.some(
                    (item) =>
                        String(item.itemName || "")
                            .toLowerCase()
                            .includes(searchText) ||

                        String(item.hsnCode || "")
                            .toLowerCase()
                            .includes(searchText) ||

                        String(item.barcode || "")
                            .toLowerCase()
                            .includes(searchText)
                );

                return (
                    String(bill.invoiceNo || "")
                        .toLowerCase()
                        .includes(searchText) ||

                    String(bill.customerName || "")
                        .toLowerCase()
                        .includes(searchText) ||

                    itemMatch
                );
            });
        }

        return res.status(200).json({
            success: true,
            count: billWiseData.length,
            data: billWiseData
        });

    } catch (error) {
        console.error(
            "BILL WISE ITEM AUDIT ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getAuditLogsByid = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const log = await AuditLog.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        }).populate("userId", "name email role");

        if (!log) {
            return res.status(404).json({
                success: false,
                message: "Audit log not found"
            });
        }

        res.json({
            success: true,
            data: log
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.deleteAuditLog = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const { id } = req.params;

        const log = await AuditLog.findOneAndDelete({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        if (!log) {
            return res.status(404).json({
                success: false,
                message: "Audit log not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Audit log deleted successfully"
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};