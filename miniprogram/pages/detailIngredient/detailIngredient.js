// pages/detailIngredient/detailIngredient.js
const app=getApp();
Page({

  /**
   * 页面的初始数据
   */
  data: {
    ingredient:[],
    ingredientId:null,
  },

  editIngredient(){
    if(!this.data.ingredient){return;}
    let ingredientId=this.data.ingredient.ingredientId;
    wx.navigateTo({url:"/pages/addIngredient/addIngredient?ingredientId="+ingredientId});
  },
  deleteIngredient(){
    wx.showModal({//提示窗
      title:"删除食材",
      content:"确定删除该食材吗？",
      success:(res)=>{
        if(res.confirm){
          let ingredientId=this.data.ingredient.ingredientId;
          let ingredients=app.globalData.ingredients;
          let index=ingredients.findIndex(item=>{return item.ingredientId==ingredientId;});
          if(index!=-1){ingredients.splice(index,1);}
          wx.navigateBack();
      }
     }
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    let ingredientId=Number(options.ingredientId);/*找到Id*/
    this.setData({ingredientId:ingredientId});
    let ingredient=app.globalData.ingredients.find(item=>{return item.ingredientId==ingredientId;});
    this.setData({ingredient:ingredient});
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
    let ingredient=app.globalData.ingredients.find(item=>{
      return item.ingredientId==this.data.ingredientId;
    });
    this.setData({ingredient:ingredient});
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