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
  if (!str) return '';
  const buf = Buffer.from(str);
  if (buf.length <= maxBytes) return str;
  let cut = buf.slice(0, maxBytes);
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
        const errors = [];
        const safeFrom = mail.from ? mail.from.text : 'unknown';
        const safeTo = mail.to ? mail.to.text : 'unknown';

        if (!mail.to || !mail.from) {
          const msg = `邮件缺少收件人/发件人，from=${safeFrom}, to=${safeTo}`;
          console.info(msg);
          errors.push({ step: 'parse', msg });
        }

        const mailId = `${Date.now()}--${cutByByte(safeTo, 60)}--${cutByByte(mail.subject, 100)}`;

        // 1. 优先缓存到本地（记录日志 + 保存内容/附件）
        try {
          log(JSON.stringify({
            ak: config.ak,
            remote_ip: session.remoteAddress,
            remote_host: session.clientHostname,
            headers: mail.headers,
            sender: safeFrom,
            receiver: safeTo,
            subject: mail.subject,
            mail_id: mailId
          }));
          const mailDir = path.join(__dirname, '..', 'logs', 'emails');
          const mailPath = path.join(mailDir, mailId);
          await fs.ensureDir(mailPath);

          // 保存HTML内容
          if (mail.html) {
            await fs.writeFile(path.join(mailPath, 'content.html'), mail.html);
          } else if (mail.text) {
            await fs.writeFile(path.join(mailPath, 'content.html'), mail.text);
          }

          // 保存附件
          if (mail.attachments && mail.attachments.length) {
            for (const attachment of mail.attachments) {
              let filename = attachment.filename || 'attachment';
              filename = cutByByte(filename, 100);
              const attachmentPath = path.join(mailPath, filename);
              try {
                await fs.writeFile(attachmentPath, attachment.content);
              } catch (writeErr) {
                console.info(`保存附件失败: ${writeErr}`);
              }
            }
          }
        } catch (err) {
          console.error('缓存本地出错', err);
          errors.push({ step: 'cache', msg: err.message || String(err) });
        }

        const commonFields = () => ({
          ak: config.ak,
          remote_ip: session.remoteAddress,
          remote_host: session.clientHostname,
          headers: mail.headers,
          sender: safeFrom,
          receiver: safeTo,
          subject: mail.subject,
          content: mail.html
        });

        // 2. 发往中心后台
        try {
          await upstream.send(commonFields());
        } catch (err) {
          console.error('发往中心后台出错', err);
          errors.push({ step: 'upstream', msg: err.message || String(err) });
        }

        // 3. 查询规则并转发（需要 from/to 都存在）
        if (mail.to && mail.from) {
          try {
            const transferErrors = await transfer(mail);
            if (Array.isArray(transferErrors)) {
              transferErrors.forEach(e => errors.push(e));
            }
          } catch (err) {
            console.error('转发处理出错', err);
            errors.push({ step: 'transfer', msg: err.message || String(err) });
          }
        }

        // 4. 出错发管理员通知（通知1 -> 通知2 降级在 adminNotify 内部）
        if (errors.length) {
          await notify.adminNotify(errors).catch(e => console.error('adminNotify 自身出错', e));
        }

        return callback();
      } catch (e) {
        console.error(e)
        console.info(e.stack)
        const msg = `接收处理新邮件失败2: ${e}, err.stack: ${e.stack}`
        console.info(msg)
        notify.adminNotify([{ step: 'fatal', msg }]).catch(() => {})
        var e2 = new Error('Internal Error');
        e2.responseCode = 554;
        return callback(e2);
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

// 全局兜底：避免未捕获异常/拒绝导致进程退出（仅记录，不退出）
process.on('unhandledRejection', (reason) => {
  const info = reason && reason.stack ? reason.stack : String(reason);
  console.error('unhandledRejection:', info);
  log(`unhandledRejection: ${info}`);
});
process.on('uncaughtException', (err) => {
  const info = err && err.stack ? err.stack : String(err);
  console.error('uncaughtException:', info);
  log(`uncaughtException: ${info}`);
});
