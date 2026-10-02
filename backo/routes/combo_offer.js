const express = require("express");
const router = express.Router();


const authorize = require("../middleware/role");
const { verifyToken } = require("../middleware/auth");


const {
    createComboOffer,
    searchComboOffers,
    getAllComboOffers,
    getComboOfferById,
    updateComboOffer,
    deleteComboOffer
} = require("../controllers/combo_offer");


router.post(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    createComboOffer
);

router.get("/search", 
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    searchComboOffers);

router.get(
    "/",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getAllComboOffers
);


router.get(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    getComboOfferById
);


router.put(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
    updateComboOffer
);


router.delete(
    "/:id",
    verifyToken,
    authorize("super_admin", "admin", "cashier"),
   deleteComboOffer
);

module.exports = router;