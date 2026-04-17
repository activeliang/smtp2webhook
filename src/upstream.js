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
    var res = await axios.post(config.upstream, form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 8000 // 8 seconds in milliseconds
    }).then(r => r.data).catch(err => {
      console.info('backend server error: ', err.code);
      return err.code;
    });
    console.info(`send_to_backgend res: ${JSON.stringify(res)}`)
    log(`send_to_backgend res: ${JSON.stringify(res)}`)
    return res;
  }
}

module.exports = main

/*
exports.send({
  ak: "e8562670b6c840688f34044309b0fdd0",
  sender: "pjincz@gmail.com",
  receiver: "test@jcz.onl",
  subject: "test+mail",
  textcontent: "awef awef awef",
}).then(console.log);
*/
