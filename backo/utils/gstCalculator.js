const splitGST = (taxableAmount, gstRate, saleType = "INTRA_STATE") => {
    const taxAmount = (taxableAmount * gstRate) / 100;

    if (saleType === "INTER_STATE") {
        return {
            cgst: 0,
            sgst: 0,
            igst: taxAmount
        };
    }

    return {
        cgst: taxAmount / 2,
        sgst: taxAmount / 2,
        igst: 0
    };
};

module.exports = { splitGST };