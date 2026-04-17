const aliyunEmail = require('./aliyunEmailPush')
const tiTransfer = require('./tiTransfer')
const hpTransfer = require('./hpTransfer')
const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/

const checkAndHandleTransfer = async (mail) => {
  const receiverMatch = mail.to.text.match(emailRegex)
  const senderMatch = mail.from.text.match(emailRegex)
  if (!receiverMatch || !senderMatch) {
    console.info(`无法解析收件人/发件人邮箱，跳过转发处理`)
    return
  }
  const receiveHost = receiverMatch[0].split('@')[1]
  const senderHost = senderMatch[0].split('@')[1]
  console.info('receiveHost: ', receiveHost)
  console.info('senderHost: ', senderHost)
  if (receiveHost == 'hupan.cafe' || receiveHost == 'hpcafe.cn') {
    // 处理中转
    await aliyunEmail.send(mail).catch(err => console.info(`通过阿里云转发出错: `, err))
    await hpTransfer.handle(mail).catch(err => console.info(`转发hp邮件出错: `, err))
  } else {
    // 只要是这个邮箱的都转发
    console.info('pre to transfer...')
    await tiTransfer.handle(mail).catch(err => console.info(`转发ti邮件出错: `, err))
  }
}

module.exports = checkAndHandleTransfer