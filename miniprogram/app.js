// app.js
App({
  onLaunch: function () {
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      env: "",
      // 菜品
      dishes:[
        {
          dishId:1,
          dishImage:"/images/dishes/番茄炒鸡蛋.jpg",
          dishName:"番茄炒蛋",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"色泽鲜亮诱人，金黄软嫩的鸡蛋蓬松饱满，裹着酸甜浓郁的番茄汤汁。熟透的番茄绵软出沙，汁水丰盈，酸甜滋味恰到好处，不齁不淡。鸡蛋吸饱鲜爽汤汁，入口滑嫩鲜香，酸甜开胃。汤汁拌饭格外下饭，口感温润醇厚，做法家常质朴，老少皆宜，是餐桌经典百搭家常菜，一口下去暖心又适口。",// 新增：菜品描述
          dishIngredients:[
            {
              name:"西红柿",
              amount:"2个"
            },
            {
              name:"鸡蛋",
              amount:"3个"
            }
          ],
          dishCookingSteps:[
            "西红柿切块",
            "鸡蛋打散炒熟",
            "加入西红柿翻炒"
          ],
          //评价统计
          likeCount:100,
          dislikeCount:5,
          // 是否有待评价订单
          canEvaluate:false
        },
        {
          dishId:2,
          dishImage:"/images/dishes/红烧肉.jpg",
          dishName:"红烧肉",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"猪肉",
              amount:"500g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:100,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:false
        },
        {
          dishId:3,
          dishImage:"",
          dishName:"清炒青菜",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"生菜",
              amount:"500g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:1,
          dislikeCount:50,
          // 是否有待评价订单
          canEvaluate:false
        },
        {
          dishId:4,
          dishImage:"",
          dishName:"鱼香肉丝",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"猪肉",
              amount:"500g"
            },
            {
              name:"木耳",
              amount:"200g"
            },
            {
              name:"胡萝卜",
              amount:"200g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:10,
          dislikeCount:20,
          // 是否有待评价订单
          canEvaluate:false
        },
        {
          dishId:5,
          dishImage:"",
          dishName:"红烧排骨",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"排骨",
              amount:"500g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:30,
          dislikeCount:10,
          // 是否有待评价订单
          canEvaluate:false
        },
        {
          dishId:6,
          dishImage:"",
          dishName:"可乐鸡翅",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"可乐",
              amount:"1瓶"
            },
            {
              name:"鸡翅",
              amount:"500g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:10,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:true
        },
        {
          dishId:7,
          dishImage:"",
          dishName:"麻婆豆腐",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"豆腐",
              amount:"500g"
            },
            {
              name:"牛肉",
              amount:"100g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:0,
          dislikeCount:1,
          // 是否有待评价订单
          canEvaluate:true
        },
        {
          dishId:8,
          dishImage:"",
          dishName:"肉末茄子",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"茄子",
              amount:"200g"
            },
            {
              name:"猪肉",
              amount:"100g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:0,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:true
        },
        {
          dishId:9,
          dishImage:"",
          dishName:"地三鲜",
          dishCategory:"热菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"土豆",
              amount:"200g"
            },
            {
              name:"茄子",
              amount:"200g"
            },
            {
              name:"青椒",
              amount:"200g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:5,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:true
        },
        {
          dishId:10,
          dishImage:"",
          dishName:"凉拌黄瓜",
          dishCategory:"凉菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"黄瓜",
              amount:"300g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:0,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:false
        },
        {
          dishId:11,
          dishImage:"",
          dishName:"折耳根",
          dishCategory:"凉菜",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"折耳根",
              amount:"200g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:0,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:false
        },
        {
          dishId:12,
          dishImage:"",
          dishName:"金桔柠檬",
          dishCategory:"饮料",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"柠檬",
              amount:"200g"
            },
            {
              name:"金桔",
              amount:"200g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:0,
          dislikeCount:0,
          // 是否有待评价订单
          canEvaluate:false
        },
        {
          dishId:13,
          dishImage:"",
          dishName:"姜丝可乐",
          dishCategory:"饮料",
          dishCount:0,
          dishOrderCount:0,   // 总下单次数
          dishRating:0,       // 星级评分
          dishDescription:"",
          dishIngredients:[
            {
              name:"可乐",
              amount:"1瓶"
            },
            {
              name:"生姜",
              amount:"100g"
            }
          ],
          dishCookingSteps:[""],
          //评价统计
          likeCount:0,
          dislikeCount:60,
          // 是否有待评价订单
          canEvaluate:false
        }
      ],
      // 冰箱食材
      ingredients:[
        {
          ingredientId:1,
          ingredientImage:"",
          ingredientName:"西红柿",
          ingredientCategory:"蔬菜",
          ingredientCount:20,
          ingredientUnit:"个",
          ingredientProduceDate:"2026-07-01",//生产日期
          ingredientPurchaseDate:"2026-07-03",//购买日期
          ingredientShelfLife:30,
          ingredientExpireDate:"",
          ingredientExpireStatus:"",
          ingredientExpireText:""
        },
        {
          ingredientId:2,
          ingredientImage:"",
          ingredientName:"土豆",
          ingredientCategory:"蔬菜",
          ingredientCount:1,
          ingredientUnit:"个",
          ingredientProduceDate:"2026-07-15",
          ingredientPurchaseDate:"2026-07-30",
          ingredientShelfLife:30,
          ingredientExpireDate:"",
          ingredientExpireStatus:"",
          ingredientExpireText:""
        },
        {
          ingredientId:3,
          ingredientImage:"",
          ingredientName:"香蕉",
          ingredientCategory:"水果",
          ingredientCount:4,
          ingredientUnit:"个",
          ingredientProduceDate:"2026-08-01",
          ingredientPurchaseDate:"2026-08-01",
          ingredientShelfLife:10,
          ingredientExpireDate:"",
          ingredientExpireStatus:"",
          ingredientExpireText:""
        },
        {
          ingredientId:4,
          ingredientImage:"",
          ingredientName:"伊利纯牛奶",
          ingredientCategory:"蛋奶",
          ingredientCount:1,
          ingredientUnit:"瓶",
          ingredientProduceDate:"2026-07-01",
          ingredientPurchaseDate:"2026-07-15",
          ingredientShelfLife:90,
          ingredientExpireDate:"",
          ingredientExpireStatus:"",
          ingredientExpireText:""
        },
        {
          ingredientId:5,
          ingredientImage:"",
          ingredientName:"鸡蛋",
          ingredientCategory:"蛋奶",
          ingredientCount:30,
          ingredientUnit:"个",
          ingredientProduceDate:"2026-07-01",
          ingredientPurchaseDate:"2026-07-15",
          ingredientShelfLife:90,
          ingredientExpireDate:"",
          ingredientExpireStatus:"",
          ingredientExpireText:""
        },
        {
          ingredientId:6,
          ingredientImage:"",
          ingredientName:"猪肉",
          ingredientCategory:"肉类",
          ingredientCount:500,
          ingredientUnit:"g",
          ingredientProduceDate:"2026-08-10",
          ingredientPurchaseDate:"2026-08-11",
          ingredientShelfLife:20,
          ingredientExpireDate:"",
          ingredientExpireStatus:"",
          ingredientExpireText:""
        },
        {
          ingredientId:7,
          ingredientImage:"",
          ingredientName:"西红柿",
          ingredientCategory:"蔬菜",
          ingredientCount:3,
          ingredientUnit:"个",
          ingredientProduceDate:"2026-08-08",//生产日期
          ingredientPurchaseDate:"2026-08-11",//购买日期
          ingredientShelfLife:7,
          ingredientExpireDate:"",
          ingredientExpireStatus:"",
          ingredientExpireText:""
        },
        {
          ingredientId:8,
          ingredientImage:"",
          ingredientName:"西红柿",
          ingredientCategory:"蔬菜",
          ingredientCount:1,
          ingredientUnit:"个",
          ingredientProduceDate:"2026-08-04",//生产日期
          ingredientPurchaseDate:"2026-08-11",//购买日期
          ingredientShelfLife:7,
          ingredientExpireDate:"",
          ingredientExpireStatus:"",
          ingredientExpireText:""
        },
      ],
      // 待消耗食材清单(点菜后食材充足生成,用于在冰箱页面手动点击确认消耗食材)
      consumeList:[],
      // 待购买食材清单(点菜后食材缺少生成,用于参照购买食材,新食材入库后消失,刷新consumeList)
      shortageList:[],
      // 当前选择的菜单(点菜后固定生成,用于确认制作菜品并扣除冰箱食材)
      orderList:[],
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env: this.globalData.env,
        env: "cloud1-d1g20bvre49cb67cb.636c-cloud1-d1g20bvre49cb67cb-1460534732",
        traceUser: true,
      });
    }
  },
});
