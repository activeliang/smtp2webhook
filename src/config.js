const { MailParser } = require("mailparser");

module.exports = {
  upstream: 'http://rtr.hongliang.fun/api/v1/emails/receive',
  ak: 'e8562670b6c840688f34044309b0fdd0',
  domain: 'jcz.onl',
  maxSize: 200 * 1024 * 1024, // 1.4MB, because upstream can only receive 2M at most with base64 encoding
  debug: true,
};