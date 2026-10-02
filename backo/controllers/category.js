const mongoose = require("mongoose");
const Category = require("../models/category");
const { attachHierarchy } = require("../utils/hierarchy");

exports.createCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Category name required"
            });
        }

        const hierarchy = attachHierarchy(req.user);
        const userId = req.user.userId || req.user.id;

        const exists = await Category.findOne({
            name: name.trim(),
            superAdminId: hierarchy.superAdminId
        });

        if (exists) {
            return res.status(400).json({
                success: false,
                message: "Category already exists"
            });
        }

        const category = await Category.create({
            name: name.trim(),
            ...hierarchy,
            createdBy: userId,
            roleCreatedBy: req.user.role
        });

        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: category
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.getCategories = async (req, res) => {
    try {

        const hierarchy = attachHierarchy(req.user);

        const categories = await Category.find({
            superAdminId: hierarchy.superAdminId
        })
            .sort({ createdAt: -1 })
            

        return res.status(200).json({
            success: true,
            count: categories.length,
            data: categories
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });

    }
};


exports.getCategoryById = async (req, res) => {
    try {

        const { id } = req.params;

        const hierarchy = attachHierarchy(req.user);

        const category = await Category.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: category
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });

    }
};


exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, isActive } = req.body;

        const hierarchy = attachHierarchy(req.user);

        const category = await Category.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        if (name) {
            const exists = await Category.findOne({
                _id: { $ne: id },
                name: name.trim(),
                superAdminId: hierarchy.superAdminId
            });

            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: "Category already exists"
                });
            }

            category.name = name.trim();
        }

        if (typeof isActive === "boolean") {
            category.isActive = isActive;
        }

        category.updatedBy = req.user.userId || req.user.id;

        await category.save();

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: category
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};

exports.deleteCategory = async (req, res) => {
    try {

        const { id } = req.params;

        const hierarchy = attachHierarchy(req.user);

        const category = await Category.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        await Category.deleteOne({
            _id: category._id
        });

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully"
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });

    }
};