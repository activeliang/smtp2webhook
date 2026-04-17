var config = require('./config');
var SMTPServer = require('smtp-server').SMTPServer;
var DKIM = require('dkim');
var simpleParser = require('mailparser').simpleParser;
var upstream = require('./upstream');
const base64 = require('js-base64');
// const fs = require('fs')
const notify = require('./notify')
const log = require('./logger');
const path = require('path');
const transfer = require('./transfer')
const fs = require('fs-extra');

// 按字节截断字符串
function cutByByte(str, maxBytes) {
  const buf = Buffer.from(str);
  if (buf.length <= maxBytes) return str;
  const cut = buf.slice(0, maxBytes);
  // 避免截断到半个 UTF-8 字符
  while (cut.length > 0 && (cut[cut.length - 1] & 0x80) === 0x80) {
    // 如果最后一个字节是 UTF-8 多字节字符的一部分，往前截
    if ((cut[cut.length - 1] & 0xE0) === 0xC0) { cut = cut.slice(0, -1); break; }
    if ((cut[cut.length - 1] & 0xF0) === 0xE0) { cut = cut.slice(0, -2); break; }
    if ((cut[cut.length - 1] & 0xF8) === 0xF0) { cut = cut.slice(0, -3); break; }
    break;
  }
  return cut.toString('utf8');
}

const serverParams = {
  authOptional: true,
  disabledCommands: ['AUTH'],
  size: config.maxSize,
  onData(stream, session, callback) {
    console.info(session)
    const chunks = [];
    stream.on('data', function (data) {
      chunks.push(data);
    })
    stream.on('end', async function () {
      let message;
      try {
        message = Buffer.concat(chunks);
      } catch (e) {
        console.error('合并邮件数据失败:', e);
        return callback(e);
      }
      try {
        var mail = await simpleParser(message);
        if (!mail.to) {
          console.info(`没有mail.to...忽略邮件`);
          log(JSON.stringify({ err: 'no_mail_to', from: mail.from ? mail.from.text : 'unknown' }));
          return callback();
        }
        const mailId = `${Date.now()}--${cutByByte(mail.to.text, 60)}--${cutByByte(mail.subject, 100)}`
        // 记录日志到本地
        try {
          log(JSON.stringify({
            ak: config.ak,
            remote_ip: session.remoteAddress,
            remote_host: session.clientHostname,
            headers: mail.headers,
            sender: mail.from.text,
            receiver: mail.to.text,
            subject: mail.subject,
            mail_id: mailId
          }))
        } catch (err) {
          console.info(`记录日志出错: `, err)
        }

        // 缓存附件和内容到本地文件夹
        try {
          const mailDir = path.join(__dirname, '..', 'logs', 'emails');
          const mailPath = path.join(mailDir, mailId);
          await fs.ensureDir(mailPath);

          // 保存HTML内容
          if (mail.html) {
            await fs.writeFile(path.join(mailPath, 'content.html'), mail.html).catch(err => { throw err; });
          } else if (mail.text) {
            await fs.writeFile(path.join(mailPath, 'content.html'), mail.text).catch(err => { throw err; });
          }

          // 保存附件
          if (mail.attachments && mail.attachments.length) {
            for (const attachment of mail.attachments) {
              let filename = attachment.filename || 'attachment';
              filename = cutByByte(filename, 100);
              const attachmentPath = path.join(mailPath, filename);
              await fs.writeFile(attachmentPath, attachment.content).catch(writeErr => {
                console.info(`保存附件失败: ${writeErr}`);
              });
            }
          }
        } catch (err) {
          console.info('缓存本地出错', err)
        }

        // 转发邮件到相关位置
        try {
          await transfer(mail).catch(err => console.info(`转发邮件出错: `, err))
        } catch (err) {
          console.info(`转发邮件出错: `, err)
        }

        // 上传到网站记录
        try {
          await upstream.send({
            ak: config.ak,
            remote_ip: session.remoteAddress,
            remote_host: session.clientHostname,
            headers: mail.headers,
            sender: mail.from.text,
            receiver: mail.to.text,
            subject: mail.subject,
            content: mail.html
          }).catch(err => console.info('upstream error: ', err))
        } catch (err) {
          console.info(`上传到后台出错`, err)
        }
        return callback()
      } catch (e) {
        console.error(e)
        console.info(e.stack)
        console.info(`接收处理新邮件失败2: ${e}, err.stack: ${e.stack}`)
        notify.push(`接收处理新邮件失败2: ${e}, err.stack: ${e.stack}`)
        var e = new Error('Internal Error');
        e.responseCode = 554;
        return callback(e);
      }
    })
  }
}

var server25 = new SMTPServer(serverParams)
server25.on('error', function (e) {
  console.error('server25: ', e)
})
server25.listen(25)
log(`listening via 25 port ...`)
console.info(`listening via 25 port ...`)