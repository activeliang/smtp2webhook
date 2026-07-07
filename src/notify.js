const axios = require('axios')

const NOTIFY1_URL = "https://cnjx81311e.execute-api.cn-northwest-1.amazonaws.com.cn/handle"
const PUSHOVER_URL = "https://api.pushover.net/1/messages.json"

const main = {
  // 管理员通知1：发往中心通知 webhook（AWS API Gateway）。失败抛错，交由 adminNotify 降级到 pushover
  push: async (content, title = "邮件中转管理员通知") => {
    const params = { title, content }
    const headers = { authorization: `Bearer liang888` }
    return axios.post(NOTIFY1_URL, params, { headers, timeout: 10000 })
  },

  // 管理员通知2：pushover。参考 Ruby 实现，最多重试 3 次。凭据来自环境变量 PUSHOVER_TOKEN / PUSHOVER_USER
  pushover: async (content, title = "smtp2webhook 告警") => {
    const token = process.env.PUSHOVER_TOKEN
    const user = process.env.PUSHOVER_USER
    if (!token || !user) {
      console.error('pushover 未配置 PUSHOVER_TOKEN / PUSHOVER_USER，跳过通知')
      return
    }
    const params = { token, user, message: content, title }
    let tries = 0
    while (true) {
      try {
        await axios.post(PUSHOVER_URL, params, {
          headers: { 'content-type': 'application/json' },
          timeout: 10000
        })
        return
      } catch (err) {
        tries += 1
        if (tries < 3) continue
        console.error('pushover notify error!', err.message)
        return
      }
    }
  },

  // 顶层统一通知：先通知1，失败降级通知2。内容即原始错误汇总，不额外附加说明
  adminNotify: async (errors) => {
    const content = Array.isArray(errors)
      ? errors.map(e => {
          const step = e && e.step ? `[${e.step}] ` : ''
          const msg = e && (e.msg || e.message) ? (e.msg || e.message) : (typeof e === 'string' ? e : JSON.stringify(e))
          return step + msg
        }).join('\n')
      : String(errors)
    try {
      await main.push(content)
    } catch (err) {
      console.error('管理员通知1失败，降级到 pushover:', err.message)
      await main.pushover(content)
    }
  }
}

module.exports = main
