// All category data belongs to the authenticated kitchen; legacy device-wide caches are not imported.
const categoryData = {
  dishCategories: [],
  ingredientCategories: [],
  ingredientUnits: ["g", "kg", "mL", "L", "个", "瓶"],
  setCategories(dishes, ingredients) {
    this.dishCategories.splice(0, this.dishCategories.length, ...dishes);
    this.ingredientCategories.splice(0, this.ingredientCategories.length, ...ingredients);
  },
  saveCategories(type, categories, expectedVersion, renames = []) {
    return require("../services/kitchenStore").perform("category.save", {
      type, categories, expectedVersion, renames
    }, "分类已保存", "categories:" + type);
  }
};
module.exports = categoryData;
