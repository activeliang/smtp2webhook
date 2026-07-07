const aliyunEmail = require('./aliyunEmailPush')
const tiTransfer = require('./tiTransfer')
const hpTransfer = require('./hpTransfer')
const emailRegex = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/

const checkAndHandleTransfer = async (mail) => {
  const errors = []
  const receiverMatch = mail.to.text.match(emailRegex)
  const senderMatch = mail.from.text.match(emailRegex)
  if (!receiverMatch || !senderMatch) {
    console.info(`无法解析收件人/发件人邮箱，跳过转发处理`)
    return errors
  }
  const receiveHost = receiverMatch[0].split('@')[1]
  const senderHost = senderMatch[0].split('@')[1]
  console.info('receiveHost: ', receiveHost)
  console.info('senderHost: ', senderHost)
  if (receiveHost == 'hupan.cafe' || receiveHost == 'hpcafe.cn') {
    await aliyunEmail.send(mail).catch(err => errors.push({ step: 'aliyun', msg: err.message || String(err) }))
    await hpTransfer.handle(mail).catch(err => errors.push({ step: 'hupan', msg: err.message || String(err) }))
  } else {
    await tiTransfer.handle(mail).catch(err => errors.push({ step: 'ti', msg: err.message || String(err) }))
  }
  return errors
}

module.exports = checkAndHandleTransfer
