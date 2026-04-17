var nodemailer = require('nodemailer')
var axios = require('axios')
const uploader = require('./uploader')
const notify = require('./notify')

var transporter = nodemailer.createTransport({
  "host": "smtpdm.aliyun.com",
  "port": 80,
  // "secureConnection": true, // use SSL, the port is 465
  "auth": {
    "user": 'transfer@limx.hupan.cafe', // user name
    "pass": 'EssvanQin123'         // password
  }
})

var transporter2 = nodemailer.createTransport({
  host: 'smtp.163.com',
  port: 465,
  // "secureConnection": true, // use SSL, the port is 465
  "auth": {
    "user": 'limxas@163.com', // user name
    "pass": 'MULFSTBNOFMBMYFZ'         // password
  }
})
// NB! No need to recreate the transporter object. You can use
// the same transporter object for all e-mails
// setup e-mail data with unicode symbols

const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/

const getEmailValidInfo = name => {
  return axios.get(`https://gg.hongliang.fun/api/v1/email_valid?name=${name}`).then(res => res.data)
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
    if (!validInfo.valid) return
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
    result = await transporter.sendMail(mailOptions).then(d => {
      console.info('发送结果: ', d)
      if (d.rejected.length == 0 && d.response.startsWith(`250 Data Ok`)) {
        return d
      } else {
        notify.push(`阿里云邮件推送失败: ${JSON.stringify(d)}`)
        console.info(`发送失败，准备重发: ${JSON.stringify(d)}`)
        throw new Error(`response status code is not 250...`)
      }
    }).catch(async err => {
      console.info('发送失败: ', err)
      result = await transporter2.sendMail(mailOptions).then(d2 => {
        console.info('发送结果2: ', d2)
        return d2
      }).catch(err2 => {
        console.info('发送失败2: ', err2)
      })
      notify.push(`阿里云邮件推送失败: err: ${err.message || err}`)
    })
    return result
  }
}


module.exports = main