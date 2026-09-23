// Run from the repository root: node tests/kitchen-sync.test.js
// VM loading also works in restricted Windows environments where module realpath is unavailable.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert/strict");
const crypto = require("crypto");
const clone = value => JSON.parse(JSON.stringify(value));
function loader(globals = {}) {
  const cache = new Map();
  const load = filename => {
    filename = path.resolve(filename);
    if (!path.extname(filename)) filename += ".js";
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    const context = { module, exports: module.exports, Buffer, console, Date, setTimeout, clearTimeout,
      setInterval, clearInterval, ...globals, require: id => id.startsWith(".") ? load(path.resolve(path.dirname(filename), id)) : require(id) };
    new vm.Script(fs.readFileSync(filename, "utf8"), { filename }).runInNewContext(context);
    return module.exports;
  };
  return load;
}
class Database {
  constructor() { this.documents = {}; this.tail = Promise.resolve(); }
  runTransaction(callback) {
    const work = this.tail.then(async () => {
      const draft = clone(this.documents);
      const result = await callback({ collection: name => ({ doc: id => ({
        get: async () => ({ data: draft[name + ":" + id] ? clone(draft[name + ":" + id]) : null }),
        set: async ({ data }) => { draft[name + ":" + id] = clone(data); },
        remove: async () => { delete draft[name + ":" + id]; }
      }) }) });
      this.documents = draft; return clone(result);
    });
    this.tail = work.catch(() => {}); return work;
  }
}
const load = loader();
const { createService } = load("cloudfunctions/kitchenApi/service.js");
const db = new Database();
const now = Date.parse("2026-09-19T04:00:00Z");
const api = who => createService(db, () => ({ OPENID: who, APPID: "test-app" }), () => now);
const alice = api("alice"), bob = api("bob"), outsider = api("outsider");
let sequence = 0;
const requestId = () => "test_request_" + String(++sequence).padStart(18, "0");
async function mutate(client, kitchenId, action, payload = {}, id = requestId()) {
  return client({ action, payload, kitchenId, requestId: id });
}
async function rejects(fn, code) { await assert.rejects(fn, error => error.code === code); }
const results = [];
async function test(name, fn) { await fn(); results.push(name); console.log("PASS " + name); }
async function run() {
  let a, b, other, kitchenId, woodId, dishId;
  await test("first login and new kitchen contain no seeded business data", async () => {
    a = await alice({ action: "bootstrap", payload: { nickname: "Alice" } });
    assert.equal(a.kitchen, null); assert.equal(a.state.dishes.length, 0);
    a = await mutate(alice, null, "create", { name: "Test Kitchen" }); kitchenId = a.kitchen.id;
    assert.deepEqual(a.state.dishCategories, []); assert.deepEqual(a.state.ingredients, []);
  });
  await test("trusted cloud identity is required", async () => {
    const bad = createService(db, () => ({}), () => now);
    await rejects(() => bad({ action: "bootstrap", payload: { OPENID: "alice" } }), "UNAUTHENTICATED");
  });
  await test("idempotent create survives a lost response", async () => {
    const david = api("david"); await david({ action: "bootstrap", payload: {} }); const id = requestId();
    const first = await mutate(david, null, "create", { name: "D" }, id);
    const second = await mutate(david, null, "create", { name: "D" }, id);
    assert.equal(second.kitchen.id, first.kitchen.id); assert.equal(second.duplicate, true);
  });
  await test("another member joins by invitation and sees same kitchen", async () => {
    await bob({ action: "bootstrap", payload: { nickname: "Bob" } });
    b = await mutate(bob, null, "join", { code: a.kitchen.inviteCode.toLowerCase() });
    assert.equal(b.kitchen.id, kitchenId); assert.equal(b.kitchen.members.length, 2);
    assert.equal(b.kitchen.inviteCode, "");
  });
  await test("different kitchens are isolated, forged kitchen id is rejected", async () => {
    await outsider({ action: "bootstrap", payload: {} });
    other = await mutate(outsider, null, "create", { name: "Other" });
    await rejects(() => mutate(outsider, kitchenId, "cart.clear", { cartVersion: 0 }), "FORBIDDEN");
    const result = await outsider({ action: "getState", kitchenId }); assert.equal(result.kitchen.id, other.kitchen.id);
  });
  await test("invalid invites are rate limited without creating membership", async () => {
    const eve = api("eve"); await eve({ action: "bootstrap", payload: {} });
    for (let i = 0; i < 5; i++) await rejects(() => mutate(eve, null, "join", { code: "000000000000" }), "INVALID_INVITE");
    await rejects(() => mutate(eve, null, "join", { code: a.kitchen.inviteCode }), "RATE_LIMIT");
    assert.equal((await eve({ action: "getState" })).kitchen, null);
  });
  await test("only kitchen creator can rotate invite", async () => {
    await rejects(() => mutate(bob, kitchenId, "rotateInvite"), "FORBIDDEN");
    const previous = a.kitchen.inviteCode; a = await mutate(alice, kitchenId, "rotateInvite");
    assert.notEqual(a.kitchen.inviteCode, previous);
    const frank = api("frank"); await frank({ action: "bootstrap", payload: {} });
    await rejects(() => mutate(frank, null, "join", { code: previous }), "INVALID_INVITE");
  });
  await test("shared categories and recipes persist with server-controlled counters", async () => {
    a = await mutate(alice, kitchenId, "category.save", { type: "dish", categories: ["热菜"], expectedVersion: 0 });
    a = await mutate(alice, kitchenId, "category.save", { type: "ingredient", categories: ["蔬菜"], expectedVersion: 0 });
    a = await mutate(alice, kitchenId, "dish.save", { isNew: true, expectedVersion: 0, dish: {
      dishName: "木耳菜", dishCategory: "热菜", dishImage: "", dishDescription: "", dishCount: 999, likeCount: 9000,
      dishSeason: { startMonth: 1, endMonth: 12 }, dishIngredients: [{ name: "木耳", count: 200, unit: "g" }], dishCookingSteps: ["煮熟"]
    } });
    dishId = a.state.dishes[0].dishId; assert.equal(a.state.dishes[0].dishCount, 0); assert.equal(a.state.dishes[0].likeCount, 0);
    b = await bob({ action: "getState" }); assert.equal(b.state.dishes[0].dishId, dishId);
  });
  await test("inventory is stored and new stock uses same authoritative calculation", async () => {
    a = await mutate(alice, kitchenId, "ingredient.save", { isNew: true, expectedVersion: 0, ingredient: {
      ingredientName: "木耳", ingredientCount: 100, ingredientUnit: "g", ingredientCategory: "蔬菜",
      ingredientImage: "", ingredientPurchaseDate: "2026-09-19", ingredientProduceDate: "", ingredientShelfLife: 7
    } }); woodId = a.state.ingredients[0].ingredientId;
  });
  await test("cart is shared and submitting captures independent menu requirements", async () => {
    a = await mutate(alice, kitchenId, "cart.set", { ids: [dishId], count: 1 });
    b = await bob({ action: "getState" }); assert.equal(b.state.dishes[0].dishCount, 1);
    a = await mutate(alice, kitchenId, "order.submit", { cartVersion: a.state.cartVersion, previousOrderId: null });
    assert.equal(a.state.dishes[0].dishCount, 0); assert.equal(a.orderList[0].dish.dishCount, 1);
    assert.equal(a.shortageList[0].count, 100); assert.equal(a.state.ingredients[0].ingredientCount, 100);
  });
  await test("editing inventory updates shortages for other members", async () => {
    const item = a.state.ingredients[0];
    a = await mutate(alice, kitchenId, "ingredient.save", { isNew: false, expectedVersion: item._version, ingredient: { ...item, ingredientCount: 300 } });
    b = await bob({ action: "getState" }); assert.equal(b.shortageList.length, 0); assert.equal(b.consumeList[0].count, 200);
    assert.equal(b.state.ingredients[0].ingredientCount, 300);
  });
  await test("concurrent edits to same item reject stale versions without overwriting", async () => {
    const item = a.state.ingredients[0];
    const operations = [alice, bob].map((client, index) => mutate(client, kitchenId, "ingredient.save", {
      isNew: false, expectedVersion: item._version, ingredient: { ...item, ingredientCount: 400 + index }
    }));
    const settled = await Promise.allSettled(operations);
    assert.equal(settled.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(settled.find(result => result.status === "rejected").reason.code, "CONFLICT");
    a = await alice({ action: "getState" }); assert.equal(a.state.ingredients[0].ingredientCount, 400);
  });
  await test("recipe editing cannot rewrite a submitted menu", async () => {
    const dish = a.state.dishes[0];
    a = await mutate(alice, kitchenId, "dish.save", { isNew: false, expectedVersion: dish._version,
      dish: { ...dish, dishIngredients: [{ name: "木耳", count: 500, unit: "g" }] } });
    assert.equal(a.consumeList[0].count, 200); assert.equal(a.orderList[0].dish.dishIngredients[0].count, 200);
  });
  await test("active-menu dishes cannot be removed from recipe library", async () => {
    await rejects(() => mutate(alice, kitchenId, "dish.delete", { id: dishId, expectedVersion: a.state.dishes[0]._version }), "IN_USE");
  });
  await test("expired inventory cannot fulfill an order", async () => {
    let item = a.state.ingredients[0];
    a = await mutate(alice, kitchenId, "ingredient.save", { isNew: false, expectedVersion: item._version,
      ingredient: { ...item, ingredientPurchaseDate: "2000-01-01" } });
    assert.equal(a.shortageList[0].count, 200);
    await rejects(() => mutate(alice, kitchenId, "order.complete", { orderId: a.state.order.id, orderVersion: a.state.order.version }), "SHORTAGE");
    item = a.state.ingredients[0];
    a = await mutate(alice, kitchenId, "ingredient.save", { isNew: false, expectedVersion: item._version,
      ingredient: { ...item, ingredientPurchaseDate: "2026-09-19" } });
  });
  await test("completion is atomic and duplicate retries do not consume twice", async () => {
    const id = requestId(), payload = { orderId: a.state.order.id, orderVersion: a.state.order.version };
    a = await mutate(alice, kitchenId, "order.complete", payload, id);
    assert.equal(a.state.ingredients[0].ingredientCount, 200); assert.equal(a.state.order, null);
    const repeated = await mutate(alice, kitchenId, "order.complete", payload, id);
    assert.equal(repeated.state.ingredients[0].ingredientCount, 200); assert.equal(repeated.duplicate, true);
    await rejects(() => mutate(bob, kitchenId, "order.complete", payload), "CONFLICT");
    assert.equal(Object.keys(db.documents).filter(key => key.startsWith("kitchen_orders:")).length, 1);
  });
  await test("same id cannot be reused with a different operation payload", async () => {
    const id = requestId(); await mutate(alice, kitchenId, "cart.set", { ids: [dishId], count: 1 }, id);
    await rejects(() => mutate(alice, kitchenId, "cart.set", { ids: [dishId], count: 0 }, id), "INVALID");
  });
  await test("each member can rate once and individual votes are retained", async () => {
    a = await mutate(alice, kitchenId, "dish.rate", { id: dishId, like: true });
    assert.equal(a.state.dishes[0].canEvaluate, false);
    b = await bob({ action: "getState" }); assert.equal(b.state.dishes[0].canEvaluate, true);
    await rejects(() => mutate(alice, kitchenId, "dish.rate", { id: dishId, like: true }), "CONFLICT");
    b = await mutate(bob, kitchenId, "dish.rate", { id: dishId, like: false });
    assert.equal(b.state.dishes[0].dishRating, 50);
    assert.equal(Object.keys(db.documents).filter(key => key.startsWith("kitchen_ratings:")).length, 2);
  });
  await test("random rules and dice position are shared", async () => {
    a = await alice({ action: "getState" });
    a = await mutate(alice, kitchenId, "random.settings", { expectedVersion: a.state.randomVersion,
      settings: { seasonalOnly: true, rules: [{ category: "热菜", enabled: true, count: 1 }] } });
    a = await mutate(alice, kitchenId, "random.position", { x: 0.2, y: 0.3 });
    b = await bob({ action: "getState" }); assert.equal(b.state.randomSettings.seasonalOnly, true); assert.equal(b.state.dicePosition.x, 0.2);
    await rejects(() => mutate(alice, kitchenId, "random.settings", { expectedVersion: a.state.randomVersion,
      settings: { rules: [{ category: "热菜", enabled: true, count: 2 }] } }), "INVALID");
  });
  await test("category rename migrates existing records and random rules", async () => {
    a = await mutate(alice, kitchenId, "category.save", { type: "dish", categories: ["家常菜"], expectedVersion: a.state.categoryVersions.dish,
      renames: [{ from: "热菜", to: "家常菜" }] });
    assert.equal(a.state.dishes[0].dishCategory, "家常菜"); assert.equal(a.state.randomSettings.rules[0].category, "家常菜");
    await rejects(() => mutate(alice, kitchenId, "category.save", { type: "dish", categories: [], expectedVersion: a.state.categoryVersions.dish }), "IN_USE");
  });
  await test("arbitrary foreign image references are rejected", async () => {
    const dish = a.state.dishes[0];
    await rejects(() => mutate(alice, kitchenId, "dish.save", { isNew: false, expectedVersion: dish._version,
      dish: { ...dish, dishImage: "cloud://other/kitchens/foreign/user/private.jpg" } }), "INVALID");
  });
  await test("deleting inventory updates derived shortages", async () => {
    a = await mutate(alice, kitchenId, "order.submit", { cartVersion: a.state.cartVersion, previousOrderId: null });
    a = await mutate(alice, kitchenId, "ingredient.delete", { id: woodId, expectedVersion: a.state.ingredients[0]._version });
    assert.equal(a.shortageList[0].count, 500); assert.equal(a.consumeList.length, 0);
  });
  await test("leaving removes access but preserves shared data", async () => {
    b = await mutate(bob, kitchenId, "leave"); assert.equal(b.kitchen, null);
    await rejects(() => mutate(bob, kitchenId, "random.position", { x: 0, y: 0 }), "FORBIDDEN");
    a = await alice({ action: "getState" }); assert.equal(a.state.dishes.length, 1); assert.equal(a.kitchen.members.length, 1);
    await rejects(() => mutate(alice, kitchenId, "leave"), "OWNER");
  });
  await clientTests(alice, kitchenId);
  await recoveryTests();
  await pageTests();
  console.log("\n" + results.length + " scenarios passed.");
}
async function clientTests(server, kitchenId) {
  const storage = new Map(); let offline = false, loseReply = false, deferredRead = null, calls = 0;
  const app = {};
  const wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, clone(value)),
    showModal() {}, showToast() {}, cloud: { callFunction: async ({ data }) => {
      calls++; if (offline) throw new Error("offline");
      let result;
      try { result = { ok: true, data: await server(data) }; } catch (error) { result = { ok: false, error: { code: error.code, message: error.message } }; }
      if (data.action === "getState" && deferredRead) return new Promise(resolve => { deferredRead.resolve = () => resolve({ result }); });
      if (loseReply && data.action !== "getState" && data.action !== "bootstrap") { loseReply = false; throw new Error("reply lost"); }
      return { result };
    } }
  };
  const fresh = () => {
    const localLoad = loader({ wx, getApp: () => app, setInterval: () => 1, clearInterval() {} });
    const store = localLoad("miniprogram/services/kitchenStore.js"); store.initialize(app); return store;
  };
  let store = fresh();
  await test("client starts empty and ignores old device-wide sample caches", async () => {
    storage.set("miniprogram_dish_categories", ["legacy"]);
    assert.equal(app.globalData.dishes.length, 0); assert.equal(store.user, null);
    await store.login(); assert.equal(store.kitchen.id, kitchenId); assert.equal(app.globalData.dishCategories.includes("legacy"), false);
  });
  await test("offline writes are retained without optimistic mutation", async () => {
    const before = clone(app.globalData.dicePosition); offline = true;
    await assert.rejects(() => store.mutate("random.position", { x: 0.7, y: 0.8 }));
    assert.deepEqual(clone(app.globalData.dicePosition), before); assert.equal(store.pending.action, "random.position");
    assert(storage.get(store.pendingKey)); offline = false;
  });
  await test("pending request survives restart and retry", async () => {
    const id = store.pending.requestId; store = fresh(); await store.login(); assert.equal(store.pending.requestId, id);
    await store.retry(); assert.equal(store.pending, null); assert.equal(app.globalData.dicePosition.x, 0.7);
  });
  await test("lost server reply retries with same id without replaying mutation", async () => {
    loseReply = true;
    await assert.rejects(() => store.mutate("random.position", { x: 0.4, y: 0.5 }));
    const revision = (await server({ action: "getState" })).revision;
    await store.retry(); assert.equal(store.revision, revision); assert.equal(store.pending, null);
  });
  await test("late refresh responses do not overwrite a newer save", async () => {
    deferredRead = {};
    const refresh = store.refresh();
    while (!deferredRead.resolve) await new Promise(resolve => setTimeout(resolve, 0));
    await store.mutate("random.position", { x: 0.9, y: 0.1 });
    deferredRead.resolve(); await refresh; deferredRead = null;
    assert.equal(app.globalData.dicePosition.x, 0.9);
  });
  await test("conflicting content can be archived locally without replacing cloud", async () => {
    await assert.rejects(() => store.mutate("category.save", { type: "dish", expectedVersion: -1, categories: ["stale"] }));
    assert(store.pending); store.archivePending(); assert.equal(store.pending, null); assert.equal(store.drafts().length, 1);
    assert.equal(app.globalData.dishCategories.includes("stale"), false);
  });
  await test("logout clears visible data, not cloud data, and restart rehydrates", async () => {
    store.logout(); assert.equal(store.user, null); assert.equal(app.globalData.dishes.length, 0);
    store = fresh(); await store.restore(); assert.equal(store.user, null);
    await store.login(); assert.equal(app.globalData.dishes.length, 1);
  });
  await test("cache write failure prevents sending an untracked mutation", async () => {
    const before = calls, previous = wx.setStorageSync; wx.setStorageSync = () => { throw new Error("quota"); };
    await assert.rejects(() => store.mutate("random.position", { x: 0.2, y: 0.2 }));
    assert.equal(calls, before); assert.equal(store.pending, null); wx.setStorageSync = previous;
  });
}
function recoveryClient(server) {
  const storage = new Map(), app = {};
  const harness = { loseReply: false, activeTimers: 0 };
  const wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, clone(value)),
    showModal() {}, showToast() {}, cloud: { callFunction: async ({ data }) => {
      let result;
      try { result = { ok: true, data: await server(data) }; }
      catch (error) { result = { ok: false, error: { code: error.code, message: error.message } }; }
      if (harness.loseReply && !["bootstrap", "getState"].includes(data.action)) { harness.loseReply = false; throw new Error("reply lost"); }
      return { result };
    } }
  };
  harness.fresh = () => {
    const localLoad = loader({ wx, getApp: () => app,
      setInterval: () => { harness.activeTimers++; return 1; }, clearInterval: () => { harness.activeTimers--; } });
    const store = localLoad("miniprogram/services/kitchenStore.js"); store.initialize(app); return store;
  };
  return harness;
}
async function recoveryTests() {
  const ownerApi = api("recovery-owner"), memberApi = api("recovery-member");
  const owner = recoveryClient(ownerApi), member = recoveryClient(memberApi);
  let store = owner.fresh(), kitchenId, invite;
  await test("lost create reply recovers old pending partition after restart", async () => {
    await store.login(); owner.loseReply = true;
    await assert.rejects(() => store.mutate("create", { name: "Recovery" }));
    const id = store.pending.requestId, oldKey = store.pendingKey;
    store.stop(); store = owner.fresh(); await store.restore();
    assert(store.kitchen); assert.equal(store.pending.requestId, id); assert.equal(store.pendingKey, oldKey);
    kitchenId = store.kitchen.id; invite = store.kitchen.inviteCode;
    await store.retry(); assert.equal(store.pending, null); assert.equal(store.read(oldKey), null);
    store.stop(); store = owner.fresh(); await store.restore(); assert.equal(store.pending, null);
  });
  let memberStore = member.fresh();
  await test("lost join reply cannot add the same member twice", async () => {
    await memberStore.login(); member.loseReply = true;
    await assert.rejects(() => memberStore.mutate("join", { code: invite }));
    memberStore.stop(); memberStore = member.fresh(); await memberStore.restore();
    assert.equal(memberStore.kitchen.id, kitchenId); assert(memberStore.pending);
    await memberStore.retry(); assert.equal(memberStore.kitchen.members.length, 2);
  });
  await test("lost leave reply finds pending request from the former kitchen", async () => {
    member.loseReply = true; await assert.rejects(() => memberStore.mutate("leave", {}));
    memberStore.stop(); memberStore = member.fresh(); await memberStore.restore();
    assert.equal(memberStore.kitchen, null); assert.equal(memberStore.pending.action, "leave");
    await memberStore.retry(); assert.equal(memberStore.pending, null); assert.equal(memberStore.kitchen, null);
  });
  await test("editing a not-yet-saved new category can rename it before first save", async () => {
    await store.mutate("category.save", { type: "dish", expectedVersion: 0, categories: ["家常菜"], renames: [{ from: "新分类", to: "家常菜" }] });
    assert.deepEqual(clone(store.app.globalData.dishCategories), ["家常菜"]);
  });
  const dish = { dishName: "测试菜", dishCategory: "家常菜", dishImage: "", dishDescription: "", dishIngredients: [], dishCookingSteps: [] };
  await test("retrying new recipe save clears its submitted form, with no duplicate insertion", async () => {
    const draft = { dish, expectedVersion: 0 };
    store.saveForm("dish:new", draft); const token = store.readForm("dish:new")._draftToken;
    owner.loseReply = true;
    await assert.rejects(() => store.mutate("dish.save", { dish, expectedVersion: 0, isNew: true }, "dish:new"));
    store.saveForm("dish:new", draft); // onHide may persist the identical form again.
    assert.equal(store.readForm("dish:new")._draftToken, token);
    store.stop(); store = owner.fresh(); await store.restore(); await store.retry();
    assert.equal(store.readForm("dish:new"), null); assert.equal(store.app.globalData.dishes.length, 1);
  });
  await test("successful retry never clears a newer form edit", async () => {
    store.saveForm("categories:dish", { categories: ["家常菜", "汤"], expectedVersion: 1 });
    owner.loseReply = true;
    await assert.rejects(() => store.mutate("category.save", { type: "dish", categories: ["家常菜", "汤"], expectedVersion: 1 }, "categories:dish"));
    store.saveForm("categories:dish", { categories: ["家常菜", "汤", "凉菜"], expectedVersion: 1 });
    await store.retry(); assert.equal(store.readForm("categories:dish").categories.length, 3);
    assert.equal(store.app.globalData.dishCategories.length, 2);
  });
  await test("temporary saving indicator does not change an ingredient draft identity", async () => {
    store.saveForm("ingredient:new", { form: { ingredientName: "木耳", saving: true } });
    const token = store.readForm("ingredient:new")._draftToken;
    store.saveForm("ingredient:new", { form: { ingredientName: "木耳", saving: false } });
    assert.equal(store.readForm("ingredient:new")._draftToken, token);
  });
  await test("a late login reply cannot restart polling while app is in background", async () => {
    store.foreground = false; store.stop(); const before = owner.activeTimers;
    await store.login(); assert.equal(owner.activeTimers, before); assert.equal(store.timer, null);
    store.foreground = true; store.start(); assert.equal(owner.activeTimers, before + 1);
  });
  await test("renaming inventory categories preserves saved expiration dates", async () => {
    const domain = load("cloudfunctions/kitchenApi/domain.js");
    const state = domain.emptyState(); state.ingredientCategories = ["蔬菜"];
    state.ingredients.push({ ingredientId: 1, ingredientName: "木耳", ingredientCount: 10, ingredientUnit: "g", ingredientCategory: "蔬菜",
      ingredientProduceDate: "", ingredientPurchaseDate: "2026-09-19", ingredientShelfLife: 0, ingredientExpireDate: "2026-09-26", _version: 1 });
    domain.apply(state, "category.save", { type: "ingredient", expectedVersion: 0, categories: ["鲜蔬"], renames: [{ from: "蔬菜", to: "鲜蔬" }] }, { now });
    assert.equal(domain.expiry(state.ingredients[0]), "2026-09-26");
  });
  await test("expired invitation does not grant access to kitchen", async () => {
    const late = createService(db, () => ({ OPENID: "late-member", APPID: "test-app" }), () => now + 8 * 86400000);
    await late({ action: "bootstrap", payload: {} });
    await rejects(() => mutate(late, null, "join", { code: invite }), "INVALID_INVITE");
    assert.equal((await late({ action: "getState" })).kitchen, null);
  });
  store.stop(); memberStore.stop();
}
async function pageTests() {
  const app = {}, pages = new Map(); let current;
  const localLoad = loader({ getApp: () => app, Page: page => pages.set(current, page), wx: {} });
  localLoad("miniprogram/services/kitchenStore.js").initialize(app);
  const names = ["menu", "fridge", "mine", "detailDish", "detailIngredient", "editDish", "editIngredient", "categoriesManagement"];
  await test("all page event bindings resolve to implemented handlers", async () => {
    for (const name of names) {
      current = name; const base = "miniprogram/pages/" + name + "/" + name;
      localLoad(base + ".js"); const page = pages.get(name);
      const markup = fs.readFileSync(base + ".wxml", "utf8");
      for (const match of markup.matchAll(/\b(?:bind|catch):?[\w-]+="([\w]+)"/g))
        assert.equal(typeof page[match[1]], "function", name + ": " + match[1]);
    }
  });
  await test("menu and fridge render empty shared state without sample data", async () => {
    const instantiate = name => {
      const page = { ...pages.get(name), data: clone(pages.get(name).data) };
      page.setData = changes => Object.assign(page.data, clone(changes)); return page;
    };
    const menu = instantiate("menu"), fridge = instantiate("fridge");
    menu.refreshDishes(); fridge.refreshIngredients();
    assert.equal(menu.data.showDishes.length, 0); assert.equal(fridge.data.showIngredients.length, 0);
    assert.deepEqual(menu.data.dishCategories, ["全部"]); assert.deepEqual(fridge.data.ingredientCategories, ["全部"]);
  });
}
run().catch(error => { console.error(error); process.exitCode = 1; });
