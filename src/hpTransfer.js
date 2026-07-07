var nodemailer = require('nodemailer')
var axios = require('axios')
const uploader = require('./uploader')

const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/

const getTransitTargetEmail = receiver => {
  const name = receiver.split('@')[0]
  return axios.get(`https://gg.hongliang.fun/api/v1/email_transit_rules/transit_target?name=${name}`, { timeout: 10000 }).then(res => res.data.data)
}

const handleTransfer = async mailOptions => {
  const res = await axios.post('https://bu6b68aioe.execute-api.cn-northwest-1.amazonaws.com.cn/handle', mailOptions, { timeout: 10000 })
  console.log(res.data)
  if (res.status != 200) {
    throw new Error('调用hp_email_transfer失败: 非200状态')
  }
  return res.data
}

const main = {
  handle: async function (mail) {
    let receiver, sender, targetEmail;
    try {
      receiver = mail.to.text.match(emailRegex)[0];
      sender = mail.from.text.match(emailRegex)[0];
      targetEmail = await getTransitTargetEmail(receiver);
    } catch (err) {
      console.info(`hupan 转发前查询出错: ${err}`);
      throw err;
    }
    if (!targetEmail) {
      console.info(`hupan没有对应规则，不需要转发....`)
      return
    }
    console.info(`receiveHost: hpcafe.cn / hupan.cafe, senderHost: ${sender.split('@')[1]}, 目标转发地址: ${targetEmail}`)
    const senderName = mail.from.text.replace(/<[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+>/, '')
    var mailOptions = {
      from: `${senderName} <>`, // sender address mailfrom must be same with the user
      subject: `[湖畔]${mail.subject}`,
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
    mailOptions.to = targetEmail
    await handleTransfer(mailOptions)
  }
}


module.exports = main
