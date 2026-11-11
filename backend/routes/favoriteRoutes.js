const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getFavorites, addFavorite, removeFavorite } = require("../controllers/favoriteController");
const router = express.Router();
router.use(protect);
router.get("/", getFavorites);
router.post("/:outletId", addFavorite);
router.delete("/:outletId", removeFavorite);
module.exports = router;
