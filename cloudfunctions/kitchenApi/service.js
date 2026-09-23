const crypto = require("crypto");
const domain = require("./domain");
const COLLECTIONS = { users: "kitchen_users", kitchens: "kitchen_spaces", invites: "kitchen_invites", requests: "kitchen_requests", orders: "kitchen_orders", ratings: "kitchen_ratings" };
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
async function read(ref) {
  try { const result = await ref.get(); return (Array.isArray(result.data) ? result.data[0] : result.data) || null; }
  catch (error) {
    if (/document.*(not exist|not found)|文档不存在/i.test(error.message || error.errMsg || "")) return null;
    throw error;
  }
}
function clean(document) { const result = { ...document }; delete result._id; return result; }
function createService(db, getIdentity, clock = Date.now) {
  return async function handle(event = {}) {
    const identity = getIdentity();
    if (!identity.OPENID || !identity.APPID) domain.fail("UNAUTHENTICATED", "请通过微信小程序登录");
    const userId = hash(`${identity.APPID}:${identity.OPENID}`).slice(0, 32);
    const now = clock(), action = event.action, payload = event.payload || {};
    if (Buffer.byteLength(JSON.stringify(event), "utf8") > 650000) domain.fail("LIMIT", "请求内容过大");
    const readOnly = action === "bootstrap" || action === "getState";
    if (!readOnly && !/^[a-zA-Z0-9_-]{16,100}$/.test(event.requestId || "")) domain.fail("INVALID", "请求标识不正确");
    const requestHash = hash(JSON.stringify({ action, payload, kitchenId: event.kitchenId || "" }));
    const kitchenId = crypto.randomBytes(16).toString("hex");
    const inviteCode = crypto.randomBytes(6).toString("hex").toUpperCase();
    const newId = crypto.randomInt(1, 281474976710655);
    const result = await db.runTransaction(async transaction => {
      const ref = (type, id) => transaction.collection(COLLECTIONS[type]).doc(id);
      const userRef = ref("users", userId);
      let user = await read(userRef);
      if (!user) {
        if (action !== "bootstrap") domain.fail("UNAUTHENTICATED", "请先在“我的”页面登录");
        user = { userId, nickname: payload.nickname ? domain.text(payload.nickname, 30) : "厨房成员", kitchenId: null, createdAt: now, joinAttempts: 0, joinWindow: now };
        await userRef.set({ data: user });
      }
      let kitchen = user.kitchenId ? await read(ref("kitchens", user.kitchenId)) : null;
      if (user.kitchenId && (!kitchen || !kitchen.members.some(member => member.id === userId))) domain.fail("FORBIDDEN", "厨房成员信息异常，请联系管理员");
      const snapshot = () => {
        const state = kitchen ? JSON.parse(JSON.stringify(kitchen.state)) : domain.emptyState();
        const sanitizeDish = dish => {
          dish.canEvaluate = (dish.evaluationUsers || []).includes(userId);
          delete dish.evaluationUsers; delete dish.evaluationOrderId;
        };
        state.dishes.forEach(sanitizeDish);
        if (state.order) state.order.items.forEach(row => sanitizeDish(row.dish));
        return { user: { id: userId, nickname: user.nickname }, kitchen: kitchen ? {
        id: user.kitchenId, name: kitchen.name, owner: kitchen.owner, isOwner: kitchen.owner === userId,
        members: kitchen.members, inviteCode: kitchen.owner === userId ? kitchen.inviteCode : "",
        inviteExpiresAt: kitchen.owner === userId ? kitchen.inviteExpiresAt : 0
      } : null, revision: kitchen ? kitchen.revision : 0, state,
      ...domain.lists(state, now), serverTime: now };
      };
      if (readOnly) return snapshot();
      const requestRef = ref("requests", hash(`${userId}:${event.requestId}`));
      const previous = await read(requestRef);
      if (previous) {
        if (previous.hash !== requestHash) domain.fail("INVALID", "同一请求标识不能用于不同操作");
        return { ...snapshot(), duplicate: true };
      }
      if (action === "create") {
        if (kitchen) domain.fail("ALREADY_JOINED", "你已经加入厨房，请勿重复创建");
        kitchen = { name: domain.text(payload.name, 40), owner: userId, members: [{ id: userId, nickname: user.nickname }],
          state: domain.emptyState(), revision: 1, createdAt: now, updatedAt: now, inviteCode, inviteExpiresAt: now + 7 * 86400000 };
        user.kitchenId = kitchenId;
        await ref("invites", hash(inviteCode)).set({ data: { kitchenId, expiresAt: kitchen.inviteExpiresAt } });
        await userRef.set({ data: clean(user) });
        await ref("kitchens", kitchenId).set({ data: kitchen });
      } else if (action === "join") {
        if (kitchen) domain.fail("ALREADY_JOINED", "你已经加入厨房，请先退出当前厨房");
        if (now - user.joinWindow > 600000) { user.joinWindow = now; user.joinAttempts = 0; }
        if (user.joinAttempts >= 5) domain.fail("RATE_LIMIT", "邀请码尝试次数过多，请稍后再试");
        const code = typeof payload.code === "string" ? payload.code.trim().toUpperCase() : "";
        const invite = /^[A-F0-9]{12}$/.test(code) ? await read(ref("invites", hash(code))) : null;
        const target = invite && invite.expiresAt > now ? await read(ref("kitchens", invite.kitchenId)) : null;
        if (!target || target.inviteCode !== code || target.inviteExpiresAt <= now) {
          user.joinAttempts++; await userRef.set({ data: clean(user) });
          return { error: { code: "INVALID_INVITE", message: "邀请码无效或已过期，请向创建者获取新邀请码" } };
        }
        if (target.members.length >= 30) domain.fail("LIMIT", "厨房成员已达到当前版本上限");
        user.kitchenId = invite.kitchenId; user.joinAttempts = 0;
        kitchen = target; kitchen.members.push({ id: userId, nickname: user.nickname }); kitchen.revision++; kitchen.updatedAt = now;
        await userRef.set({ data: clean(user) }); await ref("kitchens", user.kitchenId).set({ data: clean(kitchen) });
      } else {
        if (!kitchen || event.kitchenId !== user.kitchenId) domain.fail("FORBIDDEN", "请先加入当前厨房，不能访问其他厨房的数据");
        if (action === "leave") {
          if (kitchen.owner === userId) domain.fail("OWNER", "创建者暂不能退出厨房；退出登录不会删除厨房数据");
          kitchen.members = kitchen.members.filter(member => member.id !== userId); kitchen.revision++; kitchen.updatedAt = now;
          await ref("kitchens", user.kitchenId).set({ data: clean(kitchen) });
          user.kitchenId = null; kitchen = null; await userRef.set({ data: clean(user) });
        } else if (action === "rotateInvite") {
          if (kitchen.owner !== userId) domain.fail("FORBIDDEN", "只有创建者可以更新邀请码");
          await ref("invites", hash(kitchen.inviteCode)).remove();
          kitchen.inviteCode = inviteCode; kitchen.inviteExpiresAt = now + 7 * 86400000;
          await ref("invites", hash(inviteCode)).set({ data: { kitchenId: user.kitchenId, expiresAt: kitchen.inviteExpiresAt } });
          kitchen.revision++; kitchen.updatedAt = now;
          await ref("kitchens", user.kitchenId).set({ data: clean(kitchen) });
        } else {
          const outcome = domain.apply(kitchen.state, action, payload, { now, userId, memberIds: kitchen.members.map(member => member.id), kitchenId: user.kitchenId, newId, requestId: event.requestId });
          kitchen.state = outcome.state; kitchen.revision++; kitchen.updatedAt = now;
          await ref("kitchens", user.kitchenId).set({ data: clean(kitchen) });
          if (outcome.completedOrder) await ref("orders", hash(`${user.kitchenId}:${outcome.completedOrder.id}`)).set({ data: { kitchenId: user.kitchenId, ...outcome.completedOrder } });
          if (outcome.rating) await ref("ratings", hash(`${user.kitchenId}:${outcome.rating.orderId}:${outcome.rating.dishId}:${userId}`)).set({ data: { kitchenId: user.kitchenId, ...outcome.rating } });
        }
      }
      // Written in the same transaction as the mutation: retries cannot consume stock twice.
      await requestRef.set({ data: { userId, hash: requestHash, kitchenId: user.kitchenId, action, createdAt: now } });
      return snapshot();
    });
    if (result.error) domain.fail(result.error.code, result.error.message);
    return result;
  };
}
module.exports = { createService, COLLECTIONS };
