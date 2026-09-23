// pages/editIngredient/editIngredient.js
const app=getApp();
const store = require("../../services/kitchenStore");
const dateUtil=require("../../utils/date.js");
const categoryUtil=require("../../utils/category.js");
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
        ingredientExpireText:"",
        ingredientCategory:"",
        ingredientCategories:[],
        fridgeIngredient:[]    
  },
  
  change_ingredientImage(){//食材图片
    wx.chooseMedia({
     count:1,
     mediaType:["image"],
     success: async res => {
       try { this.setData({ ingredientImage: await store.keepImage(res.tempFiles[0].tempFilePath), ingredientImageUrl: "" }); }
       catch (error) { wx.showToast({ title: error.message, icon: "none" }); }
     }
    })
  },
  change_ingredientName(e){this.setData({ingredientName:e.detail.value.trim()})},//食材名称
  change_ingredientCount(e){this.setData({ingredientCount:e.detail.value})},//食材数量
  change_ingredientUnit(e){
    let index=e.detail.value;
    this.setData({ingredientUnit:this.data.ingredientUnits[index]})
  },//食材单位
  change_ingredientCategory(e){//食材类别
    let index=e.detail.value;
    this.setData({ingredientCategory:this.data.ingredientCategories[index]});
  },
  change_ingredientShelfLife(e){this.setData({ingredientShelfLife:e.detail.value})},//食材保质期
  change_ingredientProduceDate(e){this.setData({ingredientProduceDate:e.detail.value});},//食材生产日期
  change_ingredientPurchaseDate(e){this.setData({ingredientPurchaseDate:e.detail.value})},//食材购买日期
  async saveIngredient(){//保存
    if (this._saving || !store.requireKitchen()) return;
    //=========================
    // 数据校验
    //=========================
    if(!this.data.ingredientName){
      wx.showToast({title:"请输入食材名称",icon:"none"});
      return;
    }
    this.data.ingredientCount=Number(this.data.ingredientCount);
    if(!this.data.ingredientCount || this.data.ingredientCount<=0){
      wx.showToast({title:"请输入正确数量",icon:"none"});
      return;
    }
    if(!this.data.ingredientUnit){
      wx.showToast({title:"请选择单位",icon:"none"});
      return;
    }
    if((this.data.ingredientUnit==="个"||this.data.ingredientUnit==="瓶")&& !Number.isInteger(this.data.ingredientCount)){
      wx.showToast({title:"请输入正确数量",icon:"none"});
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
    const expectedVersion = this.data.fridgeIngredient._version || 0;
    const isNew = !this.data.fridgeIngredient.ingredientId;
    this._saving = true; this.setData({ saving: true });
    try {
      store.saveForm(this._formKey, { form: this.data });
      ingredient.ingredientImage = await store.uploadImage(ingredient.ingredientImage);
      this.setData({ ingredientImage: ingredient.ingredientImage });
      store.saveForm(this._formKey, { form: this.data });
      const saved = await store.perform("ingredient.save", { ingredient, expectedVersion, isNew }, "食材已保存", this._formKey);
      if (saved) { this._saved = true; store.saveForm(this._formKey, null); wx.navigateBack(); }
    } catch (error) {
      wx.showModal({ title: "尚未保存", content: error.message, showCancel: false });
    } finally { this._saving = false; this.setData({ saving: false }); }
  },
  scanIngredient() {
    wx.showToast({ title: "扫码识别尚未接入，请手动填写", icon: "none" });
  },

   /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {//加载页面时传递类别
    if (!store.requireKitchen()) return;
    this._formKey = `ingredient:${options.ingredientId || 'new'}`;
    this.setData({
      today: dateUtil.formatDate(new Date()),
      ingredientUnits:categoryUtil.ingredientUnits,
      ingredientCategories:[...categoryUtil.ingredientCategories]
    });
    const ingredientId = options.ingredientId;
    if(ingredientId){//对已有食材进行编辑
      const fridgeIngredient=app.globalData.ingredients.find(item=>{return item.ingredientId==ingredientId;});//根据食材id查找对应的食材
      if (!fridgeIngredient) { wx.showToast({ title: '食材已被删除', icon: 'none' }); wx.navigateBack(); return; }
      this.setData({//同步数据
        ingredientImage:fridgeIngredient.ingredientImage,//图片
        ingredientImageUrl:fridgeIngredient.ingredientImageUrl || '',
        ingredientName:fridgeIngredient.ingredientName,//名称
        ingredientCount:fridgeIngredient.ingredientCount,//数量
        ingredientUnit:fridgeIngredient.ingredientUnit,//单位
        ingredientCategory:fridgeIngredient.ingredientCategory,//类别
        ingredientProduceDate:fridgeIngredient.ingredientProduceDate,//生产日期
        ingredientPurchaseDate:fridgeIngredient.ingredientPurchaseDate,//购买日期
        ingredientShelfLife:fridgeIngredient.ingredientShelfLife,//保质期
        fridgeIngredient:fridgeIngredient
      });
      this.restoreForm();
      return
    }
    const today=dateUtil.formatDate(new Date());
    this.setData({ingredientPurchaseDate:today});//默认购买日期为今天
    let ingredientCategory=decodeURIComponent(options.ingredientCategory || '');
    if(ingredientCategory=="全部")
      ingredientCategory="";
    this.setData({ingredientCategory:ingredientCategory});
    this.restoreForm();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  restoreForm() {
    const draft = store.readForm(this._formKey);
    if (draft && draft.form) wx.showModal({ title: "恢复本机编辑草稿", content: "发现上次未完成保存的内容，是否继续编辑？",
      success: result => { if (result.confirm) this.setData({ ...draft.form, saving: false,
        ingredientUnits: categoryUtil.ingredientUnits, ingredientCategories: [...categoryUtil.ingredientCategories] }); } });
  },
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
  onHide() { this.keepDraft(); },
  keepDraft() {
    if (!this._formKey || this._saved) return;
    try { store.saveForm(this._formKey, { form: this.data }); }
    catch (error) { wx.showToast({ title: "草稿保存失败，请勿关闭", icon: "none" }); }
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() { this.keepDraft(); },

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
