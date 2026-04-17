let OSS = require('ali-oss');
let md5 = require('js-md5');
const axios = require('axios')
const notify = require('./notify')

const endpoint = "https://gg.hongliang.fun/"

const getStsToken =  _ => {
  return axios.get(endpoint + 'api/v1/sts_token').then(res => res.data.data)
}

const generateClient = (token) => {
  return new OSS({
    region: 'oss-cn-guangzhou',
  	//云账号AccessKey有所有API访问权限，建议遵循阿里云安全最佳实践，创建并使用STS方式来进行API访问
    accessKeyId: token.AccessKeyId,
    accessKeySecret: token.AccessKeySecret,
    stsToken: token.SecurityToken,
    bucket: 'nyhau',
    refreshSTSToken: async () => {      
      const refreshToken = await axios.get(endpoint + "api/v1/sts_token").then(res => res.data.data)
      return {
        accessKeyId: refreshToken.AccessKeyId,
        accessKeySecret: refreshToken.AccessKeySecret,
        stsToken: refreshToken.SecurityToken,
      };
    },
  })
}

const uploadProcess = async file => new Promise(async (resolve, reject) => {
  const sts_token = await getStsToken()
  const client = generateClient(sts_token)
  const md5Value = md5(file.content)
  const filePath = `limx/email_transfer/${md5Value}_${file.filename}`
  const listFile = await client.list({ prefix: filePath })
  console.info('listFile: ', listFile)
  if (listFile.objects.length > 0) {
    console.log('检查到文件已存在，跳过上传...')
    return resolve({ path: filePath, name: file.filename, size: file.size })
  }
  await client.multipartUpload(filePath, file.content).then(_ => resolve({ path: filePath, name: file.filename, size: file.size })).catch(reject).finally(_ => {})
})

const handleUpload = async (files) => {
  const result = []
  const promiseArray = files.map((i, idx) => uploadProcess(i).then(res => result[idx] = res))
  await Promise.all(promiseArray)
  console.info('result: ', result)
  return result
}

module.exports.handle = handleUpload