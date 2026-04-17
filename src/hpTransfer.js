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

const getTransitTargetEmail = receiver => {
  const name = receiver.split('@')[0]
  return axios.get(`https://gg.hongliang.fun/api/v1/email_transit_rules/transit_target?name=${name}`).then(res => res.data.data)
}

// const notifyer = async (str, title = '邮件处理中心通知[us_smtp2webhook]') => {
//   const params = {
//     token: 'aiw45n1qqnmf3j8bnj2v6ssvvw3e6c',
//     user: 'udgp4jdju8navenf9dy5nt3tncdgmt',
//     message: str,
//     title: title
//   }
//   axios.post("https://api.pushover.net/1/messages.json", params, { 'content-type': 'application/json' })
// }

// const handleTransfer = async mailOptions => {
//   // return axios.post('https://svms82f0o3.execute-api.cn-northwest-1.amazonaws.com.cn/handle', mailOptions).then(res => {
//   //   console.log(res)
//   //   if (res.status != 200) {
//   //     notify.push('调用ti_email_transfer失败...')
//   //   }
//   // }).catch(err => {
//   //   notify.push(`调用ti_email_transfer失败... error: ${JSON.stringify(err)}`)
//   // })
//   var transporter = nodemailer.createTransport({
//     host: 'smtp.163.com',
//     port: 465,
//     // "secureConnection": true, // use SSL, the port is 465
//     "auth": {
//       "user": 'hp_transfer@163.com', // user name
//       "pass": 'UBLSYGTWHQUAUXRT'         // password
//     }
//   })
//   result = await transporter.sendMail(mailOptions).then(d => {
//     console.info('hupan 邮件转发，发送结果: ', d)
//     if (d.accepted.map(i => i.toLowerCase()).includes(currentReceiver.toLowerCase()) && d.response.startsWith(`250`)) {
//       res1 = d
//       return d
//     } else {
//       console.info(`发送失败，准备重发: ${JSON.stringify(d)}`)
//       throw new Error(`response status code is not 250...`)
//     }
//   }).catch(async err => {
//     console.info('发送失败: ', err)
//     result = await transporter.sendMail(mailOptions).then(d => {
//       console.info('发送结果2: ', d)
//       res2 = d
//       return d
//     }).catch(err2 => {
//       console.info('发送失败2: ', err2)
//     })
//     notifyer(`hupan邮件发送失败: err: ${JSON.stringify(err)}`)
//     return result
//   })
// }

const handleTransfer = async mailOptions => {
  return axios.post('https://bu6b68aioe.execute-api.cn-northwest-1.amazonaws.com.cn/handle', mailOptions).then(res => {
    console.log(res.data)
    if (res.status != 200) {
      notify.push('调用hp_email_transfer失败...')
    }
  }).catch(err => {
    notify.push(`调用hp_email_transfer失败... error: ${JSON.stringify(err)}`)
  })
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
      notify.push(`hupan 转发前查询出错: ${err.message || err}`);
      return;
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
    await handleTransfer(mailOptions).catch(err => {
      console.info(`handleTransfer 出错了: ${err}`)
    })
  }
}


module.exports = main