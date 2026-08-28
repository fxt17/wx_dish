function clampIndex(value, rangeLength) {
  if (rangeLength <= 0) {
    return 0;
  }

  const index = Number(value);
  if (!Number.isInteger(index)) {
    return 0;
  }

  return Math.min(Math.max(index, 0), rangeLength - 1);
}

function normalizeValue(value, leftRange, rightRange) {
  const source = Array.isArray(value) ? value : [];
  return [
    clampIndex(source[0], leftRange.length),
    clampIndex(source[1], rightRange.length)
  ];
}

Component({
  externalClasses: [
    "custom-mask-class",
    "custom-panel-class",
    "custom-actions-class",
    "custom-title-class",
    "custom-column-title-class",
    "custom-picker-class",
    "custom-option-class",
    "custom-cancel-class",
    "custom-confirm-class"
  ],

  properties: {
    title: {
      type: String,
      value: "请选择"
    },
    leftTitle: {
      type: String,
      value: ""
    },
    rightTitle: {
      type: String,
      value: ""
    },
    leftRange: {
      type: Array,
      value: []
    },
    rightRange: {
      type: Array,
      value: []
    },
    value: {
      type: Array,
      value: [0, 0]
    },
    cancelText: {
      type: String,
      value: "取消"
    },
    confirmText: {
      type: String,
      value: "确定"
    },
    maskClosable: {
      type: Boolean,
      value: true
    },
    disabled: {
      type: Boolean,
      value: false
    },
    indicatorStyle: {
      type: String,
      value: "height: 88rpx;"
    }
  },

  data: {
    pickerVisible: false,
    pickerValue: [0, 0]
  },

  observers: {
    "value, leftRange, rightRange": function (value, leftRange, rightRange) {
      if (this.data.pickerVisible) {
        return;
      }

      this.setData({
        pickerValue: normalizeValue(value, leftRange, rightRange)
      });
    }
  },

  methods: {
    handleOpen() {
      if (this.data.disabled) {
        return;
      }

      this.setData({
        pickerVisible: true,
        pickerValue: normalizeValue(
          this.data.value,
          this.data.leftRange,
          this.data.rightRange
        )
      });
    },

    buildResult(value) {
      const normalizedValue = normalizeValue(
        value,
        this.data.leftRange,
        this.data.rightRange
      );
      const leftIndex = normalizedValue[0];
      const rightIndex = normalizedValue[1];

      return {
        value: normalizedValue,
        leftIndex,
        rightIndex,
        leftItem: this.data.leftRange[leftIndex],
        rightItem: this.data.rightRange[rightIndex]
      };
    },

    handleChange(e) {
      const pickerValue = normalizeValue(
        e.detail.value,
        this.data.leftRange,
        this.data.rightRange
      );

      this.setData({ pickerValue });
      this.triggerEvent("columnchange", this.buildResult(pickerValue));
    },

    handleConfirm() {
      const result = this.buildResult(this.data.pickerValue);
      this.setData({ pickerVisible: false }, () => {
        this.triggerEvent("change", result);
      });
    },

    handleCancel() {
      this.setData({ pickerVisible: false }, () => {
        this.triggerEvent("cancel");
      });
    },

    handleMaskTap() {
      if (this.data.maskClosable) {
        this.handleCancel();
      }
    },

    stopPropagation() {}
  }
});
