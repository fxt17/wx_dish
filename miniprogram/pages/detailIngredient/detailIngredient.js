const app = getApp();
const store = require("../../services/kitchenStore");
const sync = require("../../services/pageSync");
Page({
  data: { ingredient: null, missing: false },
  onLoad(options) { this.ingredientId = Number(options.ingredientId); },
  onShow() { sync.attach(this, this.refreshIngredient); },
  onHide() { sync.detach(this); },
  onUnload() { sync.detach(this); },
  refreshIngredient() {
    const ingredient = app.globalData.ingredients.find(item => item.ingredientId === this.ingredientId);
    this.setData({ ingredient: ingredient || null, missing: !ingredient });
  },
  editIngredient() {
    if (this.data.ingredient && store.requireKitchen()) wx.navigateTo({ url: "/pages/editIngredient/editIngredient?ingredientId=" + this.ingredientId });
  },
  async deleteIngredient() {
    const ingredient = this.data.ingredient;
    if (!ingredient || !await sync.confirm("删除共享食材", "将删除这批库存，并重新计算家庭菜单的缺料信息。")) return;
    if (await store.perform("ingredient.delete", { id: ingredient.ingredientId, expectedVersion: ingredient._version }, "食材已删除")) wx.navigateBack();
  }
});
