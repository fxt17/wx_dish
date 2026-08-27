const STORAGE_KEYS = {
  dish: "miniprogram_dish_categories",
  ingredient: "miniprogram_ingredient_categories"
};

const defaultDishCategories = [
  "热菜", "凉菜", "汤类", "饮料",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"
];

const defaultIngredientCategories = [
  "蔬菜", "肉类", "水果", "蛋奶", "酒水", "其他"
];

//根据type加载本地缓存
function loadCategories(type, defaults) {
  try {
    const storedCategories = wx.getStorageSync(STORAGE_KEYS[type]);
    return Array.isArray(storedCategories)? [...storedCategories]:[...defaults];
  } catch (error) {
    console.warn(`读取${type}分类失败，使用默认分类`, error);
    return [...defaults];
  }
}

const categoryData = {
  dishCategories: loadCategories("dish", defaultDishCategories),
  ingredientCategories: loadCategories("ingredient", defaultIngredientCategories),
  ingredientUnits: ["g", "kg", "mL", "L", "个", "瓶"],
  ingredientUnits: ["g", "kg", "mL", "L", "个", "瓶"],

  // 原地更新导出的数组，保证已经加载本模块的页面也能读取到新分类；
  // 同时写入本地存储，使分类在小程序重新启动后仍然保留。
  saveCategories(type, categories) {
    const target = type==="dish"? this.dishCategories:type==="ingredient"? this.ingredientCategories:null;// 根据type匹配相应的分类数据（原本的分类数据）

    if (!target || !Array.isArray(categories)) {return false;}

    const nextCategories = [...categories];// 修改后的分类数据
    target.splice(0, target.length, ...nextCategories);// 删除原分类假如新分类

    // 保存至本地缓存
    try {
      wx.setStorageSync(STORAGE_KEYS[type], nextCategories);//保存到微信小程序的本地缓存中
      return true;
    } catch (error) {
      console.error(`保存${type}分类失败`, error);
      return false;
    }
  }
};

module.exports = categoryData;
