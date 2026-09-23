const app = getApp();
const store = require("../../services/kitchenStore");
const sync = require("../../services/pageSync");
const actions = require("../../services/menuActions");
const categoryUtil = require("../../utils/category");
const seasonUtil = require("../../utils/season");
Page({
  data: { searchText: "", dishCategories: [], currentDishCategory: "全部", dishes: [], showDishes: [], totalCount: 0, kitchenReady: false, syncStatus: "" },
  onShow() { sync.attach(this, this.refreshDishes); },
  onHide() { sync.detach(this); },
  onUnload() { sync.detach(this); },
  selectDish: actions.selectDish,
  cancelDish: actions.cancelDish,
  clearCart: actions.clearCart,
  submitOrder: actions.submitOrder,
  confirmRandomDishes(e) {
    return store.perform("cart.add", { ids: Array.isArray(e.detail.dishIds) ? e.detail.dishIds : [], count: 1 }, "已加入共享购物车");
  },
  categoriesManagement() {
    if (store.requireKitchen()) wx.navigateTo({ url: "/pages/categoriesManagement/categoriesManagement?type=dish" });
  },
  addDish() {
    if (!store.requireKitchen()) return;
    if (!categoryUtil.dishCategories.length) {
      wx.showModal({ title: "先添加分类", content: "新厨房还没有菜品分类，请先创建一个分类。", success: result => { if (result.confirm) this.categoriesManagement(); } });
      return;
    }
    wx.navigateTo({ url: "/pages/editDish/editDish?dishCategory=" + encodeURIComponent(this.data.currentDishCategory) });
  },
  openDetail(e) { wx.navigateTo({ url: "/pages/detailDish/detailDish?dishId=" + e.currentTarget.dataset.dishId }); },
  searchDish(e) { this.setData({ searchText: e.detail.value }); this.updateShowDishes(); },
  selectCategory(e) { this.setData({ currentDishCategory: e.currentTarget.dataset.category }); this.updateShowDishes(); },
  getStarRating(dish) { const total = dish.likeCount + dish.dislikeCount; return total ? (dish.likeCount / total * 5).toFixed(1) : "0.0"; },
  updateShowDishes() {
    const showDishes = this.data.dishes.filter(dish => (this.data.currentDishCategory === "全部" || dish.dishCategory === this.data.currentDishCategory)
      && (!this.data.searchText || dish.dishName.includes(this.data.searchText)))
      .map(dish => ({ ...dish, starRating: this.getStarRating(dish), isInSeason: seasonUtil.isInSeason(dish.dishSeason) }));
    this.setData({ showDishes });
  },
  refreshDishes() {
    const dishCategories = ["全部", ...categoryUtil.dishCategories];
    this.setData({ dishes: app.globalData.dishes, dishCategories,
      currentDishCategory: dishCategories.includes(this.data.currentDishCategory) ? this.data.currentDishCategory : "全部",
      totalCount: app.globalData.dishes.reduce((sum, dish) => sum + dish.dishCount, 0) });
    this.updateShowDishes();
  }
});
