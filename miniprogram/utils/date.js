// 日期格式化工具

/**
 * Date对象转 yyyy-mm-dd
 * @param {Date} date 
 */
function formatDate(date){
  let year=date.getFullYear();
  let month=date.getMonth()+1;
  let day=date.getDate();
  return year+"-"+(month<10?"0"+month:month)+"-"+(day<10?"0"+day:day);
}

/**
 * 获取今天日期
 */
function getToday(){return formatDate(new Date());}


module.exports={
  formatDate,
  getToday
}