const config = require("../config/cloud");
const ingredientUtil = require("../utils/ingredient");
const clone = value => JSON.parse(JSON.stringify(value));
const SESSION_KEY = `kitchen:${config.env}:remember`;
const empty = () => ({ 
  dishes: [], 
  ingredients: [], 
  orderList: [], 
  consumeList: [], 
  shortageList: [],
  dishCategories: [], 
  ingredientCategories: [], 
  categoryVersions: { dish: 0, ingredient: 0 },
  cartVersion: 0, 
  order: null, 
  randomSettings: { version: 1, configured: false, seasonalOnly: false, rules: [] },
  randomVersion: 0, 
  dicePosition: { version: 1, x: 1, y: 1 } 
});
const store = {
  app: null, 
  user: null, 
  kitchen: null, 
  revision: 0, 
  pending: null, 
  busy: false,
  status: "请先登录并加入厨房", 
  listeners: new Set(), 
  generation: 0, 
  foreground: true,
  initialize(app) { 
    this.app = app; app.globalData = empty(); 
  },

  key(kind) { 
    return `kitchen:${config.env}:${this.user.id}:${this.kitchen ? this.kitchen.id : 'none'}:${kind}`; 
  },

  read(key) { 
    try { return wx.getStorageSync(key); } 
    catch (error) { return null; } 
  },

  write(key, value) {
    try { wx.setStorageSync(key, value); }
    catch (error) { throw new Error("本机存储空间不足，无法安全保存待提交内容。请清理空间后重试。"); }
  },

  info() { 
    return { 
      user: this.user, 
      kitchen: this.kitchen, 
      revision: this.revision, 
      status: this.status,
      busy: this.busy, 
      pending: this.pending ? { action: this.pending.action, error: this.pending.error || "", createdAt: this.pending.createdAt } : null 
    };
  },

  subscribe(listener) { 
    this.listeners.add(listener); return () => this.listeners.delete(listener); 
  },

  notify() { 
    this.listeners.forEach(listener => { 
      try { listener(this.info()); } 
      catch (error) { console.error("页面刷新失败", error); } 
    }); 
  },

  async call(action, payload, metadata = {}) {
    if (!wx.cloud) throw new Error("当前环境不支持微信云开发");
    let response;
    try { 
      response = await wx.cloud.callFunction({ 
        name: config.functionName, data: { action, payload, ...metadata } 
      }); 
    }
    catch (error) { 
      const failure = new Error("网络或云服务暂不可用，请检查网络及云函数部署后重试"); 
      failure.code = "NETWORK"; throw failure; 
    }
    const result = response.result;
    if (!result || !result.ok) {
      const error = new Error(result && result.error ? result.error.message : "云端响应异常，请重试");
      error.code = result && result.error ? result.error.code : "NETWORK"; throw error;
    }
    return result.data;
  },

  apply(data) {
    if (this.kitchen && data.kitchen && this.kitchen.id === data.kitchen.id && data.revision < this.revision) return;
    this.user = data.user; 
    this.kitchen = data.kitchen; 
    this.revision = data.revision;
    const value = { 
      ...empty(), 
      ...clone(data.state), 
      orderList: clone(data.orderList),
      consumeList: clone(data.consumeList), 
      shortageList: clone(data.shortageList) 
    };
    const urls = data.imageUrls || {};
    value.dishes.forEach(dish => { dish.dishImageUrl = urls[dish.dishImage] || ""; });
    value.ingredients.forEach(item => { item.ingredientImageUrl = urls[item.ingredientImage] || ""; });
    value.orderList.forEach(row => { row.dish.dishImageUrl = urls[row.dish.dishImage] || ""; });
    ingredientUtil.updateIngredientExpire(value.ingredients);
    this.app.globalData = value;
    require("../utils/category").setCategories(value.dishCategories, value.ingredientCategories);
    // Caches are partitioned by environment, verified user and kitchen. Never shown before authentication.
    try { this.write(this.key("snapshot"), data); } 
    catch (error) { this.status = error.message; }
    this.notify();
  },

  async login(nickname = "") {
    if (this.busy) return false;
  
    this.busy = true;
    this.status = "正在验证微信身份…";
    this.notify();
  
    const generation = ++this.generation;
  
    try {
      // 请求云端识别当前微信用户。
      const data = await this.call("bootstrap", { nickname });
  
      // 不接收已经失效的请求结果。
      if (generation !== this.generation) return false;
  
      if (!data || !data.user || !data.user.id) {
        throw new Error("未能确认微信身份，请重新登录");
      }
  
      // 先保存恢复标记，避免缓存写入失败后界面却先显示登录成功。
      // 此标记不是身份凭证；下次启动仍会请求云端验证。
      this.write(SESSION_KEY, true);
  
      // 应用云端确认的用户信息，并通知页面刷新。
      this.apply(data);
  
      // 保留现有待确认操作的恢复逻辑，不在本次登录中提交它。
      this.pendingKey =
        this.read(`kitchen:${config.env}:${this.user.id}:pendingPointer`)
        || this.key("pending");
  
      this.pending = this.read(this.pendingKey) || null;
  
      this.status = this.pending
        ? "已登录，有未确认的保存"
        : "微信登录成功";
  
      this.start();
      return true;
    } catch (error) {
      this.status = error.message || "登录失败，请重试";
      throw error;
    } finally {
      this.busy = false;
      this.notify();
    }
  },

  restore() { 
    if (this.read(SESSION_KEY)) 
      return this.login().catch(() => {}); 
    return Promise.resolve(); 
  },

  async refresh() {
    if (!this.user || this.refreshing || this.busy) return;
    this.refreshing = true; const generation = this.generation;
    try {
      const data = await this.call("getState", {});
      if (generation !== this.generation) return;
      this.status = this.pending ? "有未确认的保存，请前往“我的”处理" : "已与云端同步";
      this.apply(data);
    } 
    catch (error) { 
      if (generation === this.generation) { 
        this.status = "同步失败，当前显示上次读取的数据"; this.notify(); 
      } 
    }
    finally { this.refreshing = false; }
  },

  start() { 
    this.stop(); 
    if (this.foreground && this.user) 
      this.timer = setInterval(() => this.refresh(), config.pollInterval); 
  },

  stop() { 
    if (this.timer) 
      clearInterval(this.timer); 
    this.timer = null; 
  },

  requireKitchen() {
    if (this.user && this.kitchen) return true;
    wx.showModal({ title: "先加入厨房", content: "请前往“我的”登录，然后创建或加入一个厨房。", confirmText: "前往我的",
      success: result => { if (result.confirm) wx.redirectTo({ url: "/pages/mine/mine" }); } });
    return false;
  },

  async mutate(action, payload = {}, formKey) {
    if (!this.user) 
      throw new Error("请先在“我的”页面登录");
    if (!["create", "join"].includes(action) && !this.requireKitchen()) 
      throw new Error("请先加入厨房");
    if (this.busy) 
      throw new Error("正在保存，请稍候");
    if (this.pending) 
      throw new Error("还有一项保存未确认，请先到“我的”重试或处理草稿，避免重复提交");
    this.pending = { 
      action, 
      payload: clone(payload), 
      kitchenId: this.kitchen ? this.kitchen.id : null,
      requestId: `${Date.now()}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`, 
      createdAt: Date.now() 
    };
    const form = formKey ? this.readForm(formKey) : null;
    if (form && form._draftToken) 
      this.pending.form = { key: this.key(`form:${formKey}`), token: form._draftToken };
    this.pendingKey = this.key("pending");
    try {
      this.write(this.pendingKey, this.pending);
      this.write(`kitchen:${config.env}:${this.user.id}:pendingPointer`, this.pendingKey);
    }
    catch (error) { this.pending = null; throw error; }
    return this.retry();
  },

  async retry() {
    if (!this.pending || this.busy) return;
    const pending = this.pending, pendingKey = this.pendingKey || this.key("pending");
    this.busy = true; this.status = "正在保存到云端…"; this.notify();
    const generation = ++this.generation;
    try {
      const data = await this.call(pending.action, pending.payload, { kitchenId: pending.kitchenId, requestId: pending.requestId });
      if (generation !== this.generation) return;
      // A retry from “我的” must also retire the submitted form, otherwise a new-item
      // draft could be restored and inserted a second time. Never erase newer edits.
      if (pending.form) {
        const form = this.read(pending.form.key);
        if (form && form._draftToken === pending.form.token) this.write(pending.form.key, null);
      }
      // Remove the OLD partition's pending entry before create/join/leave switches partitions.
      this.write(pendingKey, null); this.pending = null; this.pendingKey = null;
      this.status = "已保存到云端"; this.apply(data); return true;
    } 
    catch (error) {
      pending.error = error.message; this.status = "尚未确认保存，本机保留待提交内容";
      try { this.write(pendingKey, pending); } 
      catch (storageError) { this.status = storageError.message; }
      throw error;
    } 
    finally { this.busy = false; this.notify(); }
  },

  archivePending() {
    if (!this.pending || this.busy) return;
    const drafts = this.read(this.key("drafts")) || [];
    this.write(this.key("drafts"), [...drafts, this.pending]);
    this.write(this.pendingKey || this.key("pending"), null);
    this.pending = null; 
    this.pendingKey = null; 
    this.status = "未提交内容已保留在本机草稿中"; 
    this.notify(); 
    this.refresh();
  },

  drafts() { 
    return this.user ? this.read(this.key("drafts")) || [] : []; 
  },
  
  saveForm(key, value) {
    if (!this.user || !this.kitchen) return;
    const storageKey = this.key(`form:${key}`);
    if (!value) { this.write(storageKey, null); return; }
    const draft = clone(value), previous = this.read(storageKey);
    delete draft._draftToken;
    if (draft.form) delete draft.form.saving;
    if (previous) {
      const content = { ...previous }; delete content._draftToken;
      if (JSON.stringify(content) === JSON.stringify(draft)) return;
    }
    this.write(storageKey, { ...draft, _draftToken: `${Date.now()}_${Math.random().toString(36).slice(2)}` });
  },

  readForm(key) {
     return this.user && this.kitchen ? this.read(this.key(`form:${key}`)) : null; 
  },

  async uploadImage(path) {
    if (!path || path.startsWith("cloud://") || path.startsWith("/images/")) return path || "";
    if (!this.requireKitchen()) 
      throw new Error("请先加入厨房");
    const extension = /\.(png|jpe?g|webp)$/i.exec(path);
    const cloudPath = `kitchens/${this.kitchen.id}/${this.user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension ? extension[1].toLowerCase() : 'jpg'}`;
    try { 
      const result = await wx.cloud.uploadFile({ cloudPath, filePath: path }); 
      return result.fileID; 
    }
    catch (error) { 
      throw new Error("图片上传失败，未保存，请保留页面并重试"); 
    }
  },

  async keepImage(path) {
    // Keep a selected photo beyond the temporary-file lifetime, so an offline form draft remains usable.
    try {
      const saved = await new Promise((resolve, reject) => wx.saveFile({ tempFilePath: path, success: resolve, fail: reject }));
      return saved.savedFilePath;
    } 
    catch (error) { throw new Error("图片无法保存到本机，请清理空间后重新选择"); }
  },

  logout() {
    if (this.busy || this.pending) 
      throw new Error("请先处理未确认的保存再退出登录");
    this.generation++; this.stop(); this.write(SESSION_KEY, false);
    this.user = null; this.kitchen = null; this.revision = 0; this.pendingKey = null;
    this.app.globalData = empty(); require("../utils/category").setCategories([], []);
    this.status = "已退出登录，云端厨房数据不会删除"; this.notify();
  },

  async perform(action, payload, title, formKey) {
    try { 
      const saved = await this.mutate(action, payload, formKey); 
      if (saved && title) 
        wx.showToast({ title, icon: "success" }); 
      return saved; 
    }
    catch (error) { 
      wx.showModal({ title: "尚未保存", content: error.message, showCancel: false }); 
      return false; 
    }
  }
};

module.exports = store;
