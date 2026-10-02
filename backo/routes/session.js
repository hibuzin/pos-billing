const express = require("express");
const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");


const {
    startSession,
    getAllSessions,
    getSessionsByDate,
    cashIn,
    cashOut,
    settleSession,
    getCurrentSession,
    endSession,
    getActiveSession,
    getMySessionHistory,
    getUserSessionHistory,
    todaySessions,
    sessionReport
} = require("../controllers/session");

router.post(
    "/start",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    startSession
);


router.get("/",
    verifyToken,
    authorize("super_admin"),
    getAllSessions);


router.get("/date",
    verifyToken,
    authorize("super_admin"),
    getSessionsByDate);


router.post("/cash-in",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    cashIn
);

router.post(
    "/cash-out",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    cashOut
);



router.get(
    "/current",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getCurrentSession
);

router.post(
    "/settle",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    settleSession
);



router.post(
    "/end",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    endSession
);

router.get("/active",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getActiveSession);

router.get("/history",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getMySessionHistory);


router.get(
    "/history/:userId",
    verifyToken,
    authorize("super_admin"),
    getUserSessionHistory
);

router.get(
    "/today",
    verifyToken,
    authorize("super_admin"),
    todaySessions
);

router.get(
    "/report",
    verifyToken,
    authorize("super_admin"),
    sessionReport
);

module.exports = router;