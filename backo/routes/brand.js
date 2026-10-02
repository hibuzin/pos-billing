const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Brand = require("../models/brand");
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
                manufacturerName,
                contactPerson,
                phone,
                email,
                address,
                gstin
            } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Brand name is required"
                });
            }

            const hierarchy = attachHierarchy(req.user);

            const exists = await Brand.findOne({
                name: name.trim(),
                superAdminId: hierarchy.superAdminId
            });

           

            const brand = await Brand.create({
                name: name.trim(),
                manufacturerName,
                contactPerson,
                phone,
                email,
                address,
                gstin,
                ...hierarchy,
                createdBy: req.user.userId || req.user.id
            });

            res.status(201).json({
                success: true,
                message: "Brand created successfully",
                data: brand
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
            const { search, isActive } = req.query;

            const filter = {
                superAdminId: hierarchy.superAdminId
            };

            if (search) {
                filter.name = { $regex: search, $options: "i" };
            }

            if (isActive !== undefined) {
                filter.isActive = isActive === "true";
            }

            const brands = await Brand.find(filter)
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                count: brands.length,
                data: brands
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

            const brand = await Brand.findOne({
                _id: req.params.id,
                superAdminId: hierarchy.superAdminId
            });

            if (!brand) {
                return res.status(404).json({
                    success: false,
                    message: "Brand not found"
                });
            }

            res.json({
                success: true,
                data: brand
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



router.put(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const allowedFields = [
                "name",
                "manufacturerName",
                "contactPerson",
                "phone",
                "email",
                "address",
                "gstin",
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

            const brand = await Brand.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                updateData,
                { new: true }
            );

            if (!brand) {
                return res.status(404).json({
                    success: false,
                    message: "Brand not found"
                });
            }

            res.json({
                success: true,
                message: "Brand updated successfully",
                data: brand
            });

        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "Brand name already exists"
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

            const brand = await Brand.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                { isActive: false },
                { returnDocument: "after" }
            );

            if (!brand) {
                return res.status(404).json({
                    success: false,
                    message: "Brand not found"
                });
            }

            res.json({
                success: true,
                message: "Brand deactivated successfully",
                data: brand
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