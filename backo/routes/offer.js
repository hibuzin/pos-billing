const express = require("express");

const router = express.Router();

const { verifyToken } = require("../middleware/auth");
const authorize = require("../middleware/role");

const {
    createOffer,
    getOffers,
     getOfferById,
    getActiveOffers,
    updateOffer,
    toggleOfferStatus,
    deleteOffer
} = require("../controllers/offer");



router.post("/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createOffer);

router.get("/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getOffers);

router.get("/active",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getActiveOffers);

router.get("/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getOfferById);

router.put("/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateOffer);

router.put("/:id/status",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    toggleOfferStatus);

router.delete("/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    deleteOffer);

module.exports = router;