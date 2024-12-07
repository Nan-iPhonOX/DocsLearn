# 编译安装 Nginx 最新版

## 预编译包

> ---

### 下载

```bash
wget https://nginx.org/download/nginx-1.26.2.tar.gz
```

### 解压

```bash
tar -xf nginx-1.26.2.tar.gz
```

## 编译

> ---

### 编译环境配置

> 编译 Nginx 需要 gcc+的环境支持
>
> 因为 nginx.conf 中使用了正则表达式，所以编译 Nginx 时就需要把 PCRE 库编译进 Nginx
>
> Nginx 编译过程和 Http 相应过程还需要 gzip 格式的压缩，所以我们还需要安装 zlib 库
>
> SSL 协议也很重要

```bash
sudo apt install gcc make libpcre3 libpcre3-dev openssl
```

### 编译前配置

```bash
./configure \
    --with-http_ssl_module \
    --with-stream \
    --with-stream_ssl_module
```

推荐配置

```bash
./configure
    --prefix=/etc/nginx
    --sbin-path=/usr/sbin/nginx
    --conf-path=/etc/nginx/nginx.conf
    --error-log-path=/var/log/nginx/error.log
    --http-log-path=/var/log/nginx/access.log
    --pid-path=/var/run/nginx.pid
    --lock-path=/var/run/nginx.lock
    --http-client-body-temp-path=/var/cache/nginx/client_temp --http-proxy-temp-path=/var/cache/nginx/proxy_temp --http-fastcgi-temp-path=/var/cache/nginx/fastcgi_temp --http-uwsgi-temp-path=/var/cache/nginx/uwsgi_temp
    --http-scgi-temp-path=/var/cache/nginx/scgi_temp
    --user=www
    --group=www --with-file-aio
    --with-threads
    --with-http_addition_module
    --with-http_auth_request_module
    --with-http_dav_module
    --with-http_flv_module
    --with-http_gunzip_module
    --with-http_gzip_static_module
    --with-http_mp4_module
    --with-http_random_index_module
    --with-http_realip_module
    --with-http_secure_link_module
    --with-http_slice_module
    --with-http_ssl_module
    --with-http_stub_status_module
    --with-http_sub_module
    --with-http_v2_module
    --with-mail
    --with-mail_ssl_module
    --with-stream
    --with-stream_realip_module
    --with-stream_ssl_module
    --with-stream_ssl_preread_module
```

> --help
> 打印帮助消息。

> --prefix=path
> 定义将保留服务器文件的目录。 此同一目录也将用于 设置的所有相对路径（库源的路径除外） 和配置文件中。 默认情况下，它设置为目录。configure nginx.conf /usr/local/nginx

> --sbin-path=path
> 设置 nginx 可执行文件的名称。 此名称仅在安装过程中使用。 默认情况下，文件名为 .prefix/sbin/nginx

> --modules-path=path
> 定义 nginx 动态模块将安装的目录。 默认情况下，使用目录。prefix/modules

> --conf-path=path
> 设置配置文件的名称。 如果需要，nginx 总是可以使用不同的配置文件启动 通过在命令行参数 -c file 中指定它。 默认情况下，文件名为 .nginx.confprefix/conf/nginx.conf

> --error-log-path=path
> 设置主要错误、警告和诊断文件的名称。 安装后，始终可以使用 error_log 指令在配置文件中更改文件名。 默认情况下，文件名为 .nginx.confprefix/logs/error.log

> --pid-path=path
> 设置文件的名称 ，它将存储主进程的进程 ID。 安装后，始终可以使用 pid 指令在配置文件中更改文件名。 默认情况下，文件名为 .nginx.pidnginx.confprefix/logs/nginx.pid

> --lock-path=path
> 为锁定文件的名称设置前缀。 安装后，始终可以使用 lock_file 指令在配置文件中更改该值。 默认情况下，该值为 .nginx.confprefix/logs/nginx.lock

> --user=name
> 设置将使用其凭证的非特权用户的名称 由 worker 进程。 安装后，始终可以使用 user 指令在配置文件中更改名称。 默认用户名为 nobody。nginx.conf

> --group=name
> 设置将使用其凭证的组的名称 由 worker 进程。 安装后，始终可以使用 user 指令在配置文件中更改名称。 默认情况下，组名称设置为非特权用户的名称。nginx.conf

> --build=name
> 设置可选的 nginx 构建名称。

> --builddir=path
> 设置 build 目录。

> --with-select_module

> --without-select_module
> 启用或禁用构建允许服务器工作的模块 使用方法。 如果平台未出现，则会自动构建此模块 支持更合适的方法，例如 kqueue、epoll 或 /dev/poll。select()

> --with-poll_module

> --without-poll_module
> 启用或禁用构建允许服务器工作的模块 使用方法。 如果平台未出现，则会自动构建此模块 支持更合适的方法，例如 kqueue、epoll 或 /dev/poll。poll()

> --with-threads
> 启用线程池的使用。

> --with-file-aio
> 允许在 FreeBSD 和 Linux 上使用异步文件 I/O （AIO）。

> --with-http_ssl_module
> 允许构建一个模块，该模块将 HTTPS 协议支持添加到 HTTP 服务器。 默认情况下，此模块不是构建的。 构建和运行此模块需要 OpenSSL 库。

> --with-http_v2_module
> 允许构建支持 HTTP/2 的模块。 默认情况下，此模块不是构建的。

> --with-http_v3_module
> 允许构建支持 HTTP/3 的模块。 默认情况下，此模块不是构建的。 提供 HTTP/3 支持的 SSL 库 推荐构建和运行此模块，例如 BoringSSL、LibreSSL 或 QuicTLS。 否则，如果使用 OpenSSL 库，则 将使用 OpenSSL 兼容层 不支持 QUIC 早期数据。

> --with-http_realip_module
> 启用构建将 Client 端地址更改为地址的 ngx_http_realip_module 模块 在指定的标头字段中发送。 默认情况下，此模块不是构建的。

> --with-http_addition_module
> 启用构建 ngx_http_addition_module 模块，该模块在响应前后添加文本。 默认情况下，此模块不是构建的。

> --with-http_xslt_module

> --with-http_xslt_module=dynamic
> 允许构建使用一个或多个 XSLT 样式表转换 XML 响应的 ngx_http_xslt_module 模块。 默认情况下，此模块不是构建的。 libxml2 和 libxslt 库 是构建和运行此模块所必需的。

> --with-http_image_filter_module

> --with-http_image_filter_module=dynamic
> 启用构建 ngx_http_image_filter_module 模块，该模块可转换 JPEG、GIF、PNG 和 WebP 格式的图像。 默认情况下，此模块不是构建的。

> --with-http_geoip_module

> --with-http_geoip_module=dynamic
> 启用构建 ngx_http_geoip_module 模块，该模块根据客户端 IP 地址创建变量 以及预编译的 MaxMind 数据库。 默认情况下，此模块不是构建的。

> --with-http_sub_module
> 允许构建 ngx_http_sub_module 模块，该模块通过将一个指定的字符串替换为另一个指定的字符串来修改响应。 默认情况下，此模块不是构建的。

> --with-http_dav_module
> 支持构建 ngx_http_dav_module 模块，该模块通过 WebDAV 协议提供文件管理自动化。 默认情况下，此模块不是构建的。

> --with-http_flv_module
> 启用构建提供伪流式处理服务器端支持的 ngx_http_flv_module 模块 用于 Flash 视频 （FLV） 文件。 默认情况下，此模块不是构建的。

> --with-http_mp4_module
> 启用构建提供伪流式处理服务器端支持的 ngx_http_mp4_module 模块 用于 MP4 文件。 默认情况下，此模块不是构建的。

> --with-http_gunzip_module
> 启用构建解压缩响应的 ngx_http_gunzip_module 模块 与 “” 适用于不支持 “gzip” 编码方法的客户端。 默认情况下，此模块不是构建的。Content-Encoding: gzip

> --with-http_gzip_static_module
> 启用构建 ngx_http_gzip_static_module 模块，该模块支持发送预压缩文件 替换为 “” 文件扩展名，而不是常规文件。 默认情况下，此模块不是构建的。.gz

> --with-http_auth_request_module
> 允许构建实现客户端授权的 ngx_http_auth_request_module 模块 基于 subrequest 的结果。 默认情况下，此模块不是构建的。

> --with-http_random_index_module
> 启用构建处理请求的 ngx_http_random_index_module 模块 以斜杠字符 （''） 结尾，并随机选择一个 文件作为索引文件。 默认情况下，此模块不是构建的。/

> --with-http_secure_link_module
> 启用构建 ngx_http_secure_link_module 模块。 默认情况下，此模块不是构建的。

> --with-http_degradation_module
> 启用构建模块。 默认情况下，此模块不是构建的。ngx_http_degradation_module

> --with-http_slice_module
> 允许构建将请求拆分为子请求的 ngx_http_slice_module 模块， 每个都返回一定范围的响应。 该模块提供了更有效的大响应缓存。 默认情况下，此模块不是构建的。

> --with-http_stub_status_module
> 允许构建提供对基本状态信息访问的 ngx_http_stub_status_module 模块。 默认情况下，此模块不是构建的。

> --without-http_charset_module
> 禁用 ngx_http_charset_module 构建将指定字符集添加到 “Content-Type” 响应标头字段 并且还可以将数据从一个字符集转换为另一个字符集。

> --without-http_gzip_module
> 禁用构建模块 ，它压缩 HTTP 服务器的响应。 构建和运行此模块需要 zlib 库。

> --without-http_ssi_module
> 禁用构建在响应中处理 SSI（服务器端包含）命令的 ngx_http_ssi_module 模块 穿过它。

> --without-http_userid_module
> 禁用构建 ngx_http_userid_module 模块，该模块设置适合客户端标识的 Cookie。

> --without-http_access_module
> 禁用构建允许限制对某些客户端地址的访问的 ngx_http_access_module 模块。

> --without-http_auth_basic_module
> 禁用构建 ngx_http_auth_basic_module 模块，该模块允许通过验证用户名来限制对资源的访问 和密码使用“HTTP 基本身份验证”协议。

> --without-http_mirror_module
> 禁用构建实现原始请求镜像的 ngx_http_mirror_module 模块 通过创建后台镜像子请求。

> --without-http_autoindex_module
> 禁用构建处理请求的 ngx_http_autoindex_module 模块 以斜杠字符 （''） 结尾，并生成 一个目录列表，以防 ngx_http_index_module 模块 找不到索引文件。/

> --without-http_geo_module
> 禁用构建创建变量的 ngx_http_geo_module 模块 的值取决于客户端 IP 地址。

> --without-http_map_module
> 禁用构建创建变量的 ngx_http_map_module 模块 的值取决于其他变量的值。

> --without-http_split_clients_module
> 禁用构建为 A/B 测试创建变量的 ngx_http_split_clients_module 模块。

> --without-http_referer_module
> 禁用构建 ngx_http_referer_module 模块，该模块可以阻止具有无效值的请求访问站点 在 “Referer” 标头字段中。

> --without-http_rewrite_module
> 禁用构建允许 HTTP 服务器重定向请求和更改 URI 的模块 的请求。 构建和运行此模块需要 PCRE 库。

> --without-http_proxy_module
> 禁用构建 HTTP 服务器代理模块。

> --without-http_fastcgi_module
> 禁用构建将请求传递到 FastCGI 服务器的 ngx_http_fastcgi_module 模块。

> --without-http_uwsgi_module
> 禁用构建将请求传递给 uwsgi 服务器的 ngx_http_uwsgi_module 模块。

> --without-http_scgi_module
> 禁用构建将请求传递到 SCGI 服务器的 ngx_http_scgi_module 模块。

> --without-http_grpc_module
> 禁用构建将请求传递到 gRPC 服务器的 ngx_http_grpc_module 模块。

> --without-http_memcached_module
> 禁用构建从 Memcached 服务器获取响应的 ngx_http_memcached_module 模块。

> --without-http_limit_conn_module
> 禁用构建限制每个 key 连接数的 ngx_http_limit_conn_module 模块，例如 来自单个 IP 地址的连接数。

> --without-http_limit_req_module
> 禁用构建限制每个键的请求处理速率的 ngx_http_limit_req_module 模块，例如 来自单个 IP 地址的请求的处理速率。

> --without-http_empty_gif_module
> 禁用构建发出单像素的模块 透明 GIF。

> --without-http_browser_module
> 禁用构建 ngx_http_browser_module 模块，该模块创建其值取决于 “User-Agent” 请求标头字段。

> --without-http_upstream_hash_module
> 禁用构建实现哈希负载均衡方法的模块。

> --without-http_upstream_ip_hash_module
> 禁用构建实现 ip_hash Load Balancing 方法的模块。

> --without-http_upstream_least_conn_module
> 禁用构建实现 least_conn Load Balancing 方法的模块。

> --without-http_upstream_random_module
> 禁用构建实现 Random Load Balancing 方法的模块。

> --without-http_upstream_keepalive_module
> 禁用构建提供缓存的模块 与上游服务器的连接。

> --without-http_upstream_zone_module
> 禁用构建可以存储运行时状态的模块 共享内存区中的上游组。

> --with-http_perl_module

> --with-http_perl_module=dynamic
> 启用构建嵌入式 Perl 模块。 默认情况下，此模块不是构建的。

> --with-perl_modules_path=path
> 定义一个将保存 Perl 模块的目录。

> --with-perl=path
> 设置 Perl 二进制文件的名称。

> --http-log-path=path
> 设置 HTTP 服务器的主请求日志文件的名称。 安装后，始终可以使用 access_log 指令在配置文件中更改文件名。 默认情况下，文件名为 .nginx.confprefix/logs/access.log

> --http-client-body-temp-path=path
> 定义用于存储临时文件的目录 保存 Client 端请求正文。 安装后，始终可以使用 client_body_temp_path 指令在配置文件中更改目录。 默认情况下，目录名为 。nginx.confprefix/client_body_temp

> --http-proxy-temp-path=path
> 定义用于存储临时文件的目录 以及从代理服务器接收的数据。 安装后，始终可以使用 proxy_temp_path 指令在配置文件中更改目录。 默认情况下，目录名为 。nginx.confprefix/proxy_temp

> --http-fastcgi-temp-path=path
> 定义用于存储临时文件的目录 使用从 FastCGI 服务器接收的数据。 安装后，始终可以使用 fastcgi_temp_path 指令在配置文件中更改目录。 默认情况下，目录名为 。nginx.confprefix/fastcgi_temp

> --http-uwsgi-temp-path=path
> 定义用于存储临时文件的目录 使用从 uWSGI 服务器接收的数据。 安装后，始终可以使用 uwsgi_temp_path 指令在配置文件中更改目录。 默认情况下，目录名为 。nginx.confprefix/uwsgi_temp

> --http-scgi-temp-path=path
> 定义用于存储临时文件的目录 使用从 SCGI 服务器接收的数据。 安装后，始终可以使用 scgi_temp_path 指令在配置文件中更改目录。 默认情况下，目录名为 。nginx.confprefix/scgi_temp

> --without-http
> 禁用 HTTP 服务器。

> --without-http-cache
> 禁用 HTTP 缓存。

> --with-mail

> --with-mail=dynamic
> 启用 POP3/IMAP4/SMTP 邮件代理服务器。

> --with-mail_ssl_module
> 允许构建一个模块，该模块将 SSL/TLS 协议支持添加到邮件代理服务器。 默认情况下，此模块不是构建的。 构建和运行此模块需要 OpenSSL 库。

> --without-mail_pop3_module
> 禁用 POP3 协议 在 Mail Proxy Server 中。

> --without-mail_imap_module
> 禁用 IMAP 协议 在 Mail Proxy Server 中。

> --without-mail_smtp_module
> 禁用 SMTP 协议 在 Mail Proxy Server 中。

> --with-stream

> --with-stream=dynamic
> 允许为通用 TCP/UDP 代理和负载平衡构建流模块。 默认情况下，此模块不是构建的。

> --with-stream_ssl_module
> 允许构建一个模块，该模块将 SSL/TLS 协议支持添加到 stream 模块中。 默认情况下，此模块不是构建的。 构建和运行此模块需要 OpenSSL 库。

> --with-stream_realip_module
> 启用构建将 Client 端地址更改为 Address 的 ngx_stream_realip_module 模块 在 PROXY 协议标头中发送。 默认情况下，此模块不是构建的。

> --with-stream_geoip_module

> --with-stream_geoip_module=dynamic
> 启用构建 ngx_stream_geoip_module 模块，该模块根据客户端 IP 地址创建变量 以及预编译的 MaxMind 数据库。 默认情况下，此模块不是构建的。

> --with-stream_ssl_preread_module
> 启用构建 ngx_stream_ssl_preread_module 模块，该模块允许从 ClientHello 消息中提取信息，而不终止 SSL/TLS。 默认情况下，此模块不是构建的。

> --without-stream_limit_conn_module
> 禁用构建限制每个 key 连接数的 ngx_stream_limit_conn_module 模块，例如 来自单个 IP 地址的连接数。

> --without-stream_access_module
> 禁用构建允许限制对某些 Client 端地址的访问的 ngx_stream_access_module 模块。

> --without-stream_geo_module
> 禁用构建创建变量的 ngx_stream_geo_module 模块 的值取决于客户端 IP 地址。

> --without-stream_map_module
> 禁用构建创建变量的 ngx_stream_map_module 模块 的值取决于其他变量的值。

> --without-stream_split_clients_module
> 禁用构建为 A/B 测试创建变量的 ngx_stream_split_clients_module 模块。

> --without-stream_return_module
> 禁用构建向客户端发送某个指定值的 ngx_stream_return_module 模块 ，然后关闭连接。

> --without-stream_set_module
> 禁用构建为变量设置值的 ngx_stream_set_module 模块。

> --without-stream_upstream_hash_module
> 禁用构建实现哈希负载均衡方法的模块。

> --without-stream_upstream_least_conn_module
> 禁用构建实现 least_conn Load Balancing 方法的模块。

> --without-stream_upstream_random_module
> 禁用构建实现 Random Load Balancing 方法的模块。

> --without-stream_upstream_zone_module
> 禁用构建可以存储运行时状态的模块 共享内存区中的上游组。

> --with-google_perftools_module
> 启用构建 ngx_google_perftools_module 模块，该模块支持使用 Google Performance Tools 分析 nginx 工作进程。 该模块面向 nginx 开发人员，默认情况下不是构建的。

> --with-cpp_test_module
> 启用构建模块。ngx_cpp_test_module

> --add-module=path
> 启用外部模块。

> --add-dynamic-module=path
> 启用外部动态模块。

> --with-compat
> 启用动态模块兼容性。

> --with-cc=path
> 设置 C 编译器的名称。

> --with-cpp=path
> 设置 C 预处理器的名称。

> --with-cc-opt=parameters
> 设置将添加到 CFLAGS 变量的其他参数。 在 FreeBSD 下使用系统 PCRE 库时， 应指定。 如果 支持的文件数量需要 增加它也可以在此处指定，例如： .--with-cc-opt="-I /usr/local/include"select()--with-cc-opt="-D FD_SETSIZE=2048"

> --with-ld-opt=parameters
> 设置将在链接期间使用的其他参数。 在 FreeBSD 下使用系统 PCRE 库时， 应指定。--with-ld-opt="-L /usr/local/lib"

> --with-cpu-opt=cpu
> 允许按指定的 CPU 进行构建：、、、 .pentiumpentiumpropentium3pentium4athlonopteronsparc32sparc64ppc64

> --without-pcre
> 禁用 PCRE 库。

> --with-pcre
> 强制使用 PCRE 库。

> --with-pcre=path
> 设置 PCRE 库源的路径。 需要从 PCRE 站点下载库分发并提取。 其余的由 nginx 和 完成。 location 指令中的正则表达式支持需要该库 以及 ngx_http_rewrite_module 模块。./configuremake

> --with-pcre-opt=parameters
> 为 PCRE 设置其他构建选项。

> --with-pcre-jit
> 构建 PCRE 库 “just-in-time compilation” 支持（1.1.12，pcre_jit 指令）。

> --without-pcre2
> 禁用 PCRE2 文库 而不是原始的 PCRE 库 （1.21.5）。

> --with-zlib=path
> 设置 zlib 库源代码的路径。 需要从 zlib 站点下载库分发并提取。 其余的由 nginx 和 完成。 该库是 ngx_http_gzip_module 模块所必需的。./configuremake

> --with-zlib-opt=parameters
> 为 zlib 设置其他构建选项。

> --with-zlib-asm=cpu
> 启用优化的 zlib 汇编器源 对于其中一个指定的 CPU：、 、 。pentiumpentiumpro

> --with-libatomic
> 强制使用 libatomic_ops 库。

> --with-libatomic=path
> 设置 libatomic_ops 库源的路径。

> --with-openssl=path
> 设置 OpenSSL 库源的路径。

> --with-openssl-opt=parameters
> 为 OpenSSL 设置其他构建选项。

> --with-debug
> 启用调试日志。

### 编译并安装

```bash
make && make install
```

## 启动 Nginx

```bash
/usr/local/nginx/sbin/nginx
```

## 配置 Nginx 为系统服务

---

### 创建配置文件

在 /etc/systemd/system/ 目录下创建一个新的服务文件 Nginx.service

```bash
# /etc/systemd/system/Nginx.service

[Unit]
Description=Nginx HTTP Server
After=network.target

[Service]
Type=forking
ExecStart=/usr/local/nginx/sbin/nginx
ExecReload=/usr/local/nginx/sbin/nginx -s reload
ExecStop=/usr/local/nginx/sbin/nginx -s stop
PrivateTmp=true

[Install]
WantedBy=multi-user.target

```

```bash
# 我的WSL中的配置

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

### 重新加载配置

```bash
systemctl daemon-reload
```

### 启动 Nginx 服务

```bash
# 关闭nginx
/usr/local/nginx/sbin/nginx -s stop

# 启动服务

systemctl start Nginx
```

### 设置为开机启动服务

```bash
systemctl enable nginx
```
### WSL 80 端口启动

使用 setcap 命令让指定程序拥有绑定端口的能力，这样即使程序运行在普通用户下，也能够绑定到 1024 以下的特权端口上。

```bash
# 在 Linux 系统下，只允许 Root 用户运行的程序才可以使用特权端口 ( 1024 以下的端口 )。
sudo setcap cap_net_bind_service=+eip /home/crazy/nginx/sbin/nginx
```

如果程序不再需要使用这个能力，你可以使用以下命令来清除。

```bash
sudo setcap -r /home/crazy/nginx/sbin/nginx
```