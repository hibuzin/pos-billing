const adminandcashier = require("../models/admin_and_cashier");

exports.getAdminMe = async (req, res) => {
    try {

        const admin = await adminandcashier.findOne({
            _id: req.user.userId,
            role: "admin",
            superAdminId: req.user.superAdminId
        }).select("-password");

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Admin fetched successfully",
            data: admin
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });

    }
};


exports.getAllCashiers = async (req, res) => {
    try {

        const cashiers = await adminandcashier.find({
            role: "cashier",
            superAdminId: req.user.superAdminId
        }).select("-password");

        return res.status(200).json({
            success: true,
            count: cashiers.length,
            data: cashiers
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });

    }
};