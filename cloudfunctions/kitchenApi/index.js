const cloud = require("wx-server-sdk");
const { createService } = require("./service");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const handle = createService(cloud.database(), () => cloud.getWXContext());

exports.main = async event => {
  try {
    const data = await handle(event);
    // Storage remains creator-only. Signed image URLs are issued only AFTER membership validation.
    const images = new Set();
    for (const item of data.state.dishes) if (item.dishImage.startsWith("cloud://")) images.add(item.dishImage);
    for (const item of data.state.ingredients) if (item.ingredientImage.startsWith("cloud://")) images.add(item.ingredientImage);
    for (const item of data.orderList) if ((item.dish.dishImage || "").startsWith("cloud://")) images.add(item.dish.dishImage);
    data.imageUrls = {};
    const files = [...images].filter(id => data.kitchen && id.includes(`/kitchens/${data.kitchen.id}/`));
    for (let i = 0; i < files.length; i += 50) {
      try {
        const result = await cloud.getTempFileURL({ fileList: files.slice(i, i + 50).map(fileID => ({ fileID, maxAge: 3600 })) });
        for (const file of result.fileList) if (file.tempFileURL) data.imageUrls[file.fileID] = file.tempFileURL;
      } catch (error) { console.warn("Image URLs unavailable", error.errCode || error.code); }
    }
    return { ok: true, data };
  } catch (error) {
    console.error("Kitchen request failed", error.code || error.errCode, error.message);
    const business = typeof error.code === "string" && /^[A-Z_]+$/.test(error.code);
    return { ok: false, error: { code: business ? error.code : "SERVER_ERROR", message: business ? error.message : "云服务暂不可用，请检查部署、数据库集合及网络；未确认的操作可重试" } };
  }
};
