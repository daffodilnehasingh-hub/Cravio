const router = require("express").Router();
const { protect, requireRole } = require("../middleware/authMiddleware");
const controller = require("../controllers/deliveryPartnerController");

router.use(protect);
router.get("/me", requireRole("delivery"), controller.getMyDeliveryProfile);
router.patch("/me/availability", requireRole("delivery"), controller.updateMyAvailability);
router.get("/", requireRole("admin"), controller.listPartners);
router.post("/", requireRole("admin"), controller.createPartner);
router.patch("/:id", requireRole("admin"), controller.updatePartner);

module.exports = router;
