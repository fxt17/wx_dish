// components/cart/cart.js
Component({
  properties:{
    dishes:{
      type:Array,
      value:[]
    },
    totalCount:{
      type:Number,
      value:0,
      // 如果数量为0，自动关闭购物车
      observer:function(newValue){if(newValue==0){this.setData({cartVisible:false});}}
    }
  },
  data:{
    cartVisible:false
  },
  methods:{
    // 打开关闭购物车
    showCart(){this.setData({cartVisible:!this.data.cartVisible});},
    // 加菜
    selectDish(e){
      let dishId=e.detail.dishId;
      this.triggerEvent("selectDish",{dishId:dishId});
    },
    // 减菜
    cancelDish(e){
      let dishId=e.detail.dishId;
      this.triggerEvent("cancelDish",{dishId:dishId});
    },
    // 清空菜单
    clearCart(){
      this.triggerEvent("clearCart");
    },
    submitOrder(){
      this.triggerEvent("submitOrder");
    }
  }
})