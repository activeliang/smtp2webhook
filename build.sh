# install docker 
wget -qO- https://get.docker.com | sh

# local build 
docker build --platform linux/amd64 -t activeliang/smtp2webhook .
# docker tag ...
docker tag  registry.cn-hongkong.aliyuncs.com/activeliang/smtp2webhook
docker push registry.cn-hongkong.aliyuncs.com/activeliang/smtp2webhook

# server run
docker login --username=qq75219670@126.com registry.cn-hongkong.aliyuncs.com -p xxxxxxxx
docker pull registry.cn-hongkong.aliyuncs.com/activeliang/smtp2webhook
docker container stop smtp2webhook
docker container rm smtp2webhook
mkdir -p /var/log/smtp2webhook
docker run -d -p 25:25  --name smtp2webhook --restart=always -v /var/log/smtp2webhook:/app/logs registry.cn-hongkong.aliyuncs.com/activeliang/smtp2webhook
# tail -f /var/log/smtp2webhook/email.log
docker logs --tail=100 -f smtp2webhook



# server dev 
docker container stop smtp2webhook
docker container rm smtp2webhook
docker run --rm -it -p 25:25  --name smtp2webhook -v /var/log/smtp2webhook:/app/logs activeliang/smtp2webhook
