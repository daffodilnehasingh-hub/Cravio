const mongoose=require("mongoose");
const schema=new mongoose.Schema({
 code:{type:String,required:true,unique:true,uppercase:true,trim:true,match:/^[A-Z0-9_-]{3,24}$/},
 description:{type:String,trim:true,maxlength:160,default:""},
 discountType:{type:String,enum:["percentage","fixed"],default:"percentage"},
 discountValue:{type:Number,required:true,min:1},
 maxDiscount:{type:Number,min:0,default:null},
 minOrderValue:{type:Number,min:0,default:0},
 outletType:{type:String,enum:["all","restaurant","canteen"],default:"all"},
 usageLimit:{type:Number,min:1,default:null},
 usedCount:{type:Number,default:0,min:0},
 startsAt:{type:Date,default:Date.now},expiresAt:{type:Date,default:null},
 active:{type:Boolean,default:true}
},{timestamps:true});
module.exports=mongoose.model("Coupon",schema);
