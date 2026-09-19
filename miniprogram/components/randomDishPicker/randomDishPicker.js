const randomDishUtil = require("../../utils/randomDish.js");
const seasonUtil = require("../../utils/season.js");

const SETTINGS_KEY = "miniprogram_random_dish_settings_v1";
const POSITION_KEY = "miniprogram_random_dish_position_v1";
const DEFAULT_IMAGE = "/images/myicons/食物.png";
const MOVE_TOLERANCE = 8; // px，轻微抖动不取消长按。
const BUTTON_WIDTH = 110; // rpx，与样式一致。
const BUTTON_HEIGHT = 150;
const ROLL_DURATION = 1600; // ms，旋转由快到慢。
const ROLL_SETTLE_DELAY = 120; // 停稳后再展示结果。
const HOLD_COMPLETE_DELAY = 120; // 满环稍作停留，让完成反馈可见。

function clamp(value, min, max) {//用于把一个数限制在指定范围内，范围内取value，范围外取最大或最小值
  return Math.min(Math.max(value, min), max);
}

function normalizeDraftCount(value, available, allowEmpty = false) {
  if (available <= 0) { return 0; }
  if (allowEmpty && value === "") { return ""; }
  const count = Number(value);
  return clamp(Number.isNaN(count) ? 1 : Math.floor(count), 1, available);
}

Component({
  properties: {
    dishes: { type: Array, value: [] },
    categories: { type: Array, value: [] },
    longPressDuration: { type: Number, value: 3000 }
  },

  data: {
    ready: false,
    diceX: 0,
    diceY: 0,
    pressing: false,
    holdComplete: false,
    dragging: false,
    rolling: false,
    rollDuration: ROLL_DURATION,
    rollId: 0,
    modal: "",
    draftRows: [],
    draftSeasonalOnly: false,
    defaultMode: true,
    formError: "",
    resultRows: [],
    resultMessages: [],
    resultRequested: 0,
    resultSummary: "",
    resultHeight: 530
  },

  observers: {//数据监听器，当菜品或分类数据更新时，如果设置弹窗正打开，就刷新弹窗里的分类列表和可选菜品数量
    "dishes, categories": function () {
      if (this.data.modal === "settings") {//this.data.modal保存当前弹窗状态，正在设置时更新设置
        this.refreshDraftRows(this.data.draftRows);
      }
    }
  },

  lifetimes: {
    attached() {
      this._inactive = false;
      this._settings = randomDishUtil.normalizeSettings(this.readLocal(SETTINGS_KEY));
      const savedPosition = this.readLocal(POSITION_KEY);
      this._position = savedPosition && savedPosition.version === 1
        && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)
        ? { x: clamp(savedPosition.x, 0, 1), y: clamp(savedPosition.y, 0, 1) }
        : { x: 1, y: 1 };
      this.updateBounds();
    },
    detached() {
      this._inactive = true;
      this.cancelGesture(false);
      this.cancelRoll(false);
    }
  },

  pageLifetimes: {
    show() {
      this._inactive = false;
      if (this._position) { this.updateBounds(); }
    },
    hide() {
      this._inactive = true;
      this.cancelGesture();
      this.cancelRoll();
      this.closeDialog();
    },
    resize() {
      this.cancelGesture();
      if (this._position) { this.updateBounds(); }
    }
  },

  methods: {
    readLocal(key) {
      try { return wx.getStorageSync(key); }
      catch (error) {
        console.warn("读取随机点菜设置失败", error);
        return null;
      }
    },

    writeLocal(key, value) {
      try {
        wx.setStorageSync(key, value);
        return true;
      } catch (error) {
        console.warn("保存随机点菜设置失败", error);
        return false;
      }
    },

    updateBounds() {
      const info = wx.getWindowInfo();
      const scale = info.windowWidth / 750;
      const padding = 24 * scale;
      // 顶栏高 100rpx；底部预留 300rpx，覆盖购物车与导航栏区域。
      const maxX = Math.max(0, info.windowWidth - BUTTON_WIDTH * scale - padding);
      const maxY = Math.max(0, info.windowHeight - (300 + BUTTON_HEIGHT) * scale);
      this._bounds = {
        minX: Math.min(padding, maxX), maxX,
        minY: Math.min(124 * scale, maxY), maxY
      };
      const bounds = this._bounds;
      this.setData({
        ready: true,
        diceX: bounds.minX + this._position.x * (bounds.maxX - bounds.minX),
        diceY: bounds.minY + this._position.y * (bounds.maxY - bounds.minY)
      });
    },

    clearHoldTimer() {
      if (this._holdTimer !== undefined) {
        clearTimeout(this._holdTimer);
        this._holdTimer = undefined;
      }
    },

    cancelGesture(render = true) {
      this.clearHoldTimer();
      if (this._holdCompleteTimer !== undefined) {
        clearTimeout(this._holdCompleteTimer);
        this._holdCompleteTimer = undefined;
      }
      if (this._moveTimer !== undefined) {
        clearTimeout(this._moveTimer);
        this._moveTimer = undefined;
      }
      this._nextPosition = null;
      this._gesture = null;
      if (render) { this.setData({ pressing: false, dragging: false, holdComplete: false }); }
    },

    handleTouchStart(e) {
      if (this._gesture && this._gesture.completed) { return; }
      this.cancelGesture();
      if (this._inactive || !this.data.ready || this.data.modal || this._rollRun
        || e.touches.length !== 1) { return; }
      const touch = e.touches[0];
      const gesture = {
        identifier: touch.identifier,
        startX: touch.clientX, startY: touch.clientY,
        originX: this.data.diceX, originY: this.data.diceY,
        startedAt: Date.now(), dragging: false
      };
      this._gesture = gesture;
      this.setData({ pressing: true });
      this._holdTimer = setTimeout(() => {
        this._holdTimer = undefined;
        if (!this._inactive && this._gesture === gesture && !gesture.dragging) {
          this.completeLongPress(gesture);
        }
      }, this.data.longPressDuration);
    },

    completeLongPress(gesture) {
      if (this._inactive || this._gesture !== gesture || gesture.dragging || gesture.completed) { return; }
      gesture.completed = true;
      this.clearHoldTimer();
      this.setData({ holdComplete: true });
      // 部分设备或模拟器不支持震动，失败时仍正常打开设置。
      try {
        if (typeof wx.vibrateShort === "function") {
          wx.vibrateShort({ type: "light", fail() {} });
        }
      } catch (error) {
        console.warn("长按完成震动不可用", error);
      }
      this._holdCompleteTimer = setTimeout(() => {
        this._holdCompleteTimer = undefined;
        if (!this._inactive && this._gesture === gesture) { this.openSettings(); }
      }, HOLD_COMPLETE_DELAY);
    },

    moveWithTouch(touch) {
      const gesture = this._gesture;
      const dx = touch.clientX - gesture.startX;
      const dy = touch.clientY - gesture.startY;
      if (!gesture.dragging && Math.hypot(dx, dy) > MOVE_TOLERANCE) {
        gesture.dragging = true;
        this.clearHoldTimer();
        this.setData({ pressing: false, dragging: true });
      }
      if (!gesture.dragging) { return; }
      this._nextPosition = {
        diceX: clamp(gesture.originX + dx, this._bounds.minX, this._bounds.maxX),
        diceY: clamp(gesture.originY + dy, this._bounds.minY, this._bounds.maxY)
      };
      // 合并同一帧内的位置更新，避免每个 touchmove 都跨层刷新。
      if (this._moveTimer === undefined) {
        this._moveTimer = setTimeout(() => {
          this._moveTimer = undefined;
          if (!this._inactive) { this.flushPosition(); }
        }, 16);
      }
    },

    flushPosition() {
      if (this._nextPosition) {
        this.setData(this._nextPosition);
        this._nextPosition = null;
      }
    },

    handleTouchMove(e) {
      if (!this._gesture || this._gesture.completed) { return; }
      if (e.touches.length !== 1) { this.cancelGesture(); return; }
      const touch = e.touches[0];
      if (touch.identifier !== this._gesture.identifier) { this.cancelGesture(); return; }
      this.moveWithTouch(touch);
    },

    handleTouchEnd(e) {
      const gesture = this._gesture;
      if (!gesture || gesture.completed || this._inactive) { return; }
      const touch = e.changedTouches.find(item => item.identifier === gesture.identifier);
      if (!touch) { this.cancelGesture(); return; }
      this.moveWithTouch(touch);
      this.flushPosition();
      const wasDragging = gesture.dragging;
      const heldLongEnough = Date.now() - gesture.startedAt >= this.data.longPressDuration;
      if (!wasDragging && heldLongEnough) {
        this.completeLongPress(gesture);
        return;
      }
      this.cancelGesture();
      if (wasDragging) {
        const bounds = this._bounds;
        this._position = {
          x: (this.data.diceX - bounds.minX) / (bounds.maxX - bounds.minX || 1),
          y: (this.data.diceY - bounds.minY) / (bounds.maxY - bounds.minY || 1)
        };
        this.writeLocal(POSITION_KEY, { version: 1, ...this._position });
      } else {
        this.roll();
      }
    },

    handleTouchCancel() {
      this.cancelGesture();
    },

    refreshDraftRows(sourceRows) {
      const rules = new Map(sourceRows.map(row => [row.category, row]));
      const counts = new Map();
      randomDishUtil.getCandidates(this.data.dishes, this.data.draftSeasonalOnly)
        .forEach(dish => counts.set(dish.dishCategory, (counts.get(dish.dishCategory) || 0) + 1));
      const draftRows = randomDishUtil.normalizeCategories(this.data.categories).map(category => {
        const rule = rules.get(category);
        const available = counts.get(category) || 0;
        return {
          category,
          enabled: available > 0 && !!(rule && rule.enabled),
          count: normalizeDraftCount(rule ? rule.count : 1, available, true),
          available
        };
      });
      this.setData({ draftRows });
      return draftRows;
    },

    openSettings() {
      if (this._inactive || this._rollRun) { return; }
      this.cancelGesture();
      const settings = this._settings;
      this.setData({
        modal: "settings", formError: "",
        draftSeasonalOnly: settings.seasonalOnly,
        defaultMode: !settings.configured
      });
      this.refreshDraftRows(settings.rules);
    },

    handleCategoriesChange(e) {
      const selected = new Set(e.detail.value);
      this.setData({
        draftRows: this.data.draftRows.map(row => ({
          ...row, enabled: row.available > 0 && selected.has(row.category)
        })),
        formError: ""
      });
    },

    handleCountInput(e) {
      return this.updateDraftCount(e, true);
    },

    handleCountBlur(e) {
      this.updateDraftCount(e, false);
    },

    updateDraftCount(e, allowEmpty) {
      const index = Number(e.currentTarget.dataset.index);
      const row = this.data.draftRows[index];
      if (!row || !row.enabled || row.available <= 0) { return; }
      const count = normalizeDraftCount(e.detail.value, row.available, allowEmpty);
      this.setData({ [`draftRows[${index}].count`]: count, formError: "" });
      // 即使钳制后的值与旧数据相同，也替换输入框中刚输入的超限文字。
      return String(count);
    },

    stepCount(e) {
      const index = Number(e.currentTarget.dataset.index);
      const row = this.data.draftRows[index];
      if (!row || !row.enabled || row.available <= 0) { return; }
      const delta = Number(e.currentTarget.dataset.delta);
      if (delta !== 1 && delta !== -1) { return; }
      const current = normalizeDraftCount(row.count, row.available);
      const count = normalizeDraftCount(current + delta, row.available);
      this.setData({ [`draftRows[${index}].count`]: count, formError: "" });
    },

    handleSeasonChange(e) {
      this.setData({ draftSeasonalOnly: e.detail.value });
      this.refreshDraftRows(this.data.draftRows);
    },

    saveSettings() {
      // 保存前再次按最新候选数校验，兼容旧缓存和弹窗打开后的菜品变化。
      const draftRows = this.refreshDraftRows(this.data.draftRows);
      const selected = draftRows.filter(row => row.enabled);
      if (!selected.length) {
        this.setData({ formError: "请至少勾选一个分类。" });
        return;
      }
      const invalid = selected.find(row => !Number.isSafeInteger(Number(row.count))
        || Number(row.count) <= 0 || Number(row.count) > row.available);
      if (invalid) {
        this.setData({ formError: `“${invalid.category}”的数量须为 1～${invalid.available} 的整数。` });
        return;
      }
      const settings = randomDishUtil.normalizeSettings({
        version: 1, configured: true,
        seasonalOnly: this.data.draftSeasonalOnly,
        rules: draftRows
      });
      const saved = this.writeLocal(SETTINGS_KEY, settings);
      this._settings = settings;
      this.setData({ modal: "" });
      wx.showToast({ title: saved ? "设置已保存" : "设置已应用，本机保存失败", icon: "none" });
    },

    roll() {
      if (this._inactive || !this.data.ready || this._rollRun || this.data.modal === "settings") { return; }
      this.cancelGesture();
      const run = { id: this.data.rollId + 1, finishing: false };
      this._rollRun = run;
      // 摇骰子只生成待确认结果，不修改购物车。
      this.setData({ modal: "", rolling: true, rollId: run.id }, () => {
        if (this._inactive || this._rollRun !== run || run.finishing) { return; }
        // 优先由动画结束事件完成；缺失事件时兜底，避免一直锁住按钮。
        run.fallbackTimer = setTimeout(() => this.finishRoll(run), ROLL_DURATION + 400);
      });
    },

    handleRollAnimationEnd(e) {
      // 忽略长按进度等子节点冒泡过来的动画事件及已失效轮次。
      const run = this._rollRun;
      if (!run || e.target.id !== e.currentTarget.id
        || Number(e.currentTarget.dataset.rollId) !== run.id) { return; }
      this.finishRoll(run);
    },

    finishRoll(run) {
      if (!run || this._inactive || this._rollRun !== run || run.finishing) { return; }
      run.finishing = true;
      clearTimeout(run.fallbackTimer);
      run.settleTimer = setTimeout(() => {
        if (this._inactive || this._rollRun !== run) { return; }
        this.cancelRoll(false);
        this.showRandomResult();
      }, ROLL_SETTLE_DELAY);
    },

    cancelRoll(render = true) {
      const run = this._rollRun;
      if (run) {
        clearTimeout(run.fallbackTimer);
        clearTimeout(run.settleTimer);
      }
      this._rollRun = null;
      if (render && this.data.rolling) { this.setData({ rolling: false }); }
    },

    showRandomResult() {
      const month = new Date().getMonth() + 1;
      const result = randomDishUtil.pickRandomDishes(
        this.data.dishes, this.data.categories, this._settings, month
      );
      this._resultConfirmed = false;
      this.setData({
        rolling: false,
        modal: "result",
        resultRows: result.dishes.map(dish => ({
          key: String(dish.dishId),
          name: dish.dishName,
          category: dish.dishCategory || "未分类",
          image: dish.dishImage || DEFAULT_IMAGE,
          season: seasonUtil.formatSeason(dish.dishSeason),
          inSeason: seasonUtil.isInSeason(dish.dishSeason, month)
        })),
        resultRequested: result.requestedTotal,
        resultMessages: result.messages,
        resultSummary: this._settings.configured
          ? `按分类随机 · ${this._settings.seasonalOnly ? "仅当季" : "不限时令"}`
          : "全部菜谱 · 默认随机 1 道",
        resultHeight: Math.min(1100, 370 + Math.max(160, result.dishes.length * 156) + result.messages.length * 90)
      });
    },

    handleImageError(e) {
      const index = Number(e.currentTarget.dataset.index);
      if (this.data.resultRows[index] && this.data.resultRows[index].image !== DEFAULT_IMAGE) {
        this.setData({ [`resultRows[${index}].image`]: DEFAULT_IMAGE });
      }
    },

    confirmResult() {
      if (this._inactive || this.data.modal !== "result" || this._resultConfirmed
        || !this.data.resultRows.length) { return; }
      const candidates = randomDishUtil.getCandidates(this.data.dishes, this._settings.seasonalOnly);
      const currentDishes = new Map(candidates.map(dish => [String(dish.dishId), dish]));
      const keys = [...new Set(this.data.resultRows.map(row => row.key))];
      if (keys.some(key => !currentDishes.has(key))) {
        wx.showToast({ title: "菜品已变更，请取消后重新随机", icon: "none" });
        return;
      }
      const dishIds = keys.map(key => currentDishes.get(key).dishId);
      this._resultConfirmed = true;
      this.closeDialog();
      // 由 menu 复用现有购物车逻辑，组件不直接改动全局菜品。
      this.triggerEvent("confirm", { dishIds });
    },

    closeDialog() {
      this.setData({ modal: "", resultRows: [], resultMessages: [], resultRequested: 0, resultSummary: "" });
    },

    // 点击行为由 touchend 统一判定，屏蔽拖动/长按后合成的 tap。
    stopEvent() {}
  }
});
