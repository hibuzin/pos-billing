const getFinancialYear = (date = new Date()) => {
    const d = new Date(date);

    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    let startYear;
    let endYear;

    if (month >= 4) {
        startYear = year;
        endYear = year + 1;
    } else {
        startYear = year - 1;
        endYear = year;
    }

    return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
};

module.exports = {
    getFinancialYear
};