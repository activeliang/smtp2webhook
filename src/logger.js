const rfs = require('rotating-file-stream');
const path = require('path');
// 日志配置
const logStream = rfs.createStream('email.log', {
  interval: '1d', 
  path: path.join(__dirname, '..', 'logs'),
  maxFiles: 30 // 保留30天的日志文件
})

// 日志写入函数，添加时间前缀和换行符
function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`[${timestamp}] ${message}\n`);
}


module.exports = logWithTimestamp