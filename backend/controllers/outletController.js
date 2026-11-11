const Outlet=require("../models/Outlet");
const Order=require("../models/Order");
const cleanId=v=>String(v||"").trim();
exports.publicList=async(req,res,next)=>{try{const outlets=await Outlet.find({isActive:true,$or:[{approvalStatus:"approved"},{approvalStatus:{$exists:false}}]}).select("-managedBy");res.json({outlets})}catch(e){next(e)}};
exports.publicMenu=async(req,res,next)=>{try{const outlet=await Outlet.findOne({outletId:req.params.outletId,isActive:true,$or:[{approvalStatus:"approved"},{approvalStatus:{$exists:false}}]}).select("-managedBy");if(!outlet)return res.status(404).json({message:"Outlet not found."});outlet.items.forEach(item=>{if(Number(item.stockQuantity||0)<=0)item.available=false});res.json({outlet})}catch(e){next(e)}};
exports.manageList=async(req,res,next)=>{try{const filter=req.user.role==="admin"?{}:{outletId:{$in:req.user.managedOutletIds||[]}};res.json({outlets:await Outlet.find(filter).sort({name:1})})}catch(e){next(e)}};
exports.create=async(req,res,next)=>{try{const {outletId,name,type,description,cuisine,image,delivery=true,pickup=true}=req.body;if(!cleanId(outletId)||!name||!["restaurant","canteen"].includes(type))return res.status(400).json({message:"Outlet ID, name and valid type are required."});const outlet=await Outlet.create({outletId:cleanId(outletId),name,type,description,cuisine,image,delivery,pickup});res.status(201).json({message:"Outlet created.",outlet})}catch(e){if(e.code===11000)return res.status(409).json({message:"Outlet ID already exists."});next(e)}};
exports.update=async(req,res,next)=>{try{const outlet=await Outlet.findOne({outletId:req.params.outletId});if(!outlet)return res.status(404).json({message:"Outlet not found."});if(req.user.role==="vendor"&&!(req.user.managedOutletIds||[]).includes(outlet.outletId))return res.status(403).json({message:"This outlet is not assigned to you."});const fields=["name","description","cuisine","image","delivery","pickup","isActive"];fields.forEach(k=>{if(req.body[k]!==undefined)outlet[k]=req.body[k]});await outlet.save();res.json({message:"Outlet updated.",outlet})}catch(e){next(e)}};
exports.addItem=async(req,res,next)=>{try{const outlet=await Outlet.findOne({outletId:req.params.outletId});if(!outlet)return res.status(404).json({message:"Outlet not found."});if(req.user.role==="vendor"&&!(req.user.managedOutletIds||[]).includes(outlet.outletId))return res.status(403).json({message:"This outlet is not assigned to you."});const {itemId,name,category,price,description,image,isVeg=true,stockQuantity=50,lowStockThreshold=5}=req.body;if(!cleanId(itemId)||!name||!category||!Number.isFinite(Number(price))||Number(price)<1)return res.status(400).json({message:"Item ID, name, category and a valid price are required."});if(outlet.items.some(x=>x.itemId===cleanId(itemId)))return res.status(409).json({message:"Item ID already exists in this outlet."});if(!Number.isInteger(Number(stockQuantity))||Number(stockQuantity)<0||!Number.isInteger(Number(lowStockThreshold))||Number(lowStockThreshold)<0)return res.status(400).json({message:"Stock and low-stock threshold must be non-negative whole numbers."});outlet.items.push({itemId:cleanId(itemId),name,category,price:Number(price),description,image,isVeg,stockQuantity:Number(stockQuantity),lowStockThreshold:Number(lowStockThreshold),available:Number(stockQuantity)>0});await outlet.save();res.status(201).json({message:"Menu item added.",outlet})}catch(e){next(e)}};
exports.updateItem=async(req,res,next)=>{try{const outlet=await Outlet.findOne({outletId:req.params.outletId});if(!outlet)return res.status(404).json({message:"Outlet not found."});if(req.user.role==="vendor"&&!(req.user.managedOutletIds||[]).includes(outlet.outletId))return res.status(403).json({message:"This outlet is not assigned to you."});const item=outlet.items.find(x=>x.itemId===req.params.itemId);if(!item)return res.status(404).json({message:"Menu item not found."});["name","category","description","image","available","isVeg"].forEach(k=>{if(req.body[k]!==undefined)item[k]=req.body[k]});if(req.body.price!==undefined){if(!Number.isFinite(Number(req.body.price))||Number(req.body.price)<1)return res.status(400).json({message:"Price must be at least ₹1."});item.price=Number(req.body.price)}if(req.body.available===true&&Number(item.stockQuantity||0)<=0)return res.status(400).json({message:"Add stock before enabling this menu item."});await outlet.save();res.json({message:"Menu item updated.",item})}catch(e){next(e)}};
exports.removeItem=async(req,res,next)=>{try{const outlet=await Outlet.findOne({outletId:req.params.outletId});if(!outlet)return res.status(404).json({message:"Outlet not found."});if(req.user.role==="vendor"&&!(req.user.managedOutletIds||[]).includes(outlet.outletId))return res.status(403).json({message:"This outlet is not assigned to you."});outlet.items=outlet.items.filter(x=>x.itemId!==req.params.itemId);await outlet.save();res.json({message:"Menu item removed."})}catch(e){next(e)}};

exports.inventoryList=async(req,res,next)=>{try{const filter=req.user.role==="admin"?{}:{outletId:{$in:req.user.managedOutletIds||[]}};const outlets=await Outlet.find(filter).select("outletId name type items.itemId items.name items.category items.stockQuantity items.lowStockThreshold items.available").sort({name:1});const items=[];outlets.forEach(o=>o.items.forEach(i=>items.push({outletId:o.outletId,outletName:o.name,type:o.type,itemId:i.itemId,name:i.name,category:i.category,stockQuantity:Number(i.stockQuantity||0),lowStockThreshold:Number(i.lowStockThreshold??5),available:i.available})));res.json({items,lowStockItems:items.filter(i=>i.stockQuantity<=i.lowStockThreshold)})}catch(e){next(e)}};
exports.updateStock=async(req,res,next)=>{try{const outlet=await Outlet.findOne({outletId:req.params.outletId});if(!outlet)return res.status(404).json({message:"Outlet not found."});if(req.user.role==="vendor"&&!(req.user.managedOutletIds||[]).includes(outlet.outletId))return res.status(403).json({message:"This outlet is not assigned to you."});const item=outlet.items.find(i=>i.itemId===req.params.itemId);if(!item)return res.status(404).json({message:"Menu item not found."});const stock=Number(req.body.stockQuantity),threshold=req.body.lowStockThreshold===undefined?item.lowStockThreshold:Number(req.body.lowStockThreshold);if(!Number.isInteger(stock)||stock<0||stock>100000||!Number.isInteger(threshold)||threshold<0||threshold>100000)return res.status(400).json({message:"Stock and low-stock threshold must be whole numbers between 0 and 100000."});item.stockQuantity=stock;item.lowStockThreshold=threshold;if(stock===0)item.available=false;else if(req.body.available!==undefined)item.available=Boolean(req.body.available);await outlet.save();res.json({message:"Inventory updated.",item:{itemId:item.itemId,name:item.name,stockQuantity:item.stockQuantity,lowStockThreshold:item.lowStockThreshold,available:item.available}})}catch(e){next(e)}};

// Homepage recommendations are built from real outlet menus and completed order history.
async function getRecommendedItems(customerId=null){
  const match={status:{$nin:["cancelled","payment_pending"]}};
  if(customerId) match.customer=customerId;
  const sold=await Order.aggregate([
    {$match:match},
    {$unwind:"$items"},
    {$group:{_id:{outletId:"$outlet.outletId",itemId:"$items.itemId"},quantitySold:{$sum:"$items.quantity"}}},
    {$sort:{quantitySold:-1}},
    {$limit:60}
  ]);
  const outlets=await Outlet.find({isActive:true,$or:[{approvalStatus:"approved"},{approvalStatus:{$exists:false}}]}).select("outletId name type items").lean();
  const byOutlet=new Map(outlets.map(o=>[String(o.outletId),o]));
  const results=[];
  for(const row of sold){
    const outlet=byOutlet.get(String(row._id.outletId));
    const item=outlet?.items?.find(x=>String(x.itemId)===String(row._id.itemId));
    if(!item||item.available===false||Number(item.stockQuantity||0)<=0) continue;
    results.push({id:String(item.itemId),outletId:String(outlet.outletId),outletName:outlet.name,outletType:outlet.type,name:item.name,category:item.category,price:item.price,isVeg:item.isVeg,image:item.image||"",quantitySold:row.quantitySold,reason:customerId?"Based on your order history":"Popular with Cravio customers"});
    if(results.length>=12) break;
  }
  // A new platform or new outlet may have no sales yet: show available menu items.
  if(!results.length){
    for(const outlet of outlets){
      for(const item of (outlet.items||[])){
        if(item.available===false||Number(item.stockQuantity||0)<=0) continue;
        results.push({id:String(item.itemId),outletId:String(outlet.outletId),outletName:outlet.name,outletType:outlet.type,name:item.name,category:item.category,price:item.price,isVeg:item.isVeg,image:item.image||"",quantitySold:0,reason:"Fresh pick"});
        if(results.length>=12) break;
      }
      if(results.length>=12) break;
    }
  }
  return results;
}
exports.publicRecommendations=async(req,res,next)=>{try{const recommendations=await getRecommendedItems();res.json({recommendations,mode:"popular"})}catch(e){next(e)}};
exports.personalRecommendations=async(req,res,next)=>{try{const recommendations=await getRecommendedItems(req.user._id);res.json({recommendations,mode:recommendations.some(x=>x.reason==="Based on your order history")?"personalized":"popular"})}catch(e){next(e)}};


// Apply a validated percentage price adjustment to selected menu items.
exports.bulkUpdatePrices=async(req,res,next)=>{try{
  const outlet=await Outlet.findOne({outletId:req.params.outletId});
  if(!outlet)return res.status(404).json({message:"Outlet not found."});
  if(req.user.role==="vendor"&&!(req.user.managedOutletIds||[]).includes(outlet.outletId))return res.status(403).json({message:"This outlet is not assigned to you."});
  const {itemIds,percentage}=req.body;
  if(!Array.isArray(itemIds)||!itemIds.length||itemIds.length>200||itemIds.some(x=>typeof x!=="string"||!x.trim()))return res.status(400).json({message:"Select between 1 and 200 valid menu items."});
  const pct=Number(percentage);
  if(!Number.isFinite(pct)||pct < -90||pct > 200)return res.status(400).json({message:"Percentage must be between -90 and 200."});
  const selected=new Set(itemIds.map(x=>x.trim()));
  const found=outlet.items.filter(i=>selected.has(i.itemId));
  if(found.length!==selected.size)return res.status(400).json({message:"One or more selected menu items were not found."});
  for(const item of found){const price=Math.round(Number(item.price)*(1+pct/100)*100)/100;if(!Number.isFinite(price)||price<1)return res.status(400).json({message:`Price for ${item.name} cannot be below ₹1.`});}
  found.forEach(item=>{item.price=Math.round(Number(item.price)*(1+pct/100)*100)/100;});
  await outlet.save();
  res.json({message:`Updated prices for ${found.length} menu items.`,updatedCount:found.length});
}catch(e){next(e)}};
