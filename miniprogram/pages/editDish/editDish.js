// pages/editDish/editDish.js
const app=getApp();
const categoryUtil=require("../../utils/category.js");
const seasonUtil=require("../../utils/season.js");

function decodeOptionValue(value){
  try{
    return decodeURIComponent(value || "");
  }
  catch(error){
    return value || "";
  }
}

function createEmptyDish(dishCategory){
  return {
    dishId:null,
    dishImage:"/images/myicons/食物.png",
    dishName:"",
    dishCount:0,
    dishOrderCount:0,
    dishRating:0,
    dishCategory:dishCategory,
    dishDescription:"",
    dishSeason:{
      startMonth:1,
      endMonth:12
    },
    dishIngredients:[],
    dishCookingSteps:[],
    likeCount:0,
    dislikeCount:0,
    canEvaluate:false
  };
}

Page({

  /**
   * 页面的初始数据
   */
  data: {
    dish:null,
    isNewDish:false,
    seasonMonthRanges:[
      seasonUtil.monthOptions,
      seasonUtil.monthOptions
    ],
    seasonPickerValue:[0, 11],
    dishSeasonText:"全年适宜",
    seasonEndYearText:"当年"
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options){
    const dishId=options.dishId;//接收编辑按键传递的详情页面菜品id
    const isNewDish=!dishId;
    let dish;

    if(dishId){//对已有食材进行编辑
      const sourceDish=app.globalData.dishes.find(item=>{return item.dishId==dishId;});//根据菜品id查找对应的菜品
      if(!sourceDish){
        wx.showToast({title:"菜品不存在",icon:"none"});
        setTimeout(()=>{wx.navigateBack();},1000);
        return;
      }
      dish=JSON.parse(JSON.stringify(sourceDish));// 注意复制一份
      dish.dishIngredients=Array.isArray(dish.dishIngredients)?dish.dishIngredients:[];
      dish.dishCookingSteps=Array.isArray(dish.dishCookingSteps)?dish.dishCookingSteps:[];
    }
    else{// 新增菜品
      const requestedCategory=decodeOptionValue(options.dishCategory);
      const dishCategory=requestedCategory!=="全部"&&categoryUtil.dishCategories.includes(requestedCategory)
        ? requestedCategory
        : "";
      dish=createEmptyDish(dishCategory);
    }

    const dishSeason=seasonUtil.normalizeSeason(dish.dishSeason);
    dish.dishSeason=dishSeason;
    this.setData({
      dish:dish,
      isNewDish:isNewDish,
      ingredientUnits:[...categoryUtil.ingredientUnits],
      dishCategories:[...categoryUtil.dishCategories],
      seasonPickerValue:[dishSeason.startMonth-1,dishSeason.endMonth-1],
      dishSeasonText:seasonUtil.formatSeason(dishSeason),
      seasonEndYearText:dishSeason.endMonth>=dishSeason.startMonth ? "当年" : "次年"
    });
    wx.setNavigationBarTitle({title:isNewDish?"新增菜谱":"菜品编辑"});
  },

  change_dishImage(){//修改菜品图片
    wx.chooseMedia({
     count:1,
     mediaType:["image"],
     success:(res)=>{
        let image=res.tempFiles[0].tempFilePath;
        this.setData({"dish.dishImage":image});
      }
    })
  },

  change_dishName(e){//修改菜品名称
    this.setData({"dish.dishName": e.detail.value});
  },

  change_dishCategory(e){// 修改当前菜品分类
    let index=e.detail.value;
    let category=this.data.dishCategories[index];
    this.setData({"dish.dishCategory":category});
  },

  preview_dishSeason(e){// 滚动时只更新右列的年份提示
    const value=e.detail.value;
    this.setData({
      seasonEndYearText:value[1]>=value[0] ? "当年" : "次年"
    });
  },

  reset_dishSeasonPreview(){// 取消选择后恢复已确认范围的年份提示
    const value=this.data.seasonPickerValue;
    this.setData({
      seasonEndYearText:value[1]>=value[0] ? "当年" : "次年"
    });
  },

  change_dishSeason(e){// 确认后再写入当前菜品
    const value=e.detail.value;
    const dishSeason={
      startMonth:Number(value[0])+1,
      endMonth:Number(value[1])+1
    };
    this.setData({
      "dish.dishSeason":dishSeason,
      seasonPickerValue:value,
      dishSeasonText:seasonUtil.formatSeason(dishSeason)
    });
  },

  change_dishDescription(e){// 修改当前菜品描述
    this.setData({"dish.dishDescription":e.detail.value});
  },

  change_dishIngredientName(e){//改变菜品所需食材名字
    let index=e.currentTarget.dataset.index;
    let value=e.detail.value.trim();// .trim去掉首尾空白字符
    this.setData({[`dish.dishIngredients[${index}].name`]:value});
  },

  change_dishIngredientCount(e){//改变菜品所需食材数量
    let index=e.currentTarget.dataset.index;
    this.setData({[`dish.dishIngredients[${index}].count`]:e.detail.value});
  },

  change_dishIngredientUnit(e){//改变菜品所需食材数量
    let index = e.currentTarget.dataset.index;
    let unitIndex = Number(e.detail.value);
    let unit = this.data.ingredientUnits[unitIndex];
    this.setData({[`dish.dishIngredients[${index}].unit`]:unit});
  },

  delete_dishIngredient(e){//删除菜品食材
    let index=e.currentTarget.dataset.index;
    let list=this.data.dish.dishIngredients;
    list.splice(index,1);
    this.setData({"dish.dishIngredients":list});
  },

  add_dishIngredient(){//添加菜品所需食材
    let list=this.data.dish.dishIngredients || [];
    list.push({
      name:"",
      count:"",
      unit:""
    });
    this.setData({"dish.dishIngredients":list});
  },

  add_dishStep(){//增加菜品烹饪步骤
    let steps=this.data.dish.dishCookingSteps || [];
    steps.push("");
    this.setData({"dish.dishCookingSteps":steps});
  },

  change_dishStep(e){//改变菜品烹饪步骤
    let index=e.currentTarget.dataset.index;
    this.setData({[`dish.dishCookingSteps[${index}]`]:e.detail.value});
  },

  delete_dishStep(e){//删除菜品烹饪步骤
    let index=e.currentTarget.dataset.index;
    let steps=this.data.dish.dishCookingSteps;
    steps.splice(index,1);
    this.setData({"dish.dishCookingSteps":steps});
  },

  saveDish(){
    let dish = JSON.parse(JSON.stringify(this.data.dish));
    // =========================
    // 数据校验
    // =========================
    dish.dishName=(dish.dishName || "").trim();
    if(!dish.dishName){// 校验菜品名称
      wx.showToast({title:"请输入菜品名称",icon:"none"});
      return;
    }
    if(!dish.dishCategory || !this.data.dishCategories.includes(dish.dishCategory)){
      wx.showToast({title:"请选择菜品类别",icon:"none"});
      return;
    }
    for (let ingredient of dish.dishIngredients) {//检查食材
      if(!ingredient.name){
        wx.showToast({title:"请输入食材名称",icon:"none"});
        return;
      }
      let count = Number(ingredient.count);
      if (!Number.isFinite(count) || count <= 0) {// 数量必须是有效数字，并且大于0
        wx.showToast({
          title: `食材「${ingredient.name}」数量不正确`,
          icon: "none"
        });
        return;
      }
      // 个、瓶必须是整数
      if((ingredient.unit === "个" || ingredient.unit === "瓶") && !Number.isInteger(count)) {
        wx.showToast({
          title: `「${ingredient.name}」数量必须是整数`,
          icon: "none"
        });
        return;
      }
      // 保存为 Number
      ingredient.count = count;
    }

    if(this.data.isNewDish){// 新增菜品
      dish.dishId=Date.now();
      app.globalData.dishes.push(dish);
      wx.showToast({title:"添加成功",icon:"success"});
    }
    else{// 保存更新已有菜品的全局数据
      const index=app.globalData.dishes.findIndex(item=>{return item.dishId==dish.dishId;});
      if(index===-1){
        wx.showToast({title:"菜品不存在",icon:"none"});
        return;
      }
      app.globalData.dishes[index]=dish;
      wx.showToast({title:"修改成功",icon:"success"});
    }
    setTimeout(()=>{wx.navigateBack();},1000);//返回详情界面
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})
