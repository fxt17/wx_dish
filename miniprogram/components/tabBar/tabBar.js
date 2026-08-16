// components/tabBar/tabBar.js

Component({
  /**
   * 组件的初始数据
   */
  data: {

  },
  properties: {current:{type:String,value:"menu"}},
  /**
   * 组件的方法
   */
  methods:{
    goMenu(){wx.redirectTo({url:"/pages/menu/menu"})},
    goFridge(){wx.redirectTo({url:"/pages/fridge/fridge"})},
    goMine(){wx.redirectTo({url:"/pages/mine/mine"})}
  }
})