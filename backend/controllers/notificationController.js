const Notification = require("../models/Notification");
exports.list = async (req,res,next)=>{try{
 const notifications=await Notification.find({user:req.user.id}).sort({createdAt:-1}).limit(100);
 const unreadCount=await Notification.countDocuments({user:req.user.id,readAt:null});
 res.json({notifications,unreadCount});
}catch(e){next(e)}};
exports.markRead = async (req,res,next)=>{try{
 const n=await Notification.findOneAndUpdate({_id:req.params.id,user:req.user.id,readAt:null},{readAt:new Date()},{new:true});
 if(!n)return res.status(404).json({message:"Notification not found or already read."});
 res.json({notification:n});
}catch(e){next(e)}};
exports.markAllRead = async(req,res,next)=>{try{
 await Notification.updateMany({user:req.user.id,readAt:null},{$set:{readAt:new Date()}});
 res.json({message:"All notifications marked as read."});
}catch(e){next(e)}};
