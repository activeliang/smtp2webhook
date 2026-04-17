const axios = require('axios')

const main = { 
  push: async (content, title="邮件中转管理员通知") => {
    const params = {
      title,
      content
    }
    const headers = {
      authorization: `Bearer liang888`
    }
    return axios.post("https://cnjx81311e.execute-api.cn-northwest-1.amazonaws.com.cn/handle", params, { headers })
  }
}

module.exports = main

// console.info('kkk');
// (async _ => {
//   await main.push('kkkkkkkk').then(d => console.info(d))
// })()
