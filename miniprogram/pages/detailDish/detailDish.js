const app = getApp();
const store = require("../../services/kitchenStore");
const sync = require("../../services/pageSync");
const actions = require("../../services/menuActions");
const seasonUtil = require("../../utils/season");
Page({
  data: { dish: null, dishes: [], totalCount: 0, dishSeasonText: "", missing: false },
  onLoad(options) { this.dishId = Number(options.dishId); },
  onShow() { sync.attach(this, this.refreshDish); },
  onHide() { sync.detach(this); },
  onUnload() { sync.detach(this); },
  refreshDish() {
    const dish = app.globalData.dishes.find(item => item.dishId === this.dishId);
    this.setData({ dish: dish || null, missing: !dish, dishes: app.globalData.dishes,
      dishSeasonText: dish ? seasonUtil.formatSeason(dish.dishSeason) : "",
      totalCount: app.globalData.dishes.reduce((sum, item) => sum + item.dishCount, 0) });
  },
  selectDish: actions.selectDish,
  cancelDish: actions.cancelDish,
  clearCart: actions.clearCart,
  submitOrder: actions.submitOrder,
  editDish() { if (this.data.dish && store.requireKitchen()) wx.navigateTo({ url: "/pages/editDish/editDish?dishId=" + this.dishId }); },
  async deleteDish() {
    const dish = this.data.dish;
    if (!dish || !await sync.confirm("删除家庭菜谱", "所有厨房成员都会看到此菜谱被删除，确定继续吗？")) return;
    if (await store.perform("dish.delete", { id: dish.dishId, expectedVersion: dish._version }, "菜谱已删除")) wx.navigateBack();
  },
  likeDish() { return this.rate(true); },
  dislikeDish() { return this.rate(false); },
  rate(like) {
    if (this.data.dish && this.data.dish.canEvaluate) return store.perform("dish.rate", { id: this.dishId, like }, "感谢评价");
  }
});
