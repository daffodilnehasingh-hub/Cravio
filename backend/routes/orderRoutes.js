const express = require("express");
const { protect, requireRole } = require("../middleware/authMiddleware");
const {
  createOrder, verifyRazorpayPayment, failRazorpayPayment, getMyOrders, getOrderById, getAllOrders, updateOrderStatus,
  getDeliveryPartners, assignDeliveryPartner, getMyDeliveryOrders,
  updateDeliveryStatus, updateDeliveryLocation, cancelMyOrder,
  requestRefund, getRefundRequests, reviewRefundRequest
} = require("../controllers/orderController");
const router = express.Router();
router.use(protect);
router.post("/", createOrder);
router.post("/payment/verify", verifyRazorpayPayment);
router.post("/payment/fail", failRazorpayPayment);
router.get("/my", getMyOrders);
router.post("/:id/refund", requestRefund);
router.get("/refunds/manage", requireRole("admin"), getRefundRequests);
router.patch("/refunds/:id/review", requireRole("admin"), reviewRefundRequest);
router.patch("/:id/cancel", cancelMyOrder);
router.get("/manage", requireRole("admin", "vendor"), getAllOrders);
router.get("/delivery/partners", requireRole("admin", "vendor"), getDeliveryPartners);
router.get("/delivery/my", requireRole("delivery"), getMyDeliveryOrders);
router.patch("/:id/assign-delivery", requireRole("admin", "vendor"), assignDeliveryPartner);
router.patch("/delivery/:id/status", requireRole("delivery"), updateDeliveryStatus);
router.patch("/delivery/:id/location", requireRole("delivery"), updateDeliveryLocation);
router.get("/:id", getOrderById);
router.patch("/:id/status", requireRole("admin", "vendor"), updateOrderStatus);
module.exports = router;
