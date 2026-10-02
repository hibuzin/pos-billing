const bcrypt = require("bcryptjs");
const admin_and_cashier = require("../models/admin_and_cashier");

exports.adminCreateCashier = async (req, res) => {
    try {
        const { name, email, phone, password } = req.body;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Only admin can create cashier"
            });
        }

        const adminId = req.user.userId;
        const superAdminId = req.user.superAdminId;

        const existingUser = await admin_and_cashier.findOne({
            email,
            superAdminId
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Cashier already exists in your company"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const cashier = await admin_and_cashier.create({
            name,
            email,
            phone,
            password: hashedPassword,
            role: "cashier",
            createdBy: adminId,
            superAdminId,
            adminId
        });

        return res.status(201).json({
            success: true,
            message: "Cashier created successfully",
            data: {
                _id: cashier._id,
                name: cashier.name,
                email: cashier.email,
                phone: cashier.phone,
                role: cashier.role,
                superAdminId: cashier.superAdminId,
                adminId: cashier.adminId,
                createdBy: cashier.createdBy,
                isActive: cashier.isActive,
                createdAt: cashier.createdAt
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


exports.changeCashierPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid cashier id"
            });
        }

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters"
            });
        }

        let superAdminId = null;
        let adminId = null;

        if (req.user.role === "super_admin") {
            superAdminId = req.user.userId;
        } else if (req.user.role === "admin") {
            superAdminId = req.user.superAdminId;
            adminId = req.user.userId;
        }

        const cashier = await admin_and_cashier.findOne({
            _id: id,
            role: "cashier",
            superAdminId
        }).select("+password");

        if (!cashier) {
            return res.status(404).json({
                success: false,
                message: "Cashier not found"
            });
        }

        if (
            req.user.role === "admin" &&
            cashier.createdBy.toString() !== adminId
        ) {
            return res.status(403).json({
                success: false,
                message: "You can change password only for your own cashier"
            });
        }

        cashier.password = await bcrypt.hash(newPassword, 10);

        await cashier.save();

        return res.status(200).json({
            success: true,
            message: "Cashier password changed successfully"
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};