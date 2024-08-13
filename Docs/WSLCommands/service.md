# 配置Nginx服务

## 编辑 nginx.service 文件

```bash {cmd=true}
sudo vi /etc/systemd/system/nginx.service
```

## 设置服务文件内容

```bash {cmd=true}
[Unit]
Description=nginx - high performance web server
Documentation=https://nginx.org/en/docs/
After=network.target

[Service]
Type=forking
User=crazy
Group=crazy
ExecStartPre=/home/crazy/nginx/sbin/nginx -t -c /home/crazy/nginx/conf/nginx.conf
ExecStart=/home/crazy/nginx/sbin/nginx -c /home/crazy/nginx/conf/nginx.conf
ExecReload=/home/crazy/nginx/sbin/nginx -s reload
ExecStop=/home/crazy/nginx/sbin/nginx -s stop
PIDFile=/home/crazy/nginx/logs/nginx.pid
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

当然可以！让我们逐项解释这个 systemd 服务单元文件的配置：

### [Unit] 部分
- **Description**: 描述服务的简要说明，这里是 "nginx - high performance web server"。
- **Documentation**: 提供指向服务文档的链接。
- **After**: 指定服务启动的顺序，这里表示 nginx 服务应在 `network.target` 之后启动。

### [Service] 部分
- **Type**: 指定服务的启动类型，这里是 `forking`，表示服务会在启动时创建一个子进程。
- **User**: 指定运行服务的用户，这里是 `crazy`。
- **Group**: 指定运行服务的用户组，这里是 `crazy`。
- **ExecStartPre**: 在启动主服务进程前执行的命令，这里用于测试 nginx 配置文件的正确性。
- **ExecStart**: 启动主服务进程的命令。
- **ExecReload**: 重新加载服务配置的命令。
- **ExecStop**: 停止服务的命令。
- **PIDFile**: 指定服务的 PID 文件路径。
- **PrivateTmp**: 为服务分配一个独立的临时空间，增强安全性。

### [Install] 部分
- **WantedBy**: 指定服务的目标运行级别，这里是 `multi-user.target`，表示服务将在多用户模式下启动。

# 配置postgresql服务

## 编辑postgresql.service文件

```bash {cmd=true}
sudo vim /lib/systemd/system/postgresql.service
```

## 文件内容

```bash {cmd=true}
[Unit]
Description=PostgreSQL database server
After=network.target

[Service]
Type=forking
User=crazy
ExecStart=/usr/local/pgsql16.3/bin/pg_ctl start -D /home/crazy/pgdata
ExecStop=/usr/local/pgsql16.3/bin/pg_ctl stop -D /home/crazy/pgdata
ExecReload=/usr/local/pgsql16.3/bin/pg_ctl reload -D /home/crazy/pgdata
PIDFile=/home/crazy/pgdata/postmaster.pid

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