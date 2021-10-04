module.exports = {
  upstream: 'http://ticom.hongliang.fun/api/v1/gmail_cb',
  ak: 'e8562670b6c840688f34044309b0fdd0',
  domain: 'jcz.onl',
  maxSize: 1400 * 1024, // 1.4MB, because upstream can only receive 2M at most with base64 encoding
  debug: true,
};
