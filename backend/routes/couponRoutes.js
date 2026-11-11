const router=require("express").Router();const {protect,requireRole}=require("../middleware/authMiddleware");
const c=require("../controllers/couponController");
router.post("/validate",protect,c.validate);
router.use(protect,requireRole("admin"));router.get("/",c.list);router.post("/",c.create);router.patch("/:id",c.update);
module.exports=router;
