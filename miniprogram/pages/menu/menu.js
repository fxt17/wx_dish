const app=getApp();
const dishUtil=require("../../utils/dish.js");
const categoryUtil=require("../../utils/category.js");
const ingredientUtil=require("../../utils/ingredient.js");
Page({
  data: {
    searchText:"",
    dishCategories:[],
    currentDishCategory:"全部",
    dishes:[],//菜品列表
    showDishes:[],//当前显示的菜品列表
    totalCount:0
  },
  onLoad(){
    this.setData({
      dishes:app.globalData.dishes,     
      dishCategories:[
        "全部",
        ...categoryUtil.dishCategories
      ]
    });
    this.loadScore();
    this.refreshDishes();
    // this.updateShowDishes();
  },
  onShow(){// 数据更新/同步
    // this.loadScore();
    const dishCategories = ["全部", ...categoryUtil.dishCategories];
    const currentDishCategory = dishCategories.includes(this.data.currentDishCategory)? this.data.currentDishCategory:"全部";

    this.setData({
      dishCategories: dishCategories,
      currentDishCategory: currentDishCategory
    }, () => {this.refreshDishes();});
  },

  categoriesManagement(){
    wx.navigateTo({url:"/pages/categoriesManagement/categoriesManagement?type=dish"});
  },

  // 加菜
  selectDish(e){
    let dishId=e.detail.dishId;
    dishUtil.selectDish(app.globalData.dishes,dishId);//更新dishCount
    this.refreshDishes();
  },
  // 减菜
  cancelDish(e){
    let dishId=e.detail.dishId;
    dishUtil.cancelDish(app.globalData.dishes,dishId);//更新dishCount
    this.refreshDishes();
  },

  // 搜索菜品
  searchDish(e){
    let value=e.detail.value;
    this.setData({searchText:value});
    this.updateShowDishes();
  },
  // 创建新的菜品
  addDish(){
    wx.showModal({
      title:"新增菜品",
      editable:true,
      placeholderText:"请输入菜品名称",
      success:(res)=>{//showModal执行成功后调用这个回调函数
        if(res.confirm && res.content){//用户返回确认且非空
          let name=res.content;
          let category=this.data.currentDishCategory;// 当前分类
          if(category=="全部")// 如果当前是全部，需要选择分类
            this.chooseCategory((selectCategory)=>{this.createDish(name,selectCategory);});
          else// 直接使用当前分类
            this.createDish(name,category);
        }
      }
    })
  },
  createDish(name,category){
    wx.chooseMedia({
      dishCount:1,
      mediaType:["image"],
      sourceType:["album","camera"],
      success:(imageRes)=>{
        let imagePath=imageRes.tempFiles[0].tempFilePath;
        let dish={
          dishId:Date.now(),
          dishImage:imagePath,
          dishName:name,
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishCategory:category,
          dishDescription:"",
          dishSeason:{
            startMonth:1,
            endMonth:12
          },
          dishIngredients:[],
          dishCookingSteps:[],
          //评价统计
          likeCount:0,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:false
        };
        app.globalData.dishes.push(dish);
        this.setData({dishes:app.globalData.dishes});
        this.updateShowDishes();
      },
      fail:()=>{
        let dish={
          dishId:Date.now(),
          dishImage:"/images/myicons/食物.png",
          dishName:name,
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishCategory:category,
          dishDescription:"",
          dishSeason:{
            startMonth:1,
            endMonth:12
          },
          dishIngredients:[],
          dishCookingSteps:[],
          //评价统计
          likeCount:0,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:false
        };
        app.globalData.dishes.push(dish);
        this.setData({dishes:app.globalData.dishes});
        this.updateShowDishes();
      }
    })
  },

  // 新增菜品的分类弹窗
  chooseCategory(callback){
    wx.showActionSheet({
      itemList:categoryUtil.dishCategories,
      success:(res)=>{callback(categoryUtil.dishCategories[res.tapIndex]);}
    });
  },

  // 选择菜品类别
  selectCategory(e){
    let dishCategory=e.currentTarget.dataset.category;
    this.setData({currentDishCategory:dishCategory});
    this.updateShowDishes();
  },

  // 菜品详情页
  openDetail(e){
    let dishId = e.currentTarget.dataset.dishId;
    wx.navigateTo({url:"/pages/detail/detail?dishId="+dishId,});
  },

  // 清空购物车
  clearCart(){
    app.globalData.dishes.forEach(item=>{item.dishCount=0;});//dishes中全部dish的dishCount清零
    this.refreshDishes();
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

  // 订单提交成功后的操作(更新界面显示数据)
  finishOrder(){
    app.globalData.dishes.forEach(item=>{// 详情页评价按钮,菜品下单次数,菜品选取数量
      if(item.dishCount>0){
        // item.canEvaluate = true;        // 下单刷新可评价
        // item.dishOrderCount++;          // 菜品下单次数加一
        item.dishCount = 0;             // 清空购买数量
      }
    });
    this.refreshDishes();
    wx.showToast({title:"菜单提交成功",icon:"success"});
  },

  // 加载评分
  loadScore(){
    app.globalData.dishes.forEach(item=>{this.getStarRating(item);});
    this.setData({dishes:app.globalData.dishes});
  },

  // 好评率转换为星级
  getStarRating(dish){
    let total=dish.likeCount+dish.dislikeCount;
    if(total==0)
      return "0.0";
    let rate=dish.likeCount/total;
    return (rate*5).toFixed(1);
  },

  // 更新购物车状态(已选菜品数量)
  updateCartStatus(){
    let total=0;
    app.globalData.dishes.forEach(item=>{total += item.dishCount;});//计算总选取的菜品数
    this.setData({totalCount:total});
  },

  // 更新显示菜品
  updateShowDishes(){
    let result=[...this.data.dishes];
    // 分类过滤
    if(this.data.currentDishCategory!="全部")
      result=result.filter(item=>item.dishCategory==this.data.currentDishCategory);
    // 搜索过滤
    if(this.data.searchText)
      result=result.filter(item=>item.dishName.includes(this.data.searchText));
    // 添加显示星级
    result=result.map(item=>{
      return {
        ...item,
        starRating:this.getStarRating(item)
      }
    });
    this.setData({showDishes:result});
  },

  refreshDishes(){
    this.setData({dishes:app.globalData.dishes});//同步到全局的dish和dishes
    this.updateShowDishes();//更新显示列表
    this.updateCartStatus();//更新购物车菜品数量
  },
})
