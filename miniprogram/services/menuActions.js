const store = require("./kitchenStore");
const { confirm } = require("./pageSync");
const ingredientUtil = require("../utils/ingredient");
module.exports = {
  selectDish(e) { return store.perform("cart.set", { ids: [e.detail.dishId], count: 1 }); },
  cancelDish(e) { return store.perform("cart.set", { ids: [e.detail.dishId], count: 0 }); },
  clearCart() { return store.perform("cart.clear", { cartVersion: getApp().globalData.cartVersion }); },
  async submitOrder() {
    if (!store.requireKitchen()) return;
    const data = getApp().globalData;
    if (!data.dishes.some(dish => dish.dishCount > 0)) { wx.showToast({ title: "请先选择菜品", icon: "none" }); return; }
    ingredientUtil.updateIngredientExpire(data.ingredients);
    const preview = ingredientUtil.consumeIngredients(data.ingredients, data.dishes);
    const payload = { cartVersion: data.cartVersion, previousOrderId: data.order ? data.order.id : null };
    let message = data.order ? "将替换当前家庭菜单。" : "将提交家庭共享菜单。";
    message += preview.shortageList.length ? `目前缺少 ${preview.shortageList.length} 样食材，可在冰箱中查看和补齐。` : "当前食材充足。";
    message += "此时不会扣除库存。";
    if (await confirm("提交菜单", message)) await store.perform("order.submit", payload, "菜单已保存");
  }
};
