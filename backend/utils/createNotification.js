const Notification=require("../models/Notification");
module.exports=async function createNotification(user,title,message,type="system",link=""){
 if(!user)return null;
 const notification=await Notification.create({user,title,message,type,link});
 const io=global.cravioIO;
 if(io)io.to(`user:${String(user)}`).emit("notification:new",{notification});
 return notification;
};
