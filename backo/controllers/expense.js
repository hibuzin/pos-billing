const mongoose = require("mongoose");

const Expense = require("../models/expense");
const Session = require("../models/session");
const Counter = require("../models/counter");
const { attachHierarchy } = require("../utils/hierarchy");

const getNextExpenseNo = async (superAdminId) => {
    const result = await Counter.findOneAndUpdate(
        { name: `expense_${superAdminId}` },
        { $inc: { seq: 1 } },
        { returnDocument: "after", upsert: true }
    );

    return `EXP-${String(result.seq).padStart(5, "0")}`;
};


exports.createExpense = async (req, res) => {
    try {
        const {
            name,
            originalInvoiceNo,
            expenseDate,
            amount,
            paymentMode,
            note
        } = req.body;

        if (!name || !expenseDate || amount === undefined || amount === null) {
            return res.status(400).json({
                success: false,
                message: "Name, date and amount are required"
            });
        }

        const hierarchy = attachHierarchy(req.user);
        const userId = req.user.userId || req.user.id;

        const finalDate = new Date(expenseDate);

        if (isNaN(finalDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense date"
            });
        }

        const expenseAmount = Number(amount);

        if (isNaN(expenseAmount) || expenseAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense amount"
            });
        }

        const session = await Session.findOne({
            cashier: userId,
            superAdminId: hierarchy.superAdminId,
            status: "open"
        });

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "No active session found. Please start a session first."
            });
        }

        const expenseNo = await getNextExpenseNo(
            hierarchy.superAdminId
        );

        const expense = await Expense.create({
            expenseNo,
            name: name.trim(),
            originalInvoiceNo: originalInvoiceNo || "",
            expenseDate: finalDate,
            amount: expenseAmount,
            paymentMode: paymentMode || "cash",
            note: note || "",

            ...hierarchy,
            createdBy: userId
        });

        session.cashMovements.push({
            type: "cash_out",
            amount: expenseAmount,
            reason: `Expense - ${expense.name}`,
            remarks: `Expense No: ${expense.expenseNo}`,
            createdAt: new Date()
        });

        session.cashOut =
            Number(session.cashOut || 0) + expenseAmount;

        await session.save();

        return res.status(201).json({
            success: true,
            message: "Expense created and cash out recorded successfully",
            data: {
                id: expense._id,
                expenseNo: expense.expenseNo,
                name: expense.name,
                originalInvoiceNo: expense.originalInvoiceNo,

                expenseDate: expense.expenseDate
                    ? new Date(expense.expenseDate)
                        .toLocaleDateString("en-CA")
                    : "",

                amount: expense.amount,
                paymentMode: expense.paymentMode,
                note: expense.note,

                cashOut: session.cashOut
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getAllExpenses = async (req, res) => {
    try {
        const hierarchy = attachHierarchy(req.user);

        const expenses = await Expense.find({
            superAdminId: hierarchy.superAdminId
        })
            .populate("name")
            .sort({ expenseDate: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: "Expenses fetched successfully",
            total: expenses.length,
            data: expenses.map(expense => ({
                id: expense._id,
                expenseNo: expense.expenseNo,
                name: expense.name,

               

                originalInvoiceNo: expense.originalInvoiceNo,

                expenseDate: expense.expenseDate
                    ? new Date(expense.expenseDate)
                        .toLocaleDateString("en-CA")
                    : "",

                amount: expense.amount,
                paymentMode: expense.paymentMode,
                note: expense.note,

                createdAt: expense.createdAt,
                updatedAt: expense.updatedAt
            }))
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.getExpenseById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense id"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const expense = await Expense.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        }).populate("name");

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Expense fetched successfully",
            data: {
                id: expense._id,
                expenseNo: expense.expenseNo,
                name: expense.name,

                originalInvoiceNo: expense.originalInvoiceNo,

                expenseDate: expense.expenseDate
                    ? new Date(expense.expenseDate)
                        .toLocaleDateString("en-CA")
                    : "",

                amount: expense.amount,
                paymentMode: expense.paymentMode,
                note: expense.note,

                createdAt: expense.createdAt,
                updatedAt: expense.updatedAt
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};


exports.updateExpense = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            name,
            originalInvoiceNo,
            expenseDate,
            amount,
            paymentMode,
            note
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense id"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const expense = await Expense.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        if (name !== undefined) {
            if (!name || !name.trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Expense name is required"
                });
            }

            expense.name = name.trim();
        }

        
        if (expenseDate !== undefined) {
            const finalDate = new Date(expenseDate);

            if (isNaN(finalDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense date"
                });
            }

            expense.expenseDate = finalDate;
        }

        if (amount !== undefined) {
            const expenseAmount = Number(amount);

            if (isNaN(expenseAmount) || expenseAmount <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid expense amount"
                });
            }

            expense.amount = expenseAmount;
        }

        if (originalInvoiceNo !== undefined) {
            expense.originalInvoiceNo = originalInvoiceNo || "";
        }

        if (paymentMode !== undefined) {
            expense.paymentMode = paymentMode;
        }

        if (note !== undefined) {
            expense.note = note || "";
        }

        await expense.save();

        const updatedExpense = await Expense.findById(expense._id)
            .populate("name");

        return res.status(200).json({
            success: true,
            message: "Expense updated successfully",
            data: {
                id: updatedExpense._id,
                expenseNo: updatedExpense.expenseNo,
                name: updatedExpense.name,

              

                originalInvoiceNo: updatedExpense.originalInvoiceNo,

                expenseDate: updatedExpense.expenseDate
                    ? new Date(updatedExpense.expenseDate)
                        .toLocaleDateString("en-CA")
                    : "",

                amount: updatedExpense.amount,
                paymentMode: updatedExpense.paymentMode,
                note: updatedExpense.note
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

exports.deleteExpense = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid expense id"
            });
        }

        const hierarchy = attachHierarchy(req.user);

        const expense = await Expense.findOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: "Expense not found"
            });
        }

        await Expense.deleteOne({
            _id: id,
            superAdminId: hierarchy.superAdminId
        });

        return res.status(200).json({
            success: true,
            message: "Expense deleted successfully",
            data: {
                id: expense._id,
                expenseNo: expense.expenseNo,
                name: expense.name
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

