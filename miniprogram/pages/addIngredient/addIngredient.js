// pages/addIngredient/addIngredient.js
const app=getApp();
const ingredientUtil=require("../../utils/ingredient.js");
const dateUtil=require("../../utils/date.js");
Page({

  /**
   * 页面的初始数据
   */
  data: {
        ingredientImage:"",
        ingredientName:"",
        ingredientCount:null,
        ingredientUnit:"",
        ingredientProduceDate:"",
        ingredientPurchaseDate:"",
        ingredientShelfLife:"",//保质期
        ingredientExpireStatus:"normal",
        ingredientExpireText:"剩余25天",
        ingredientCategory:"",
        // ingredientCategoryLocked:false,
        ingredientCategories:[//下拉食材类别选择
          "蔬菜",
          "肉类",
          "水果",
          "蛋奶",
          "酒水",
          "其他"
        ],
        fridgeIngredient:[]    
  },
  
  change_ingredientImage(){//食材图片
    wx.chooseMedia({
     count:1,
     mediaType:["image"],
     success:(res)=>{this.setData({ingredientImage:res.tempFiles[0].tempFilePath})}
    })
  },
  change_ingredientName(e){this.setData({ingredientName:e.detail.value})},//食材名称
  change_ingredientCount(e){this.setData({ingredientCount:e.detail.value})},//食材数量
  change_ingredientUnit(e){this.setData({ingredientUnit:e.detail.value})},//食材单位
  change_ingredientCategory(e){//食材类别
    let index=e.detail.value;
    this.setData({ingredientCategory:this.data.ingredientCategories[index]});
  },
  change_ingredientShelfLife(e){this.setData({ingredientShelfLife:e.detail.value})},//食材保质期
  change_ingredientProduceDate(e){this.setData({ingredientProduceDate:e.detail.value});},//食材生产日期
  change_ingredientPurchaseDate(e){this.setData({ingredientPurchaseDate:e.detail.value})},//食材购买日期
  saveIngredient(){//保存
    //=========================
    // 数据校验
    //=========================
    if(!this.data.ingredientName.trim()){
      wx.showToast({title:"请输入食材名称",icon:"none"});
      return;
    }
    if(!this.data.ingredientCount || Number(this.data.ingredientCount)<=0){
      wx.showToast({title:"请输入正确数量",icon:"none"});
      return;
    }
    if(!this.data.ingredientUnit){
      wx.showToast({title:"请选择单位",icon:"none"});
      return;
    }
    if(!this.data.ingredientCategory){
      wx.showToast({title:"请选择类别",icon:"none"});
      return;
    }

    let ingredient={
      ingredientId:this.data.fridgeIngredient.ingredientId?this.data.fridgeIngredient.ingredientId:Date.now(),
      ingredientImage:this.data.ingredientImage,
      ingredientName:this.data.ingredientName,
      ingredientCount:Number(this.data.ingredientCount),
      ingredientUnit:this.data.ingredientUnit,
      ingredientProduceDate:this.data.ingredientProduceDate=="请选择生产日期"?"":this.data.ingredientProduceDate,//生产日期
      ingredientPurchaseDate:this.data.ingredientPurchaseDate,//购买日期
      ingredientShelfLife:Number(this.data.ingredientShelfLife),//保质期
      ingredientCategory:this.data.ingredientCategory,
    };
    ingredient.ingredientExpireDate=ingredientUtil.calculateExpireDate(ingredient);//过期日期
    // let result=ingredientUtil.getExpireStatus(ingredient.ingredientExpireDate);
    // ingredient.ingredientExpireStatus=result.status;
    // ingredient.ingredientExpireText=result.text;
    if(this.data.fridgeIngredient.ingredientId){// 保存修改,同步已有食材
      let result=ingredientUtil.getExpireStatus(ingredient.ingredientExpireDate);
      ingredient.ingredientExpireStatus=result.status;//得到食材状态
      ingredient.ingredientExpireText=result.text;//得到食材状态对应文本
      let index=app.globalData.ingredients.findIndex(item=>item.ingredientId==this.data.fridgeIngredient.ingredientId);
      if(index!=-1){app.globalData.ingredients[index]=ingredient;}// 修改全局数据
      wx.showToast({title:"修改成功",icon:"success"});
    }
    else{// 新增食材
      app.globalData.ingredients.push(ingredient);

      let consumeList=app.globalData.consumeList;
      let shortageList=app.globalData.shortageList;
      let shortageIngredient=shortageList.find(item=>ingredient.ingredientName===item.name&&ingredient.ingredientUnit===item.unit);// 入库食材是否是缺少的食材
      let consumeIngredient=consumeList.find(item=>ingredient.ingredientName===item.name&&ingredient.ingredientUnit===item.unit);// 消耗列表中的对应食材
      if(!shortageIngredient) {//不缺货直接返回详情界面;
        wx.showToast({title:"添加成功",icon:"success"});
        setTimeout(()=>{wx.navigateBack();},1000);
        return;
      }
      if(ingredient.ingredientCount>=shortageIngredient.count){//入库大于缺少
        if(consumeIngredient)
          consumeIngredient.count+=shortageIngredient.count;// 更新消耗的食材数量
        else
          consumeList.push({name:shortageIngredient.name,count:shortageIngredient.count,unit:shortageIngredient.unit});
        let shortageIndex=shortageList.indexOf(shortageIngredient);// 删除对应的缺失食材条目
        shortageList.splice(shortageIndex,1);
      }
      else{// 入库小于缺少
        shortageIngredient.count-=ingredient.ingredientCount;// 更新缺少的食材数量
        if(consumeIngredient)
          consumeIngredient.count+=ingredient.ingredientCount;// 更新消耗的食材数量
        else
          consumeList.push({name:shortageIngredient.name,count:ingredient.ingredientCount,unit:shortageIngredient.unit});
      }
      wx.showToast({title:"添加成功",icon:"success"});
    }
    setTimeout(()=>{wx.navigateBack();},1000);//返回详情界面
  },
  scanIngredient(){
    wx.scanCode({
      onlyFromCamera:true,
      scanType:["barCode","qrCode"],
      success:(res)=>{
        console.log("扫描结果:",res);
        let code=res.result;
        wx.showLoading({title:"查询商品..."});
        this.searchIngredient(code);
      },
      fail(err){console.log("扫描失败",err);}
    });
  },

   /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {//加载页面时传递类别
    let ingredientId = options.ingredientId;
    if(ingredientId){//对已有食材进行编辑
      let fridgeIngredient=app.globalData.ingredients.find(item=>{return item.ingredientId==ingredientId;});//根据食材id查找对应的食材
      this.setData({//同步数据
        ingredientImage:fridgeIngredient.ingredientImage,//图片
        ingredientName:fridgeIngredient.ingredientName,//名称
        ingredientCount:fridgeIngredient.ingredientCount,//数量
        ingredientUnit:fridgeIngredient.ingredientUnit,//单位
        ingredientCategory:fridgeIngredient.ingredientCategory,//类别
        ingredientProduceDate:fridgeIngredient.ingredientProduceDate,//生产日期
        ingredientPurchaseDate:fridgeIngredient.ingredientPurchaseDate,//购买日期
        ingredientShelfLife:fridgeIngredient.ingredientShelfLife,//保质期
        fridgeIngredient:fridgeIngredient
      });
      return
    }
    let today=dateUtil.formatDate(new Date());
    this.setData({ingredientPurchaseDate:today});//默认购买日期为今天
    let ingredientCategory=options.ingredientCategory;
    if(ingredientCategory=="全部")
      ingredientCategory="";
    this.setData({ingredientCategory:ingredientCategory});
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