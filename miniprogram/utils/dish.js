// 加菜
function selectDish(dishes,dishId){
  let dish=dishes.find(item=>{return item.dishId==dishId;});
  if(dish && dish.dishCount<1)
    dish.dishCount++;
  return dishes;
}
// 减菜
function cancelDish(dishes,dishId){
  let dish=dishes.find(item=>{return item.dishId==dishId;});
  if(dish && dish.dishCount>0)
    dish.dishCount--;
  return dishes;
}
// 清空购物车
function clearCart(dishes){
  dishes.forEach(item=>{item.dishCount=0;});
  return dishes;
}
module.exports={
  selectDish,
  cancelDish,
  clearCart
}