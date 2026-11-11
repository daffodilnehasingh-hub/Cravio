// Demo catalogue matching frontend/js/menu.js exactly.
// The API uses these server-side prices; client-submitted prices are never trusted.
const outlets = {
  "1": { name: "The Urban Tadka", type: "restaurant", delivery: true, items: {
    "101": { name: "Paneer Tikka", price: 149, isVeg: true },
    "102": { name: "Crispy Corn", price: 119, isVeg: true },
    "103": { name: "Chicken Tikka", price: 189, isVeg: false },
    "104": { name: "Paneer Butter Masala", price: 199, isVeg: true },
    "105": { name: "Dal Tadka", price: 139, isVeg: true },
    "106": { name: "Butter Chicken", price: 229, isVeg: false },
    "107": { name: "Butter Naan", price: 45, isVeg: true },
    "108": { name: "Jeera Rice", price: 119, isVeg: true }
  }},
  "2": { name: "Campus Cafe", type: "canteen", delivery: false, items: {
    "201": { name: "Veg Grilled Sandwich", price: 55, isVeg: true },
    "202": { name: "Peri Peri Fries", price: 79, isVeg: true },
    "203": { name: "Cheese Maggi", price: 60, isVeg: true },
    "204": { name: "Mini Veg Thali", price: 99, isVeg: true },
    "205": { name: "Egg Fried Rice", price: 89, isVeg: false },
    "206": { name: "Cold Coffee", price: 65, isVeg: true },
    "207": { name: "Fresh Lime Soda", price: 40, isVeg: true }
  }},
  "3": { name: "Biryani Junction", type: "restaurant", delivery: true, items: {
    "301": { name: "Chicken Dum Biryani", price: 179, isVeg: false },
    "302": { name: "Veg Hyderabadi Biryani", price: 139, isVeg: true },
    "303": { name: "Chicken Seekh Kebab", price: 159, isVeg: false },
    "304": { name: "Paneer 65", price: 129, isVeg: true }
  }},
  "4": { name: "Techie Treats", type: "canteen", delivery: true, items: {
    "401": { name: "Paneer Kathi Roll", price: 89, isVeg: true },
    "402": { name: "Veg Momos", price: 69, isVeg: true },
    "403": { name: "Chicken Momos", price: 89, isVeg: false },
    "404": { name: "Corn Cheese Sandwich", price: 79, isVeg: true }
  }},
  "5": { name: "Olive & Oregano", type: "restaurant", delivery: true, items: {
    "501": { name: "Margherita Pizza", price: 199, isVeg: true },
    "502": { name: "Farmhouse Pizza", price: 249, isVeg: true },
    "503": { name: "Penne Alfredo", price: 189, isVeg: true },
    "504": { name: "Arrabbiata Pasta", price: 179, isVeg: true }
  }},
  "6": { name: "The Food Court", type: "canteen", delivery: true, items: {
    "601": { name: "South Indian Meal", price: 110, isVeg: true },
    "602": { name: "Veg Pulao", price: 85, isVeg: true },
    "603": { name: "Masala Dosa", price: 70, isVeg: true },
    "604": { name: "Samosa (2 pcs)", price: 30, isVeg: true }
  }}
};
module.exports = outlets;
