const express = require("express");
const router = express.Router();

const Location = require("../models/location");
const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



router.post(
    "/",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const {
                name,
                type,
                code,
                address,
                city,
                pincode,
                contactPerson,
                phone
            } = req.body;

            if (!name || !type) {
                return res.status(400).json({
                    success: false,
                    message: "Name and type are required"
                });
            }

            const allowedTypes = ["STORE", "WAREHOUSE", "COUNTER", "RACK", "DELIVERY_ZONE"];

            if (!allowedTypes.includes(type)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid location type"
                });
            }

            const hierarchy = attachHierarchy(req.user);

            const exists = await Location.findOne({
                name: name.trim(),
                type,
                superAdminId: hierarchy.superAdminId
            });

            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: "Location already exists"
                });
            }

            const location = await Location.create({
                name: name.trim(),
                type,
                code,
                address,
                city,
                pincode,
                contactPerson,
                phone,
                ...hierarchy,
                createdBy: req.user.userId || req.user.id
            });

            res.status(201).json({
                success: true,
                message: "Location created successfully",
                data: location
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);



router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);
            const { search, type, isActive } = req.query;

            const filter = {
                superAdminId: hierarchy.superAdminId
            };

            if (search) {
                filter.name = { $regex: search, $options: "i" };
            }

            if (type) {
                filter.type = type;
            }

            if (isActive !== undefined) {
                filter.isActive = isActive === "true";
            }

            const locations = await Location.find(filter)
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                count: locations.length,
                data: locations
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);



router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const location = await Location.findOne({
                _id: req.params.id,
                superAdminId: hierarchy.superAdminId
            });

            if (!location) {
                return res.status(404).json({
                    success: false,
                    message: "Location not found"
                });
            }

            res.json({
                success: true,
                data: location
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);



router.patch(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const allowedFields = [
                "name",
                "type",
                "code",
                "address",
                "city",
                "pincode",
                "contactPerson",
                "phone",
                "isActive"
            ];

            const updateData = {};

            allowedFields.forEach((field) => {
                if (req.body[field] !== undefined) {
                    updateData[field] =
                        typeof req.body[field] === "string"
                            ? req.body[field].trim()
                            : req.body[field];
                }
            });

            const location = await Location.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                updateData,
                { new: true }
            );

            if (!location) {
                return res.status(404).json({
                    success: false,
                    message: "Location not found"
                });
            }

            res.json({
                success: true,
                message: "Location updated successfully",
                data: location
            });

        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "Location already exists"
                });
            }

            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);



router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const location = await Location.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                { isActive: false },
                { new: true }
            );

            if (!location) {
                return res.status(404).json({
                    success: false,
                    message: "Location not found"
                });
            }

            res.json({
                success: true,
                message: "Location deactivated successfully",
                data: location
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: "Server error",
                error: err.message
            });
        }
    }
);

module.exports = router;