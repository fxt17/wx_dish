const store = require("../../services/kitchenStore");
const { confirm } = require("../../services/pageSync");
Page({
  data: { 
    user: null, 
    kitchen: null, 
    nickname: "", 
    kitchenName: "", 
    inviteInput: "", 
    status: "", 
    busy: false, 
    pending: null, 
    drafts: [], 
    inviteDate: "" 
  },

  onShow() {
    this._unsubscribe = store.subscribe(this.updateView.bind(this));
    this.updateView(store.info()); store.refresh();
  },

  onHide() { 
    if (this._unsubscribe) 
      this._unsubscribe(); 
    this._unsubscribe = null; 
  },

  onUnload() { 
    this.onHide(); 
  },

  updateView(info) {
    this.setData({ 
      ...info, 
      drafts: store.drafts().map((draft, index) => ({ index, action: draft.action, createdAt: new Date(draft.createdAt).toLocaleString() })),
      inviteDate: info.kitchen && info.kitchen.inviteExpiresAt ? new Date(info.kitchen.inviteExpiresAt).toLocaleDateString() : "" });
  },

  inputNickname(e) { this.setData({ nickname: e.detail.value }); },

  inputKitchen(e) { this.setData({ kitchenName: e.detail.value }); },

  inputInvite(e) { this.setData({ inviteInput: e.detail.value }); },

  async login() {
    // 正在处理请求或已经登录时，不重复发起。
    if (store.busy || store.user) return;
  
    try {
      const success = await store.login();
  
      if (success) {
        wx.showToast({
          title: "登录成功",
          icon: "success"
        });
      }
    } catch (error) {
      wx.showModal({
        title: "登录未完成",
        content: error.message || "请稍后重试",
        showCancel: false
      });
    }
  },

  async createKitchen() {
    if (!this.data.kitchenName.trim()) { 
      wx.showToast({ title: "请输入厨房名称", icon: "none" }); 
      return; 
    }
    await store.perform("create", { name: this.data.kitchenName.trim() }, "厨房已创建");
  },

  async joinKitchen() {
    if (!this.data.inviteInput.trim()) { 
      wx.showToast({ title: "请输入邀请码", icon: "none" }); 
      return; 
    }
    await store.perform("join", { code: this.data.inviteInput.trim().toUpperCase() }, "已加入厨房");
  },

  copyInvite() { 
    if (this.data.kitchen && this.data.kitchen.inviteCode) 
      wx.setClipboardData({ data: this.data.kitchen.inviteCode }); 
  },

  async rotateInvite() {
    if (await confirm("更新邀请码", "旧邀请码将立即失效；已加入的成员不受影响。")) 
      await store.perform("rotateInvite", {}, "邀请码已更新");
  },

  async leaveKitchen() {
    if (await confirm("退出厨房", "你将无法再读取这个厨房的数据，其他成员的数据不会删除。")) 
      await store.perform("leave", {}, "已退出厨房");
  },

  async logout() {
    if (!await confirm("退出登录", "云端厨房和数据会保留，重新登录后可继续使用。")) 
      return;
    try { store.logout(); } 
    catch (error) { 
      wx.showModal({ title: "暂不能退出", content: error.message, showCancel: false }); 
    }
  },

  refresh() { 
    store.refresh(); 
  },

  async retrySave() {
    try { 
      if (await store.retry()) 
        wx.showToast({ title: "云端已确认保存", icon: "success" }); 
      }
    catch (error) { 
      wx.showModal({ title: "仍未保存", content: error.message, showCancel: false }); 
    }
  },

  copyPending() { 
    if (store.pending) 
      wx.setClipboardData({ data: JSON.stringify(store.pending, null, 2) }); 
  },

  async archivePending() {
    if (!await confirm("保留草稿并读取云端", "此操作不会覆盖云端，也不会撤销已经成功的提交。未提交内容会保存在本机草稿中，可复制后重新编辑。")) 
      return;
    try { store.archivePending(); } 
    catch (error) { 
      wx.showModal({ title: "草稿保存失败", content: error.message, showCancel: false }); 
    }
  },

  copyDraft(e) {
    const draft = store.drafts()[Number(e.currentTarget.dataset.index)];
    if (draft) 
      wx.setClipboardData({ data: JSON.stringify(draft, null, 2) });
  }
});
