// pages/categoriesManagement/categoriesManagement.js
const categoryUtil = require("../../utils/category.js");
let autoScrollTimer = null;
let autoScrollDirection = 0;
let autoScrollTarget = 0;
let autoScrollVelocity = 0;
let autoScrollLastTime = 0;
let lastCommandedScrollTop = 0;
let longPressTimer = null;

// 自动滚动参数（单位为 px、px/ms）
const AUTO_SCROLL_EDGE = 150;
const AUTO_SCROLL_HYSTERESIS = 30;
const AUTO_SCROLL_MIN_SPEED = 0.18;
const AUTO_SCROLL_MAX_SPEED = 1.5;
const AUTO_SCROLL_MAX_LEAD = 64;
const LONG_PRESS_DURATION = 500;
const LONG_PRESS_MOVE_TOLERANCE = 12;

Page({

  data: {
    // =========================
    // scroll-view
    // =========================
    currentScrollTop: 0,// scroll-view 当前真实滚动位置
    scrollTop: 0,
    scrollIntoView: "",
    maxScrollTop: 0,
    scrollViewTop: 0,
    scrollViewBottom: 0,
    // =========================
    // 分类数据
    // =========================
    categoryType: "",
    categories: [],
    // =========================
    // 拖拽状态
    // =========================
    // 是否正在拖拽
    dragging: false,
    dragPreparing: false,// 已按下拖拽手柄，等待节点测量完成
    pressingIndex: -1,
    // 被拖拽的分类
    draggingItem: "",
    // 拖拽项原来的位置
    dragStartIndex: -1,
    // 当前占位位置
    placeholderIndex: -1,
    // 悬浮拖拽项的位置
    ghostTop: 0,
    // 手指按下位置与分类项顶部之间的距离
    // 保证拖拽时不会突然跳动
    touchOffsetY: 0,
    // 悬浮拖拽项的高度
    ghostHeight: 100,
    windowHeight: 0
  },

  // =========================================================
  // scroll-view 滚动
  // =========================================================
  onScroll(e) {
    const currentScrollTop = e.detail.scrollTop;
    // 原生组件能够到达的位置可能略大于 scrollHeight - 可视高度
    // （例如内容包含 margin/padding 时）。同步扩大业务边界，避免开始
    // 拖拽后把 scrollTop 从真实底部突然拉回旧的 maxScrollTop。
    const maxScrollTop = Math.max(this.data.maxScrollTop, currentScrollTop);
    // 这两个值只供逻辑层使用，不参与 WXML 渲染；直接更新可避免滚动
    // 高频触发 setData，给拖拽动画和 scrollTop 控制留出渲染带宽。
    this.data.currentScrollTop = currentScrollTop;
    this.data.maxScrollTop = maxScrollTop;

    // 非自动滚动时，让下一次自动滚动从原生组件的真实位置开始。
    if (autoScrollTimer === null) {
      autoScrollTarget = currentScrollTop;
      lastCommandedScrollTop = currentScrollTop;
    }

    // 手指停在边缘不动时 touchmove 不再触发，但列表仍在自动滚动。
    // 随着实际滚动位置变化，继续更新占位位置。
    if (this.data.dragging && autoScrollTimer !== null && Number.isFinite(this._latestDragY)) {
      this.calculatePlaceholderIndex(this._latestDragY);
    }
  },

  // =========================================================
  // 开始拖拽
  // =========================================================
  onTouchStart(e) {
    const index = Number(e.currentTarget.dataset.index);// 获取拖拽的序号
    if (index < 0 || index >= this.data.categories.length) {return;}
    const touch = e.touches[0];
    if (!touch) {return;}

    this.cancelLongPress();
    this.stopAutoScroll();
    this._topAnchorRequested = false;
    this._topScrollPulse = 0;
    this._longPressStartX = touch.clientX;
    this._longPressStartY = touch.clientY;

    this.setData({
      dragPreparing: true,
      pressingIndex: index,
      scrollTop: this.data.currentScrollTop,
      scrollIntoView: ""
    });

    // 按住达到指定时长后才真正创建拖拽状态。
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (!this.data.dragPreparing || this.data.pressingIndex !== index) {return;}
      this.beginDrag(index, this._longPressStartY);
    }, LONG_PRESS_DURATION);
  },

  // 长按成立后开始真正拖拽。
  beginDrag(index, touchClientY) {
    // -----------------------------------------------------
    // 获取当前分类项的位置
    // -----------------------------------------------------
    const query = this.createSelectorQuery();//创建了一个节点查询对象
    query.selectAll(".category-item").boundingClientRect();//查询 class="category-item" 的位置和尺寸
    query.exec(res => {//执行查询
      const rects = res[0];//第一个查询数组，即class="category-item" 的位置和尺寸
      // 查询返回前手指可能已经抬起；这种情况下不再进入拖拽状态。
      if (!this.data.dragPreparing || this.data.pressingIndex !== index) {return;}
      if (!rects || !rects[index]) {
        this.setData({dragPreparing: false, pressingIndex: -1});
        return;
      }
      const rect = rects[index];// 获取到拖拽项的位置、尺寸
      const touchOffsetY = touchClientY - rect.top;// 手指距离拖拽项顶部的距离
      const draggingItem = this.data.categories[index];// 根据序号找到拖拽项
      // 拖拽期间不能从 categories 删除原项。特别是最后一项一旦被删除，
      // 承载本次触摸序列的 image 节点也会销毁，后续 touchmove 将无法触发。
      // 原项由 drag-source 样式折叠，真正的数组重排留到 touchend 执行。
      const ghostTop = rect.top; //（拖拽）悬浮项的顶部位置与原本拖拽项保持一致
      const ghostHeight = rect.height; // （拖拽）悬浮项高度与原本保持一致
      this.setData({
        dragging: true,// 标记当前正在拖拽
        dragPreparing: false,
        pressingIndex: -1,
        draggingItem: draggingItem,
        dragStartIndex: index,
        placeholderIndex: index,// 占位位置仍然保持在原来的 index
        ghostTop: ghostTop,// 悬浮项顶部位置
        touchOffsetY: touchOffsetY,
        ghostHeight: ghostHeight// 悬浮项高度
      });
    });
  },

  cancelLongPress(resetState = true) {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    this._longPressStartX = null;
    this._longPressStartY = null;

    if (resetState && this.data.dragPreparing && !this.data.dragging) {
      this.setData({dragPreparing: false, pressingIndex: -1});
    }
  },

  // =========================================================
  // 拖拽移动
  // =========================================================
  onTouchMove(e) {
    const touch = e.touches[0];
    if (!touch) {return;}

    // 长按尚未成立时，明显移动视为普通手势并取消拖拽准备，防止误触。
    if (!this.data.dragging) {
      if (
        this.data.dragPreparing &&
        Number.isFinite(this._longPressStartX) &&
        Number.isFinite(this._longPressStartY)
      ) {
        const moveX = touch.clientX - this._longPressStartX;
        const moveY = touch.clientY - this._longPressStartY;
        if (Math.hypot(moveX, moveY) > LONG_PRESS_MOVE_TOLERANCE) {
          this.cancelLongPress();
        }
      }
      return;
    }

    const currentY = touch.clientY;
    // =====================================================
    // 1. 让悬浮项跟随手指
    // =====================================================
    const ghostTop = currentY - this.data.touchOffsetY;//新手指-旧手指+原分类项顶部，即原位置+偏移位置
    const dragReferenceY = ghostTop + this.data.ghostHeight / 2;
    this._latestDragY = dragReferenceY;
    this.setData({ghostTop:ghostTop});//用于设置悬浮项的位置
    // =====================================================
    // 2. 自动滚动
    // =====================================================
    const scrollViewTop = this.data.scrollViewTop;
    const scrollViewBottom = this.data.scrollViewBottom;
    const ghostBottom = ghostTop + this.data.ghostHeight;
    let edgeDirection = this._edgeScrollDirection || 0;

    // 使用拖拽项的上下边缘判断，而不是手指位置。这样无论用户按住卡片
    // 的哪个部位，只要卡片进入边缘区域就会持续滚动。
    if (edgeDirection < 0 && ghostTop > scrollViewTop + AUTO_SCROLL_EDGE + AUTO_SCROLL_HYSTERESIS) {
      edgeDirection = 0;
    } 
    else if(edgeDirection > 0 && ghostBottom < scrollViewBottom - AUTO_SCROLL_EDGE - AUTO_SCROLL_HYSTERESIS) {
      edgeDirection = 0;
    }

    if (edgeDirection === 0) {
      const topIntensity = Math.min(
        1,
        Math.max(0, (scrollViewTop + AUTO_SCROLL_EDGE - ghostTop) / AUTO_SCROLL_EDGE)
      );
      const bottomIntensity = Math.min(
        1,
        Math.max(0, (ghostBottom - (scrollViewBottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE)
      );
      const inTopEdge = ghostTop <= scrollViewTop + AUTO_SCROLL_EDGE;
      const inBottomEdge = ghostBottom >= scrollViewBottom - AUTO_SCROLL_EDGE;

      if (inTopEdge || inBottomEdge) {edgeDirection = topIntensity >= bottomIntensity ? -1 : 1;}
    }

    this._edgeScrollDirection = edgeDirection;

    if(edgeDirection < 0) {
      const intensity = Math.min(
        1,
        Math.max(0, (scrollViewTop + AUTO_SCROLL_EDGE - ghostTop) / AUTO_SCROLL_EDGE)
      );
      this._edgeScrollIntensity = intensity;
      this.startAutoScroll(-1, intensity);
    }
    else if(edgeDirection > 0) {
      const intensity = Math.min(
        1,
        Math.max(0, (ghostBottom - (scrollViewBottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE)
      );
      this._edgeScrollIntensity = intensity;
      this.startAutoScroll(1, intensity);
    }
    else {
      this._edgeScrollIntensity = 0;
      this.stopAutoScroll(true);
    }
    // =====================================================
    // 3. 根据手指位置计算占位位置
    // =====================================================
    this.calculatePlaceholderIndex(dragReferenceY);
  },

  // =========================================================
  // 结束拖拽
  // =========================================================
  onTouchEnd() {
    console.log("END");
    this.cancelLongPress();
    // 节点测量尚未结束时手指已经抬起，只需取消准备状态。
    if (!this.data.dragging) {
      return;
    }
    this.stopAutoScroll();
    // =====================================================
    // 根据占位位置重新插入分类
    // =====================================================
    const categories = [...this.data.categories];
    const dragStartIndex = this.data.dragStartIndex;
    let insertIndex = this.data.placeholderIndex;
    const [draggingItem] = categories.splice(dragStartIndex, 1);

    // placeholderIndex 是相对于拖拽前完整数组的位置。原项删除后，位于
    // 它后面的插入位置需要向前修正一位。
    if (insertIndex > dragStartIndex) {insertIndex -= 1;}
    // 防止越界
    if (insertIndex < 0) {insertIndex = 0;}
    if (insertIndex > categories.length) {insertIndex = categories.length;}
    categories.splice(insertIndex,0,draggingItem);
    console.log("拖拽结束，插入位置:",insertIndex);
    // =====================================================
    // 恢复正常状态
    // =====================================================
    this.setData({
      categories: categories,
      dragging: false,
      dragPreparing: false,
      pressingIndex: -1,
      draggingItem: "",
      dragStartIndex: -1,
      placeholderIndex: -1,
      ghostTop: 0,
      touchOffsetY: 0
    },
    () => {this.updateMaxScrollTop();}// 重新计算最大滚动距离
    );
  },

  // 系统中断触摸序列时取消本次拖拽，原数组保持不变。
  onTouchCancel() {
    this.cancelLongPress();
    this.stopAutoScroll();
    this.setData({
      dragging: false,
      dragPreparing: false,
      pressingIndex: -1,
      draggingItem: "",
      dragStartIndex: -1,
      placeholderIndex: -1,
      ghostTop: 0,
      touchOffsetY: 0
    });
  },

  // =========================================================
  // 根据手指位置计算占位位置
  // =========================================================
  calculatePlaceholderIndex(dragReferenceY) {
    const categories = this.data.categories;
    const count = categories.length;
    if (count <= 0) {return;}

    // touchmove 和 scroll 触发频率都很高。节点查询尚未返回时只保留最新
    // 手指位置，避免同时堆积多批 selectorQuery 阻塞渲染线程。
    this._latestDragY = dragReferenceY;
    if (this._placeholderQueryPending) {return;}
    this._placeholderQueryPending = true;

    const query = this.createSelectorQuery();// 创建节点查询对象
    query.selectAll(".category-item").boundingClientRect();// 查询 class="category-item" 的位置和尺寸
    query.exec(res => {
      this._placeholderQueryPending = false;
      if (!this.data.dragging) {return;}
      const rects = res[0];
      if (!rects || rects.length === 0) return;
      const latestReferenceY = this._latestDragY;
      // -----------------------------------------------------
      // 根据分类项中心判断应该插入在哪里
      // -----------------------------------------------------
      // 拖拽源仍保留在 categories 中，但已经折叠且不再带 category-item
      // 类。使用每个可见节点携带的原始 index，得到完整数组中的插入槽位。
      let targetIndex = count;
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const centerY = rect.top + rect.height / 2;
        if (latestReferenceY < centerY) {
          const rectIndex = Number(rect.dataset.index);
          targetIndex = Number.isFinite(rectIndex)? rectIndex:(i>=this.data.dragStartIndex? i+1:i);
          break;
        }
      }
      // -----------------------------------------------------
      // 防止超出范围
      // -----------------------------------------------------
      if (targetIndex < 0) targetIndex = 0;
      if (targetIndex > count) targetIndex = count;
      // -----------------------------------------------------
      // 没有发生变化
      // -----------------------------------------------------
      if (targetIndex===this.data.placeholderIndex) {return;}
      // -----------------------------------------------------
      // 只修改占位位置
      //
      // 注意：
      // 这里绝对不能移动 draggingItem
      // -----------------------------------------------------
      this.setData({placeholderIndex: targetIndex});
    });
  },

  // =========================================================
  // 自动滚动
  // =========================================================
  startAutoScroll(direction, intensity = 1) {
    if (direction > 0) {this._topAnchorRequested = false;}
    this._edgeScrollDirection = direction;
    this._edgeScrollIntensity = intensity;
    // 刚进入边缘区域时缓慢启动，越靠近边缘速度越快。
    const progress = Math.min(1, Math.max(0, intensity));
    // smoothstep：触发区入口和屏幕边缘处的速度变化都更平缓。
    const easedProgress = progress * progress * (3 - 2 * progress);
    const speed=AUTO_SCROLL_MIN_SPEED+(AUTO_SCROLL_MAX_SPEED-AUTO_SCROLL_MIN_SPEED)*easedProgress;
    const targetVelocity = direction * speed;

    // 同方向时平滑追随新速度；切换方向时立即响应。
    if (autoScrollTimer !== null && autoScrollDirection === direction) {
      autoScrollVelocity += (targetVelocity - autoScrollVelocity) * 0.35;
    } else {
      autoScrollVelocity = targetVelocity;
      // 方向发生变化时立即以真实位置为基准，不能先消化旧方向留下的
      // 超前目标值，否则会表现为在边缘停住一段时间。
      autoScrollTarget = this.data.currentScrollTop;
      lastCommandedScrollTop = this.data.currentScrollTop;
    }
    autoScrollDirection = direction;
    if(autoScrollTimer !== null) {return;}

    // 使用独立目标值连续累加，并按实际时间差计算位移。某一帧变慢时，
    // 后续帧会自动补偿，不再依赖固定“每帧移动多少像素”。
    // 重启时不能只使用可能滞后的 onScroll 值，否则会把列表命令回一个
    // 更旧的位置，形成肉眼可见的反向滚动。
    autoScrollTarget = direction > 0
      ? Math.max(this.data.currentScrollTop, lastCommandedScrollTop)
      : Math.min(this.data.currentScrollTop, lastCommandedScrollTop);
    autoScrollLastTime = Date.now();

    const tick = () => {
      if (!this.data.dragging) {
        this.stopAutoScroll();
        return;
      }

      const now = Date.now();
      // 避免调试器短暂卡顿后一次跳过过长距离。
      const elapsed = Math.min(40, Math.max(1, now - autoScrollLastTime));
      autoScrollLastTime = now;

      // 控制目标最多领先原生位置一小段，避免渲染稍慢时积累大量尚未
      // 执行的位移；同时仍给 scroll-view 足够空间连续向前滚动。
      if (autoScrollDirection > 0) {
        autoScrollTarget = Math.min(
          autoScrollTarget,
          this.data.currentScrollTop + AUTO_SCROLL_MAX_LEAD
        );
      } else {
        autoScrollTarget = Math.max(
          autoScrollTarget,
          this.data.currentScrollTop - AUTO_SCROLL_MAX_LEAD
        );
      }

      const alignedScrollTop = autoScrollTarget;
      let targetScrollTop = alignedScrollTop + autoScrollVelocity * elapsed;
      if(targetScrollTop <= 0) {targetScrollTop = 0;}

      // 下边界允许略微超过估算值，由原生 scroll-view 钳制到真实底部。
      // 循环不会因此停止，拖拽项离开边缘时才结束自动滚动。
      const downLimit = Math.max(
        this.data.maxScrollTop,
        this.data.currentScrollTop
      ) + AUTO_SCROLL_MAX_LEAD;
      if(targetScrollTop > downLimit) {targetScrollTop = downLimit;}

      // scroll-top 已经命令到 0，但原生位置可能因为同值不再触发更新而
      // 仍停在顶部上方一小段。此时使用顶部锚点完成最后定位，确保第一
      // 个占位位置完整进入视口。
      if (
        autoScrollDirection < 0 &&
        targetScrollTop <= 0 &&
        this.data.currentScrollTop > 1 &&
        !this._topAnchorRequested
      ) {
        this._topAnchorRequested = true;
        this.setData({scrollIntoView: "categoryContentStart"}, () => {
          // 定位命令送达视图层后清空属性，避免它持续覆盖 scrollTop。
          wx.nextTick(() => {
            if (this.data.scrollIntoView) {
              this.setData({scrollIntoView: ""});
            }
          });
        });
      }

      autoScrollTarget = targetScrollTop;

      // 到顶部前在 0 和 0.01 之间发送不可见的微小脉冲。这样即使绑定值
      // 已经等于 0，视图层仍会持续收到新的顶部定位指令，直至原生位置
      // 真正归零；0.01px 不会造成肉眼可见的抖动。
      let commandScrollTop = targetScrollTop;
      if (
        autoScrollDirection < 0 &&
        targetScrollTop <= 0 &&
        this.data.currentScrollTop > 1
      ) {
        this._topScrollPulse = this._topScrollPulse === 0 ? 0.01 : 0;
        commandScrollTop = this._topScrollPulse;
      } else if (targetScrollTop > 0) {
        this._topScrollPulse = 0;
      }

      if (Math.abs(commandScrollTop - lastCommandedScrollTop) > 0.001) {
        lastCommandedScrollTop = commandScrollTop;
        this.setData({scrollTop: commandScrollTop});
      }

      autoScrollTimer = setTimeout(tick, 16);
    };

    autoScrollTimer = setTimeout(tick, 0);
  },

  // =========================================================
  // 停止自动滚动
  // =========================================================
  stopAutoScroll(clearEdgeIntent = true) {
    if (autoScrollTimer !== null) {
      clearTimeout(autoScrollTimer);
      autoScrollTimer = null;
    }
    autoScrollDirection = 0;
    autoScrollVelocity = 0;
    autoScrollLastTime = 0;
    if (clearEdgeIntent) {
      this._edgeScrollDirection = 0;
      this._edgeScrollIntensity = 0;
      this._topAnchorRequested = false;
    }
  },

  // =========================================================
  // 重新计算最大滚动距离
  // =========================================================
  updateMaxScrollTop() {
    const query = this.createSelectorQuery();// 创建节点查询对象
    query.select("#categoryScroll").boundingClientRect();//查询 id="categoryScroll" 的位置和尺寸
    query.select("#categoryScroll").scrollOffset();//查询元素的滚动信息
    query.select("#categoryContentEnd").boundingClientRect();// 查询真实内容末尾
    query.exec(res => {
      const rect = res[0];// scroll-view的位置和尺寸信息
      const scrollInfo = res[1];// scroll-view的滚动信息
      const contentEnd = res[2];
      if (!rect || !scrollInfo) {return;}

      // scrollHeight 在 flex、margin 和 padding 组合下可能低估真实末尾。
      // 使用末尾标记的位置再计算一次，避免自动滚动提前约 20px 停止。
      const windowInfo = wx.getWindowInfo();
      const paddingBottom = 20 * windowInfo.windowWidth / 750;
      const layoutMaxScrollTop = contentEnd
        ? scrollInfo.scrollTop + contentEnd.bottom + paddingBottom - rect.bottom
        : 0;
      const rawMaxScrollTop = Math.max(
        0,
        scrollInfo.scrollHeight-rect.height,
        scrollInfo.scrollTop,
        layoutMaxScrollTop
      );
      const maxScrollTop = rawMaxScrollTop > 1 ? rawMaxScrollTop : 0;
      // const diff = scrollInfo.scrollHeight - rect.height;
      // const maxScrollTop = diff > 1 ? diff : 0;
      this.setData({
        maxScrollTop: maxScrollTop,
        currentScrollTop: scrollInfo.scrollTop,
        scrollViewTop: rect.top,// scroll-view窗口可视顶部
        scrollViewBottom: rect.bottom// scroll-view窗口可视底部
      });
      autoScrollTarget = scrollInfo.scrollTop;
      lastCommandedScrollTop = scrollInfo.scrollTop;
    });
  },

  // =========================================================
  // 修改分类
  // =========================================================
  editCategory(e) {
    // 拖拽过程中禁止编辑
    if (this.data.dragging) {return;}
    const index = Number(e.currentTarget.dataset.index);
    const oldName = this.data.categories[index];
    wx.showModal({
      title: "修改分类",
      editable: true,
      placeholderText: "请输入分类名称",
      content: oldName,
      success: res => {
        if (!res.confirm) {return;}
        const newName = res.content.trim();
        if (!newName) {
          wx.showToast({
            title: "分类名称不能为空",
            icon: "none"
          });
          return;
        }
        const categories = [...this.data.categories];
        categories[index] = newName;
        this.setData({categories:categories});
      }
    });
  },

  // =========================================================
  // 删除分类
  // =========================================================
  deleteCategory(e) {
    if (this.data.dragging) {return;}
    const index = Number(e.currentTarget.dataset.index);
    const categoryName = this.data.categories[index];
    wx.showModal({
      title: "删除分类",
      content:`确定要删除“${categoryName}”吗？`,
      success: res => {
        if (!res.confirm) {return;}
        const categories = [...this.data.categories];
        categories.splice(index, 1);
        this.setData({categories:categories}, ()=>{this.updateMaxScrollTop();});
      }
    });
  },

  // =========================================================
  // 新建分类
  // =========================================================
  addCategory() {
    if (this.data.dragging) {return;}
    wx.showModal({
      title: "新建分类",
      editable: true,
      placeholderText:"请输入分类名称",
      success: res => {
        if (!res.confirm) {return;}
        const newName = res.content.trim();
        if (!newName) {
          wx.showToast({
            title:"分类名称不能为空",
            icon: "none"
          });
          return;
        }
        if (this.data.categories.includes(newName)) {
          wx.showToast({
            title:"该分类已存在",
            icon: "none"
          });
          return;
        }
        const categories = [...this.data.categories,newName];
        this.setData({categories:categories}, ()=>{this.updateMaxScrollTop();});
      }
    });
  },

  // =========================================================
  // 页面加载
  // =========================================================
  onLoad(options) {
    const systemInfo = wx.getWindowInfo();
    this.setData({windowHeight:systemInfo.windowHeight});
    const type = options.type;
    if (type==="dish") {
      this.setData({categoryType:type, categories:[...categoryUtil.dishCategories]});
    }
    else if(type==="ingredient"){
      this.setData({categoryType:type, categories:[...categoryUtil.ingredientCategories]});
    }
  },

  // 保存当前分类顺序及增删改结果。原生导航栏返回会触发 onUnload。
  saveCategories() {
    const {categoryType, categories} = this.data;
    if (!categoryType) {return;}

    const saved = categoryUtil.saveCategories(categoryType, categories);
    if (!saved) {
      console.error("分类保存失败:", categoryType, categories);
    }
  },

  // =========================================================
  // 页面首次渲染完成
  // =========================================================
  onReady() {
    this.updateMaxScrollTop();
  },

  onShow() {},

  onHide() {},

  onUnload() {
    this.cancelLongPress(false);
    this.stopAutoScroll();
    this.saveCategories();
  },

  onPullDownRefresh() {},

  onReachBottom() {},

  onShareAppMessage() {}

});
