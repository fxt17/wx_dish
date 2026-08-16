// components/shoppingCart/shoppingCart.js
Component({
  properties:{
    shortageList:{
      type:Array,
      value:[]
    },
    consumeList:{
      type:Array,
      value:[]
    },
    orderList:{
      type:Array,
      value:[]
    },
    dishCount:Number,
    shortageCount:Number,
    consumeCount:Number,
  },
  data:{
    shortageVisible:false,
    consumeVisible:false,
    menuVisible:false
  },
  observers:{
    "dishCount,shortageCount,consumeCount":function(dishCount,shortageCount,consumeCount){
      if(dishCount==0){this.setData({menuVisible:false,shortageVisible:false,consumeVisible:false});}
      if(shortageCount==0){
        this.setData({shortageVisible:false});
        if(dishCount>0){this.setData({consumeVisible:true});}
      }
      if(consumeCount==0){this.setData({consumeVisible:false});}
    }
},
  methods:{
    showIngredients(){// 打开关闭食材弹窗
      if(this.properties.shortageCount>0){// 缺货食材列表非空，切换缺货食材列表
        this.setData({shortageVisible:!this.data.shortageVisible});
        if(this.data.shortageVisible)//如果缺货食材列表显示，就关闭菜单列表
          this.setData({menuVisible:!this.data.shortageVisible});
      }
      else{// 缺货食材列表为空，切换消耗食材列表
        this.setData({consumeVisible:!this.data.consumeVisible});
        if(this.data.consumeVisible)//如果消耗食材列表显示，就关闭菜单列表
          this.setData({menuVisible:!this.data.consumeVisible});
      }
    },
    showMenu(){
      this.setData({menuVisible:!this.data.menuVisible});
      if(this.data.menuVisible)//如果显示菜单弹窗就关闭食材购物单
        this.setData({shortageVisible:!this.data.menuVisible,consumeVisible:!this.data.menuVisible});
    },
    // 清空菜单
    deleteMenu(){
      this.triggerEvent("deleteMenu");
    },
    //从菜单中删除某样菜品
    deleteDish(e){
      let dishId=e.currentTarget.dataset.dishId;
      this.triggerEvent("deleteDish",{dishId:dishId});
    },
    submitMenu(){
      this.triggerEvent("submitMenu");
    }
  }
})