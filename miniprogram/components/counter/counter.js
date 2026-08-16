// components/counter/counter.js
Component({

  /**
   * 组件的属性列表
   */
  properties: {
    dishId:{
      type:Number,
      value:null
    },
    dishCount:{
      type:Number,
      value:0
    }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    plus(){this.triggerEvent("plus",{dishId:this.properties.dishId});},
    minus(){this.triggerEvent("minus",{dishId:this.properties.dishId});}
  }
})