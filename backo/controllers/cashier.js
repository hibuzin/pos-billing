const adminandcashier = require("../models/admin_and_cashier");

exports.getCashierMe = async (req, res) => {
    try {

        const cashier = await adminandcashier.findOne({
            _id: req.user.userId,
            role: "cashier",
            superAdminId: req.user.superAdminId
        }).select("-password");

        if (!cashier) {
            return res.status(404).json({
                success: false,
                message: "Cashier not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cashier fetched successfully",
            data: cashier
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });

    }
};
