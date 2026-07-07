var config = require('./config');
var URLSearchParams = require('url-search-params');
var axios = require('axios')

const log = require('./logger');

const main = {
  send: async function (body) {
    var form = new URLSearchParams();
    var form2 = {}
    for (var key in body) {
      if (body.hasOwnProperty(key) && body[key] !== undefined) {
        form.append(key, body[key]);
        form2[key] = body[key]
      }
    }
    form.append('data', new Date().toISOString());
    if (config.debug) console.log(form);
    // 失败直接抛异常，由调用方（app.js）捕获并收集到错误列表
    const res = await axios.post(config.upstream, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 8000 // 8 seconds in milliseconds
    });
    console.info(`send_to_backgend res: ${JSON.stringify(res.data)}`)
    log(`send_to_backgend res: ${JSON.stringify(res.data)}`)
    return res.data;
  }
}

module.exports = main
