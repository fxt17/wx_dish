const seasonUtil = require("./season.js");

function normalizeCategories(categories) {
  return [...new Set((Array.isArray(categories) ? categories : []).filter(
    category => typeof category === "string" && category.trim() && category !== "全部"
  ))];
}

function normalizeSettings(value) {
  const source = value && value.version === 1 ? value : {};
  const rules = [];
  const seen = new Set();
  (Array.isArray(source.rules) ? source.rules : []).forEach(rule => {
    if (!rule || typeof rule.category !== "string" || !rule.category.trim()
      || rule.category === "全部" || seen.has(rule.category)) { return; }
    seen.add(rule.category);
    const count = Number(rule.count);
    rules.push({
      category: rule.category,
      enabled: rule.enabled === true,
      count: Number.isSafeInteger(count) && count > 0 ? count : 1
    });
  });
  return {
    version: 1,
    configured: source.configured === true,
    seasonalOnly: source.seasonalOnly === true,
    rules
  };
}

// 候选去重与时令筛选共用此入口，设置中的可选数量与实际抽取保持一致。
function getCandidates(dishes, seasonalOnly, month = new Date().getMonth() + 1) {
  const seen = new Set();
  return (Array.isArray(dishes) ? dishes : []).filter(dish => {
    if (!dish || dish.dishId === undefined || dish.dishId === null
      || String(dish.dishId) === "" || typeof dish.dishName !== "string"
      || !dish.dishName.trim()) { return false; }
    const key = String(dish.dishId);
    if (seen.has(key)) { return false; }
    seen.add(key);
    return !seasonalOnly || seasonUtil.isInSeason(dish.dishSeason, month);
  });
}

// 局部 Fisher–Yates 洗牌：不改变传入数组，同一次抽取不会重复。
function sample(candidates, count, random) {
  const pool = candidates.slice();
  const size = Math.min(count, pool.length);
  for (let index = 0; index < size; index++) {
    const target = index + Math.floor(random() * (pool.length - index));
    [pool[index], pool[target]] = [pool[target], pool[index]];
  }
  return pool.slice(0, size);
}

function pickRandomDishes(dishes, categories, value,
  month = new Date().getMonth() + 1, random = Math.random) {
  const settings = normalizeSettings(value);
  const candidates = getCandidates(dishes, settings.seasonalOnly, month);
  if (!settings.configured) {
    return {
      dishes: sample(candidates, 1, random),
      requestedTotal: 1,
      messages: candidates.length ? [] : ["暂无符合条件的菜品，请先添加菜谱或调整时令设置。"]
    };
  }

  const currentCategories = new Set(normalizeCategories(categories));
  const result = { dishes: [], requestedTotal: 0, messages: [] };
  const enabledRules = settings.rules.filter(rule => rule.enabled);
  if (!enabledRules.length) {
    result.messages.push("尚未勾选参与随机的分类，请长按骰子 3 秒设置。");
  }
  enabledRules.forEach(rule => {
    result.requestedTotal += rule.count;
    if (!currentCategories.has(rule.category)) {
      result.messages.push(`“${rule.category}”分类已变更，请长按骰子更新设置。`);
      return;
    }
    const pool = candidates.filter(dish => dish.dishCategory === rule.category);
    result.dishes.push(...sample(pool, rule.count, random));
    if (pool.length < rule.count) {
      result.messages.push(`${rule.category}要求 ${rule.count} 道，符合条件的只有 ${pool.length} 道。`);
    }
  });
  return result;
}

module.exports = { normalizeCategories, normalizeSettings, getCandidates, pickRandomDishes };
