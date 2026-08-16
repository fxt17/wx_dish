// utils/ingredient.js
const app=getApp();
const dateUtil=require("./date.js");

// 冰箱状态更新,得到保质截止期,保质状态,文本(ExpireDate\ExpireStatus\ExpireText)
function updateIngredientExpire(ingredients){
  ingredients.forEach(item=>{
    if(!item.ingredientExpireDate){item.ingredientExpireDate=calculateExpireDate(item);}
    let result=getExpireStatus(item.ingredientExpireDate);
    item.ingredientExpireStatus=result.status;
    item.ingredientExpireText=result.text;
  });
}
// 根据购买日期和保质期计算过期日期
function calculateExpireDate(ingredient){
  let produceDate;
  if(ingredient.ingredientProduceDate){produceDate=new Date(ingredient.ingredientProduceDate);}
  else{produceDate=new Date(ingredient.ingredientPurchaseDate);}//无生产日期的默认为购买日期
  let shelfLife=Number(ingredient.ingredientShelfLife);
  if(!shelfLife){//无保质期的
    switch(ingredient.ingredientCategory){
      case "蔬菜":
      case "水果":
      case "蛋奶":shelfLife=7;break;
      case "肉类":shelfLife=30;break;
      case "酒水":shelfLife=60;break;
      default:shelfLife=3;
    }
  }
  produceDate.setDate(produceDate.getDate() + shelfLife);
  return dateUtil.formatDate(produceDate);// 格式化 yyyy-mm-dd
}
// 根据过期日期判断状态
function getExpireStatus(ingredientExpireDate){
  let today = new Date();
  let expire = new Date(ingredientExpireDate);
  // 只比较日期，避免时间造成误差
  today.setHours(0,0,0,0);
  expire.setHours(0,0,0,0);
  let days = Math.ceil((expire - today)/(1000*60*60*24));
  if(days < 0){return {status:"expire-danger",text:"已过期"};}
  if(days <= 3){return {status:"expire-warning",text:"剩余"+days+"天"};}
  return {status:"expire-normal",text:"剩余"+days+"天"};
}
// 根据菜单和库存得到缺少食材列表shortageList、consumeList、orderList
function consumeIngredients(fridge,dishes){
  let consumeList=[];//库存消耗记录
  let shortageList=[];//不足食材,缺少的食材
  let orderList=[];//选择的菜品

  dishes.forEach(dish=>{
    if(dish.dishCount>0){
      // orderList.push({dishId:dish.dishId,dishImage:dish.dishImage,dishName:dish.dishName,dishCount:dish.dishCount});// 保存订单快照
      orderList.push({dish});
      dish.dishIngredients.forEach(ingredient=>{
        let match=ingredient.amount.match(/\d+/);
        if(!match)return;  
        let needName=ingredient.name;
        // let needCount=parseInt(ingredient.amount)*dish.diyshCount;
        let needCount=parseInt(match[0])*dish.dishCount;
        let needUnit=ingredient.amount.replace(/\d+/,"");//食谱中所需食材的单位
        //-------------------------
        // 找可用食材
        //-------------------------
        let fridgeIngredients=fridge.filter(item=>item.ingredientName===needName&&item.ingredientUnit===needUnit&&item.ingredientExpireStatus!=="expire-danger");//同名,同单位,非过期食材
        //-------------------------
        // 根据库存输出 消耗表单consume 与 缺货/购买表单shortage
        //-------------------------
        let fridgeIngredientCount=0;//总库存
        fridgeIngredients.forEach(item=>{fridgeIngredientCount+=item.ingredientCount;});//统计可用食材的总库存
        let sameIngredient=consumeList.find(item=>item.name===needName&&item.unit===needUnit);// 是否有相同的食材
        let sameShortage=shortageList.find(item=>item.name===needName&&item.unit===needUnit);// 是否有相同的食材
        if(sameIngredient){// 有相同需求的食材
          if(fridgeIngredientCount-sameIngredient.count>=needCount)//库存充足
            sameIngredient.count+=needCount;// 统计总共需要的数量
          else{// 库存不足
            needCount+=sameIngredient.count-fridgeIngredientCount;
            sameIngredient.count=fridgeIngredientCount;// 消耗剩余库存
            if(sameShortage)
              sameShortage.count+=needCount;
            else
              shortageList.push({name:needName,count:needCount,unit:needUnit});// 不足的食材加购
          }
        }
        else{// 无相同需求的食材
          if(fridgeIngredientCount>=needCount){//库存充足
            consumeList.push({name:needName,count:needCount,unit:needUnit});
          }
          else{// 库存不足
            needCount-=fridgeIngredientCount;
            if(fridgeIngredientCount>0)
              consumeList.push({name:needName,count:fridgeIngredientCount,unit:needUnit});
            if(sameShortage)
              sameShortage.count+=needCount;
            else
              shortageList.push({name:needName,count:needCount,unit:needUnit});// 不足的食材加购
          }
        }
      })
    }
  });
  return {consumeList,shortageList,orderList};
}

module.exports={updateIngredientExpire,calculateExpireDate, getExpireStatus, consumeIngredients}