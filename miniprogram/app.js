const config = require("./config/cloud");
const kitchen = require("./services/kitchenStore");

App({
  onLaunch() {
    kitchen.initialize(this);
    if (wx.cloud) wx.cloud.init({ env: config.env, traceUser: true });
    this.ready = kitchen.restore();
  },
  onShow() {
    kitchen.foreground = true;
    kitchen.start();
    kitchen.refresh();
  },
  onHide() { kitchen.foreground = false; kitchen.stop(); }
});
