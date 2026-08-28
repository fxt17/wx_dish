const monthOptions = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月"
];

function normalizeMonth(value, fallback) {
  const month = Number(value);
  return Number.isInteger(month) && month >= 1 && month <= 12
    ? month
    : fallback;
}

// 兼容尚未设置时令的旧菜品，默认按全年适宜处理。
function normalizeSeason(season) {
  const source = season || {};
  return {
    startMonth: normalizeMonth(source.startMonth, 1),
    endMonth: normalizeMonth(source.endMonth, 12)
  };
}

function formatSeason(season) {
  const normalized = normalizeSeason(season);
  const startMonth = normalized.startMonth;
  const endMonth = normalized.endMonth;

  if (startMonth === 1 && endMonth === 12) {
    return "全年适宜";
  }

  const seasonNames = {
    "3-5": "春季",
    "6-8": "夏季",
    "9-11": "秋季",
    "12-2": "冬季"
  };
  const seasonName = seasonNames[`${startMonth}-${endMonth}`];
  let rangeText = startMonth === endMonth? 
    `${startMonth}月` : startMonth > endMonth?
      `${startMonth}月-次年${endMonth}月` : `${startMonth}月-${endMonth}月`;

  if (seasonName) {
    rangeText += ` · ${seasonName}`;
  }
  return rangeText;
}

function isInSeason(season, currentMonth = new Date().getMonth() + 1) {
  const normalized = normalizeSeason(season);
  const startMonth = normalized.startMonth;
  const endMonth = normalized.endMonth;

  // 普通范围，例如3月—5月。
  if (startMonth <= endMonth) {
    return currentMonth >= startMonth && currentMonth <= endMonth;
  }

  // 跨年范围，例如12月—次年2月。
  return currentMonth >= startMonth || currentMonth <= endMonth;
}

module.exports = {
  monthOptions,
  normalizeSeason,
  formatSeason,
  isInSeason
};
