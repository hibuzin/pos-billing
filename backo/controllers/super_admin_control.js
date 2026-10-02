const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const adminandcashier = require("../models/admin_and_cashier");

exports.createUser = async (req, res) => {
    try {

        const { name, email, phone, password, role } = req.body;

        if (!name || !phone || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Name, phone, password and role are required"
            });
        }

        if (!["admin", "cashier"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Super Admin can create only admin or cashier"
            });
        }

        const superAdminId = req.user.userId || req.user.id;

        let loginEmail = "";

        if (email) {
            loginEmail = email.trim().toLowerCase();

            const existingUser = await adminandcashier.findOne({
                email: loginEmail,
                superAdminId
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "User already exists in your company"
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await adminandcashier.create({
            name: String(name).trim(),

            email: loginEmail || "",

            phone: String(phone).trim(),

            password: hashedPassword,

            role,

            createdBy: superAdminId,

            superAdminId,

            adminId: null
        });

        return res.status(201).json({
            success: true,
            message: `${role} created successfully`,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                superAdminId: user.superAdminId,
                createdBy: user.createdBy,
                isActive: user.isActive,
                createdAt: user.createdAt
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


exports.getAllAdmins = async (req, res) => {
    try {

        const admins = await adminandcashier.find({
            role: "admin",
            superAdminId: req.user.userId
        }).select("-password");

        return res.status(200).json({
            success: true,
            count: admins.length,
            data: admins
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
        const superAdminId = req.user.superAdminId || req.user.userId;

        const cashiers = await adminandcashier.find({
            role: "cashier",
            superAdminId
        }).select("name email phone role superAdminId adminId createdBy");

        return res.status(200).json({
            success: true,
            message: "Cashiers fetched successfully",
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


exports.getAdminById = async (req, res) => {
    try {
        const { adminId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(adminId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin id"
            });
        }

        const admin = await adminandcashier.findOne({
            _id: adminId,
            role: "admin",
            superAdminId: req.user.userId
        }).select("name email phone role superAdminId adminId createdBy");

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

exports.getCashierById = async (req, res) => {
    try {

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid cashier id"
            });
        }

        const superAdminId =
            req.user.role === "super_admin"
                ? req.user.userId
                : req.user.superAdminId;

        const cashier = await adminandcashier.findOne({
            _id: id,
            role: "cashier",
            superAdminId
        }).select("name email phone role superAdminId adminId createdBy");

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

exports.updateAdmin = async (req, res) => {
    try {

        const { adminId } = req.params;

        const {
            name,
            email,
            phone
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(adminId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin id"
            });
        }

        const admin = await adminandcashier.findOne({
            _id: adminId,
            role: "admin",
            superAdminId: req.user.userId
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        if (email) {

            const existingEmail = await adminandcashier.findOne({
                email: email.trim().toLowerCase(),
                _id: { $ne: adminId },
                superAdminId: req.user.userId
            });

            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists"
                });
            }

            admin.email = email.trim().toLowerCase();
        }

        if (name) {
            admin.name = name.trim();
        }

        if (phone) {
            admin.phone = phone.trim();
        }

        await admin.save();

        return res.status(200).json({
            success: true,
            message: "Admin updated successfully",
            data: {
                _id: admin._id,
                name: admin.name,
                email: admin.email,
                phone: admin.phone,
                role: admin.role,
                superAdminId: admin.superAdminId,
                adminId: admin.adminId,
                createdBy: admin.createdBy
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



exports.updateCashier = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, password, isActive } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid cashier id"
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

        const cashier = await adminandcashier.findOne({
            _id: id,
            role: "cashier",
            superAdminId
        });

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
                message: "You can update only your own cashier"
            });
        }

        if (email) {
            const loginEmail = email.trim().toLowerCase();

            const existingUser = await adminandcashier.findOne({
                _id: { $ne: id },
                email: loginEmail,
                superAdminId
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Email already exists in your company"
                });
            }

            cashier.email = loginEmail;
        }

        if (name) cashier.name = name;
        if (phone) cashier.phone = phone;
        if (typeof isActive === "boolean") cashier.isActive = isActive;

        if (password) {
            cashier.password = await bcrypt.hash(password, 10);
        }

        await cashier.save();

        return res.status(200).json({
            success: true,
            message: "Cashier updated successfully",
            data: {
                _id: cashier._id,
                name: cashier.name,
                email: cashier.email,
                phone: cashier.phone,
                role: cashier.role,
                superAdminId: cashier.superAdminId,
                createdBy: cashier.createdBy,
                isActive: cashier.isActive,
                updatedAt: cashier.updatedAt
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



exports.deleteAdmin = async (req, res) => {
    try {

        const { adminId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(adminId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid admin id"
            });
        }

        const admin = await adminandcashier.findOne({
            _id: adminId,
            role: "admin",
            superAdminId: req.user.userId
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        // delete all cashier under this admin
        await adminandcashier.deleteMany({
            role: "cashier",
            adminId: admin._id
        });

        // delete admin
        await adminandcashier.deleteOne({
            _id: admin._id
        });

        return res.status(200).json({
            success: true,
            message: "Admin deleted successfully"
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });

    }
};




exports.deleteCashier = async (req, res) => {
    try {
        const { id } = req.params;

        let superAdminId = null;
        let adminId = null;


        if (req.user.role === "super_admin") {
            superAdminId = req.user.userId;
        } else if (req.user.role === "admin") {
            superAdminId = req.user.superAdminId;
            adminId = req.user.userId;
        }


        const cashier = await adminandcashier.findOne({
            _id: id,
            role: "cashier",
            superAdminId
        });

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
                message: "You can delete only your own cashier"
            });
        }

        await adminandcashier.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Cashier deleted successfully"
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};