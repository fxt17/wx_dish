// pages/editDish/editDish.js
const app=getApp();
const categoryUtil=require("../../utils/category.js");
Page({

  /**
   * 页面的初始数据
   */
  data: {
    dish:null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options){
    let dishId=options.dishId;//接收编辑按键传递的详情页面菜品id
    let dish=app.globalData.dishes.find(item=>{return item.dishId==dishId;});//根据菜品id查找对应的菜品
    this.setData({dish:Object.assign({},dish)});// 注意复制一份
    this.setData({dishCategories:categoryUtil.dishCategories});
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
    let dish=this.data.dish;
    dish.dishName=e.detail.value;//接收输出框的菜品名称
    this.setData({dish:dish});//编辑页面数据缓存
  },

  change_dishCategory(e){// 修改当前菜品分类
    let index=e.detail.value;
    let category=this.data.dishCategories[index];
    this.setData({"dish.dishCategory":category});
  },

  change_dishDescription(e){// 修改当前菜品描述
    this.setData({"dish.dishDescription":e.detail.value});
  },

  change_dishIngredientName(e){//改变菜品所需食材名字
    let index=e.currentTarget.dataset.index;
    let value=e.detail.value;
    this.setData({[`dish.dishIngredients[${index}].name`]:value});
  },

  change_dishIngredientAmount(e){//改变菜品所需食材数量
    let index=e.currentTarget.dataset.index;
    this.setData({[`dish.dishIngredients[${index}].amount`]:e.detail.value});
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
      amount:""
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
    let dishId=this.data.dish.dishId;
    let dishes=app.globalData.dishes;
    let index=dishes.findIndex(item=>{return item.dishId==dishId;});
    if(index!=-1){dishes[index]=this.data.dish;}//保存更新全局数据
    wx.navigateBack();
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