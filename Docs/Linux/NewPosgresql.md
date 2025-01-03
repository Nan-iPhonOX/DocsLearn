# 编译安装Postgresql最新版

## 编译前准备

---

### 下载

```bash
# 自己创建的源码存放目录AppSource，方便管理
cd ~/AppSource
# 访问https://www.postgresql.org/ftp/source
wget https://ftp.postgresql.org/pub/source/v17.2/postgresql-17.2.tar.gz
tar -xvf postgresql-17.2.tar.gz
```

### 安装依赖

```bash
# 可以根据配置需要安装依赖包，配置参数查询
./configure --help

# 这是我的与配置参数

./configure --prefix=/usr/local/pgsql --without-icu

sudo apt install ...
# 一般包含一下依赖，可根据需要进行选择,不同系统上的包名可能不同

sudo apt install gcc perl-ExtUtils-Embed readline-devel zlib-devel openssl-devel pam pam-devel libxml2-devel libxslt-devel tcl tcl-devel python-devel docbook-style-dsssl flex bison openjade 

# Debian 必须使用的依赖
bison
flex
libreadline-dev

```

## 编译安装

```bash
make && makeinstll
```

## 配置

### 配置用于数据库管理的用户组

```bash
groupadd postgres

# 添加用户pgadmin 用户目录 /home/pgadmin 并指定用户组为postgres
useradd pgadmin -d /home/pgadmin -g postgres
# 设置密码
passwd pgadmin

```


### 创建数据库目录和log目录

```bash
# 创建数据库目录和log目录
mkdir /home/pgadmin /home/pgadmin/data /home/pgadmin/log

# 修改用户目录权限
sudo chown -R pgadmin:postgres /home/pgadmin

# 切换到用户pgadmin
su pgadmin

# 切换至目录
cd /usr/loacl/pgsql/bin

# 初始化数据库
./initdb -D /home/pgadmin/data -U pgadmin
```

### 配置环境变量

#### 将配置写入rc
```bash
.zshrc
# postgresql 
export PGHOME=/usr/local/pgsql
export PGDATA=/home/pgadmin/data
export PATH=$PATH:$PGHOME/bin
# 设置动态库收索目录
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:$PGHOME/lib/
```

重启wsl


### 远程访问
```bash
# 进入数据库目录
cd /home/pgadmin/data
# 编辑pg_hba.conf文件
vim pg_hba.conf
# 找到host all all IP_ADDRESS# 找到host all all 127.0.0.1/32 md5 这一行，修改为
host all all 0.0.0.0/0 md5

# 编辑postgresql.conf文件
vim postgresql.conf
# 找到listen_addresses = 'localhost' 这一行，修改为listen_addresses = '*'
# 重启数据库
pg_ctl -D /home/pgadmin/data -l /home/pgadmin/log/postgresql.log start
```
## 链接

```bash
# 使用psql链接数据库
psql -h IP_ADDRESS -p 5432 -U pgadmin -d postgres

#创建新的database
create database dbname;

#切换到新的database

\c dbname

#查看当前database
\l

#退出数据库
```

# 配置postgresql服务

## 编辑postgresql.service文件

```bash {cmd=true}
sudo vim /lib/systemd/system/postgresql.service
```

## 文件内容

```bash 
[Unit]
Description=PostgreSQL database server
After=network.target

[Service]
Type=forking
User=pgadmin
Group=postgres
ExecStart=/usr/local/pgsql/bin/pg_ctl start -D /home/pgadmin/pgdata
ExecStop=/usr/local/pgsql/bin/pg_ctl stop -D /home/pgadmin/pgdata
ExecReload=/usr/local/pgsql/bin/pg_ctl reload -D /home/pgadmin/pgdata
PIDFile=/home/pgadmin/pgdata/postmaster.pid

[Install]
WantedBy=multi-user.target
```

# 配置服务自动启动

## 服务
```bash {cmd=true}
sudo systemctl start nginx
sudo systemctl start postgresql
```

## 开机启动服务
```bash {cmd=true}
sudo systemctl enable nginx
sudo systemctl enable postgresql
```

## 查看服务状态

```bash {cmd=true}
sudo systemctl status postgresql
sudo systemctl status nginx
```