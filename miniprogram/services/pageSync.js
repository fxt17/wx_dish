const store = require("./kitchenStore");
function detach(page) { if (page._unsubscribeKitchen) page._unsubscribeKitchen(); page._unsubscribeKitchen = null; }
function attach(page, refresh) {
  detach(page);
  const update = info => { page.setData({ kitchenReady: !!info.kitchen, syncStatus: info.status }); refresh.call(page); };
  page._unsubscribeKitchen = store.subscribe(update);
  update(store.info()); store.refresh();
}
function confirm(title, content) {
  return new Promise(resolve => wx.showModal({ title, content, success: result => resolve(result.confirm), fail: () => resolve(false) }));
}
module.exports = { attach, detach, confirm };
