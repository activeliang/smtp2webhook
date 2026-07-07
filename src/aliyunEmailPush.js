var nodemailer = require('nodemailer')
var axios = require('axios')
const uploader = require('./uploader')

var transporter = nodemailer.createTransport({
  "host": "smtpdm.aliyun.com",
  "port": 80,
  "auth": {
    "user": 'transfer@limx.hupan.cafe', // user name
    "pass": 'EssvanQin123'         // password
  }
})

var transporter2 = nodemailer.createTransport({
  host: 'smtp.163.com',
  port: 465,
  "auth": {
    "user": 'limxas@163.com', // user name
    "pass": 'MULFSTBNOFMBMYFZ'         // password
  }
})

const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/

const getEmailValidInfo = name => {
  return axios.get(`https://gg.hongliang.fun/api/v1/email_valid?name=${name}`, { timeout: 10000 }).then(res => res.data)
}

const main = {
  send: async function (mail) {
    let sender;
    try {
      sender = mail.from.text.match(emailRegex)[0];
    } catch (err) {
      console.info(`无法解析发件人邮箱: ${err}`);
      return;
    }
    const validInfo = await getEmailValidInfo(sender.split('-')[0])
    if (!validInfo || !validInfo.valid) return
    const senderName = mail.from.text.replace(/<[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+>/, '')
    var mailOptions = {
      from: `[${mail.to.text.match(emailRegex)[0].split('@')[0]}] ${senderName} <transfer@limx.hupan.cafe>`, // sender address mailfrom must be same with the user
      to: validInfo.target,
      subject: mail.subject,
      text: mail.text,
      replyTo: mail.from.text.match(emailRegex)[0],
      html: mail.html,
      attachments: mail.attachments
    }

    // 处理附件大于8mb的情况
    const totalSize = (mail.attachments || []).reduce((t, c) => t + (c.size || 0), 0)
    console.info('totalSize: ', totalSize)
    const limitMbSize = 8
    if (totalSize >= limitMbSize * 1024 * 1024) {
      const attachmentItems = await uploader.handle(mail.attachments)
      const attachmentTags = attachmentItems.map((i, idx) => `<div><span>${idx+1}. </span><span>${i.name}</span><span style="margin-left: .3rem;">[${(i.size / 1024 / 1024).toFixed(2)}MB]</span><a style="margin-left: .3rem;" href="https://nyhau.oss-cn-guangzhou.aliyuncs.com/${i.path}">https://nyhau.oss-cn-guangzhou.aliyuncs.com/${i.path}</a></div>`)
      mailOptions.html += `<br><br><br>-----中转附件大小超限----- <br>${attachmentTags.join('<br>')}`
      mailOptions.attachments = []
    }

    let result
    try {
      result = await transporter.sendMail(mailOptions)
      if (result.rejected.length == 0 && result.response.startsWith(`250 Data Ok`)) {
        console.info('发送结果: ', result)
      } else {
        throw new Error(`response status code is not 250: ${result.response}`)
      }
    } catch (err) {
      console.info('主发送失败，尝试备用: ', err.message)
      try {
        result = await transporter2.sendMail(mailOptions)
        console.info('备用发送结果: ', result)
      } catch (err2) {
        throw new Error(`阿里云/163 邮件发送均失败: ${err2.message || err2}`)
      }
    }
    return result
  }
}


module.exports = main
