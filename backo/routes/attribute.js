const express = require("express");
const router = express.Router();

const attribute = require("../models/attribute");
const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");
const { attachHierarchy } = require("../utils/hierarchy");



router.post(
    "/",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const { name, values } = req.body;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: "Attribute name is required"
                });
            }

            const hierarchy = attachHierarchy(req.user);

            const cleanValues = Array.isArray(values)
                ? values.map(v => String(v).trim()).filter(Boolean)
                : [];

            const exists = await Attribute.findOne({
                name: name.trim(),
                superAdminId: hierarchy.superAdminId
            });

            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: "Attribute already exists"
                });
            }

            const attribute = await Attribute.create({
                name: name.trim(),
                values: [...new Set(cleanValues)],
                ...hierarchy,
                createdBy: req.user.userId || req.user.id
            });

            res.status(201).json({
                success: true,
                message: "Attribute created successfully",
                data: attribute
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

            const attributes = await Attribute.find(filter)
                .sort({ createdAt: -1 });

            res.json({
                success: true,
                count: attributes.length,
                data: attributes
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

            const attribute = await Attribute.findOne({
                _id: req.params.id,
                superAdminId: hierarchy.superAdminId
            });

            if (!attribute) {
                return res.status(404).json({
                    success: false,
                    message: "Attribute not found"
                });
            }

            res.json({
                success: true,
                data: attribute
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
            const updateData = {};

            if (req.body.name !== undefined) {
                updateData.name = String(req.body.name).trim();
            }

            if (req.body.values !== undefined) {
                const cleanValues = Array.isArray(req.body.values)
                    ? req.body.values.map(v => String(v).trim()).filter(Boolean)
                    : [];

                updateData.values = [...new Set(cleanValues)];
            }

            if (req.body.isActive !== undefined) {
                updateData.isActive = req.body.isActive;
            }

            const attribute = await Attribute.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                updateData,
                { new: true }
            );

            if (!attribute) {
                return res.status(404).json({
                    success: false,
                    message: "Attribute not found"
                });
            }

            res.json({
                success: true,
                message: "Attribute updated successfully",
                data: attribute
            });

        } catch (err) {
            if (err.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "Attribute already exists"
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



router.post(
    "/:id/values",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const { value } = req.body;

            if (!value) {
                return res.status(400).json({
                    success: false,
                    message: "Value is required"
                });
            }

            const hierarchy = attachHierarchy(req.user);

            const attribute = await Attribute.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $addToSet: {
                        values: String(value).trim()
                    }
                },
                { new: true }
            );

            if (!attribute) {
                return res.status(404).json({
                    success: false,
                    message: "Attribute not found"
                });
            }

            res.json({
                success: true,
                message: "Attribute value added successfully",
                data: attribute
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



router.delete(
    "/:id/values/:value",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const attribute = await Attribute.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                {
                    $pull: {
                        values: req.params.value
                    }
                },
                { new: true }
            );

            if (!attribute) {
                return res.status(404).json({
                    success: false,
                    message: "Attribute not found"
                });
            }

            res.json({
                success: true,
                message: "Attribute value removed successfully",
                data: attribute
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



router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin"),
    async (req, res) => {
        try {
            const hierarchy = attachHierarchy(req.user);

            const attribute = await Attribute.findOneAndUpdate(
                {
                    _id: req.params.id,
                    superAdminId: hierarchy.superAdminId
                },
                { isActive: false },
                { new: true }
            );

            if (!attribute) {
                return res.status(404).json({
                    success: false,
                    message: "Attribute not found"
                });
            }

            res.json({
                success: true,
                message: "Attribute deactivated successfully",
                data: attribute
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