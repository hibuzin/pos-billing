const mongoose = require("mongoose");
const Customer = require("../models/customer");
const user = require("../models/user");
const Counter = require("../models/counter");
const { attachHierarchy } = require("../utils/hierarchy");



exports.createLoyalty = async (req, res) => {
    try {
        const { customerId, amount } = req.body;
        const { userId, superAdminId } = req.user;

        const amountNum = Number(amount);

        if (!amountNum || amountNum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid amount"
            });
        }


        const customer = await Customer.findOne({
            customerId,
            superAdminId
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found or not authorized"
            });
        }


        const points = Math.floor(amountNum / 100);

        customer.loyaltyPoints += points;
        customer.totalSpent += amountNum;
        customer.lastUpdatedBy = userId;

        await customer.save();

        res.json({
            success: true,
            message: "Loyalty points added",
            addedPoints: points,
            totalPoints: customer.loyaltyPoints
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}



exports.redeemLoyalty = async (req, res) => {
    try {
        const { customerId, points } = req.body;
        const { userId, superAdminId } = req.user;

        const pointsNum = Number(points);

        if (!pointsNum || pointsNum <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid points"
            });
        }


        const customer = await Customer.findOne({
            customerId,
            superAdminId
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found or not authorized"
            });
        }

        if (customer.loyaltyPoints < pointsNum) {
            return res.status(400).json({
                success: false,
                message: "Not enough loyalty points"
            });
        }

        customer.loyaltyPoints -= pointsNum;
        customer.lastUpdatedBy = userId;

        await customer.save();

        res.json({
            success: true,
            message: "Points redeemed successfully",
            discount: pointsNum,
            remainingPoints: customer.loyaltyPoints
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}


exports.getAllLoyaltyCustomers = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const customers = await Customer.find({
            superAdminId: hierarchy.superAdminId
        })
            .select("customerId name phone loyaltyPoints totalSpent")
            .sort({ loyaltyPoints: -1 })
            .lean();

        const data = customers.map(customer => ({
            ...customer,

            loyaltyPoints:
                Number(customer.loyaltyPoints || 0),

            redeemValue: Number(customer.loyaltyPoints || 0).toFixed(2),

            totalSpent:
                Number(customer.totalSpent || 0)
        }));

        res.json({
            success: true,
            count: data.length,
            data
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
};


exports.loyaltycustomerbyid = async (req, res) => {
    try {
        const { superAdminId } = req.user;

        const customer = await Customer.findOne({
            customerId: req.params.customerId,
            superAdminId: superAdminId
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found or not authorized"
            });
        }

        res.json({
            success: true,
            customerId: customer.customerId,
            name: customer.name,
            loyaltyPoints: customer.loyaltyPoints,
            redeemValue: Number(customer.loyaltyPoints || 0).toFixed(2),

            totalSpent: customer.totalSpent
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}


exports.resetLoyaltyPoints = async (req, res) => {
    try {
        const { customerId } = req.body;
        const { userId, superAdminId } = req.user;

        const customer = await Customer.findOne({
            customerId,
            superAdminId
        });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: "Customer not found"
            });
        }

        customer.loyaltyPoints = 0;
        customer.lastUpdatedBy = userId;

        await customer.save();

        res.json({
            success: true,
            message: "Loyalty points reset successfully",
            loyaltyPoints: customer.loyaltyPoints
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Server error",
            error: err.message
        });
    }
}