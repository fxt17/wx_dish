// pages/editDish/editDish.js
const app=getApp();
const categoryUtil=require("../../utils/category.js");
const seasonUtil=require("../../utils/season.js");
Page({

  /**
   * 页面的初始数据
   */
  data: {
    dish:null,
    seasonMonthRanges:[
      seasonUtil.monthOptions,
      seasonUtil.monthOptions
    ],
    seasonPickerValue:[0, 11],
    dishSeasonText:"全年适宜"
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options){
    let dishId=options.dishId;//接收编辑按键传递的详情页面菜品id
    let dish=app.globalData.dishes.find(item=>{return item.dishId==dishId;});//根据菜品id查找对应的菜品
    dish=JSON.parse(JSON.stringify(dish));// 注意复制一份
    const dishSeason=seasonUtil.normalizeSeason(dish.dishSeason);
    dish.dishSeason=dishSeason;
    this.setData({
      dish:dish,
      dishCategories:categoryUtil.dishCategories,
      ingredientUnits:categoryUtil.ingredientUnits,
      seasonPickerValue:[dishSeason.startMonth-1,dishSeason.endMonth-1],
      dishSeasonText:seasonUtil.formatSeason(dishSeason)
    });
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

  change_dishSeason(e){// 修改当前菜品的适宜月份范围
    const startMonth=Number(e.detail.value[0])+1;
    const endMonth=Number(e.detail.value[1])+1;
    const dishSeason={startMonth:startMonth,endMonth:endMonth};
    this.setData({
      "dish.dishSeason":dishSeason,
      seasonPickerValue:[startMonth-1,endMonth-1],
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
    // 检查食材数量
    // =========================
    for (let ingredient of dish.dishIngredients) {
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

    let index=app.globalData.dishes.findIndex(item=>{return item.dishId==dish.dishId;});
    if(index!=-1){app.globalData.dishes[index]=dish;}//保存更新全局数据
    wx.showToast({title:"修改成功",icon:"success"});
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
