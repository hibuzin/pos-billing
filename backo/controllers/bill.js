const mongoose = require("mongoose");
const Bill = require("../models/bill");
const User = require("../models/user");
const Offer = require("../models/offer");
const ComboOffer = require("../models/combo_offer");
const counter = require("../models/counter");
const Product = require("../models/product");
const Barcode = require("../models/barcode");
const Customer = require("../models/customer");
const PriceLevel = require("../models/price_level");
const DuePayment = require("../models/due_payment");
const { attachHierarchy } = require("../utils/hierarchy");
const CashRegister = require("../models/cashregister");
const Session = require("../models/session");
const AuditLog = require("../models/audit_log");


const getNextInvoiceNo = async (superAdminId) => {
    const result = await counter.findOneAndUpdate(
        { name: `invoice_${superAdminId}` },
        { $inc: { seq: 1 } },
        { returnDocument: "after", upsert: true }
    );

    return `INV-${String(result.seq).padStart(5, "0")}`;
};

exports.createBill = async (req, res) => {
    try {
        const {
            codes,
            items: billItems = [],
            isWalkInCustomer = false,
            customerId,
            redeemPoints = 0,
            priceLevel = "normal",

            discountPercent,
            discountAmount,

            paymentStatus = "paid",
            paymentMethod = "due",

            payments = [],
            paidAmount = 0,
            dueDate
        } = req.body;

        if (
            (!Array.isArray(codes) || codes.length === 0) &&
            (!Array.isArray(billItems) || billItems.length === 0)
        ) {
            return res.status(400).json({
                success: false,
                message: "No products provided"
            });
        }

        const hierarchy = attachHierarchy(req.user);


        const userId = req.user.userId || req.user.id;


        const activeSession = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (!activeSession) {
            return res.status(400).json({
                success: false,
                message: "Please start a session before creating a bill."
            });
        }


        let subTotal = 0;
        let totalGST = 0;
        let totalItemDiscount = 0;

        const items = [];

        const gstAuditItems = [];

        const codeQtyMap = {};

        for (const code of codes || []) {
            const searchValue = String(code).trim();

            if (!searchValue) continue;

            codeQtyMap[searchValue] =
                (codeQtyMap[searchValue] || 0) + 1;
        }

        for (const [searchValue, qty] of Object.entries(codeQtyMap)) {

            let product = null;

            let barcode = await Barcode.findOne({
                code: searchValue,
                superAdminId: hierarchy.superAdminId
            });



            if (!barcode) {
                return res.status(400).json({
                    success: false,
                    message: `Barcode not found: ${searchValue}`
                });
            }

            if (barcode.comboOfferId) {

            } else {
                product = await Product.findOne({
                    _id: barcode.productId,
                    superAdminId: hierarchy.superAdminId
                });

                if (!product) {
                    return res.status(400).json({
                        success: false,
                        message: `Product not found for barcode ${searchValue}`
                    });
                }

                const stock = Number(product.stock || 0);

                if (stock < qty) {
                    return res.status(400).json({
                        success: false,
                        message: `Stock not available for ${product.name}. Available: ${stock}`
                    });

                }
            }


            if (barcode.comboOfferId) {

                const comboOffer = await ComboOffer.findOne({
                    _id: barcode.comboOfferId,
                    superAdminId: hierarchy.superAdminId,
                    isActive: true
                });

                if (!comboOffer) {
                    return res.status(400).json({
                        success: false,
                        message: `Combo offer not found for barcode: ${searchValue}`
                    });
                }





                const comboPrice = Number(comboOffer.comboPrice || 0);

                if (comboPrice <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid combo price"
                    });
                }

                const finalComboPrice = Number(
                    (comboPrice * qty).toFixed(2)
                );

                const comboProducts = [];

                for (const comboItem of comboOffer.products) {

                    const comboProduct = await Product.findOne({
                        _id: comboItem.productId,
                        superAdminId: hierarchy.superAdminId
                    });

                    if (!comboProduct) {
                        return res.status(400).json({
                            success: false,
                            message: `Combo product not found: ${comboItem.productId}`
                        });
                    }

                    comboProducts.push({
                        product: comboProduct,
                        qty: Number(comboItem.qty || 1)
                    });
                }


                let comboGST = 0;

                for (const item of comboProducts) {

                    const productGST = Number(
                        item.product.gstRate || item.product.gst || 0
                    );

                    if (productGST > 0) {
                        comboGST += Number(
                            (
                                finalComboPrice *
                                productGST /
                                (100 + productGST)
                            ).toFixed(2)
                        );
                    }
                }


                items.push({
                    productId: null,
                    barcodeId: barcode?._id || null,
                    barcode: barcode?.code || "",

                    itemCode: comboOffer.itemCode || "",

                    comboOfferId: comboOffer._id,

                    productName: comboOffer.offerName,
                    name: comboOffer.offerName,

                    totalAmount: finalComboPrice,
                    discountPercent: 0,
                    discountAmount: 0,
                    finalPrice: finalComboPrice,

                    qty,

                    comboProducts: comboProducts.map(item => ({
                        productId: item.product._id,
                        productName: item.product.name,
                        sellingPrice: Number(item.product.sellingPrice || 0),
                        qty: item.qty
                    })),

                    gstRate: 0,
                    gstAmount: comboGST
                });

                subTotal += Number(
                    (finalComboPrice - comboGST).toFixed(2)
                );

                totalGST += comboGST;

                continue;
            }



            let slabPrice = null;
            let discountPerItem = 0;
            let totalDiscount = 0;

            let appliedPriceLevel = "normal";
            let appliedSlab = null;


            const rawGstRate = barcode?.gstRate ?? product.gstRate ?? "none";

            const gstRate =
                rawGstRate === "none"
                    ? "none"
                    : Number(rawGstRate);

            const price = Number(
                barcode?.sellingPrice ?? product?.sellingPrice ?? 0
            );

            if (price <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid selling price for product: ${product.name}`
                });
            }

            const grossAmount = Number((price * qty).toFixed(2));



            const itemDiscountPercent = 0;
            const itemDiscountAmount = 0;

            let itemDiscount = 0;

            if (itemDiscountPercent > 0) {
                itemDiscount = Number(
                    ((grossAmount * itemDiscountPercent) / 100).toFixed(2)
                );
            } else if (itemDiscountAmount > 0) {
                itemDiscount = itemDiscountAmount;
            }

            totalItemDiscount += itemDiscount;

            const finalPrice = Number(
                (grossAmount - itemDiscount).toFixed(2)
            );

            let taxableAmount = finalPrice;
            let gstAmount = 0;

            if (gstRate !== "none" && Number(gstRate) > 0) {
                taxableAmount = Number(
                    (finalPrice / (1 + Number(gstRate) / 100)).toFixed(2)
                );

                gstAmount = Number(
                    (finalPrice - taxableAmount).toFixed(2)
                );
            }

            subTotal += taxableAmount;
            totalGST += gstAmount;

            items.push({
                productId: product._id,
                barcodeId: barcode?._id || null,
                barcode: barcode?.code || "",

                itemCode: product.itemCode || "",

                productName: product.name || "",
                name: product.name || "",

                totalAmount: grossAmount,
                discountPercent: Number(discountPercent || 0),
                discountAmount: itemDiscount,
                finalPrice,

                unit: barcode?.unit || product.unit || "pcs",
                unitValue: barcode.unitValue || product.unitValue || 1,
                unitText: `${barcode.unitValue || product.unitValue || 1} ${barcode.unit || product.unit || "pcs"}`,

                totalkg: `${qty * Number(barcode.unitValue || product.unitValue || 1)} ${barcode.unit || product.unit || "pcs"}`,
                qty,

                mrp: barcode?.mrp ?? product.mrp ?? 0,
                sellingPrice: barcode.sellingPrice || 0,
                appliedPriceLevel,
                appliedSlab,
                gstRate,
                gstAmount
            });

            if (gstRate !== "none") {
                gstAuditItems.push({
                    productId: product._id,
                    productName: product.name || "",
                    barcode: barcode?.code || "",
                    qty,
                    sellingPrice: barcode.sellingPrice || 0,
                    gstRate,
                    gstAmount,
                    finalPrice
                });
            }



            await Product.updateOne(
                { _id: product._id, superAdminId: hierarchy.superAdminId },
                { $inc: { stock: -qty } }
            );
        }

        let appliedBuyGetOffer = null;

        for (const billItem of billItems) {

            const qty = Number(billItem.qty || 1);


            let freeQty = 0;
            let freeProduct = null;


            const buyGetOffer = await Offer.findOne({
                superAdminId: hierarchy.superAdminId,
                offerType: "buy_get",
                isActive: true,
                buyProductId: billItem.productId
            });

            if (buyGetOffer) {
                appliedBuyGetOffer = buyGetOffer;
            }

            if (buyGetOffer && qty >= Number(buyGetOffer.buyQty || 0)) {

                freeQty =
                    Math.floor(qty / Number(buyGetOffer.buyQty)) *
                    Number(buyGetOffer.freeQty || 0);

                if (freeQty > 0) {

                    freeProduct = await Product.findOne({
                        _id: buyGetOffer.freeProductId,
                        superAdminId: hierarchy.superAdminId
                    });

                    if (!freeProduct) {
                        return res.status(404).json({
                            success: false,
                            message: "Free product not found"
                        });
                    }


                }
            }

            const discountPercent = Number(billItem.discountPercent || 0);
            const discountAmount = Number(billItem.discountAmount || 0);




            if (isNaN(qty) || qty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid quantity"
                });
            }

            if (billItem.comboOfferId) {

                const comboOffer = await ComboOffer.findOne({
                    _id: billItem.comboOfferId,
                    superAdminId: hierarchy.superAdminId,
                    isActive: true
                });

                if (!comboOffer) {
                    return res.status(404).json({
                        success: false,
                        message: "Combo offer not found"
                    });
                }



                const availableComboQty = Number(comboOffer.comboQty || 0);

                if (availableComboQty < qty) {
                    return res.status(400).json({
                        success: false,
                        message:
                            `Combo stock not available. Available: ${availableComboQty}, Required: ${qty}`
                    });
                }



                comboOffer.comboQty = availableComboQty - qty;

                await comboOffer.save();



                const comboPrice = Number(comboOffer.comboPrice || 0);

                if (comboPrice <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid combo price"
                    });
                }

                const finalComboPrice = Number(
                    (comboPrice * qty).toFixed(2)
                );



                let comboGST = 0;

                for (const comboItem of comboOffer.products) {

                    const product = await Product.findOne({
                        _id: comboItem.productId,
                        superAdminId: hierarchy.superAdminId
                    });

                    if (!product) {
                        return res.status(404).json({
                            success: false,
                            message: "Combo product not found"
                        });
                    }

                    const productGST = Number(
                        product.gstRate || product.gst || 0
                    );

                    if (productGST > 0) {
                        comboGST += Number(
                            (
                                finalComboPrice *
                                productGST /
                                (100 + productGST)
                            ).toFixed(2)
                        );
                    }
                }

                comboGST = Number(comboGST.toFixed(2));

                const comboTaxableAmount = Number(
                    (finalComboPrice - comboGST).toFixed(2)
                );



                items.push({

                    productId: null,

                    barcodeId: null,

                    barcode: null,

                    itemCode: comboOffer.itemCode || "",



                    comboOfferId: comboOffer._id,

                    productName: comboOffer.offerName,

                    name: comboOffer.offerName,

                    totalAmount: finalComboPrice,

                    discountPercent: 0,

                    discountAmount: 0,

                    finalPrice: finalComboPrice,

                    qty,

                    freeQty: 0,

                    totalGivenQty: qty,

                    sellingPrice: comboPrice,

                    normalSellingPrice: comboPrice,

                    comboProducts: comboOffer.products.map(comboItem => ({
                        productId: comboItem.productId,
                        qty: Number(comboItem.qty || 1) * qty
                    })),

                    gstRate: 0,

                    gstAmount: comboGST
                });

                subTotal += comboTaxableAmount;

                totalGST += comboGST;

                continue;
            }



            const product = await Product.findOne({
                _id: billItem.productId,
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

            const normalSellingPrice = Number(
                barcode?.sellingPrice ?? product.sellingPrice ?? 0
            );

            const editedSellingPrice =
                billItem.sellingPrice !== undefined &&
                    billItem.sellingPrice !== null &&
                    billItem.sellingPrice !== ""
                    ? Number(billItem.sellingPrice)
                    : null;

            let price = editedSellingPrice !== null
                ? editedSellingPrice
                : normalSellingPrice;

            let slabPrice = null;
            let discountPerItem = 0;
            let totalDiscount = 0;

            let appliedPriceLevel = "normal";
            let appliedSlab = null;

            const productPriceLevel = await PriceLevel.findOne({
                productId: product._id,
                superAdminId: hierarchy.superAdminId,
                isActive: true
            });

            if (productPriceLevel && editedSellingPrice === null) {

                if (
                    priceLevel === "manual" &&
                    productPriceLevel.pricingType === "manual"
                ) {

                    price = Number(productPriceLevel.manualPrice || price);
                    appliedPriceLevel = "manual";

                } else if (
                    priceLevel === "auto" &&
                    productPriceLevel.pricingType === "auto"
                ) {

                    const profitPercent =
                        Number(productPriceLevel.autoPricing?.profitPercent || 0);

                    const baseOn =
                        productPriceLevel.autoPricing?.baseOn || "costPrice";

                    const basePrice =
                        baseOn === "mrp"
                            ? Number(barcode?.mrp ?? product.mrp ?? 0)
                            : Number(barcode?.costPrice ?? product.costPrice ?? 0);

                    price =
                        basePrice +
                        (basePrice * profitPercent / 100);

                    appliedPriceLevel = "auto";

                } else if (
                    priceLevel === "slab" &&
                    productPriceLevel.pricingType === "slab"
                ) {

                    const slab = productPriceLevel.slabs.find((s) => {

                        const minOk = qty >= Number(s.minQty || 0);

                        const maxOk =
                            s.maxQty === null ||
                            qty <= Number(s.maxQty);

                        return minOk && maxOk;
                    });

                    if (slab) {
                        slabPrice = Number(slab.price || normalSellingPrice);

                        discountPerItem = Number((normalSellingPrice - slabPrice).toFixed(2));
                        totalDiscount = Number((discountPerItem * qty).toFixed(2));

                        price = slabPrice;

                        appliedPriceLevel = "slab";
                        appliedSlab = {
                            minQty: slab.minQty,
                            maxQty: slab.maxQty,
                            slabPrice,
                            normalSellingPrice,
                            discountPerItem,
                            totalDiscount
                        };
                    }
                }
            }


            const rawGstRate = barcode?.gstRate ?? product.gstRate ?? "none";

            const gstRate =
                rawGstRate === "none"
                    ? "none"
                    : Number(rawGstRate);

            if (price <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid selling price for product: ${product.name}`
                });

            }

            const grossAmount = Number((price * qty).toFixed(2));



            let itemDiscount = 0;

            if (Number(discountPercent) > 0) {
                itemDiscount = Number(
                    ((grossAmount * Number(discountPercent)) / 100).toFixed(2)
                );
            }
            else if (Number(discountAmount) > 0) {
                itemDiscount = Number(discountAmount);
            }

            let calculatedDiscountPercent = discountPercent;

            if (
                calculatedDiscountPercent === 0 &&
                itemDiscount > 0 &&
                grossAmount > 0
            ) {
                calculatedDiscountPercent = Number(
                    ((itemDiscount / grossAmount) * 100).toFixed(2)
                );
            }

            totalItemDiscount += itemDiscount;

            const finalPrice = Number(
                (grossAmount - itemDiscount).toFixed(2)
            );

            let taxableAmount = finalPrice;
            let gstAmount = 0;

            if (gstRate !== "none" && Number(gstRate) > 0) {
                taxableAmount = Number(
                    (finalPrice / (1 + Number(gstRate) / 100)).toFixed(2)
                );

                gstAmount = Number(
                    (finalPrice - taxableAmount).toFixed(2)
                );
            }


            subTotal += taxableAmount;
            totalGST += gstAmount;

            items.push({



                productId: product._id,
                barcodeId: barcode?._id || null,

                barcode: barcode?.code || "",

                itemCode: product.itemCode || "",

                totalAmount: grossAmount,
                discountPercent: calculatedDiscountPercent,
                discountAmount: itemDiscount,
                finalPrice,

                productName: product.name || "",
                name: product.name || "",

                unit: barcode?.unit || product.unit || "pcs",

                unitValue: barcode?.unitValue || product.unitValue || 1,

                unitText: `${barcode?.unitValue || product.unitValue || 1} ${barcode?.unit || product.unit || "pcs"}`,

                totalUnitQty:
                    qty * Number(barcode?.unitValue || product.unitValue || 1),

                totalUnitText:
                    `${qty * Number(barcode?.unitValue || product.unitValue || 1)} ${barcode?.unit || product.unit || "pcs"}`,

                qty,
                freeQty,

                freeProductId: freeProduct?._id || null,

                freeProductName: freeProduct?.name || "",

                freeProductUnit: freeProduct
                    ? freeProduct.unit || "pcs"
                    : "",

                freeProductUnitValue: freeProduct
                    ? freeProduct.unitValue || 1
                    : 0,

                totalGivenQty: qty + freeQty,

                mrp: barcode?.mrp ?? product.mrp ?? 0,


                appliedPriceLevel,
                appliedSlab,


                sellingPrice: normalSellingPrice,
                normalSellingPrice,
                slabPrice,
                discountPerItem,
                totalDiscount,


                gstRate,
                gstAmount,
            });


            if (gstRate !== "none") {
                gstAuditItems.push({
                    productId: product._id,
                    productName: product.name || "",
                    barcode: barcode?.code || "",
                    qty,
                    price,
                    gstRate,
                    gstAmount,
                    finalPrice
                });
            }


            const stock = Number(product.stock || 0);

            if (stock < qty + freeQty) {
                return res.status(400).json({
                    success: false,
                    message: `${product.name} stock not available. Available: ${stock}`
                });
            }



            const stockUpdate = await Product.updateOne(
                {
                    _id: product._id,
                    superAdminId: hierarchy.superAdminId,
                    stock: { $gte: qty + freeQty }
                },
                {
                    $inc: {
                        stock: -(qty + freeQty)
                    }
                }

            );

            if (stockUpdate.modifiedCount === 0) {
                return res.status(400).json({
                    success: false,
                    message: `${product.name} stock update failed`
                });
            }
        }



        const beforeBillDiscount = Number(
            (subTotal + totalGST).toFixed(2)
        );

        let billDiscount = 0;
        let billDiscountPercentage = 0;

        if (Number(discountPercent) > 0) {

            billDiscount = Number(
                (
                    beforeBillDiscount *
                    Number(discountPercent) /
                    100
                ).toFixed(2)
            );

            billDiscountPercentage = Number(discountPercent);

        } else if (Number(discountAmount) > 0) {

            billDiscount = Number(discountAmount);

            billDiscountPercentage = Number(
                (
                    billDiscount /
                    beforeBillDiscount *
                    100
                ).toFixed(2)
            );
        }


        let discount = 0;
        let customer = null;

        if (!isWalkInCustomer) {

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message: "Customer is required or select Walk in Customer."
                });
            }

            const customerFilter = {
                superAdminId: hierarchy.superAdminId,
                $or: []
            };

            if (mongoose.Types.ObjectId.isValid(customerId)) {
                customerFilter.$or.push({ _id: customerId });
            }

            if (!isNaN(customerId)) {
                customerFilter.$or.push({ customerId: Number(customerId) });
            }

            customer = await Customer.findOne(customerFilter);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found"
                });
            }



            if (Number(redeemPoints) > 0) {
                if (customer.loyaltyPoints < Number(redeemPoints)) {
                    return res.status(400).json({
                        success: false,
                        message: "Not enough loyalty points"
                    });
                }

                discount = Number(redeemPoints);
                customer.loyaltyPoints -= discount;
            }
        } else {

            customer = null;
        }



        let grandTotal = Number(
            (
                subTotal +
                totalGST -
                billDiscount -
                discount
            ).toFixed(2)
        );


        let offer = null;
        let offerDiscount = 0;
        let appliedOffer = null;




        offer = await Offer.findOne({
            superAdminId: hierarchy.superAdminId,
            isActive: true,
            offerType: { $ne: "buy_get" },
            minimumPurchase: { $lte: grandTotal }
        })
            .sort({ minimumPurchase: -1 });



        if (offer) {

            if (offer.discountType === "amount") {

                offerDiscount = Number(offer.discountValue);

            } else {

                offerDiscount = Number(
                    (
                        grandTotal *
                        offer.discountValue /
                        100
                    ).toFixed(2)
                );
            }

            appliedOffer = offer.offerName;
        }

        grandTotal = Number(
            (grandTotal - offerDiscount).toFixed(2)
        );

        let finalPayments = [];

        if (paymentStatus === "due" || paymentStatus === "partial") {

            if (payments.length > 0) {
                finalPayments = payments;
            } else if (Number(paidAmount) > 0) {
                finalPayments = [
                    {
                        method: paymentMethod,
                        amount: Number(paidAmount)
                    }
                ];
            }

        } else if (paymentMethod === "split") {

            finalPayments = payments;

        } else {

            if (payments.length > 0) {
                finalPayments = payments;

            } else {
                finalPayments = [
                    {
                        method: paymentMethod,
                        amount: Number(paidAmount) > 0
                            ? Number(paidAmount)
                            : grandTotal
                    }
                ];
            }
        }

        const allowedMethods = ["cash", "upi", "card", "cheque", "sodexo"];

        for (const pay of finalPayments) {

            if (!allowedMethods.includes(pay.method)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment method"
                });
            }

            const totalPaid = Number(
                finalPayments.reduce(
                    (sum, pay) => sum + Number(pay.amount || 0),
                    0
                ).toFixed(2)
            );



            if (Number(pay.amount || 0) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment amount"
                });
            }


            if (pay.method === "cheque") {

                if (!pay.details) {
                    return res.status(400).json({
                        success: false,
                        message: "Cheque details are required"
                    });
                }

                const {
                    chequeNo,
                    chequeDate,
                    bankName,
                    accountHolder
                } = pay.details;

                if (
                    !chequeNo ||
                    !chequeDate ||
                    !bankName ||
                    !accountHolder
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "Complete cheque details are required"
                    });
                }
            }
        }


        const totalPaid = Number(
            finalPayments.reduce(
                (sum, pay) => sum + Number(pay.amount || 0),
                0
            ).toFixed(2)
        );


        let pendingAmount = 0;

        let returnAmount = 0;

        if (paymentStatus === "paid") {

            if (totalPaid < grandTotal) {
                return res.status(400).json({
                    success: false,
                    message: "Paid amount cannot be less than grand total"
                });
            }

            returnAmount = Number((totalPaid - grandTotal).toFixed(2));
        }

        if (paymentStatus === "partial") {
            if (!customer) {
                return res.status(400).json({
                    success: false,
                    message: "Customer required for partial payment"
                });
            }

            if (totalPaid <= 0 || totalPaid >= grandTotal) {
                return res.status(400).json({
                    success: false,
                    message: "Partial paid amount must be less than grand total"
                });
            }

            pendingAmount = Number((grandTotal - totalPaid).toFixed(2));
        }

        if (paymentStatus === "due") {
            if (!customer) {
                return res.status(400).json({
                    success: false,
                    message: "Customer required for due payment"
                });
            }

            pendingAmount = Number(
                (grandTotal - totalPaid).toFixed(2)
            );
        }

        const earnedPoints = Math.floor(grandTotal / 100);

        if (customer) {
            customer.loyaltyPoints += earnedPoints;
            customer.totalSpent += grandTotal;
            await customer.save();
        }

        const invoiceNo = await getNextInvoiceNo(hierarchy.superAdminId);

        const bill = await Bill.create({
            items,
            summary: {
                subTotal,
                totalGST,
                discount,

                itemDiscountAmount: Number(totalItemDiscount.toFixed(2)),

                billDiscountAmount: Number(billDiscount.toFixed(2)),
                billDiscountPercentage: Number(billDiscountPercentage.toFixed(2)),

                totalAmount: Number(
                    (subTotal + totalGST).toFixed(2)
                ),

                offerDiscountAmount: Number(offerDiscount.toFixed(2)),

                grandTotal
            },


            offer: {
                offerId: offer?._id || appliedBuyGetOffer?._id || null,
                offerName: appliedOffer || appliedBuyGetOffer?.offerName || null,
                discountAmount: offerDiscount
            },

            invoiceNo,
            customerId: customer ? customer._id : null,

            paymentMethod: finalPayments.length > 1 ? "split" : finalPayments[0]?.method || "due",
            paymentStatus,
            payments: finalPayments,

            paidAmount: totalPaid,
            pendingAmount,

            returnAmount,

            cashier: req.user.userId || req.user.id,
            createdBy: req.user.userId || req.user.id,

            role: req.user.role,
            ...hierarchy
        });

        const hasGSTItems =
            Array.isArray(gstAuditItems) &&
            gstAuditItems.length > 0;

        if (hasGSTItems) {
            await AuditLog.create({
                ...hierarchy,

                userId: req.user.userId || req.user.id,
                role: req.user.role,

                module: "Bill",
                action: "Create",

                documentId: bill._id,
                oldData: null,

                newData: {
                    invoiceNo: bill.invoiceNo || "",
                    invoiceDate: bill.createdAt || new Date(),

                    customerId: customer?._id || null,
                    customerName: customer?.name || "Walk-in Customer",

                    customerGstNumber:
                        customer?.gstNumber ||
                        customer?.gstnumber ||
                        customer?.gstin ||
                        "",

                    placeOfSupply:
                        customer?.state ||
                        customer?.placeOfSupply ||
                        "",

                    items: bill.items
                        .filter(
                            (item) =>
                                item.gstRate !== "none" &&
                                item.gstRate !== null &&
                                item.gstRate !== undefined
                        )
                        .map((item) => {
                            const qty = Number(item.qty || 0);
                            const freeQty = Number(item.freeQty || 0);

                            const rate = Number(item.price || 0);
                            const gstRate = Number(item.gstRate || 0);
                            const gstAmount = Number(item.gstAmount || 0);
                            const finalAmount = Number(item.finalPrice || 0);

                            const taxableAmount = Number(
                                Number(
                                    item.taxableAmount ??
                                    Math.max(0, finalAmount - gstAmount)
                                ).toFixed(2)
                            );

                            return {
                                productId: item.productId || null,
                                barcodeId: item.barcodeId || null,

                                itemName: item.name || "",
                                hsnCode: item.hsnCode || "",
                                barcode: item.barcode || "",

                                qty,
                                freeQty,

                                totalGivenQty: Number(
                                    item.totalGivenQty ?? (qty + freeQty)
                                ),

                                unit: item.unit || "pcs",
                                unitValue: Number(item.unitValue || 1),
                                unitText: item.unitText || "",
                                totalKg: item.totalkg || "",

                                mrp: Number(item.mrp || 0),
                                rate,

                                sellingPrice: Number(
                                    item.sellingPrice ??
                                    item.price ??
                                    0
                                ),

                                price: Number(
                                    item.price ??
                                    0
                                ),

                                appliedPriceLevel:
                                    item.appliedPriceLevel || "normal",

                                appliedSlab:
                                    item.appliedPriceLevel === "slab" &&
                                        Number(item.appliedSlab?.price || 0) > 0
                                        ? {
                                            minQty: Number(
                                                item.appliedSlab?.minQty || 0
                                            ),

                                            maxQty:
                                                item.appliedSlab?.maxQty !== null &&
                                                    item.appliedSlab?.maxQty !== undefined
                                                    ? Number(item.appliedSlab.maxQty)
                                                    : null,

                                            price: Number(
                                                item.appliedSlab?.price || 0
                                            )
                                        }
                                        : null,

                                gstRate,

                                cgstRate: Number(
                                    (gstRate / 2).toFixed(2)
                                ),

                                sgstRate: Number(
                                    (gstRate / 2).toFixed(2)
                                ),

                                gstAmount,

                                cgstAmount: Number(
                                    (gstAmount / 2).toFixed(2)
                                ),

                                sgstAmount: Number(
                                    (gstAmount / 2).toFixed(2)
                                ),

                                discountAmount: Number(
                                    item.discountAmount || 0
                                ),

                                taxableAmount,

                                totalAmount: Number(
                                    item.totalAmount || 0
                                ),

                                finalAmount,

                                itemTotalAmount: Number(
                                    finalAmount.toFixed(2)
                                )
                            };
                        }),

                    summary: {
                        subTotal: Number(
                            bill.summary?.subTotal || 0
                        ),

                        totalGST: Number(
                            bill.summary?.totalGST || 0
                        ),

                        itemDiscountAmount: Number(
                            bill.summary?.itemDiscountAmount || 0
                        ),

                        billDiscountAmount: Number(
                            bill.summary?.billDiscountAmount || 0
                        ),

                        billDiscountPercentage: Number(
                            bill.summary?.billDiscountPercentage || 0
                        ),

                        loyaltyDiscount: Number(
                            bill.summary?.discount || 0
                        ),

                        grandTotal: Number(
                            bill.summary?.grandTotal || 0
                        )
                    },

                    offer: {
                        offerId: bill.offer?.offerId || null,
                        offerName: bill.offer?.offerName || "",
                        discountAmount: Number(
                            bill.offer?.discountAmount || 0
                        )
                    },

                    paidAmount: Number(
                        bill.paidAmount || 0
                    ),

                    pendingAmount: Number(
                        bill.pendingAmount || 0
                    ),

                    paymentMethod:
                        bill.paymentMethod || "due",

                    paymentStatus:
                        bill.paymentStatus || "due",

                    payments: (bill.payments || []).map((payment) => ({
                        method: payment.method || "",
                        amount: Number(payment.amount || 0),

                        details: {
                            upiId: payment.details?.upiId || "",
                            cardType: payment.details?.cardType || "",
                            cardLast4: payment.details?.cardLast4 || "",

                            chequeNo:
                                payment.details?.chequeNo || "",

                            chequeDate:
                                payment.details?.chequeDate || null,

                            bankName:
                                payment.details?.bankName || "",

                            accountHolder:
                                payment.details?.accountHolder || ""
                        }
                    }))
                }

            });
        }


        activeSession.totalBills = (activeSession.totalBills || 0) + 1;

        activeSession.totalSales = Number(
            ((activeSession.totalSales || 0) + grandTotal).toFixed(2)
        );


        for (const pay of finalPayments) {

            let amount = Number(grandTotal || 0);

            console.log("SESSION UPDATE");
            console.log("Payment Method:", pay.method);
            console.log("Grand Total:", grandTotal);
            console.log("Amount Added:", amount);

            switch (pay.method) {

                case "cash":
                    activeSession.cashSales = Number(
                        ((activeSession.cashSales || 0) + amount).toFixed(2)
                    );
                    break;

                case "upi":
                    activeSession.upiSales = Number(
                        ((activeSession.upiSales || 0) + amount).toFixed(2)
                    );
                    break;

                case "card":
                    activeSession.cardSales = Number(
                        ((activeSession.cardSales || 0) + amount).toFixed(2)
                    );
                    break;

                case "cheque":
                    activeSession.chequeSales = Number(
                        ((activeSession.chequeSales || 0) + amount).toFixed(2)
                    );
                    break;

                case "sodexo":
                    activeSession.sodexoSales = Number(
                        ((activeSession.sodexoSales || 0) + amount).toFixed(2)
                    );
                    break;
            }
        }

        activeSession.expectedCash = Number(
            (
                Number(activeSession.openingAmount || 0) +
                Number(activeSession.cashSales || 0)
            ).toFixed(2)
        );

        await activeSession.save();

        const cashRegister = await CashRegister.findOne({
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (cashRegister && finalPayments.length > 0) {
            for (const pay of finalPayments) {
                const amount = Number(grandTotal || 0);

                if (pay.method === "cash") {
                    cashRegister.cashSales += amount;
                }

                if (pay.method === "upi") {
                    cashRegister.upiSales += amount;
                }

                if (pay.method === "card") {
                    cashRegister.cardSales += amount;
                }

                if (pay.method === "cheque") {
                    cashRegister.chequeSales += amount;
                }

                if (pay.method === "sodexo") {
                    cashRegister.sodexoSales += amount;
                }
            }

            cashRegister.expectedCash =
                cashRegister.openingAmount +
                cashRegister.cashSales -
                cashRegister.cashOut;

            await cashRegister.save();
        }

        if (gstAuditItems.length > 0) {
            await AuditLog.create({
                userId: req.user.userId || req.user.id,
                role: req.user.role,
                module: "GST",
                action: "CREATE",
                documentId: bill._id,
                oldData: null,
                newData: {
                    invoiceNo: bill.invoiceNo,
                    customerId: customer ? customer._id : null,
                    gstItems: gstAuditItems,
                    totalGST,
                    grandTotal
                },
                ...hierarchy
            });
        }




        const cgst = Number((totalGST / 2).toFixed(2));
        const sgst = Number((totalGST / 2).toFixed(2));



        const billCount = await Bill.countDocuments({
            superAdminId: hierarchy.superAdminId
        });



        return res.status(201).json({
            success: true,
            message: "Bill generated successfully",
            data: {
                billId: bill._id,

                billCount,

                invoiceNo: bill.invoiceNo,

                invoiceDate: new Date().toLocaleDateString("en-GB"),

                invoiceTime: new Date().toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }),

                customer: customer
                    ? {
                        customerId: customer.customerId,
                        customerName: customer.name,
                        mobile: customer.phone || ""
                    }
                    : {
                        customerId: null,
                        customerName: "Walk in Customer",
                        mobile: ""
                    },

                paymentMethod: bill.paymentMethod,
                paymentStatus: bill.paymentStatus,

                payments: finalPayments,

                paidAmount: totalPaid,
                pendingAmount,
                returnAmount,

                items,

                summary: {
                    totalAmount: Number((subTotal + totalGST + totalItemDiscount).toFixed(2)),
                    subTotal: Number(subTotal.toFixed(2)),
                    cgst,
                    sgst,
                    totalGST: Number(totalGST.toFixed(2)),

                    itemDiscountAmount: Number(totalItemDiscount.toFixed(2)),

                    billDiscountAmount: Number(billDiscount.toFixed(2)),

                    billDiscountPercentage,

                    totalDiscount: Number(
                        (totalItemDiscount + billDiscount).toFixed(2)
                    ),

                    offerName: appliedOffer || appliedBuyGetOffer?.offerName || null,
                    offerAmount: offerDiscount,
                    loyaltyDiscount: discount,
                    grandTotal
                },

                loyalty: {
                    used: discount,
                    earned: earnedPoints,
                    remaining: customer ? customer.loyaltyPoints : 0
                }
            }
        });

    } catch (error) {
        console.error("BILL ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.calculateBill = async (req, res) => {
    try {
        const {
            codes,
            items: billItems = [],
            customerId,
            redeemPoints = 0,
            loyaltyPoints = 0,
            priceLevel = "normal",
            discountPercent = 0,
            discountAmount = 0,
            receivedAmount = 0
        } = req.body;

        const pointsToRedeem = Number(redeemPoints || loyaltyPoints || 0);

        if (
            (!Array.isArray(codes) || codes.length === 0) &&
            (!Array.isArray(billItems) || billItems.length === 0)
        ) {
            return res.status(400).json({
                success: false,
                message: "No products provided"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        let subTotal = 0;
        let totalGST = 0;
        let totalItemDiscount = 0;
        const items = [];
        const codeQtyMap = {};


        for (const code of codes || []) {
            const searchValue = String(code).trim();
            if (!searchValue) continue;
            codeQtyMap[searchValue] = (codeQtyMap[searchValue] || 0) + 1;
        }

        for (const [searchValue, qty] of Object.entries(codeQtyMap)) {

            let freeQty = 0;

            const barcode = await Barcode.findOne({
                code: searchValue,
                superAdminId: hierarchy.superAdminId
            });

            if (!barcode) {
                return res.status(400).json({ success: false, message: `Barcode not found: ${searchValue}` });
            }


            if (barcode.comboOfferId) {

                const comboOffer = await ComboOffer.findOne({
                    _id: barcode.comboOfferId,
                    superAdminId: hierarchy.superAdminId,
                    isActive: true
                });

                if (!comboOffer) {
                    return res.status(400).json({
                        success: false,
                        message: `Combo offer not found for barcode: ${searchValue}`
                    });
                }

                if (
                    !Array.isArray(comboOffer.products) ||
                    comboOffer.products.length === 0
                ) {
                    return res.status(400).json({
                        success: false,
                        message: `No products found in combo: ${comboOffer.offerName}`
                    });
                }

                const comboProducts = [];


                for (const comboItem of comboOffer.products) {

                    const product = await Product.findOne({
                        _id: comboItem.productId,
                        superAdminId: hierarchy.superAdminId
                    });

                    if (!product) {
                        return res.status(400).json({
                            success: false,
                            message: `Combo product not found`
                        });
                    }

                    const comboQty =
                        Number(comboItem.qty || 1) * qty;

                    const availableStock =
                        Number(product.stock || 0) -
                        Number(product.reservedStock || 0);

                    if (availableStock < comboQty) {
                        return res.status(400).json({
                            success: false,
                            message:
                                `${product.name} stock not available for combo. ` +
                                `Required: ${comboQty}, Available: ${availableStock}`
                        });
                    }

                    comboProducts.push({
                        product,
                        qty: comboQty
                    });
                }


                const comboPrice = Number(
                    comboOffer.comboPrice || 0
                );

                if (comboPrice <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid combo price for ${comboOffer.offerName}`
                    });
                }

                const finalComboPrice = Number(
                    (comboPrice * qty).toFixed(2)
                );


                let comboGST = 0;

                for (const item of comboProducts) {

                    const productGST = Number(
                        item.product.gstRate ||
                        item.product.gst ||
                        0
                    );

                    if (productGST > 0) {

                        comboGST += Number(
                            (
                                finalComboPrice *
                                productGST /
                                (100 + productGST)
                            ).toFixed(2)
                        );
                    }
                }


                comboGST = Math.min(
                    comboGST,
                    finalComboPrice
                );

                const comboTaxableAmount = Number(
                    (finalComboPrice - comboGST).toFixed(2)
                );


                items.push({

                    productId: null,

                    barcodeId: barcode?._id || null,

                    barcode: barcode?.code || "",

                    comboOfferId: comboOffer._id,

                    productName: comboOffer.offerName,

                    name: comboOffer.offerName,

                    totalAmount: finalComboPrice,

                    discountPercent: 0,

                    discountAmount: 0,

                    finalPrice: finalComboPrice,

                    qty,

                    freeQty: 0,

                    totalGivenQty: qty,

                    comboProducts: comboProducts.map(item => ({
                        productId: item.product._id,
                        productName: item.product.name,
                        sellingPrice: Number(item.product.sellingPrice || 0),
                        qty: item.qty
                    })),

                    gstRate: 0,

                    gstAmount: comboGST
                });


                subTotal += comboTaxableAmount;

                totalGST += comboGST;

                continue;
            }





            const product = await Product.findOne({
                _id: barcode.productId,
                superAdminId: hierarchy.superAdminId
            });

            const stock = Number(product.stock || 0);



            if (!product) {
                return res.status(400).json({ success: false, message: `Product not found for: ${searchValue}` });
            }

            const price = Number(barcode.sellingPrice || 0);

            const rawGstRate = barcode?.gstRate ?? product.gstRate ?? "none";

            const gstRate =
                rawGstRate === "none"
                    ? "none"
                    : Number(rawGstRate);

            const grossAmount = Number((price * qty).toFixed(2));
            let itemDiscount = 0;
            let finalDiscountPercent = 0;

            if (Number(discountPercent) > 0 && Number(discountAmount) > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Provide either discountPercent or discountAmount, not both."
                });
            }

            if (Number(discountPercent) > 0) {
                finalDiscountPercent = Number(Number(discountPercent).toFixed(2));

                itemDiscount = Number(
                    ((grossAmount * finalDiscountPercent) / 100).toFixed(2)
                );
            }
            else if (Number(discountAmount) > 0) {

                if (Number(discountAmount) > grossAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Discount amount cannot exceed item amount."
                    });
                }

                itemDiscount = Number(Number(discountAmount).toFixed(2));

                finalDiscountPercent = Number(
                    ((itemDiscount / grossAmount) * 100).toFixed(2)
                );
            }

            totalItemDiscount += itemDiscount;

            const finalPrice = Number(
                (grossAmount - itemDiscount).toFixed(2)
            );

            let taxableAmount = finalPrice;
            let gstAmount = 0;

            if (gstRate !== "none" && Number(gstRate) > 0) {
                taxableAmount = Number(
                    (finalPrice / (1 + Number(gstRate) / 100)).toFixed(2)
                );

                gstAmount = Number(
                    (finalPrice - taxableAmount).toFixed(2)
                );
            }

            subTotal += taxableAmount;
            totalGST += gstAmount;

            items.push({
                productId: product._id,
                barcodeId: barcode?._id || null,
                barcode: barcode?.code || "",

                productName: product.name || "",
                name: product.name || "",

                totalAmount: grossAmount,
                discountPercent: Number(discountPercent || 0),
                discountAmount: itemDiscount,
                finalPrice,

                unit: barcode?.unit || product.unit || "pcs",

                unitValue: barcode?.unitValue || product.unitValue || 1,

                unitText: `${barcode?.unitValue || product.unitValue || 1} ${barcode?.unit || product.unit || "pcs"}`,

                totalUnitQty:
                    qty * Number(barcode?.unitValue || product.unitValue || 1),

                totalUnitText:
                    `${qty * Number(barcode?.unitValue || product.unitValue || 1)} ${barcode?.unit || product.unit || "pcs"}`,

                qty,
                freeQty,
                totalGivenQty: qty + freeQty,

                mrp: barcode?.mrp ?? product.mrp ?? 0,

                sellingPrice: price,
                normalSellingPrice: price,

                appliedPriceLevel: "normal",
                appliedSlab: null,

                gstRate,
                gstAmount
            });
        }


        for (const billItem of billItems) {

            const qty = Number(billItem.qty || 1);

            let freeQty = 0;
            let freeProduct = null;
            let appliedBuyGetOffer = null;

            const buyGetOffer = await Offer.findOne({
                superAdminId: hierarchy.superAdminId,
                offerType: "buy_get",
                isActive: true,
                buyProductId: billItem.productId
            });

            if (
                buyGetOffer &&
                qty >= Number(buyGetOffer.buyQty || 0)
            ) {
                freeQty =
                    Math.floor(
                        qty / Number(buyGetOffer.buyQty)
                    ) *
                    Number(buyGetOffer.freeQty || 0);

                if (freeQty > 0) {

                    freeProduct = await Product.findOne({
                        _id: buyGetOffer.freeProductId,
                        superAdminId: hierarchy.superAdminId
                    });

                    if (!freeProduct) {
                        return res.status(404).json({
                            success: false,
                            message: "Free product not found"
                        });
                    }

                    appliedBuyGetOffer = buyGetOffer;
                }
            }

            const itemDiscountPercent = Number(
                billItem.discountPercent || 0
            );

            const itemDiscountAmount = Number(
                billItem.discountAmount || 0
            );

            if (isNaN(qty) || qty <= 0) {
                return res.status(400).json({ success: false, message: "Invalid quantity" });
            }


            if (billItem.comboOfferId) {

                const comboOffer = await ComboOffer.findOne({
                    _id: billItem.comboOfferId,
                    superAdminId: hierarchy.superAdminId,
                    isActive: true
                });

                if (!comboOffer) {
                    return res.status(404).json({
                        success: false,
                        message: "Combo offer not found"
                    });
                }

                if (
                    !Array.isArray(comboOffer.products) ||
                    comboOffer.products.length === 0
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "No products found in combo"
                    });
                }


                const availableComboQty = Number(comboOffer.comboQty || 0);

                if (availableComboQty < qty) {
                    return res.status(400).json({
                        success: false,
                        message:
                            `Combo stock not available. ` +
                            `Available: ${availableComboQty}, Required: ${qty}`
                    });
                }

                comboOffer.comboQty = availableComboQty - qty;
                await comboOffer.save();


                const comboPrice = Number(comboOffer.comboPrice || 0);

                if (comboPrice <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid combo price for ${comboOffer.offerName}`
                    });
                }

                const finalComboPrice = Number(
                    (comboPrice * qty).toFixed(2)
                );



                let comboGST = 0;

                for (const comboItem of comboOffer.products) {

                    const product = await Product.findOne({
                        _id: comboItem.productId,
                        superAdminId: hierarchy.superAdminId
                    });

                    if (!product) {
                        return res.status(404).json({
                            success: false,
                            message: `Combo product not found: ${comboItem.productId}`
                        });
                    }

                    const productGST = Number(
                        product.gstRate || product.gst || 0
                    );

                    if (productGST > 0) {
                        comboGST += Number(
                            (
                                finalComboPrice *
                                productGST /
                                (100 + productGST)
                            ).toFixed(2)
                        );
                    }
                }

                comboGST = Math.min(
                    Number(comboGST.toFixed(2)),
                    finalComboPrice
                );

                const comboTaxableAmount = Number(
                    (finalComboPrice - comboGST).toFixed(2)
                );



                items.push({

                    productId: null,

                    barcodeId: null,

                    barcode: null,

                    comboOfferId: comboOffer._id,

                    productName: comboOffer.offerName,

                    name: comboOffer.offerName,

                    totalAmount: finalComboPrice,

                    discountPercent: 0,

                    discountAmount: 0,

                    finalPrice: finalComboPrice,

                    qty,

                    freeQty: 0,

                    totalGivenQty: qty,

                    sellingPrice: Number(
                        comboOffer.comboPrice || 0
                    ),

                    normalSellingPrice: Number(
                        comboOffer.comboPrice || 0
                    ),

                    comboProducts: comboOffer.products.map(comboItem => ({
                        productId: comboItem.productId,
                        qty: Number(comboItem.qty || comboItem.quantity || 1) * qty
                    })),

                    gstRate: 0,

                    gstAmount: comboGST
                });

                subTotal += comboTaxableAmount;

                totalGST += comboGST;



                continue;
            }

            const product = await Product.findOne({
                _id: billItem.productId,
                superAdminId: hierarchy.superAdminId
            });

            if (!product) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }

            const barcode = await Barcode.findOne({
                productId: product._id,
                superAdminId: hierarchy.superAdminId
            });

            const normalSellingPrice = Number(
                barcode?.sellingPrice ?? product.sellingPrice ?? 0
            );

            let price = normalSellingPrice;
            let appliedPriceLevel = "normal";
            let appliedSlab = null;
            let discountPerItem = 0;
            let totalDiscount = 0;

            const productPriceLevel = await PriceLevel.findOne({
                productId: product._id,
                superAdminId: hierarchy.superAdminId,
                isActive: true
            });


            if (productPriceLevel) {
                if (priceLevel === "manual" && productPriceLevel.pricingType === "manual") {
                    price = Number(productPriceLevel.manualPrice || price);
                    appliedPriceLevel = "manual";
                } else if (priceLevel === "auto" && productPriceLevel.pricingType === "auto") {
                    const profitPercent = Number(productPriceLevel.autoPricing?.profitPercent || 0);
                    const baseOn = productPriceLevel.autoPricing?.baseOn || "costPrice";

                    const basePrice =
                        baseOn === "mrp"
                            ? Number(barcode?.mrp ?? product.mrp ?? 0)
                            : Number(barcode?.costPrice ?? product.costPrice ?? 0);

                    price = basePrice + (basePrice * profitPercent / 100);
                    appliedPriceLevel = "auto";
                } else if (priceLevel === "slab" && productPriceLevel.pricingType === "slab") {
                    const slab = productPriceLevel.slabs.find((s) => {
                        const minOk = qty >= Number(s.minQty || 0);
                        const maxOk = s.maxQty === null || qty <= Number(s.maxQty);
                        return minOk && maxOk;
                    });

                    if (slab) {
                        const slabPrice = Number(slab.price || normalSellingPrice);
                        discountPerItem = Number((normalSellingPrice - slabPrice).toFixed(2));
                        totalDiscount = Number((discountPerItem * qty).toFixed(2));
                        price = slabPrice;
                        appliedPriceLevel = "slab";
                        appliedSlab = { minQty: slab.minQty, maxQty: slab.maxQty, slabPrice };
                    }
                }
            }

            if (price <= 0) {
                return res.status(400).json({ success: false, message: `Invalid selling price for product: ${product.name}` });
            }

            const stock = Number(product.stock || 0);


            const rawGstRate = barcode?.gstRate ?? product.gstRate ?? "none";

            const gstRate =
                rawGstRate === "none"
                    ? "none"
                    : Number(rawGstRate);

            const grossAmount = Number((price * qty).toFixed(2));

            let itemDiscount = 0;
            let finalDiscountPercent = 0;

            if (itemDiscountPercent > 0 && itemDiscountAmount > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Provide either discountPercent or discountAmount, not both."
                });
            }

            if (itemDiscountPercent > 0) {
                finalDiscountPercent = Number(itemDiscountPercent.toFixed(2));

                itemDiscount = Number(
                    ((grossAmount * finalDiscountPercent) / 100).toFixed(2)
                );
            }
            else if (itemDiscountAmount > 0) {

                if (itemDiscountAmount > grossAmount) {
                    return res.status(400).json({
                        success: false,
                        message: "Discount amount cannot exceed item amount."
                    });
                }

                itemDiscount = Number(itemDiscountAmount.toFixed(2));

                finalDiscountPercent = Number(
                    ((itemDiscount / grossAmount) * 100).toFixed(2)
                );
            }

            totalItemDiscount += itemDiscount;

            const finalPrice = Number(
                (grossAmount - itemDiscount).toFixed(2)
            );

            let taxableAmount = finalPrice;
            let gstAmount = 0;

            if (gstRate !== "none" && Number(gstRate) > 0) {
                taxableAmount = Number(
                    (finalPrice / (1 + Number(gstRate) / 100)).toFixed(2)
                );

                gstAmount = Number(
                    (finalPrice - taxableAmount).toFixed(2)
                );
            }

            subTotal += taxableAmount;
            totalGST += gstAmount;

            items.push({
                productId: product._id,
                barcodeId: barcode?._id,
                barcode: barcode?.code,

                productName: product.name || "",
                name: product.name || "",

                totalAmount: grossAmount,
                discountPercent: itemDiscountPercent,
                discountAmount: itemDiscount,
                finalPrice,

                unit: barcode?.unit || product.unit || "pcs",
                unitValue: barcode?.unitValue || product.unitValue || 1,
                unitText: `${barcode?.unitValue || product.unitValue || 1} ${barcode?.unit || product.unit || "pcs"}`,

                totalUnitQty:
                    qty * Number(barcode?.unitValue || product.unitValue || 1),

                totalUnitText:
                    `${qty * Number(barcode?.unitValue || product.unitValue || 1)} ${barcode?.unit || product.unit || "pcs"}`,

                qty,
                freeQty,

                freeProductId: freeProduct?._id || null,
                freeProductName: freeProduct?.name || "",
                freeProductUnit: freeProduct?.unit || "",
                freeProductUnitValue: freeProduct?.unitValue || 0,

                totalGivenQty: qty + freeQty,

                buyGetOfferId: appliedBuyGetOffer?._id || null,
                buyGetOfferName: appliedBuyGetOffer?.offerName || "",

                mrp: barcode?.mrp ?? product.mrp ?? 0,

                sellingPrice: normalSellingPrice,
                normalSellingPrice,

                slabPrice:
                    appliedPriceLevel === "slab"
                        ? price
                        : null,

                discountPerItem,
                totalDiscount,

                appliedPriceLevel,
                appliedSlab,

                gstRate,
                gstAmount
            });
        }

        let loyaltyDiscount = 0;
        let customer = null;

        if (customerId) {

            customer = await Customer.findOne({
                customerId,
                superAdminId: hierarchy.superAdminId
            });

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found"
                });
            }

            if (pointsToRedeem > 0) {

                if (customer.loyaltyPoints < pointsToRedeem) {
                    return res.status(400).json({
                        success: false,
                        message: "Not enough loyalty points"
                    });
                }

                loyaltyDiscount = pointsToRedeem;
            }
        }


        const beforeBillDiscount = Number(
            (subTotal + totalGST).toFixed(2)
        );

        let billDiscount = 0;
        let billDiscountPercentage = 0;

        if (Number(discountPercent) > 0) {
            billDiscountPercentage = Number(discountPercent);

            billDiscount = Number(
                (
                    beforeBillDiscount *
                    billDiscountPercentage /
                    100
                ).toFixed(2)
            );
        } else if (Number(discountAmount) > 0) {
            billDiscount = Number(discountAmount);

            billDiscountPercentage = Number(
                (
                    billDiscount /
                    beforeBillDiscount *
                    100
                ).toFixed(2)
            );
        }

        let grandTotal = Number(
            (
                beforeBillDiscount -
                billDiscount -
                loyaltyDiscount
            ).toFixed(2)
        );

        let offer = null;
        let offerDiscount = 0;
        let appliedOffer = null;

        offer = await Offer.findOne({
            superAdminId: hierarchy.superAdminId,
            isActive: true,
            offerType: "bill",
            minimumPurchase: { $lte: grandTotal }
        }).sort({ minimumPurchase: -1 });




        if (offer) {

            if (offer.discountType === "amount") {

                offerDiscount = Number(offer.discountValue);

            } else {

                offerDiscount = Number(
                    (
                        grandTotal *
                        offer.discountValue /
                        100
                    ).toFixed(2)
                );
            }

            if (offerDiscount > grandTotal) {
                offerDiscount = grandTotal;
            }

            appliedOffer = offer.offerName;

            grandTotal = Number(
                (grandTotal - offerDiscount).toFixed(2)
            );
        }

        const cgst = Number((totalGST / 2).toFixed(2));
        const sgst = Number((totalGST / 2).toFixed(2));
        const earnedPoints = Math.floor(grandTotal / 100);

        let changeAmount = 0;

        if (Number(receivedAmount) > grandTotal) {
            changeAmount = Number(
                (Number(receivedAmount) - grandTotal).toFixed(2)
            );
        }

        return res.status(200).json({
            success: true,
            message: "Bill calculated successfully",
            data: {
                items,
                summary: {
                    totalAmount: Number((subTotal + totalGST + totalItemDiscount).toFixed(2)),
                    subTotal,
                    cgst,
                    sgst,
                    totalGST,
                    discountAmount: Number(totalItemDiscount.toFixed(2)),
                    loyaltyDiscount,
                    offerName: appliedOffer,
                    offerAmount: offerDiscount,
                    grandTotal,

                    receivedAmount: Number(receivedAmount),
                    changeAmount: Number(changeAmount.toFixed(2)),

                    paidAmount: Number(receivedAmount),
                    returnAmount: Number(changeAmount.toFixed(2))

                },
                loyalty: {
                    used: loyaltyDiscount,
                    earned: earnedPoints,
                    remaining: customer
                        ? customer.loyaltyPoints - loyaltyDiscount
                        : 0
                }
            }
        });

    } catch (error) {
        console.error("CALCULATE BILL ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Server error during calculation",
            error: error.message
        });
    }
};


exports.searchProductsForBill = async (req, res) => {
    try {
        const { search } = req.query;

        if (!search) {
            return res.status(400).json({
                success: false,
                message: "Search is required"
            });
        }

        const searchValue = search.trim();
        const hierarchy = attachHierarchy(req.user);


        const products = await Product.find({
            superAdminId: hierarchy.superAdminId,
            name: { $regex: searchValue, $options: "i" },
            stock: { $gt: 0 }
        }).limit(20);

        const productData = await Promise.all(
            products.map(async (p) => {
                const barcode = await Barcode.findOne({
                    productId: p._id,
                    superAdminId: hierarchy.superAdminId,
                    availableQty: { $gt: 0 }
                });


                const priceLevel = await PriceLevel.findOne({
                    productId: p._id,
                    superAdminId: hierarchy.superAdminId,
                    isActive: true
                });

                return {
                    productId: p._id,
                    productName: p.name,
                    brand: p.brand,
                    barcode: barcode?.code || "",
                    qty: 1,
                    stock: p.stock,

                    mrp: barcode?.mrp || p.mrp || 0,
                    sellingPrice: barcode?.sellingPrice || p.sellingPrice || 0,
                    costPrice: barcode?.costPrice || p.costPrice || 0,
                    gstRate: p.gstRate || 0,

                    priceLevel: priceLevel ? {
                        pricingType: priceLevel.pricingType,
                        manualPrice: priceLevel.manualPrice,
                        autoPricing: priceLevel.autoPricing,
                        slabs: priceLevel.slabs
                    } : null,

                    slabPrices: priceLevel?.pricingType === "slab"
                        ? priceLevel.slabs.map(s => ({
                            minQty: s.minQty,
                            maxQty: s.maxQty,
                            price: s.price
                        }))
                        : [],

                    flavor: barcode?.flavor || "",
                    litters: barcode?.litters || "",
                    kg: barcode?.kg || "",

                    gstRate: barcode?.gstRate || p.gstRate || 0
                };
            })
        );


        const barcodes = await Barcode.find({
            superAdminId: hierarchy.superAdminId,
            code: { $regex: searchValue, $options: "i" },
            availableQty: { $gt: 0 }
        }).populate("productId");

        const barcodeData = await Promise.all(
            barcodes
                .filter((b) => b.productId)
                .map(async (b) => {
                    const priceLevel = await PriceLevel.findOne({
                        productId: b.productId._id,
                        superAdminId: hierarchy.superAdminId,
                        isActive: true
                    });

                    return {
                        productId: b.productId._id,
                        productName: b.productId.name,
                        brand: b.productId.brand,
                        barcode: b.code,
                        qty: 1,
                        stock: b.productId.stock,

                        mrp: b.mrp || b.productId.mrp || 0,
                        sellingPrice: b.sellingPrice || b.productId.sellingPrice || 0,
                        costPrice: b.costPrice || b.productId.costPrice || 0,
                        gstRate: b.productId.gstRate || 0,

                        priceLevel: priceLevel ? {
                            pricingType: priceLevel.pricingType,
                            manualPrice: priceLevel.manualPrice,
                            autoPricing: priceLevel.autoPricing,
                            slabs: priceLevel.slabs
                        } : null,

                        slabPrices: priceLevel?.pricingType === "slab"
                            ? priceLevel.slabs.map(s => ({
                                minQty: s.minQty,
                                maxQty: s.maxQty,
                                price: s.price
                            }))
                            : [],

                        flavor: b.flavor || "",
                        litters: b.litters || "",
                        kg: b.kg || "",
                        gstRate: b.productId.gstRate || 0
                    };
                })
        );


        const merged = [...barcodeData, ...productData];

        const uniqueData = merged.filter(
            (item, index, self) =>
                index === self.findIndex(
                    (x) =>
                        String(x.productId) === String(item.productId) &&
                        x.barcode === item.barcode
                )
        );

        return res.status(200).json({
            success: true,
            count: uniqueData.length,
            data: uniqueData
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.searchCustomerBills = async (req, res) => {
    try {

        const { search } = req.query;

        if (!search) {
            return res.status(400).json({
                success: false,
                message: "Search value is required"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const conditions = [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } }
        ];

        if (!isNaN(search)) {
            conditions.push({ customerId: Number(search) });
            conditions.push({ id: Number(search) });
        }

        const customers = await Customer.find({
            superAdminId: hierarchy.superAdminId,
            $or: conditions
        });

        if (customers.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        const customerIds = customers.map(c => c._id);

        const bills = await Bill.find({
            superAdminId: hierarchy.superAdminId,
            $or: [
                { customerId: { $in: customerIds } },
                { invoiceNo: { $regex: search, $options: "i" } }
            ]
        })
            .populate("customerId", "name phone customerId id")
            .populate("createdBy", "name email role")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Customer bills fetched successfully",
            count: bills.length,
            data: bills.map(bill => ({
                _id: bill._id,
                invoiceNo: bill.invoiceNo,

                customer: bill.customerId,

                items: bill.items,

                summary: bill.summary,

                paymentStatus: bill.paymentStatus,
                paymentMethod: bill.paymentMethod,

                paidAmount: bill.paidAmount,
                pendingAmount: bill.pendingAmount,

                payments: bill.payments,

                offer: bill.offer,

                createdBy: bill.createdBy,

                createdAt: bill.createdAt
            }))
        });

    } catch (error) {

        console.error("SEARCH CUSTOMER BILL ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};



exports.getBills = async (req, res) => {
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

        if (fromDate && toDate) {
            const [fd, fm, fy] = fromDate.split("/");
            const [td, tm, ty] = toDate.split("/");

            const start = new Date(fy, fm - 1, fd);
            start.setHours(0, 0, 0, 0);

            const end = new Date(ty, tm - 1, td);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }


        if (period) {
            const now = new Date();

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


                case "week": {
                    start = new Date(now);

                    const day = start.getDay();


                    const diff = day === 0 ? -6 : 1 - day;

                    start.setDate(start.getDate() + diff);
                    start.setHours(0, 0, 0, 0);

                    end = new Date(start);
                    end.setDate(start.getDate() + 6);
                    end.setHours(23, 59, 59, 999);

                    break;
                }


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
                            "Invalid period. Use today, yesterday, week, month or year"
                    });
            }

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }



        const bills = await Bill.find(filter)
            .populate("customerId", "name phone customerId")
            .populate("createdBy", "name email role")
            .populate("items.productId", "itemCode")
            .populate("items.comboProducts.productId", "itemCode name")
            .populate("items.comboOfferId", "itemCode name")
            .sort({ createdAt: -1 });


        const billsWithFormattedDates = bills
            .map((bill, index) => {

                const filteredItems = bill.items.filter((item) => {
                    if (!gst || gst.toLowerCase() === "all") {
                        return true;
                    }

                    const gstFilter = gst.toLowerCase();

                    const itemGst = String(item.gstRate ?? "none").toLowerCase();

                    if (gstFilter === "gst") {
                        return itemGst !== "none";
                    }

                    if (gstFilter === "none") {
                        return itemGst === "none";
                    }

                    return itemGst === gstFilter;
                });

                if (
                    gst &&
                    gst.toLowerCase() !== "all" &&
                    filteredItems.length === 0
                ) {
                    return null;
                }
                const totalItems = bill.items.length;

                const totalQty = bill.items.reduce(
                    (sum, item) => sum + Number(item.qty || 0),
                    0
                );

                const totalUnitQty = bill.items.reduce(
                    (sum, item) =>
                        sum + (Number(item.qty || 0) * Number(item.unitValue || 1)),
                    0
                );

                const totalFreeQty = bill.items.reduce(
                    (sum, item) => sum + Number(item.freeQty || 0),
                    0
                );

                const totalGivenQty = bill.items.reduce(
                    (sum, item) => sum + Number(item.totalGivenQty || item.qty || 0),
                    0
                );

                const paidAmount = Number(bill.paidAmount || 0);
                const grandTotal = Number(bill.summary.grandTotal || 0);

                const pendingAmount = Math.max(grandTotal - paidAmount, 0);
                const returnAmount = Math.max(paidAmount - grandTotal, 0);

                const totalAmount = Number(
                    bill.items.reduce(
                        (sum, item) => sum + Number(item.totalAmount || 0),
                        0
                    ).toFixed(2)
                );

                const itemDiscountAmount = Number(
                    bill.items.reduce(
                        (sum, item) => sum + Number(item.discountAmount || 0),
                        0
                    ).toFixed(2)
                );

                return {

                    billCount: index + 1,

                    billId: bill._id,
                    invoiceNo: bill.invoiceNo,

                    invoiceDate: new Date(bill.createdAt).toLocaleDateString("en-GB", {
                        timeZone: "Asia/Kolkata"
                    }),

                    invoiceTime: new Date(bill.createdAt).toLocaleTimeString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    }),

                    customer: bill.customerId
                        ? {
                            customerId: bill.customerId.customerId,
                            name: bill.customerId.name,
                            mobile: bill.customerId.phone
                        }
                        : null,

                    cashier: bill.createdBy
                        ? {
                            id: bill.createdBy._id,
                            name: bill.createdBy.name,
                            email: bill.createdBy.email,
                            role: bill.createdBy.role
                        }
                        : null,

                    payment: {
                        paymentMethod: bill.paymentMethod,
                        paymentStatus: bill.paymentStatus,
                        payments: bill.payments,

                        paidAmount: Number(paidAmount.toFixed(2)),
                        pendingAmount: Number(pendingAmount.toFixed(2)),
                        returnAmount: Number(returnAmount.toFixed(2))
                    },

                    summary: {
                        subTotal: Number(bill.summary?.subTotal || 0),

                        totalGST: Number(bill.summary?.totalGST || 0),


                        totalAmount: totalAmount,


                        itemDiscountAmount: itemDiscountAmount,


                        billDiscountAmount: Number(
                            bill.summary?.billDiscountAmount || 0
                        ),

                        billDiscountPercentage: Number(
                            bill.summary?.billDiscountPercentage || 0
                        ),

                        discount: Number(bill.summary?.discount || 0),

                        loyaltyDiscount: Number(
                            bill.summary?.loyaltyDiscount ??
                            bill.summary?.discount ??
                            0
                        ),

                        offerName: bill.offer?.offerName || null,

                        offerAmount: Number(
                            bill.offer?.discountAmount || 0
                        ),

                        grandTotal: Number(
                            bill.summary?.grandTotal || 0
                        )
                    },

                    totals: {
                        totalItems,
                        totalQty,
                        totalFreeQty,
                        totalGivenQty,
                        totalUnitQty
                    },

                    items: filteredItems.map(item => ({

                        productId: item.productId?._id || item.productId,

                        itemCode:
                            item.productId?.itemCode ||
                            item.comboOfferId?.itemCode ||
                            item.comboProducts?.[0]?.productId?.itemCode ||
                            null,

                        barcodeId: item.barcodeId,
                        barcode: item.barcode,

                        name: item.name,

                        qty: item.qty,
                        freeQty: item.freeQty || 0,

                        freeProductId: item.freeProductId || null,
                        freeProductName: item.freeProductName || "",
                        freeProductUnit: item.freeProductUnit || "",
                        freeProductUnitValue: item.freeProductUnitValue || 0,


                        totalGivenQty: item.totalGivenQty || item.qty,

                        unit: item.unit,
                        unitValue: item.unitValue,
                        unitText: item.unitText,

                        mrp: item.mrp,

                        price: item.sellingPrice || item.price,

                        totalAmount: item.totalAmount,
                        discountPercent: item.discountPercent,
                        discountAmount: item.discountAmount,

                        gstRate: item.gstRate,
                        gstAmount: item.gstAmount,

                        finalPrice: item.finalPrice,

                        appliedPriceLevel: item.appliedPriceLevel,
                        appliedSlab: item.appliedSlab
                    })),

                    createdAt: new Date(bill.createdAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    }),

                    updatedAt: new Date(bill.updatedAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true
                    })
                };
            });

        const validBills = billsWithFormattedDates.filter(Boolean);

        const totalSalesAmount = Number(
            validBills.reduce(
                (sum, bill) => sum + Number(bill.summary?.grandTotal || 0),
                0
            ).toFixed(2)
        );

        return res.status(200).json({
            success: true,
            message: "Bills fetched successfully",
            count: validBills.length,

            totalSalesAmount,

            data: validBills
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getBillsByDate = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const { date, fromDate, toDate } = req.query;

        const filter = {
            superAdminId: hierarchy.superAdminId
        };

        if (date) {
            const [day, month, year] = date.split("/");

            const start = new Date(year, month - 1, day);
            const end = new Date(year, month - 1, day);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        if (fromDate && toDate) {
            const [fDay, fMonth, fYear] = fromDate.split("/");
            const [tDay, tMonth, tYear] = toDate.split("/");

            const start = new Date(fYear, fMonth - 1, fDay);
            const end = new Date(tYear, tMonth - 1, tDay);
            end.setHours(23, 59, 59, 999);

            filter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        const bills = await Bill.find(filter)
            .populate("customerId", "customerId name phone")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            count: bills.length,
            data: bills
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getItemWiseReport = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const {
            date,
            fromDate,
            toDate,
            period,
            search,
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

                const start = new Date(
                    fYear,
                    fMonth - 1,
                    fDay
                );

                start.setHours(0, 0, 0, 0);

                filter.createdAt.$gte = start;
            }

            if (toDate) {
                const [tDay, tMonth, tYear] = toDate.split("/");

                const end = new Date(
                    tYear,
                    tMonth - 1,
                    tDay
                );

                end.setHours(23, 59, 59, 999);

                filter.createdAt.$lte = end;
            }
        }

        const bills = await Bill.find(filter)
            .populate("customerId", "customerId name phone")
            .populate(
                "items.productId",
                "itemCode name mrp unit unitValue gstRate"
            )
            .sort({ createdAt: -1 });

        const report = {};

        for (const bill of bills) {

            for (const item of bill.items) {


                let itemGst;

                const billGst = item.gstRate;
                const productGst = item.productId?.gstRate;

                if (
                    billGst !== null &&
                    billGst !== undefined &&
                    String(billGst).toLowerCase().trim() === "none"
                ) {
                    itemGst = "none";
                }

                else if (Number(billGst) === 0) {

                    if (
                        productGst !== null &&
                        productGst !== undefined &&
                        String(productGst).toLowerCase().trim() === "none"
                    ) {
                        itemGst = "none";
                    } else {
                        itemGst = "0";
                    }

                }

                else if (
                    billGst !== null &&
                    billGst !== undefined &&
                    String(billGst).trim() !== ""
                ) {
                    itemGst = String(billGst)
                        .toLowerCase()
                        .trim();
                }

                else if (
                    productGst !== null &&
                    productGst !== undefined &&
                    String(productGst).trim() !== ""
                ) {
                    itemGst = String(productGst)
                        .toLowerCase()
                        .trim();
                }

                else {
                    itemGst = "none";
                }

                if (gst && gst.toLowerCase() !== "all") {

                    const gstFilter = gst.toLowerCase();


                    if (gstFilter === "gst") {
                        if (itemGst === "none") {
                            continue;
                        }
                    }


                    else if (gstFilter === "none") {

                        if (itemGst !== "none") {
                            continue;
                        }
                    }


                    else {

                        if (itemGst !== gstFilter) {
                            continue;
                        }
                    }
                }


                const id =
                    item.productId?._id?.toString() ||
                    item.productId?.toString();

                if (!id) {
                    continue;
                }


                if (!report[id]) {

                    report[id] = {
                        productId: item.productId?._id || item.productId,

                        productName: item.productName || item.name,
                        itemCode: item.productId?.itemCode || "",

                        mrp: item.mrp || item.productId?.mrp || 0,
                        sellingPrice: item.sellingPrice || item.productId?.sellingPrice || 0,
                        costPrice: item.costPrice || 0,

                        gstRate: itemGst === "none"
                            ? "none"
                            : Number(itemGst),


                        unit: item.unit || item.productId?.unit || "",
                        unitValue: item.unitValue || item.productId?.unitValue || 1,

                        qtySold: 0,
                        salesAmount: 0,
                        discountAmount: 0,
                        gstAmount: 0,
                        netSales: 0,

                        profitAmount: 0,
                        profitPercent: 0
                    };
                }

                report[id].qtySold += Number(item.qty || 0);



                report[id].salesAmount = Number(
                    (
                        report[id].salesAmount +
                        Number(item.totalAmount || (item.sellingPrice * item.qty) || 0)
                    ).toFixed(2)
                );

                report[id].discountAmount = Number(
                    (report[id].discountAmount + Number(item.discountAmount || 0)).toFixed(2)
                );

                report[id].gstAmount = Number(
                    (report[id].gstAmount + Number(item.gstAmount || 0)).toFixed(2)
                );

                report[id].netSales = Number(
                    (report[id].netSales + Number(item.finalPrice || 0)).toFixed(2)
                );


                const costPrice = Number(item.costPrice || 0);
                const qty = Number(item.qty || 0);

                const purchaseAmount = Number((costPrice * qty).toFixed(2));


                const profit = Number(
                    (Number(item.finalPrice || 0) - purchaseAmount).toFixed(2)
                );

                report[id].profitAmount += profit;

            }
        }

        const result = Object.values(report);

        const filteredResult = search
            ? result.filter(item => {
                const searchText = search.toLowerCase().trim();

                return (
                    String(item.productName || "")
                        .toLowerCase()
                        .includes(searchText) ||

                    String(item.itemCode || "")
                        .toLowerCase()
                        .includes(searchText)
                );
            })
            : result;

        return res.status(200).json({
            success: true,
            count: filteredResult.length,
            data: filteredResult
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getWalkInCustomerBills = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const bills = await Bill.find({
            superAdminId: hierarchy.superAdminId,
            customerId: null
        })
            .sort({ createdAt: -1 })
            .populate("createdBy", "name CompanyName");

        const data = bills.map((bill) => ({
            billId: bill._id,
            invoiceNo: bill.invoiceNo,

            invoiceDate: bill.createdAt.toLocaleDateString("en-GB"),
            invoiceTime: bill.createdAt.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }),

            customer: {
                customerId: null,
                customerName: "Walk in Customer",
                mobile: ""
            },

            items: bill.items.map(item => ({
                productId: item.productId,
                productName: item.productName || item.name,
                barcode: item.barcode,
                qty: item.qty,
                freeQty: item.freeQty || 0,
                totalGivenQty: item.totalGivenQty || item.qty,
                unit: item.unit,
                unitValue: item.unitValue,
                sellingPrice: item.sellingPrice,
                finalPrice: item.finalPrice,
                gstRate: item.gstRate,
                gstAmount: item.gstAmount
            })),

            totalItems: bill.items.length,

            summary: {
                subTotal: bill.summary?.subTotal || 0,
                totalGST: bill.summary?.totalGST || 0,
                discount: bill.summary?.discount || 0,
                grandTotal: bill.summary?.grandTotal || 0
            },

            paidAmount: bill.paidAmount || 0,
            pendingAmount: bill.pendingAmount || 0,

            paymentMethod: bill.paymentMethod,
            paymentStatus: bill.paymentStatus
        }));

        return res.status(200).json({
            success: true,
            totalBills: data.length,
            data
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.salescheck = async (req, res) => {
    try {
        const { type = "today" } = req.query;
        const hierarchy = attachHierarchy(req.user);

        const now = new Date();
        let startDate;

        if (type === "today") {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (type === "week") {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
        } else if (type === "month") {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (type === "year") {
            startDate = new Date(now.getFullYear(), 0, 1);
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid type. Use today, week, month, or year"
            });
        }

        const sales = await Bill.aggregate([
            {
                $match: {
                    superAdminId: hierarchy.superAdminId,
                    createdAt: { $gte: startDate, $lte: now },
                    paymentStatus: "paid"
                }
            },
            {
                $group: {
                    _id: null,
                    totalBills: { $sum: 1 },
                    totalSales: { $sum: "$summary.grandTotal" },
                    totalGST: { $sum: "$summary.totalGST" },
                    totalDiscount: { $sum: "$summary.discount" },
                    subTotal: { $sum: "$summary.subTotal" }
                }
            }
        ]);

        const result = sales[0] || {
            totalBills: 0,
            totalSales: 0,
            totalGST: 0,
            totalDiscount: 0,
            subTotal: 0
        };

        return res.status(200).json({
            success: true,
            message: `${type} sales fetched successfully`,
            filter: {
                type,
                from: startDate,
                to: now
            },
            data: result
        });

    } catch (error) {
        console.error("SALES CHECK ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


exports.cashierWiseSales = async (req, res) => {
    try {
        const { type = "today" } = req.query;
        const hierarchy = attachHierarchy(req.user);

        const now = new Date();
        let startDate;

        if (type === "today") {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (type === "week") {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
        } else if (type === "month") {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (type === "year") {
            startDate = new Date(now.getFullYear(), 0, 1);
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid type. Use today, week, month, or year"
            });
        }

        const sales = await Bill.aggregate([
            {
                $match: {
                    superAdminId: hierarchy.superAdminId,
                    createdAt: { $gte: startDate, $lte: now },
                    paymentStatus: "paid"
                }
            },
            {
                $group: {
                    _id: "$createdBy",
                    totalBills: { $sum: 1 },
                    subTotal: { $sum: "$summary.subTotal" },
                    totalGST: { $sum: "$summary.totalGST" },
                    totalDiscount: { $sum: "$summary.discount" },
                    totalSales: { $sum: "$summary.grandTotal" }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "cashier"
                }
            },
            {
                $unwind: {
                    path: "$cashier",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 0,
                    cashierId: "$_id",
                    cashierName: { $ifNull: ["$cashier.name", "Unknown"] },
                    cashierEmail: { $ifNull: ["$cashier.email", ""] },
                    totalBills: 1,
                    subTotal: 1,
                    totalGST: 1,
                    totalDiscount: 1,
                    totalSales: 1
                }
            },
            {
                $sort: { totalSales: -1 }
            }
        ]);

        return res.status(200).json({
            success: true,
            message: "Cashier wise sales fetched successfully",
            filter: {
                type,
                from: startDate,
                to: now
            },
            data: sales
        });

    } catch (error) {
        console.error("CASHIER SALES ERROR:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
}


exports.getBillById = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const bill = await Bill.findOne({
            _id: req.params.id,
            superAdminId: hierarchy.superAdminId
        })
            .populate("customerId", "name phone customerId")
            .populate("createdBy", "name email role");

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }

        const formattedBill = {
            ...bill.toObject(),

            createdAt: new Date(bill.createdAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }),

            updatedAt: new Date(bill.updatedAt).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            })
        };

        const totalGST = Number(formattedBill.summary?.totalGST || 0);

        const cgst = Number((totalGST / 2).toFixed(2));
        const sgst = Number((totalGST / 2).toFixed(2));

        const paidAmount = Number(formattedBill.paidAmount || 0);
        const grandTotal = Number(formattedBill.summary?.grandTotal || 0);

        const pendingAmount = Math.max(grandTotal - paidAmount, 0);
        const returnAmount = Math.max(paidAmount - grandTotal, 0);

        const response = {
            billId: formattedBill._id,

            invoiceNo: formattedBill.invoiceNo,

            invoiceDate: new Date(bill.createdAt).toLocaleDateString("en-GB"),

            invoiceTime: new Date(bill.createdAt).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }),

            customer: formattedBill.customerId
                ? {
                    customerId: formattedBill.customerId.customerId,
                    customerName: formattedBill.customerId.name,
                    mobile: formattedBill.customerId.phone || ""
                }
                : null,

            paymentMethod: formattedBill.paymentMethod,
            paymentStatus: formattedBill.paymentStatus,

            payments: formattedBill.payments,

            paidAmount: Number(paidAmount.toFixed(2)),
            pendingAmount: Number(pendingAmount.toFixed(2)),
            returnAmount: Number(returnAmount.toFixed(2)),

            items: formattedBill.items,

            summary: {
                totalAmount: Number(
                    (
                        Number(formattedBill.summary.subTotal || 0) +
                        Number(formattedBill.summary.totalGST || 0) +
                        formattedBill.items.reduce(
                            (sum, item) => sum + Number(item.discountAmount || 0),
                            0
                        )
                    ).toFixed(2)
                ),

                subTotal: Number(formattedBill.summary.subTotal || 0),

                cgst,
                sgst,

                totalGST: Number(formattedBill.summary.totalGST || 0),

                itemDiscountAmount: Number(
                    formattedBill.items.reduce(
                        (sum, item) =>
                            sum + Number(item.discountAmount || 0),
                        0
                    ).toFixed(2)
                ),

                billDiscountAmount: Number(
                    formattedBill.summary.billDiscountAmount || 0
                ),

                billDiscountPercentage: Number(
                    formattedBill.summary.billDiscountPercentage || 0
                ),

                loyaltyDiscount: Number(formattedBill.summary.discount || 0),

                offerName: formattedBill.offer?.offerName || null,

                offerAmount: Number(
                    formattedBill.offer?.discountAmount || 0
                ),

                grandTotal: Number(formattedBill.summary.grandTotal || 0)
            },

            loyalty: {
                used: Number(formattedBill.summary.loyaltyDiscount || 0)
            },

            createdBy: formattedBill.createdBy
        };

        return res.status(200).json({
            success: true,
            message: "Bill fetched successfully",
            data: response
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};



exports.editBill = async (req, res) => {
    try {
        const { billId } = req.params;

        const {
            items: billItems = [],

            customerId,
            isWalkInCustomer = false,

            redeemPoints = 0,

            discountPercent = 0,
            discountAmount = 0,

            paymentStatus = "paid",
            paymentMethod = "cash",

            payments = [],
            paidAmount = 0,

        } = req.body;

        const hierarchy = attachHierarchy(req.user);


        const bill = await Bill.findOne({
            _id: billId,
            superAdminId: hierarchy.superAdminId
        });

        if (!bill) {
            return res.status(404).json({
                success: false,
                message: "Bill not found"
            });
        }


        const billCreatedTime = new Date(bill.createdAt).getTime();
        const currentTime = Date.now();

        const difference = currentTime - billCreatedTime;

        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (difference > ONE_DAY) {
            return res.status(403).json({
                success: false,
                message: "Bill can only be edited within 24 hours of creation"
            });
        }

        if (!Array.isArray(billItems) || billItems.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one item is required"
            });
        }

        const oldGrandTotal = Number(
            bill.summary?.grandTotal || 0
        );

        const oldPayments = bill.payments || [];

        const oldRedeemedPoints = Number(
            bill.summary?.discount || 0
        );


        const oldEarnedPoints = Math.floor(
            oldGrandTotal / 100
        );


        for (const oldItem of bill.items || []) {



            const restoreQty =
                Number(oldItem.qty || 0) +
                Number(oldItem.freeQty || 0);



            if (oldItem.productId) {
                await Product.updateOne(
                    {
                        _id: oldItem.productId,
                        superAdminId: hierarchy.superAdminId
                    },
                    {
                        $inc: {
                            stock: restoreQty
                        }
                    }
                );
            }
        }


        let subTotal = 0;
        let totalGST = 0;
        let totalItemDiscount = 0;

        const newItems = [];

        for (const billItem of billItems) {

            const qty = Number(billItem.qty || 0);

            if (qty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid quantity"
                });
            }

            const product = await Product.findOne({
                _id: billItem.productId,
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

            if (!barcode) {
                return res.status(404).json({
                    success: false,
                    message: `Barcode not found for ${product.name}`
                });
            }


            let freeQty = 0;

            const buyGetOffer = await Offer.findOne({
                superAdminId: hierarchy.superAdminId,
                offerType: "buy_get",
                isActive: true,
                buyProductId: product._id
            });

            if (
                buyGetOffer &&
                qty >= Number(buyGetOffer.buyQty || 0)
            ) {
                freeQty =
                    Math.floor(
                        qty / Number(buyGetOffer.buyQty)
                    ) *
                    Number(buyGetOffer.freeQty || 0);
            }

            const totalRequiredQty = qty + freeQty;




            const price = Number(
                billItem.sellingPrice ||
                barcode.sellingPrice ||
                0
            );

            if (price <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid selling price for ${product.name}`
                });
            }

            const rawGstRate =
                billItem.gstRate ??
                barcode.gstRate ??
                product.gstRate ??
                "none";

            const gstRate =
                String(rawGstRate).toLowerCase() === "none"
                    ? 0
                    : Number(rawGstRate);

            if (!Number.isFinite(gstRate)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid GST rate for ${product.name}`
                });
            }

            const grossAmount = Number(
                (price * qty).toFixed(2)
            );

            const itemDiscountPercent = Number(
                billItem.discountPercent || 0
            );

            const itemDiscountAmount = Number(
                billItem.discountAmount || 0
            );

            let itemDiscount = 0;

            if (itemDiscountPercent > 0) {
                itemDiscount = Number(
                    (
                        grossAmount *
                        itemDiscountPercent /
                        100
                    ).toFixed(2)
                );

            } else if (itemDiscountAmount > 0) {
                itemDiscount = Number(
                    itemDiscountAmount.toFixed(2)
                );
            }

            if (itemDiscount > grossAmount) {
                return res.status(400).json({
                    success: false,
                    message:
                        `Discount cannot exceed item total for ${product.name}`
                });
            }

            let calculatedDiscountPercent =
                itemDiscountPercent;

            if (
                calculatedDiscountPercent === 0 &&
                itemDiscount > 0 &&
                grossAmount > 0
            ) {
                calculatedDiscountPercent = Number(
                    (
                        itemDiscount /
                        grossAmount *
                        100
                    ).toFixed(2)
                );
            }

            totalItemDiscount += itemDiscount;

            const finalPrice = Number(
                (
                    grossAmount -
                    itemDiscount
                ).toFixed(2)
            );


            const taxableAmount = Number(
                (
                    finalPrice /
                    (1 + gstRate / 100)
                ).toFixed(2)
            );

            const gstAmount = Number(
                (
                    finalPrice -
                    taxableAmount
                ).toFixed(2)
            );

            subTotal += taxableAmount;
            totalGST += gstAmount;

            newItems.push({
                productId: product._id,

                barcodeId: barcode?._id || null,
                barcode: barcode.code,

                itemCode: product.itemCode || "",

                productName: product.name || "",
                name: product.name || "",

                qty,
                freeQty,
                totalGivenQty: qty + freeQty,

                unit:
                    barcode.unit ||
                    product.unit ||
                    "pcs",

                unitValue:
                    barcode.unitValue ||
                    product.unitValue ||
                    1,

                unitText:
                    `${barcode.unitValue || product.unitValue || 1} ` +
                    `${barcode.unit || product.unit || "pcs"}`,

                totalUnitQty:
                    qty *
                    Number(
                        barcode.unitValue ||
                        product.unitValue ||
                        1
                    ),

                totalUnitText:
                    `${qty *
                    Number(
                        barcode.unitValue ||
                        product.unitValue ||
                        1
                    )} ` +
                    `${barcode.unit || product.unit || "pcs"}`,

                mrp: Number(barcode.mrp || 0),

                sellingPrice: price,
                normalSellingPrice:
                    Number(barcode.sellingPrice || 0),

                totalAmount: grossAmount,

                discountPercent:
                    calculatedDiscountPercent,

                discountAmount:
                    itemDiscount,

                finalPrice,

                gstRate,
                gstAmount
            });




            const stockUpdate =
                await Product.updateOne(
                    {
                        _id: product._id,
                        superAdminId:
                            hierarchy.superAdminId,

                        stock: {
                            $gte: totalRequiredQty
                        }
                    },
                    {
                        $inc: {
                            stock: -totalRequiredQty
                        }
                    }
                );

            if (stockUpdate.modifiedCount === 0) {
                return res.status(400).json({
                    success: false,
                    message:
                        `${product.name} stock update failed`
                });
            }
        }

        subTotal = Number(subTotal.toFixed(2));
        totalGST = Number(totalGST.toFixed(2));


        const beforeBillDiscount = Number(
            (subTotal + totalGST).toFixed(2)
        );

        let billDiscount = 0;
        let billDiscountPercentage = 0;

        if (Number(discountPercent) > 0) {

            billDiscount = Number(
                (
                    beforeBillDiscount *
                    Number(discountPercent) /
                    100
                ).toFixed(2)
            );

            billDiscountPercentage =
                Number(discountPercent);

        } else if (Number(discountAmount) > 0) {

            billDiscount =
                Number(discountAmount);

            billDiscountPercentage =
                beforeBillDiscount > 0
                    ? Number(
                        (
                            billDiscount /
                            beforeBillDiscount *
                            100
                        ).toFixed(2)
                    )
                    : 0;
        }


        let customer = null;

        if (!isWalkInCustomer) {

            if (!customerId) {
                return res.status(400).json({
                    success: false,
                    message: "Customer is required."
                });
            }

            const customerFilter = {
                superAdminId: hierarchy.superAdminId,
                $or: []
            };

            if (mongoose.Types.ObjectId.isValid(customerId)) {
                customerFilter.$or.push({
                    _id: customerId
                });
            }

            if (!isNaN(customerId)) {
                customerFilter.$or.push({
                    customerId: Number(customerId)
                });
            }

            customer = await Customer.findOne(customerFilter);

            if (!customer) {
                return res.status(404).json({
                    success: false,
                    message: "Customer not found"
                });
            }
        }


        let loyaltyDiscount = 0;

        if (customer) {

            // Restore the loyalty points that were used
            // in the original bill
            customer.loyaltyPoints =
                Number(customer.loyaltyPoints || 0) +
                oldRedeemedPoints;

            // New loyalty points entered while editing
            const newRedeemPoints = Number(
                redeemPoints || 0
            );

            if (newRedeemPoints < 0) {
                return res.status(400).json({
                    success: false,
                    message: "Redeem points cannot be negative"
                });
            }

            if (
                newRedeemPoints >
                Number(customer.loyaltyPoints || 0)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Insufficient loyalty points"
                });
            }


            customer.loyaltyPoints -= newRedeemPoints;

            loyaltyDiscount = newRedeemPoints;
        }

        let grandTotal = Number(
            (
                subTotal +
                totalGST -
                billDiscount -
                loyaltyDiscount
            ).toFixed(2)
        );

        let offer = null;
        let offerDiscount = 0;
        let appliedOffer = null;

        offer = await Offer.findOne({
            superAdminId:
                hierarchy.superAdminId,

            isActive: true,

            minimumPurchase: {
                $lte: grandTotal
            }
        }).sort({
            minimumPurchase: -1
        });

        if (offer) {

            if (
                offer.discountType === "amount"
            ) {
                offerDiscount =
                    Number(offer.discountValue || 0);

            } else {
                offerDiscount = Number(
                    (
                        grandTotal *
                        Number(
                            offer.discountValue || 0
                        ) /
                        100
                    ).toFixed(2)
                );
            }

            appliedOffer =
                offer.offerName;
        }

        grandTotal = Number(
            Math.max(
                grandTotal - offerDiscount,
                0
            ).toFixed(2)
        );


        let finalPayments = [];

        if (
            paymentStatus === "due" ||
            paymentStatus === "partial"
        ) {

            if (
                Array.isArray(payments) &&
                payments.length > 0
            ) {
                finalPayments = payments;

            } else if (
                Number(paidAmount) > 0
            ) {
                finalPayments = [
                    {
                        method: paymentMethod,
                        amount:
                            Number(paidAmount)
                    }
                ];
            }

        } else if (
            paymentMethod === "split"
        ) {

            finalPayments = payments;

        } else {

            finalPayments = [
                {
                    method: paymentMethod,
                    amount: Number(paidAmount) > 0
                        ? Number(paidAmount)
                        : grandTotal
                }
            ];
        }

        const allowedMethods = [
            "cash",
            "upi",
            "card",
            "cheque",
            "sodexo"
        ];

        for (const pay of finalPayments) {

            if (
                !allowedMethods.includes(
                    pay.method
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment method"
                });
            }

            if (
                Number(pay.amount || 0) <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid payment amount"
                });
            }
        }

        const totalPaid = Number(
            finalPayments
                .reduce(
                    (sum, pay) =>
                        sum +
                        Number(pay.amount || 0),
                    0
                )
                .toFixed(2)
        );

        let pendingAmount = 0;
        let returnAmount = 0;

        if (paymentStatus === "paid") {

            if (totalPaid < grandTotal) {
                return res.status(400).json({
                    success: false,
                    message: "Paid amount cannot be less than grand total"
                });
            }

            returnAmount = Number(
                (totalPaid - grandTotal).toFixed(2)
            );

        }

        if (paymentStatus === "partial") {

            if (
                totalPaid <= 0 ||
                totalPaid >= grandTotal
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Partial amount must be less than grand total"
                });
            }

            pendingAmount = Number(
                (
                    grandTotal -
                    totalPaid
                ).toFixed(2)
            );
        }

        // Recalculate loyalty points earned from edited bill
        const newEarnedPoints = Math.floor(
            grandTotal / 100
        );

        if (customer) {


            customer.loyaltyPoints =
                Number(customer.loyaltyPoints || 0) -
                oldEarnedPoints;


            customer.loyaltyPoints += newEarnedPoints;

            customer.totalSpent =
                Number(customer.totalSpent || 0) -
                oldGrandTotal +
                grandTotal;

            await customer.save();
        }


        bill.items = newItems;

        bill.summary = {
            subTotal,
            totalGST,


            discount: loyaltyDiscount,

            grandTotal,

            itemDiscountAmount:
                Number(
                    totalItemDiscount.toFixed(2)
                ),

            billDiscountAmount:
                billDiscount,

            billDiscountPercentage
        };

        bill.offer = {
            offerId:
                offer?._id || null,

            offerName:
                appliedOffer,

            discountAmount:
                offerDiscount
        };

        bill.paymentMethod =
            finalPayments.length > 1
                ? "split"
                : finalPayments[0]?.method ||
                "due";

        bill.paymentStatus =
            paymentStatus;

        bill.payments =
            finalPayments;

        bill.paidAmount =
            totalPaid;

        bill.pendingAmount =
            pendingAmount;

        bill.returnAmount =
            returnAmount;

        bill.customerId = customer ? customer._id : null;

        bill.updatedBy =
            req.user.userId ||
            req.user.id;

        await bill.save();


        const userId =
            req.user.userId ||
            req.user.id;

        const activeSession =
            await Session.findOne({
                cashier: userId,

                superAdminId:
                    hierarchy.superAdminId,

                status: "open"
            });

        if (activeSession) {

            activeSession.totalSales =
                Number(
                    (
                        Number(
                            activeSession.totalSales ||
                            0
                        ) -
                        oldGrandTotal +
                        grandTotal
                    ).toFixed(2)
                );

            const getPaymentTotal = (
                paymentList,
                method
            ) => {
                return paymentList
                    .filter(
                        (p) =>
                            p.method === method
                    )
                    .reduce(
                        (sum, p) =>
                            sum +
                            Number(
                                p.amount || 0
                            ),
                        0
                    );
            };

            const methods = [
                "cash",
                "upi",
                "card",
                "cheque",
                "sodexo"
            ];

            for (const method of methods) {

                const oldAmount =
                    getPaymentTotal(
                        oldPayments,
                        method
                    );

                const newAmount =
                    getPaymentTotal(
                        finalPayments,
                        method
                    );

                const difference =
                    newAmount -
                    oldAmount;

                switch (method) {

                    case "cash":
                        activeSession.cashSales =
                            Number(
                                (
                                    Number(
                                        activeSession.cashSales ||
                                        0
                                    ) +
                                    difference
                                ).toFixed(2)
                            );
                        break;

                    case "upi":
                        activeSession.upiSales =
                            Number(
                                (
                                    Number(
                                        activeSession.upiSales ||
                                        0
                                    ) +
                                    difference
                                ).toFixed(2)
                            );
                        break;

                    case "card":
                        activeSession.cardSales =
                            Number(
                                (
                                    Number(
                                        activeSession.cardSales ||
                                        0
                                    ) +
                                    difference
                                ).toFixed(2)
                            );
                        break;

                    case "cheque":
                        activeSession.chequeSales =
                            Number(
                                (
                                    Number(
                                        activeSession.chequeSales ||
                                        0
                                    ) +
                                    difference
                                ).toFixed(2)
                            );
                        break;

                    case "sodexo":
                        activeSession.sodexoSales =
                            Number(
                                (
                                    Number(
                                        activeSession.sodexoSales ||
                                        0
                                    ) +
                                    difference
                                ).toFixed(2)
                            );
                        break;
                }
            }

            activeSession.expectedCash =
                Number(
                    (
                        Number(
                            activeSession.openingAmount ||
                            0
                        ) +
                        Number(
                            activeSession.cashSales ||
                            0
                        )
                    ).toFixed(2)
                );

            await activeSession.save();
        }


        await AuditLog.create({
            userId:
                req.user.userId ||
                req.user.id,

            role:
                req.user.role,

            module: "Bill",

            action: "Update",

            description:
                `Bill edited - Invoice: ${bill.invoiceNo}`,

            referenceId:
                bill._id,

            metadata: {
                invoiceNo:
                    bill.invoiceNo,

                oldGrandTotal,

                newGrandTotal:
                    grandTotal,

                paymentStatus,

                paymentMethod:
                    bill.paymentMethod
            },

            ...hierarchy
        });

        const cgst = Number(
            (totalGST / 2).toFixed(2)
        );

        const sgst = Number(
            (totalGST / 2).toFixed(2)
        );


        return res.status(200).json({
            success: true,

            message:
                "Bill updated successfully",

            data: {

                billId:
                    bill._id,

                invoiceNo:
                    bill.invoiceNo,


                customer: customer
                    ? {
                        customerId: customer.customerId,
                        customerName: customer.name,
                        mobile: customer.phone
                    }
                    : {
                        customerId: null,
                        customerName: "Walk In Customer",
                        mobile: null
                    },


                items:
                    newItems,

                paymentMethod:
                    bill.paymentMethod,

                paymentStatus,

                payments:
                    finalPayments,

                paidAmount:
                    totalPaid,

                pendingAmount,

                returnAmount,


                summary: {
                    totalAmount:
                        Number(
                            (
                                subTotal +
                                totalGST +
                                totalItemDiscount
                            ).toFixed(2)
                        ),

                    subTotal,

                    cgst,
                    sgst,

                    totalGST,

                    itemDiscountAmount:
                        Number(
                            totalItemDiscount.toFixed(2)
                        ),

                    billDiscountAmount:
                        billDiscount,

                    billDiscountPercentage,

                    offerName:
                        appliedOffer,

                    offerAmount:
                        offerDiscount,

                    loyaltyDiscount,

                    loyalty: {
                        used: loyaltyDiscount,
                        earned: newEarnedPoints,
                        remaining: customer
                            ? Number(customer.loyaltyPoints || 0)
                            : 0
                    },

                    grandTotal
                }
            }
        });

    } catch (error) {

        console.error(
            "UPDATE BILL ERROR:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};