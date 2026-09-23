// Pure business rules. Only the cloud function may persist the result.
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function text(value, max = 80, optional = false) {
  if (typeof value !== "string" || value.length > max || (!optional && !value.trim())) fail("INVALID", "请检查输入内容和长度");
  return value.trim();
}
function number(value, min = 0, max = 1000000) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) fail("INVALID", "数量不正确");
  return value;
}
function sameVersion(actual, expected) {
  if (actual !== expected) fail("CONFLICT", "其他成员已修改这份数据。你的修改已保留，请查看最新数据后重新编辑。");
}
function emptyState() {
  return { dishes: [], ingredients: [], dishCategories: [], ingredientCategories: [],
    categoryVersions: { dish: 0, ingredient: 0 }, cartVersion: 0, order: null,
    randomSettings: { version: 1, configured: false, seasonalOnly: false, rules: [] },
    randomVersion: 0, dicePosition: { version: 1, x: 1, y: 1 } };
}
function day(now) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
function date(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail("INVALID", "请输入有效日期");
  return value;
}
function expiry(item) {
  // A category rename must not silently shorten already-saved stock's shelf life.
  if (item.ingredientExpireDate) return date(item.ingredientExpireDate);
  const defaults = { "蔬菜": 7, "水果": 7, "蛋奶": 7, "肉类": 30, "酒水": 60 };
  const start = date(item.ingredientProduceDate || item.ingredientPurchaseDate);
  return new Date(Date.parse(start) + (item.ingredientShelfLife || defaults[item.ingredientCategory] || 3) * 86400000).toISOString().slice(0, 10);
}
function lists(state, now) {
  const needs = new Map();
  for (const { dish } of state.order ? state.order.items : []) {
    for (const item of dish.dishIngredients) {
      const key = JSON.stringify([item.name, item.unit]);
      const row = needs.get(key) || { name: item.name, unit: item.unit, count: 0 };
      row.count += item.count * dish.dishCount;
      needs.set(key, row);
    }
  }
  const consumeList = [], shortageList = [];
  for (const need of needs.values()) {
    const available = state.ingredients.filter(item => item.ingredientName === need.name && item.ingredientUnit === need.unit && expiry(item) >= day(now))
      .reduce((sum, item) => sum + item.ingredientCount, 0);
    const used = Math.min(available, need.count);
    if (used > 0) consumeList.push({ ...need, count: used });
    if (need.count - used > 0.00000001) shortageList.push({ ...need, count: Number((need.count - used).toFixed(8)) });
  }
  return { consumeList, shortageList, orderList: state.order ? state.order.items : [] };
}
const units = ["g", "kg", "mL", "L", "个", "瓶"];
function amount(count, unit) {
  number(count, 0.00000001);
  if (!units.includes(unit) || (["个", "瓶"].includes(unit) && !Number.isInteger(count))) fail("INVALID", "请检查数量和单位");
}
function image(value, previous, context) {
  if (!value || value === "/images/myicons/食物.png") return value || "";
  if (value === previous) return value;
  const prefix = `/kitchens/${context.kitchenId}/${context.userId}/`;
  if (typeof value !== "string" || value.length > 600 || !value.startsWith("cloud://") || value.slice(8).split("/").slice(1).join("/").indexOf(prefix.slice(1)) !== 0 || value.includes("..")) fail("INVALID", "请先将图片上传到当前厨房");
  return value;
}
function find(items, key, id) {
  const item = items.find(row => row[key] === id);
  if (!item) fail("NOT_FOUND", "数据已被删除，请刷新后重试");
  return item;
}
function order(state, payload) {
  if (!state.order || state.order.id !== payload.orderId) fail("CONFLICT", "当前菜单已经变更或完成，请刷新后重试");
  sameVersion(state.order.version, payload.orderVersion);
  return state.order;
}
function apply(state, action, payload, context) {
  const p = payload || {}, now = context.now;
  let completedOrder = null, rating = null;
  if (action === "dish.save") {
    const source = p.dish || {};
    const old = p.isNew ? null : find(state.dishes, "dishId", source.dishId);
    sameVersion(old ? old._version : 0, p.expectedVersion);
    if (!state.dishCategories.includes(source.dishCategory)) fail("INVALID", "请先创建并选择菜品分类");
    if (!Array.isArray(source.dishIngredients) || source.dishIngredients.length > 60 || !Array.isArray(source.dishCookingSteps) || source.dishCookingSteps.length > 60) fail("INVALID", "食材或步骤数量不正确");
    const season = source.dishSeason || { startMonth: 1, endMonth: 12 };
    if (![season.startMonth, season.endMonth].every(value => Number.isInteger(value) && value >= 1 && value <= 12)) fail("INVALID", "时令月份不正确");
    const dish = { dishId: old ? old.dishId : context.newId, dishName: text(source.dishName),
      dishCategory: source.dishCategory, dishDescription: text(source.dishDescription || "", 3000, true),
      dishImage: image(source.dishImage, old && old.dishImage, context), dishSeason: { startMonth: season.startMonth, endMonth: season.endMonth },
      dishIngredients: source.dishIngredients.map(item => { amount(item.count, item.unit); return { name: text(item.name), count: item.count, unit: item.unit }; }),
      dishCookingSteps: source.dishCookingSteps.map(step => text(step, 1500, true)),
      dishCount: old ? old.dishCount : 0, dishOrderCount: old ? old.dishOrderCount : 0,
      likeCount: old ? old.likeCount : 0, dislikeCount: old ? old.dislikeCount : 0,
      canEvaluate: false, evaluationUsers: old ? old.evaluationUsers || [] : [],
      evaluationOrderId: old ? old.evaluationOrderId || "" : "",
      dishRating: old ? old.dishRating : 0, _version: (old ? old._version : 0) + 1 };
    if (old) state.dishes[state.dishes.indexOf(old)] = dish; else state.dishes.push(dish);
  } else if (action === "dish.delete") {
    const dish = find(state.dishes, "dishId", p.id); sameVersion(dish._version, p.expectedVersion);
    if (state.order && state.order.items.some(row => row.dish.dishId === p.id)) fail("IN_USE", "该菜品在当前菜单中，请先从菜单移除");
    state.dishes.splice(state.dishes.indexOf(dish), 1); state.cartVersion++;
  } else if (action === "ingredient.save") {
    const source = p.ingredient || {};
    const old = p.isNew ? null : find(state.ingredients, "ingredientId", source.ingredientId);
    sameVersion(old ? old._version : 0, p.expectedVersion);
    amount(source.ingredientCount, source.ingredientUnit);
    if (!state.ingredientCategories.includes(source.ingredientCategory)) fail("INVALID", "请先创建并选择食材分类");
    const item = { ingredientId: old ? old.ingredientId : context.newId, ingredientName: text(source.ingredientName),
      ingredientCount: source.ingredientCount, ingredientUnit: source.ingredientUnit, ingredientCategory: source.ingredientCategory,
      ingredientImage: image(source.ingredientImage, old && old.ingredientImage, context),
      ingredientPurchaseDate: date(source.ingredientPurchaseDate), ingredientProduceDate: source.ingredientProduceDate ? date(source.ingredientProduceDate) : "",
      ingredientShelfLife: number(source.ingredientShelfLife || 0, 0, 36500), _version: (old ? old._version : 0) + 1 };
    if (!Number.isInteger(item.ingredientShelfLife)) fail("INVALID", "保质期应为整数天");
    if (item.ingredientPurchaseDate > day(now) || item.ingredientProduceDate > item.ingredientPurchaseDate) fail("INVALID", "请检查生产和购买日期");
    item.ingredientExpireDate = expiry(item);
    if (old) state.ingredients[state.ingredients.indexOf(old)] = item; else state.ingredients.push(item);
  } else if (action === "ingredient.delete") {
    const item = find(state.ingredients, "ingredientId", p.id); sameVersion(item._version, p.expectedVersion);
    state.ingredients.splice(state.ingredients.indexOf(item), 1);
  } else if (action === "cart.set" || action === "cart.add") {
    if (!Array.isArray(p.ids) || p.ids.length > 300 || ![0, 1].includes(p.count)) fail("INVALID", "选菜参数不正确");
    for (const id of new Set(p.ids)) find(state.dishes, "dishId", id).dishCount = p.count;
    state.cartVersion++;
  } else if (action === "cart.clear") {
    sameVersion(state.cartVersion, p.cartVersion);
    state.dishes.forEach(dish => { dish.dishCount = 0; }); state.cartVersion++;
  } else if (action === "order.submit") {
    sameVersion(state.cartVersion, p.cartVersion);
    if ((state.order ? state.order.id : null) !== p.previousOrderId) fail("CONFLICT", "其他成员已更换菜单，请重新确认");
    const selected = state.dishes.filter(dish => dish.dishCount > 0);
    if (!selected.length) fail("INVALID", "请先选择菜品");
    state.order = { id: context.requestId, version: 1, createdAt: now, createdBy: context.userId,
      items: selected.map(dish => ({ dish: JSON.parse(JSON.stringify(dish)) })) };
    state.dishes.forEach(dish => { dish.dishCount = 0; }); state.cartVersion++;
  } else if (action === "order.cancel") {
    order(state, p); state.order = null;
  } else if (action === "order.removeDish") {
    const current = order(state, p);
    current.items = current.items.filter(row => row.dish.dishId !== p.id); current.version++;
    if (!current.items.length) state.order = null;
  } else if (action === "order.complete") {
    const current = order(state, p), result = lists(state, now);
    if (result.shortageList.length) fail("SHORTAGE", "库存已变化或过期，仍有缺少食材。请刷新缺料清单。");
    for (const need of result.consumeList) {
      let count = need.count;
      const candidates = state.ingredients.filter(item => item.ingredientName === need.name && item.ingredientUnit === need.unit && expiry(item) >= day(now))
        .sort((a, b) => expiry(a).localeCompare(expiry(b)));
      for (const item of candidates) {
        const used = Math.min(item.ingredientCount, count);
        if (used > 0) { item.ingredientCount = Number((item.ingredientCount - used).toFixed(8)); item._version++; count -= used; }
        if (count <= 0.00000001) break;
      }
    }
    current.items.forEach(row => {
      const dish = state.dishes.find(item => item.dishId === row.dish.dishId);
      if (dish) {
        dish.evaluationUsers = [...context.memberIds]; dish.evaluationOrderId = current.id;
        dish.dishOrderCount += row.dish.dishCount;
      }
    });
    completedOrder = { ...current, completedAt: now, completedBy: context.userId, consumeList: result.consumeList };
    state.order = null;
  } else if (action === "dish.rate") {
    const dish = find(state.dishes, "dishId", p.id);
    if (!(dish.evaluationUsers || []).includes(context.userId)) fail("CONFLICT", "你当前没有这道菜的待评价资格，或已经评价");
    if (p.like !== true && p.like !== false) fail("INVALID", "评价参数不正确");
    dish[p.like ? "likeCount" : "dislikeCount"]++;
    dish.evaluationUsers = dish.evaluationUsers.filter(id => id !== context.userId);
    rating = { dishId: dish.dishId, orderId: dish.evaluationOrderId, userId: context.userId, like: p.like, createdAt: now };
    dish.dishRating = Math.round(dish.likeCount / (dish.likeCount + dish.dislikeCount) * 100);
  } else if (action === "category.save") {
    if (!["dish", "ingredient"].includes(p.type)) fail("INVALID", "分类类型不正确");
    sameVersion(state.categoryVersions[p.type], p.expectedVersion);
    if (!Array.isArray(p.categories) || p.categories.length > 100) fail("INVALID", "分类数量不正确");
    const values = p.categories.map(value => text(value, 30));
    if (new Set(values).size !== values.length || values.includes("全部")) fail("INVALID", "分类不能重名或使用“全部”");
    const key = p.type === "dish" ? "dishCategories" : "ingredientCategories";
    const field = p.type === "dish" ? "dishCategory" : "ingredientCategory";
    const items = p.type === "dish" ? state.dishes : state.ingredients;
    const renames = Array.isArray(p.renames) ? p.renames : [];
    if (renames.length > 100) fail("INVALID", "重命名次数过多，请先保存");
    for (const rename of renames) {
      const from = text(rename.from, 30), to = text(rename.to, 30);
      // An unsaved new category may be renamed before its first save; it has no
      // persisted records to migrate. The category version guards stale clients.
      if (!state[key].includes(from)) continue;
      items.filter(item => item[field] === from).forEach(item => { item[field] = to; item._version++; });
      state[key] = state[key].map(value => value === from ? to : value);
      if (p.type === "dish") state.randomSettings.rules.forEach(rule => { if (rule.category === from) rule.category = to; });
    }
    if (items.some(item => !values.includes(item[field]))) fail("IN_USE", "分类中仍有菜品或食材，请先调整其分类再删除");
    state[key] = values; state.categoryVersions[p.type]++;
    if (p.type === "dish") { state.randomSettings.rules = state.randomSettings.rules.filter(rule => values.includes(rule.category)); state.randomVersion++; }
  } else if (action === "random.settings") {
    sameVersion(state.randomVersion, p.expectedVersion);
    const settings = p.settings || {};
    if (!Array.isArray(settings.rules) || settings.rules.length > 100) fail("INVALID", "随机规则不正确");
    const rules = settings.rules.map(rule => ({ category: text(rule.category, 30), enabled: rule.enabled === true, count: number(rule.count, 0, 300) }));
    if (new Set(rules.map(rule => rule.category)).size !== rules.length) fail("INVALID", "随机分类重复");
    const month = Number(day(now).slice(5, 7));
    for (const rule of rules.filter(rule => rule.enabled)) {
      const available = state.dishes.filter(dish => {
        const season = dish.dishSeason || { startMonth: 1, endMonth: 12 };
        const matches = season.startMonth <= season.endMonth ? month >= season.startMonth && month <= season.endMonth : month >= season.startMonth || month <= season.endMonth;
        return dish.dishCategory === rule.category && (!settings.seasonalOnly || matches);
      }).length;
      if (!state.dishCategories.includes(rule.category) || !Number.isInteger(rule.count) || rule.count < 1 || rule.count > available) fail("INVALID", "可选菜品已变化，请重新设置随机数量");
    }
    if (!rules.some(rule => rule.enabled)) fail("INVALID", "请至少选择一个分类");
    state.randomSettings = { version: 1, configured: true, seasonalOnly: settings.seasonalOnly === true, rules }; state.randomVersion++;
  } else if (action === "random.position") {
    state.dicePosition = { version: 1, x: number(p.x, 0, 1), y: number(p.y, 0, 1) };
  } else fail("INVALID", "不支持的操作");
  if (state.dishes.length > 300 || state.ingredients.length > 1000 || Buffer.byteLength(JSON.stringify(state), "utf8") > 600000) fail("LIMIT", "厨房数据已达到当前版本容量上限，请联系维护者扩容");
  return { state, completedOrder, rating };
}
module.exports = { fail, text, sameVersion, emptyState, expiry, lists, day, apply };
