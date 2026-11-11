const router=require("express").Router();
const {protect}=require("../middleware/authMiddleware");
const {list,markRead,markAllRead}=require("../controllers/notificationController");
router.use(protect);router.get("/",list);router.patch("/read-all",markAllRead);router.patch("/:id/read",markRead);
module.exports=router;
