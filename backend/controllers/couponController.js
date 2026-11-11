const Coupon=require("../models/Coupon");
exports.validate=async(req,res,next)=>{try{
 const code=String(req.body.code||"").trim().toUpperCase(),subtotal=Number(req.body.subtotal),outletType=req.body.outletType;
 if(!code||!Number.isFinite(subtotal)||subtotal<0)return res.status(400).json({message:"Enter a coupon and valid cart subtotal."});
 const c=await Coupon.findOne({code});
 const now=new Date();
 if(!c||!c.active||c.startsAt>now||(c.expiresAt&&c.expiresAt<now)||(c.usageLimit!==null&&c.usedCount>=c.usageLimit))return res.status(400).json({message:"This coupon is unavailable or expired."});
 if(subtotal<c.minOrderValue)return res.status(400).json({message:`Minimum order value is ₹${c.minOrderValue}.`});
 if(c.outletType!=="all"&&c.outletType!==outletType)return res.status(400).json({message:"This coupon is not valid for this outlet type."});
 let discount=c.discountType==="percentage"?subtotal*c.discountValue/100:c.discountValue;
 if(c.maxDiscount!==null)discount=Math.min(discount,c.maxDiscount);
 discount=Math.min(subtotal,Math.round(discount*100)/100);
 res.json({valid:true,code:c.code,discount,discountType:c.discountType,discountValue:c.discountValue,description:c.description});
}catch(e){next(e)}};
exports.list=async(req,res,next)=>{try{res.json({coupons:await Coupon.find().sort({createdAt:-1})})}catch(e){next(e)}};
exports.create=async(req,res,next)=>{try{
 const data={...req.body,code:String(req.body.code||"").trim().toUpperCase()};
 const coupon=await Coupon.create(data);res.status(201).json({message:"Coupon created.",coupon});
}catch(e){if(e.code===11000)return res.status(409).json({message:"That coupon code already exists."});next(e)}};
exports.update=async(req,res,next)=>{try{
 const allowed=["description","discountType","discountValue","maxDiscount","minOrderValue","outletType","usageLimit","startsAt","expiresAt","active"];
 const changes={};allowed.forEach(k=>{if(req.body[k]!==undefined)changes[k]=req.body[k]});
 const coupon=await Coupon.findByIdAndUpdate(req.params.id,changes,{new:true,runValidators:true});
 if(!coupon)return res.status(404).json({message:"Coupon not found."});
 res.json({message:"Coupon updated.",coupon});
}catch(e){next(e)}};
