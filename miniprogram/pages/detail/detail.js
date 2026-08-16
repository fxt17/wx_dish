// pages/detail/detail.js
const app = getApp();
const dishUtil=require("../../utils/dish.js");
const ingredientUtil=require("../../utils/ingredient.js");
Page({
  /**
   * 页面的初始数据
   */
  data: {
    dishId:null,
    dishImage:"",
    dishName:"",
    dishCategory:"",
    dishCount:0,
    dishIngredients:[
      {
        name:"",
        amount:""
      }
    ],
    dishCookingSteps:[],
    
    dish:{
      dishId:0,
      dishCount:0,
      dishName:"",
      dishIngredients:[],
      dishCookingSteps:[]
    },
    dishes:[],
    cartVisible:false,
    totalCount:0,
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    let dishId = Number(options.dishId);
    this.setData({dishId:dishId, dishes:app.globalData.dishes});
    let dish=app.globalData.dishes.find(item=>{return item.dishId==dishId;});
    this.setData({dish:dish});
    this.updateCartStatus();
    this.updateScore();
  },
  // 加菜
  selectDish(e){
    let dishId=e.detail.dishId;
    dishUtil.selectDish(app.globalData.dishes,dishId);
    this.refreshDish();
  },
  // 减菜
  cancelDish(e){
    let dishId=e.detail.dishId;
    dishUtil.cancelDish(app.globalData.dishes,dishId);
    this.refreshDish();
  },
  // 清空购物车
  clearCart(){
    app.globalData.dishes.forEach(item=>{item.dishCount=0;});
    this.refreshDish();
  },
  // 提交菜单（购物车）
  submitOrder(){
    // 先更新食材状态
    ingredientUtil.updateIngredientExpire(app.globalData.ingredients);

    if(app.globalData.orderList.length){// 已有旧菜单
      wx.showModal({
        title:"提交菜单",
        content:"当前已有菜单，提交后将取消旧菜单",
        showCancel:true,
        cancelText:"取消",
        confirmText:"继续提交",
        success:(res)=>{
          if(res.confirm){
            app.globalData.consumeList=[];
            app.globalData.shortageList=[];
            app.globalData.orderList=[];
            this.confirmSubmit();
          }
          else{return}
        }
      })
    }
    else{this.confirmSubmit();}
  },
  confirmSubmit(){
      let result=ingredientUtil.consumeIngredients(// 消耗的冰箱食材+菜单缺少的食材
      app.globalData.ingredients,//冰箱食材
      app.globalData.dishes//菜品
    );
    /*缺少食材的菜品进一步确认*/
    if(result.shortageList.length>0){// 如果有缺少的食材
      let msg="";
      result.shortageList.forEach(item=>{msg+=`${item.name}缺少 ${item.count} ${item.unit}\n`;});
      wx.showModal({
        title:"库存不足",
        content:msg,
        showCancel:true,
        cancelText:"取消",
        confirmText:"继续提交",
        success:(res)=>{
          if(res.confirm){// 确认提交菜单
            app.globalData.consumeList=result.consumeList;
            app.globalData.shortageList=result.shortageList;
            app.globalData.orderList=result.orderList;
            this.finishOrder();//提交菜单直接完成菜品的计数等
          }
          else if(res.cancel) {return;}
        },
      });
    }
    else{//食材充足
      app.globalData.consumeList=result.consumeList;    // 不缺食材直接生成待消耗食材表单
      app.globalData.orderList=result.orderList;
      this.finishOrder();//提交菜单直接完成菜品的计数等
    }
  },
  finishOrder(){
    app.globalData.dishes.forEach(item=>{// 详情页评价按钮,菜品下单次数,菜品选取数量
      if(item.dishCount>0){
        // item.canEvaluate = true;        // 下单刷新可评价
        // item.dishOrderCount++;          // 菜品下单次数加一
        item.dishCount = 0;             // 清空购买数量
      }
    });
    this.refreshDish();
  },

  // 显示购物车(已选菜品)
  showCart(){
    this.setData({
        cartVisible:
        !this.data.cartVisible
    });
  },
  // 更新购物车状态(已选菜品)
  updateCartStatus(){
    let total=0;
    app.globalData.dishes.forEach(item=>{total += item.dishCount;});
    this.setData({totalCount:total});
    // 没有菜品时关闭购物车
    if(total==0)
      this.setData({cartVisible:false});
  },
  // 更新显示菜品
  updateShowDishes(){
    let result=this.data.dishes;
    // 分类过滤
    if(this.data.currentDishCategory!="全部")
      result=result.filter(item=>item.dishCategory==this.data.currentDishCategory);
    // 搜索过滤
    if(this.data.searchText)
      result=result.filter(item=>item.dishName.includes(this.data.searchText));
    this.setData({showDishes:result});
  },

  //删除当前菜品
  deleteDish(){
    wx.showModal({//提示窗
      title:"删除菜品",
      content:"确定删除该菜品吗？",
      success:(res)=>{
        if(res.confirm){
          let dishId=this.data.dish.dishId;
          let dishes=app.globalData.dishes;
          let index=dishes.findIndex(item=>{return item.dishId==dishId;});
          if(index!=-1){dishes.splice(index,1);}
          wx.navigateBack();
      }
     }
    })
  },
  //编辑当前菜品
  editDish(){
    if(!this.data.dish){return;}
    let dishId=this.data.dish.dishId;
    wx.navigateTo({url:"/pages/editDish/editDish?dishId="+dishId});
  },
  // 点击好吃
  likeDish(){
    let dish=this.data.dish;
    if(!dish.canEvaluate){return;}
    dish.likeCount++;
    // 消耗评价资格
    dish.canEvaluate=false;
    this.updateScore();
    this.refreshDish();
    // this.updateDish(dish);
  },
  // 点击不好吃
  dislikeDish(){
    let dish=this.data.dish;
    if(!dish.canEvaluate){return;}
    dish.dislikeCount++;
    dish.canEvaluate=false;
    this.updateScore();
    this.refreshDish();
    // this.updateDish(dish);
  },
  // 更新菜品好评率
  updateScore(){
    let dish=this.data.dish;
    if(!dish)
      return;
    let like=this.data.dish.likeCount;
    let dislike=this.data.dish.dislikeCount;
    let rate=0;
    if(like+dislike>0){rate=Math.round(like/(like+dislike)*100);}
    dish.dishRating=rate;
    this.updateDish(dish);
    this.setData({dish:dish});
    // this.setData({dishRating:dishRating});
    // // this.setData({dish:dish});
    // this.updateDish(dish);
  },

  updateDish(dish){
    let index=app.globalData.dishes.findIndex(item=>item.dishId==dish.dishId);
    if(index!=-1){app.globalData.dishes[index]=dish;}
  },

  refreshDish(){
    let dish=app.globalData.dishes.find(item=>item.dishId==this.data.dishId);
    this.setData({dish:dish,dishes:app.globalData.dishes});
    this.updateCartStatus();
    // this.updateScore();
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
    let dish=app.globalData.dishes.find(item=>{return item.dishId==this.data.dishId;});
    this.setData({dish:dish, dishes:app.globalData.dishes});
    this.updateCartStatus();
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