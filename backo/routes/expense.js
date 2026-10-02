const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");


const {
    createExpense,
    getAllExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense

} = require("../controllers/expense");


router.post(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createExpense
);

router.get("/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getAllExpenses
);


router.get("/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getExpenseById);


router.put("/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateExpense);


router.delete("/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deleteExpense);

module.exports = router;