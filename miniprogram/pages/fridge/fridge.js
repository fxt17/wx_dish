// pages/fridge/fridge.js
const app=getApp();
const ingredientUtil=require("../../utils/ingredient.js");
const categoryUtil=require("../../utils/category.js");
Page({

  /**
   * 页面的初始数据
   */
  data: {
    searchText:"",
    ingredientCategories:[],
    currentIngredientCategory:"全部",
    ingredients:[],// 食材列表
    showIngredients:[],//当前显示食材列表

    popupType:"",

    consumeList:[],
    shortageList:[],
    orderList:[]
  },

  categoriesManagement(){
    wx.navigateTo({url:"/pages/categoriesManagement/categoriesManagement?type=ingredient"});
  },

  // 新增食材，传递当前类别
  addIngredient(){wx.navigateTo({url:"/pages/addIngredient/addIngredient?ingredientCategory="+this.data.currentIngredientCategory})},

  // 搜索食材
  searchIngredient(e){
    let value=e.detail.value;
    this.setData({searchText:value});
    this.updateShowIngredient();
  },

  // 选择菜品类别
  selectCategory(e){
    let ingredientCategory=e.currentTarget.dataset.category;
    this.setData({currentIngredientCategory:ingredientCategory});
    this.updateShowIngredient();
  },
  // 更新显示的食材
  updateShowIngredient(){
    let result=this.data.ingredients;
    result=result.filter(item=>item.ingredientCount>0);
    // 分类过滤
    if(this.data.currentIngredientCategory!="全部")
      result=result.filter(item=>item.ingredientCategory==this.data.currentIngredientCategory);
    // 搜索过滤
    if(this.data.searchText)
      result=result.filter(item=>item.ingredientName.includes(this.data.searchText));
    this.setData({showIngredients:result});
  },

  // 点击食材显示详情
  openIngredientDetail(e){
    let ingredientId = e.currentTarget.dataset.ingredientId;
    wx.navigateTo({
      url:"/pages/detailIngredient/detailIngredient?ingredientId="+ingredientId,
    });
  },

  // 删除当前菜单
  deleteMenu(){
    wx.showModal({
      title:"删除菜单",
      content:"删除后当前菜单计划将取消",
      success:(res)=>{
        if(res.confirm){// 清空全局的三个列表
          app.globalData.consumeList=[];
          app.globalData.shortageList=[];
          app.globalData.orderList=[];
          this.setData({consumeList:[],shortageList:[],orderList:[]});
        }
      }
    })
  },
  deleteDish(e){
    let dishId=e.detail.dishId;
    wx.showModal({
      title:"删除菜品",
      content:"删除后当前菜品将从菜单中移除",
      success:(res)=>{
        if(res.confirm){
          let orderList=app.globalData.orderList;// 复制菜单
          let orderIndex=orderList.findIndex(item=>item.dish.dishId==dishId);//在菜单中找到对应菜品序号
          let dish=orderList[orderIndex].dish;/*对应菜品 */
          dish.dishIngredients.forEach(item=>{
            let count=Number(parseInt(item.amount));//食材数量
            let shortage=app.globalData.shortageList.find(s=>s.name==item.name);// shortageList中找到指定食材
            if(shortage){// 先删除shortageList
              if(shortage.count>=count){
                shortage.count-=count;
                count=0;
              }
              else{
                count-=shortage.count;
                shortage.count=0;
              }
            }
            if(count>0){// shortageList不够,扣除consumeList
              let consume=app.globalData.consumeList.find(c=>c.name===item.name);
              if(consume){
                if(consume.count>=count){
                  consume.count-=count;
                  count=0;
                }
                else{
                  count-=consume.count;
                  consume.count=0;
                } 
              }
            }
            // 删除0数量项
            app.globalData.shortageList=app.globalData.shortageList.filter(item=>item.count>0);
            app.globalData.consumeList=app.globalData.consumeList.filter(item=>item.count>0);
            this.setData({
              consumeList:app.globalData.consumeList,
              shortageList:app.globalData.shortageList,
            });
          });
          app.globalData.orderList.splice(orderIndex,1);
          this.setData({orderList:app.globalData.orderList});
        }
      }
    })
  },

  submitMenu(){
    app.globalData.consumeList.forEach(consumeIngredient=>{// 根据consumeList消耗冰箱食材
      let fridgeIngredients=app.globalData.ingredients.filter(ingredient=>ingredient.ingredientName==consumeIngredient.name&&ingredient.ingredientUnit==consumeIngredient.unit&&ingredient.ingredientExpireStatus!=="expire-danger");
      
      fridgeIngredients.sort((a,b)=>{// 按过期日期升序排序（越早过期越靠前），根据返回值排序，<0则a在b前
        return new Date(a.ingredientExpireDate)-new Date(b.ingredientExpireDate);
      });
      let needCount = consumeIngredient.count;
      for(let ingredient of fridgeIngredients){// 按顺序对冰箱里的每件（同名、同单位、非过期）食材进行操作
        if(needCount<=0)break;
        if(ingredient.ingredientCount >= needCount){
          ingredient.ingredientCount-=needCount;
          needCount = 0;
        }
        else{// 当前食材不够，全部扣完    
          needCount -= ingredient.ingredientCount;
          ingredient.ingredientCount = 0;
        }
      }
    })
    app.globalData.orderList.forEach(orderDish=>{
      let dish=app.globalData.dishes.find(dish=>orderDish.dish.dishId==dish.dishId);
      dish.canEvaluate = true;        // 可评价
      dish.dishOrderCount++;          // 菜品下单次数加一
    });
    app.globalData.consumeList=[];
    app.globalData.shortageList=[];
    app.globalData.orderList=[];
    this.setData({consumeList:[],shortageList:[],orderList:[]});
    this.updateShowIngredient();
    wx.showToast({title:"菜单完成",icon:"success"});
  },


  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.setData({
      ingredients:app.globalData.ingredients,   
      ingredientCategories:[
        "全部",
        ...categoryUtil.ingredientCategories
      ]
    });
  },


  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow(){
    let shortage=app.globalData.shortageList;
    let consume=app.globalData.consumeList;
    let order=app.globalData.orderList;
    const ingredientCategories = ["全部", ...categoryUtil.ingredientCategories];
    const currentIngredientCategory = ingredientCategories.includes(this.data.currentIngredientCategory)
      ? this.data.currentIngredientCategory
      : "全部";
    this.setData({
      shortageList:shortage,
      consumeList:consume,
      orderList:order,
      ingredientCategories:ingredientCategories,
      currentIngredientCategory:currentIngredientCategory
    });
    let ingredients = app.globalData.ingredients;
    ingredientUtil.updateIngredientExpire(ingredients);
    this.setData({ingredients:ingredients},()=>{this.updateShowIngredient();});
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
