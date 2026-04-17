var nodemailer = require('nodemailer')
var axios = require('axios')
const uploader = require('./uploader')
const notify = require('./notify')

// NB! No need to recreate the transporter object. You can use
// the same transporter object for all e-mails
// setup e-mail data with unicode symbols

const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/

const getEmailValidInfo = (receiver, sender) => {
  // return axios.get(`http://localhost:3000/api/v1/emails/ti_transfer_check?receiver=${receiver}&sender=${sender}`).then(res => res.data)
  return axios.get(`http://rtr.hongliang.fun/api/v1/emails/ti_transfer_check?receiver=${receiver}&sender=${sender}`).then(res => res.data.data)
}

const handleTransfer = async mailOptions => {
  return axios.post('https://svms82f0o3.execute-api.cn-northwest-1.amazonaws.com.cn/handle', mailOptions).then(res => {
    console.log(res)
    if (res.status != 200) {
      notify.push('调用ti_email_transfer失败...')
    }
  }).catch(err => {
    notify.push(`调用ti_email_transfer失败... error: ${JSON.stringify(err)}`)
  })
}

const main = {
  handle: async function (mail) {
    let receiver, sender, validInfo;
    try {
      receiver = mail.to.text.match(emailRegex)[0];
      sender = mail.from.text.match(emailRegex)[0];
      validInfo = await getEmailValidInfo(receiver, sender);
    } catch (err) {
      console.info(`ti 转发前查询出错: ${err}`);
      notify.push(`ti 转发前查询出错: ${err.message || err}`);
      return;
    }
    console.info(`receiveHost: ${sender.split('@')[1]}, senderHost: ${receiver.split('@')[1]}, validInfo: `, validInfo)
    if (!validInfo || !validInfo.result) return
    const senderName = mail.from.text.replace(/<[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+>/, '')
    var mailOptions = {
      from: `${senderName} <>`, // sender address mailfrom must be same with the user
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
      const attachmentTags = attachmentItems.map((i, idx) => `<div><span>${idx + 1}. </span><span>${i.name}</span><span style="margin-left: .3rem;">[${(i.size / 1024 / 1024).toFixed(2)}MB]</span><a style="margin-left: .3rem;" href="https://nyhau.oss-cn-guangzhou.aliyuncs.com/${i.path}">https://nyhau.oss-cn-guangzhou.aliyuncs.com/${i.path}</a></div>`)
      mailOptions.html += `<br><br><br>-----中转附件大小超限----- <br>${attachmentTags.join('<br>')}`
      mailOptions.attachments = []
    }
    for (let i = 0; i < validInfo.to.length; i++) {
      mailOptions.to = validInfo.to[i]
      await handleTransfer(mailOptions).catch(err => {
        console.info(`handleTransfer 出错了: ${err}`)
      })
    }
  }
}


module.exports = main