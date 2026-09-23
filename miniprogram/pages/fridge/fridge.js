const app = getApp();
const store = require("../../services/kitchenStore");
const sync = require("../../services/pageSync");
const categoryUtil = require("../../utils/category");
Page({
  data: { searchText: "", ingredientCategories: [], currentIngredientCategory: "全部", ingredients: [], showIngredients: [],
    consumeList: [], shortageList: [], orderList: [], kitchenReady: false, syncStatus: "" },
  onShow() { sync.attach(this, this.refreshIngredients); },
  onHide() { sync.detach(this); },
  onUnload() { sync.detach(this); },
  refreshIngredients() {
    const ingredientCategories = ["全部", ...categoryUtil.ingredientCategories];
    this.setData({ ingredients: app.globalData.ingredients, consumeList: app.globalData.consumeList, shortageList: app.globalData.shortageList,
      orderList: app.globalData.orderList, ingredientCategories,
      currentIngredientCategory: ingredientCategories.includes(this.data.currentIngredientCategory) ? this.data.currentIngredientCategory : "全部" });
    this.updateShowIngredient();
  },
  categoriesManagement() {
    if (store.requireKitchen()) wx.navigateTo({ url: "/pages/categoriesManagement/categoriesManagement?type=ingredient" });
  },
  addIngredient() {
    if (!store.requireKitchen()) return;
    if (!categoryUtil.ingredientCategories.length) {
      wx.showModal({ title: "先添加分类", content: "新厨房还没有食材分类，请先创建一个分类。", success: result => { if (result.confirm) this.categoriesManagement(); } });
      return;
    }
    wx.navigateTo({ url: "/pages/editIngredient/editIngredient?ingredientCategory=" + encodeURIComponent(this.data.currentIngredientCategory) });
  },
  searchIngredient(e) { this.setData({ searchText: e.detail.value }); this.updateShowIngredient(); },
  selectCategory(e) { this.setData({ currentIngredientCategory: e.currentTarget.dataset.category }); this.updateShowIngredient(); },
  updateShowIngredient() {
    this.setData({ showIngredients: this.data.ingredients.filter(item => item.ingredientCount > 0
      && (this.data.currentIngredientCategory === "全部" || item.ingredientCategory === this.data.currentIngredientCategory)
      && (!this.data.searchText || item.ingredientName.includes(this.data.searchText))) });
  },
  openIngredientDetail(e) { wx.navigateTo({ url: "/pages/detailIngredient/detailIngredient?ingredientId=" + e.currentTarget.dataset.ingredientId }); },
  orderPayload() {
    const order = app.globalData.order;
    return order ? { orderId: order.id, orderVersion: order.version } : null;
  },
  async deleteMenu() {
    const payload = this.orderPayload();
    if (payload && await sync.confirm("取消家庭菜单", "其他成员也会看到菜单被取消；不会扣库存。")) await store.perform("order.cancel", payload, "菜单已取消");
  },
  async deleteDish(e) {
    const payload = this.orderPayload();
    if (payload && await sync.confirm("移除菜品", "将从家庭共享菜单中移除这道菜并重新核算食材。"))
      await store.perform("order.removeDish", { ...payload, id: e.detail.dishId }, "已移除");
  },
  async submitMenu() {
    const payload = this.orderPayload();
    if (payload && await sync.confirm("确认完成菜单", "将按照云端最新库存扣除食材，此操作由所有家庭成员共享。"))
      await store.perform("order.complete", payload, "菜单已完成");
  }
});
