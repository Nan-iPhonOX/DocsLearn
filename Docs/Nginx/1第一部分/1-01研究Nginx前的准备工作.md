---
outline: [2, 3]
---

# 第 1 章 研究 Nginx 前的准备工作

2012 年，Nginx 荣获年度云计算开发奖（2012 Cloud Award for Developer of the Year），并成长为世界第二大 Web 服务器。全世界流量最高的前 1000 名网站中，超过 25% 都使用 Nginx 来处理海量的互联网请求。Nginx 已经成为业界高性能 Web 服务器的代名词。

那么，什么是 Nginx？它有哪些特点？我们选择 Nginx 的理由是什么？如何编译安装 Nginx？这种安装方式背后隐藏的又是什么样的思想呢？本章将会回答上述问题。

## 1.1 Nginx 是什么

人们在了解新事物时，往往习惯通过类比来帮助自己理解事物的概貌。那么，我们在学习 Nginx 时也采用同样的方式，先来看看 Nginx 的竞争对手——Apache、Lighttpd、Tomcat、Jetty、IIS，它们都是 Web 服务器，或者叫做 WWW（World Wide Web）服务器，相应地也都具备 Web 服务器的基本功能：基于 REST 架构风格，以统一资源描述符（Uniform Resource Identifier，URI）或者统一资源定位符（Uniform Resource Locator，URL）作为沟通依据，通过 HTTP 为浏览器等客户端程序提供各种网络服务。然而，由于这些 Web 服务器在设计阶段就受到许多局限，例如当时的互联网用户规模、网络带宽、产品特点等局限，并且各自的定位与发展方向都不尽相同，使得每一款 Web 服务器的特点与应用场合都很鲜明。

Tomcat 和 Jetty 面向 Java 语言，先天就是重量级的 Web 服务器，它的性能与 Nginx 没有可比性，这里略过。

IIS 只能在 Windows 操作系统上运行。Windows 作为服务器在稳定性与其他一些性能上都不如类 UNIX 操作系统，因此，在需要高性能 Web 服务器的场合下，IIS 可能会被“冷落”。

Apache 的发展时期很长，而且是目前毫无争议的世界第一大 Web 服务器，图 1-1 中是 12 年来（2010~2012 年）世界 Web 服务器的使用排名情况。

图 1-1 Netcraft 对于 644275754 个站点 31.4M 个域名 Web 服务器使用情况的调查结果（2012 年 3 月）

从图 1-1 中可以看出，Apache 目前处于领先地位。

Apache 有许多优点，如稳定、开源、跨平台等，但它出现的时间太长了，在它兴起的年代，互联网的产业规模远远比不上今天，所以它被设计成了一个重量级的、不支持高并发的 Web 服务器。在 Apache 服务器上，如果有数以万计的并发 HTTP 请求同时访问，就会导致服务器上消耗大量内存，操作系统内核对成百上千的 Apache 进程做进程间切换也会消耗大量 CPU 资源，并导致 HTTP 请求的平均响应速度降低，这些都决定了 Apache 不可能成为高性能 Web 服务器，这也促使了 Lighttpd 和 Nginx 的出现。观察图 1-1 中 Nginx 成长的曲线，体会一下 Nginx 抢占市场时的“咄咄逼人”吧。

Lighttpd 和 Nginx 一样，都是轻量级、高性能的 Web 服务器，欧美的业界开发者比较钟爱 Lighttpd，而国内的公司更青睐 Nginx，Lighttpd 使用得比较少。

在了解了 Nginx 的竞争对手之后，相信大家对 Nginx 也有了直观感受，下面让我们来正式地认识一下 Nginx 吧。

提示 Nginx 发音：engine。

来自俄罗斯的 Igor Sysoev 在为 Rambler Media（www.rambler.ru/）工作期间，使用 C 语言开发了 Nginx。Nginx 作为 Web 服务器，一直为俄罗斯著名的门户网站 Rambler Media 提供着出色、稳定的服务。

Igor Sysoev 将 Nginx 的代码开源，并且赋予其最自由的 2-clause BSD-like license 许可证。由于 Nginx 使用基于事件驱动的架构能够并发处理百万级别的 TCP 连接，高度模块化的设计和自由的许可证使得扩展 Nginx 功能的第三方模块层出不穷，而且优秀的设计带来了极佳的稳定性，因此其作为 Web 服务器被广泛应用到大流量的网站上，包括腾讯、新浪、网易、淘宝等访问量巨大的网站。

2012 年 2 月和 3 月 Netcraft 对 Web 服务器的调查如表 1-1 所示，可以看出，Nginx 的市场份额越来越大。

表 1-1 Netcraft 对于 Web 服务器市场占有率前 4 位软件的调查（2012 年 2 月和 3 月）

Nginx 是一个跨平台的 Web 服务器，可运行在 Linux、FreeBSD、Solaris、AIX、Mac OS、Windows 等操作系统上，并且它还可以使用当前操作系统特有的一些高效 API 来提高自己的性能。

例如，对于高效处理大规模并发连接，它支持 Linux 上的 epoll（epoll 是 Linux 上处理大并发网络连接的利器，9.6.1 节中将会详细说明 epoll 的工作原理）、Solaris 上的 event ports 和 FreeBSD 上的 kqueue 等。

又如，对于 Linux，Nginx 支持其独有的 sendfile 系统调用，这个系统调用可以高效地把硬盘中的数据发送到网络上（不需要先把硬盘数据复制到用户态内存上再发送），这极大地减少了内核态与用户态数据间的复制动作。

种种迹象都表明，Nginx 以性能为王。

2011 年 7 月，Nginx 正式成立公司，由 Igor Sysoev 担任 CTO，立足于提供商业级的 Web 服务器。

## 1.2 为什么选择 Nginx

为什么选择 Nginx？因为它具有以下特点：

1. **更快**

   这表现在两个方面：一方面，在正常情况下，单次请求会得到更快的响应；另一方面，在高峰期（如有数以万计的并发请求），Nginx 可以比其他 Web 服务器更快地响应请求。

   实际上，本书第三部分中大量的篇幅都是在说明 Nginx 是如何做到这两点的。

2. **高扩展性**

   Nginx 的设计极具扩展性，它完全是由多个不同功能、不同层次、不同类型且耦合度极低的模块组成。因此，当对某一个模块修复 Bug 或进行升级时，可以专注于模块自身，无须在意其他。而且在 HTTP 模块中，还设计了 HTTP 过滤器模块：一个正常的 HTTP 模块在处理完请求后，会有一串 HTTP 过滤器模块对请求的结果进行再处理。这样，当我们开发一个新的 HTTP 模块时，不但可以使用诸如 HTTP 核心模块、events 模块、log 模块等不同层次或者不同类型的模块，还可以原封不动地复用大量已有的 HTTP 过滤器模块。这种低耦合度的优秀设计，造就了 Nginx 庞大的第三方模块，当然，公开的第三方模块也如官方发布的模块一样容易使用。

   Nginx 的模块都是嵌入到二进制文件中执行的，无论官方发布的模块还是第三方模块都是如此。这使得第三方模块一样具备极其优秀的性能，充分利用 Nginx 的高并发特性，因此，许多高流量的网站都倾向于开发符合自己业务特性的定制模块。

3. **高可靠性**

   高可靠性是我们选择 Nginx 的最基本条件，因为 Nginx 的可靠性是大家有目共睹的，很多家高流量网站都在核心服务器上大规模使用 Nginx。Nginx 的高可靠性来自于其核心框架代码的优秀设计、模块设计的简单性；另外，官方提供的常用模块都非常稳定，每个 worker 进程相对独立，master 进程在 1 个 worker 进程出错时可以快速“拉起”新的 worker 子进程提供服务。

4. **低内存消耗**

   一般情况下，10000 个非活跃的 HTTP Keep-Alive 连接在 Nginx 中仅消耗 2.5MB 的内存，这是 Nginx 支持高并发连接的基础。

   从第 3 章开始，我们会接触到 Nginx 在内存中为了维护一个 HTTP 连接所分配的对象，届时将会看到，实际上 Nginx 一直在为用户考虑（尤其是在高并发时）如何使得内存的消耗更少。

5. **单机支持 10 万以上的并发连接**

   这是一个非常重要的特性！随着互联网的迅猛发展和互联网用户数量的成倍增长，各大公司、网站都需要应付海量并发请求，一个能够在峰值期顶住 10 万以上并发请求的 Server，无疑会得到大家的青睐。理论上，Nginx 支持的并发连接上限取决于内存，10 万远未封顶。

   当然，能够及时地处理更多的并发请求，是与业务特点紧密相关的，本书第 8~11 章将会详细说明如何实现这个特点。

6. **热部署**

   master 管理进程与 worker 工作进程的分离设计，使得 Nginx 能够提供热部署功能，即可以在 7×24 小时不间断服务的前提下，升级 Nginx 的可执行文件。当然，它也支持不停止服务就更新配置项、更换日志文件等功能。

7. **最自由的 BSD 许可协议**

   这是 Nginx 可以快速发展的强大动力。BSD 许可协议不只是允许用户免费使用 Nginx，它还允许用户在自己的项目中直接使用或修改 Nginx 源码，然后发布。这吸引了无数开发者继续为 Nginx 贡献自己的智慧。

以上 7 个特点当然不是 Nginx 的全部，拥有无数个官方功能模块、第三方功能模块使得 Nginx 能够满足绝大部分应用场景，这些功能模块间可以叠加以实现更加强大、复杂的功能，有些模块还支持 Nginx 与 Perl、Lua 等脚本语言集成工作，大大提高了开发效率。这些特点促使用户在寻找一个 Web 服务器时更多考虑 Nginx。

当然，选择 Nginx 的核心理由还是它能在支持高并发请求的同时保持高效的服务。

如果 Web 服务器的业务访问量巨大，就需要保证在数以百万计的请求同时访问服务时，用户可以获得良好的体验，不会出现并发访问量达到一个数字后，新的用户无法获取服务，或者虽然成功地建立起了 TCP 连接，但大部分请求却得不到响应的情况。

通常，高峰期服务器的访问量可能是正常情况下的许多倍，若有热点事件的发生，可能会导致正常情况下非常顺畅的服务器直接“挂死”。然而，如果在部署服务器时，就预先针对这种情况进行扩容，又会使得正常情况下所有服务器的负载过低，这会造成大量的资源浪费。因此，我们会希望在这之间取得平衡，也就是说，在低并发压力下，用户可以获得高速体验，而在高并发压力下，更多的用户都能接入，可能访问速度会下降，但这只应受制于带宽和处理器的速度，而不应该是服务器设计导致的软件瓶颈。

事实上，由于中国互联网用户群体的数量巨大，致使对 Web 服务器的设计往往要比欧美公司更加困难。例如，对于全球性的一些网站而言，欧美用户分布在两个半球，欧洲用户活跃时，美洲用户通常在休息，反之亦然。而国内巨大的用户群体则对业界的程序员提出更高的挑战，早上 9 点和晚上 20 点到 24 点这些时间段的并发请求压力是非常巨大的。尤其节假日、寒暑假到来之时，更会对服务器提出极高的要求。

另外，国内业务上的特性，也会引导用户在同一时间大并发地访问服务器。例如，许多 SNS 网页游戏会在固定的时间点刷新游戏资源或者允许“偷菜”等好友互动操作。这些会导致服务器处理高并发请求的压力增大。

上述情形都对我们的互联网服务在大并发压力下是否还能够给予用户良好的体验提出了更高的要求。若要提供更好的服务，那么可以从多方面入手，例如，修改业务特性、引导用户从高峰期分流或者把服务分层分级、对于不同并发压力给用户提供不同级别的服务等。但最根本的是，Web 服务器要能支持大并发压力下的正常服务，这才是关键。

快速增长的互联网用户群以及业内所有互联网服务提供商越来越好的用户体验，都促使我们在大流量服务中用 Nginx 取代其他 Web 服务器。Nginx 先天的事件驱动型设计、全异步的网络 I/O 处理机制、极少的进程间切换以及许多优化设计，都使得 Nginx 天生善于处理高并发压力下的互联网请求，同时 Nginx 降低了资源消耗，可以把服务器硬件资源“压榨”到极致。

## 1.3 准备工作

由于 Linux 具有免费、使用广泛、商业支持越来越完善等特点，本书将主要针对 Linux 上运行的 Nginx 来进行介绍。需要说明的是，本书不是使用手册，而是介绍 Nginx 作为 Web 服务器的设计思想，以及如何更有效地使用 Nginx 达成目的，而这些内容在各操作系统上基本是相通的（除了第 9 章关于事件驱动方式以及第 14 章的进程间同步方式在类 UNIX 操作系统上略有不同以外）。

### 1.3.1 Linux 操作系统

首先我们需要一个内核为 Linux 2.6 及以上版本的操作系统，因为 Linux 2.6 及以上内核才支持 epoll，而在 Linux 上使用 select 或 poll 来解决事件的多路复用，是无法解决高并发压力问题的。

我们可以使用 `uname -a` 命令来查询 Linux 内核版本，例如：

```bash
:wehf2wng001:root > uname -a
Linux wehf2wng001 2.6.18-128.el5 #1 SMP Wed Jan 21 10:41:14 EST 2009 x86_64 x86_64 x86_64 GNU/Linux
```

执行结果表明内核版本是 2.6.18，符合我们的要求。

### 1.3.2 使用 Nginx 的必备软件

如果要使用 Nginx 的常用功能，那么首先需要确保该操作系统上至少安装了如下软件。

1. **GCC 编译器**

   GCC（GNU Compiler Collection）可用来编译 C 语言程序。Nginx 不会直接提供二进制可执行程序（1.2.x 版本中已经开始提供某些操作系统上的二进制安装包了，不过，本书探讨如何开发 Nginx 模块是必须通过直接编译源代码进行的），这有许多原因，本章后面会详述。

   我们可以使用最简单的 yum 方式安装 GCC，例如：

   ```bash
   yum install -y gcc
   ```

   GCC 是必需的编译工具。在第 3 章会提到如何使用 C++ 来编写 Nginx HTTP 模块，这时就需要用到 G++ 编译器了。G++ 编译器也可以用 yum 安装，例如：

   ```bash
   yum install -y gcc-c++
   ```

   Linux 上有许多软件安装方式，yum 只是其中比较方便的一种，其他方式这里不再赘述。

2. **PCRE 库**

   PCRE（Perl Compatible Regular Expressions，Perl 兼容正则表达式）是由 Philip Hazel 开发的函数库，目前为很多软件所使用，该库支持正则表达式。它由 RegEx 演化而来，实际上，Perl 正则表达式也是源自于 Henry Spencer 写的 RegEx。

   如果我们在配置文件 nginx.conf 里使用了正则表达式，那么在编译 Nginx 时就必须把 PCRE 库编译进 Nginx，因为 Nginx 的 HTTP 模块要靠它来解析正则表达式。当然，如果你确认不会使用正则表达式，就不必安装它。其 yum 安装方式如下：

   ```bash
   yum install -y pcre pcre-devel
   ```

   pcre-devel 是使用 PCRE 做二次开发时所需要的开发库，包括头文件等，这也是编译 Nginx 所必须使用的。

3. **zlib 库**

   zlib 库用于对 HTTP 包的内容做 gzip 格式的压缩，如果我们在 nginx.conf 里配置了 `gzip on`，并指定对于某些类型（content-type）的 HTTP 响应使用 gzip 来进行压缩以减少网络传输量，那么，在编译时就必须把 zlib 编译进 Nginx。其 yum 安装方式如下：

   ```bash
   yum install -y zlib zlib-devel
   ```

   同理，zlib 是直接使用的库，zlib-devel 是二次开发所需要的库。

4. **OpenSSL 开发库**

   如果我们的服务器不只是要支持 HTTP，还需要在更安全的 SSL 协议上传输 HTTP，那么就需要拥有 OpenSSL 了。另外，如果我们想使用 MD5、SHA1 等散列函数，那么也需要安装它。其 yum 安装方式如下：

   ```bash
   yum install -y openssl openssl-devel
   ```

上面所列的 4 个库只是完成 Web 服务器最基本功能所必需的。

Nginx 是高度自由化的 Web 服务器，它的功能是由许多模块来支持的。而这些模块可根据我们的使用需求来定制，如果某些模块不需要使用则完全不必理会它。同样，如果使用了某个模块，而这个模块使用了一些类似 zlib 或 OpenSSL 等的第三方库，那么就必须先安装这些软件。

### 1.3.3 磁盘目录

要使用 Nginx，还需要在 Linux 文件系统上准备以下目录。

1. **Nginx 源代码存放目录**

   该目录用于放置从官网上下载的 Nginx 源码文件，以及第三方或我们自己所写的模块源代码文件。

2. **Nginx 编译阶段产生的中间文件存放目录**

   该目录用于放置在 configure 命令执行后所生成的源文件及目录，以及 make 命令执行后生成的目标文件和最终连接成功的二进制文件。默认情况下，configure 命令会将该目录命名为 objs，并放在 Nginx 源代码目录下。

3. **部署目录**

   该目录存放实际 Nginx 服务运行期间所需要的二进制文件、配置文件等。默认情况下，该目录为 /usr/local/nginx。

4. **日志文件存放目录**

   日志文件通常会比较大，当研究 Nginx 的底层架构时，需要打开 debug 级别的日志，这个级别的日志非常详细，会导致日志文件的大小增长得极快，需要预先分配一个拥有更大磁盘空间的目录。

### 1.3.4 Linux 内核参数的优化

由于默认的 Linux 内核参数考虑的是最通用的场景，这明显不符合用于支持高并发访问的 Web 服务器的定义，所以需要修改 Linux 内核参数，使得 Nginx 可以拥有更高的性能。

在优化内核时，可以做的事情很多，不过，我们通常会根据业务特点来进行调整，当 Nginx 作为静态 Web 内容服务器、反向代理服务器或是提供图片缩略图功能（实时压缩图片）的服务器时，其内核参数的调整都是不同的。这里只针对最通用的、使 Nginx 支持更多并发请求的 TCP 网络参数做简单说明。

首先，需要修改 /etc/sysctl.conf 来更改内核参数。例如，最常用的配置：

```bash
fs.file-max = 999999
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_max_tw_buckets = 5000
net.ipv4.ip_local_port_range = 1024 61000
net.ipv4.tcp_rmem = 4096 32768 262142
net.ipv4.tcp_wmem = 4096 32768 262142
net.core.netdev_max_backlog = 8096
net.core.rmem_default = 262144
net.core.wmem_default = 262144
net.core.rmem_max = 2097152
net.core.wmem_max = 2097152
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 1024
```

然后执行 `sysctl -p` 命令，使上述修改生效。

上面的参数意义解释如下：

- **file-max**：这个参数表示进程（比如一个 worker 进程）可以同时打开的最大句柄数，这个参数直接限制最大并发连接数，需根据实际情况配置。

- **tcp_tw_reuse**：这个参数设置为 1，表示允许将 TIME-WAIT 状态的 socket 重新用于新的 TCP 连接，这对于服务器来说很有意义，因为服务器上总会有大量 TIME-WAIT 状态的连接。

- **tcp_keepalive_time**：这个参数表示当 keepalive 启用时，TCP 发送 keepalive 消息的频度。默认是 2 小时，若将其设置得小一些，可以更快地清理无效的连接。

- **tcp_fin_timeout**：这个参数表示当服务器主动关闭连接时，socket 保持在 FIN-WAIT-2 状态的最大时间。

- **tcp_max_tw_buckets**：这个参数表示操作系统允许 TIME_WAIT 套接字数量的最大值，如果超过这个数字，TIME_WAIT 套接字将立刻被清除并打印警告信息。该参数默认为 180000，过多的 TIME_WAIT 套接字会使 Web 服务器变慢。

- **tcp_max_syn_backlog**：这个参数表示 TCP 三次握手建立阶段接收 SYN 请求队列的最大长度，默认为 1024，将其设置得大一些可以使出现 Nginx 繁忙来不及 accept 新连接的情况时，Linux 不至于丢失客户端发起的连接请求。

- **ip_local_port_range**：这个参数定义了在 UDP 和 TCP 连接中本地（不包括连接的远端）端口的取值范围。

- **net.ipv4.tcp_rmem**：这个参数定义了 TCP 接收缓存（用于 TCP 接收滑动窗口）的最小值、默认值、最大值。

- **net.ipv4.tcp_wmem**：这个参数定义了 TCP 发送缓存（用于 TCP 发送滑动窗口）的最小值、默认值、最大值。

- **netdev_max_backlog**：当网卡接收数据包的速度大于内核处理的速度时，会有一个队列保存这些数据包。这个参数表示该队列的最大值。

- **rmem_default**：这个参数表示内核套接字接收缓存区默认的大小。

- **wmem_default**：这个参数表示内核套接字发送缓存区默认的大小。

- **rmem_max**：这个参数表示内核套接字接收缓存区的最大大小。

- **wmem_max**：这个参数表示内核套接字发送缓存区的最大大小。

注意滑动窗口的大小与套接字缓存区会在一定程度上影响并发连接的数目。每个 TCP 连接都会为维护 TCP 滑动窗口而消耗内存，这个窗口会根据服务器的处理速度收缩或扩张。

参数 wmem_max 的设置，需要平衡物理内存的总大小、Nginx 并发处理的最大连接数量（由 nginx.conf 中的 worker_processes 和 worker_connections 参数决定）而确定。当然，如果仅仅为了提高并发量使服务器不出现 Out Of Memory 问题而去降低滑动窗口大小，那么并不合适，因为滑动窗口过小会影响大数据量的传输速度。rmem_default、wmem_default、rmem_max、wmem_max 这 4 个参数的设置需要根据我们的业务特性以及实际的硬件成本来综合考虑。

- **tcp_syncookies**：该参数与性能无关，用于解决 TCP 的 SYN 攻击。

### 1.3.5 获取 Nginx 源码

可以在 Nginx 官方网站（nginx.org/en/download.html）获取 Nginx 源码包。将下载的 nginx-1.0.14.tar.gz 源码压缩包放置到准备好的 Nginx 源代码目录中，然后解压。例如：

```bash
tar -zxvf nginx-1.0.14.tar.gz
```

本书编写时的 Nginx 最新稳定版本为 1.0.14（如图 1-2 所示），本书后续部分都将以此版本作为基准。当然，本书将要说明的 Nginx 核心代码一般不会有改动（否则大量第三方模块的功能就无法保证了），即使下载其他版本的 Nginx 源码包也不会影响阅读本书。

图 1-2 Nginx 的不同版本

## 1.4 编译安装 Nginx

安装 Nginx 最简单的方式是，进入 nginx-1.0.14 目录后执行以下 3 行命令：

```bash
./configure
make
make install
```

configure 命令做了大量的“幕后”工作，包括检测操作系统内核和已经安装的软件，参数的解析，中间目录的生成以及根据各种参数生成一些 C 源码文件、Makefile 文件等。

make 命令根据 configure 命令生成的 Makefile 文件编译 Nginx 工程，并生成目标文件、最终的二进制文件。

make install 命令根据 configure 执行时的参数将 Nginx 部署到指定的安装目录，包括相关目录的建立和二进制文件、配置文件的复制。

## 1.5 configure 详解

可以看出，configure 命令至关重要，下文将详细介绍如何使用 configure 命令，并分析 configure 到底是如何工作的，从中我们也可以看出 Nginx 的一些设计思想。

### 1.5.1 configure 的命令参数

使用 help 命令可以查看 configure 包含的参数。

```bash
./configure --help
```

这里不一一列出 help 的结果，只是把它的参数分为了四大类型，下面将会详述各类型下所有参数的用法和意义。

1. **路径相关的参数**

   表 1-2 列出了 Nginx 在编译期、运行期中与路径相关的各种参数。

   表 1-2 configure 支持的路径相关参数

2. **编译相关的参数**

   表 1-3 列出了编译 Nginx 时与编译器相关的参数。

   表 1-3 configure 支持的编译相关参数

3. **依赖软件的相关参数**

   表 1-4~表 1-8 列出了 Nginx 依赖的常用软件支持的参数。

   表 1-4 PCRE 的设置参数

   表 1-5 OpenSSL 的设置参数

   表 1-6 原子库的设置参数

   表 1-7 散列函数库的设置参数

   表 1-8 zlib 库的设置参数

4. **模块相关的参数**

   除了少量核心代码外，Nginx 完全是由各种功能模块组成的。这些模块会根据配置参数决定自己的行为，因此，正确地使用各个模块非常关键。在 configure 的参数中，我们把它们分为五大类。

   ![modules](/SVGs/NGX_MODULE.svg)
   
   - 事件模块。

   - 默认即编译进入 Nginx 的 HTTP 模块。

   - 默认不会编译进入 Nginx 的 HTTP 模块。

   - 邮件代理服务器相关的 mail 模块。

   - 其他模块。

   1. **事件模块**

      表 1-9 中列出了 Nginx 可以选择哪些事件模块编译到产品中。

      表 1-9 configure 支持的事件模块参数

   2. **默认即编译进入 Nginx 的 HTTP 模块**

      表 1-10 列出了默认就会编译进 Nginx 的核心 HTTP 模块，以及如何把这些 HTTP 模块从产品中去除。

      表 1-10 configure 中默认编译到 Nginx 中的 HTTP 模块参数

   3. **默认不会编译进入 Nginx 的 HTTP 模块**

      表 1-11 列出了默认不会编译至 Nginx 中的 HTTP 模块以及把它们加入产品中的方法。

      表 1-11 configure 中默认不会编译到 Nginx 中的 HTTP 模块参数

   4. **邮件代理服务器相关的 mail 模块**

      表 1-12 列出了把邮件模块编译到产品中的参数。

      表 1-12 configure 提供的邮件模块参数

5. **其他参数**

   configure 还接收一些其他参数，表 1-13 中列出了相关参数的说明。

   表 1-13 configure 提供的其他参数

### 1.5.2 configure 执行流程

我们看到 configure 命令支持非常多的参数，读者可能会好奇它在执行时到底做了哪些事情，本节将通过解析 configure 源码来对它有一个感性的认识。configure 由 Shell 脚本编写，中间会调用 `<nginx-source>/auto/` 目录下的脚本。这里将只对 configure 脚本本身做分析，对于它所调用的 auto 目录下的其他工具脚本则只做功能性的说明。

configure 脚本的内容如下：

```bash
!/bin/sh

 Copyright (C) Igor Sysoev
 Copyright (C) Nginx, Inc.

 auto/options 脚本处理 configure 命令的参数。例如，如果参数是 --help，那么显示支持的所有参数格式。
 options 脚本会定义后续工作将要用到的变量，然后根据本次参数以及默认值设置这些变量
. auto/options

 auto/init 脚本初始化后续将产生的文件路径。例如，Makefile、ngx*modules.c 等文件默认情况下将会在 <nginx-source>/objs/
. auto/init

 auto/sources 脚本将分析 Nginx 的源码结构，这样才能构造后续的 Makefile 文件
. auto/sources

 编译过程中所有目标文件生成的路径由 --builddir=DIR 参数指定，默认情况下为 <nginx-source>/objs，此时这个目录将会被创建
test -d $NGX_OBJS || mkdir $NGX_OBJS

 开始准备建立 ngx_auto_headers.h、autoconf.err 等必要的编译文件
echo > $NGX_AUTO_HEADERS_H
echo > $NGX_AUTOCONF_ERR

 向 objs/ngx_auto_config.h 写入命令行带的参数
echo "#define NGX_CONFIGURE \"$NGX_CONFIGURE\"" > $NGX_AUTO_CONFIG_H

 判断 DEBUG 标志，如果有，那么在 objs/ngx_auto_config.h 文件中写入 DEBUG 宏
if [ $NGX_DEBUG = YES ]; then
    have=NGX_DEBUG . auto/have
fi

 现在开始检查操作系统参数是否支持后续编译
if test -z "$NGX_PLATFORM"; then
    echo "checking for OS"
    NGX_SYSTEM=`uname -s 2>/dev/null`
    NGX_RELEASE=`uname -r 2>/dev/null`
    NGX_MACHINE=`uname -m 2>/dev/null`
    # 屏幕上输出 OS 名称、内核版本、32 位/64 位内核
    echo " + $NGX_SYSTEM $NGX_RELEASE $NGX_MACHINE"
    NGX_PLATFORM="$NGX_SYSTEM:$NGX_RELEASE:$NGX_MACHINE";
    case "$NGX_SYSTEM" in
        MINGW32*)
            NGX_PLATFORM=win32
            ;;
    esac
else
    echo "building for $NGX_PLATFORM"
    NGX_SYSTEM=$NGX_PLATFORM
fi

 检查并设置编译器，如 GCC 是否安装、GCC 版本是否支持后续编译 nginx
. auto/cc/conf

 对非 Windows 操作系统定义一些必要的头文件，并检查其是否存在，以此决定 configure 后续步骤是否可以成功
if [ "$NGX_PLATFORM" != win32 ]; then
    . auto/headers
fi

 对于当前操作系统，定义一些特定的操作系统相关的方法并检查当前环境是否支持。例如，对于 Linux，在这里使用 sched_setaffinity 设置进程优先级，使用 Linux 特有的 sendfile 系统调用来加速向网络中发送文件块
. auto/os/conf

 定义类 UNIX 操作系统中通用的头文件和系统调用等，并检查当前环境是否支持
if [ "$NGX_PLATFORM" != win32 ]; then
    . auto/unix
fi

 最核心的构造运行期 modules 的脚本。它将会生成 ngx_modules.c 文件，这个文件会被编译进 Nginx 中，其中它所做的唯一的事情就是定义了 ngx_modules 数组。
 ngx_modules 指明 Nginx 运行期间有哪些模块会参与到请求的处理中，包括 HTTP 请求可能会使用哪些模块处理，因此，它对数组元素的顺序非常敏感，也就是说，绝大部分模块在 ngx_modules 数组中的顺序其实是固定的。例如，一个请求必须先执行 ngx_http_gzip_filter_module 模块重新修改 HTTP 响应中的头部后，才能使用 ngx_http_header_filter_module 模块按照 headers_in 结构体里的成员构造出以 TCP 流形式发送给客户端的 HTTP 响应头部。注意，我们在 --add-module= 参数里加入的第三方模块也在此步骤写入到 ngx_modules.c 文件中了
. auto/modules

 conf 脚本用来检查 Nginx 在链接期间需要链接的第三方静态库、动态库或者目标文件是否存在
. auto/lib/conf

 处理 Nginx 安装后的路径
case ".$NGX_PREFIX" in
    .)
        NGX_PREFIX=${NGX_PREFIX:-/usr/local/nginx}
        have=NGX_PREFIX value="\"$NGX_PREFIX/\"" . auto/define
        ;;
    .!)
        NGX_PREFIX=
        ;;
    *)
        have=NGX_PREFIX value="\"$NGX_PREFIX/\"" . auto/define
        ;;
esac

 处理 Nginx 安装后 conf 文件的路径
if [ ".$NGX_CONF_PREFIX" != "." ]; then
    have=NGX_CONF_PREFIX value="\"$NGX_CONF_PREFIX/\"" . auto/define
fi

 处理 Nginx 安装后，二进制文件、pid、lock 等其他文件的路径可参见 configure 参数中路径类选项的说明
have=NGX_SBIN_PATH value="\"$NGX_SBIN_PATH\"" . auto/define
have=NGX_CONF_PATH value="\"$NGX_CONF_PATH\"" . auto/define
have=NGX_PID_PATH value="\"$NGX_PID_PATH\"" . auto/define
have=NGX_LOCK_PATH value="\"$NGX_LOCK_PATH\"" . auto/define
have=NGX_ERROR_LOG_PATH value="\"$NGX_ERROR_LOG_PATH\"" . auto/define
have=NGX_HTTP_LOG_PATH value="\"$NGX_HTTP_LOG_PATH\"" . auto/define
have=NGX_HTTP_CLIENT_TEMP_PATH value="\"$NGX_HTTP_CLIENT_TEMP_PATH\"" . auto/define
have=NGX_HTTP_PROXY_TEMP_PATH value="\"$NGX_HTTP_PROXY_TEMP_PATH\"" . auto/define
have=NGX_HTTP_FASTCGI_TEMP_PATH value="\"$NGX_HTTP_FASTCGI_TEMP_PATH\"" . auto/define
have=NGX_HTTP_UWSGI_TEMP_PATH value="\"$NGX_HTTP_UWSGI_TEMP_PATH\"" . auto/define
have=NGX_HTTP_SCGI_TEMP_PATH value="\"$NGX_HTTP_SCGI_TEMP_PATH\"" . auto/define

 创建编译时使用的 objs/Makefile 文件
. auto/make

 为 objs/Makefile 加入需要连接的第三方静态库、动态库或者目标文件
. auto/lib/make

 为 objs/Makefile 加入 install 功能，当执行 make install 时将编译生成的必要文件复制到安装路径，建立必要的目录
. auto/install

 在 ngx_auto_config.h 文件中加入 NGX_SUPPRESS_WARN 宏、NGX_SMP 宏
. auto/stubs

 在 ngx_auto_config.h 文件中指定 NGX_USER 和 NGX_GROUP 宏，如果执行 configure 时没有参数指定，默认两者皆为 nobody（也就是默认以 nobody 用户运行进程）
have=NGX_USER value="\"$NGX_USER\"" . auto/define
have=NGX_GROUP value="\"$NGX_GROUP\"" . auto/define

 显示 configure 执行的结果，如果失败，则给出原因
. auto/summary
```

（注：在 configure 脚本里检查某个特性是否存在时，会生成一个最简单的只包含 main 函数的 C 程序，该程序会包含相应的头文件。然后，通过检查是否可以编译通过来确认特性是否支持，并将结果记录在 objs/autoconf.err 文件中。后续检查头文件、检查特性的脚本都用了类似的方法。）

### 1.5.3 configure 生成的文件

当 configure 执行成功时会生成 objs 目录，并在该目录下产生以下目录和文件：

```bash
|---ngx_auto_headers.h
|---autoconf.err
|---ngx_auto_config.h
|---ngx_modules.c
|---src
|   |---core
|   |---event
|   |   |---modules
|   |---os
|   |   |---unix
|   |   |---win32
|   |---http
|   |   |---modules
|   |   |   |---perl
|   |---mail
|   |---misc
|---Makefile
```

上述目录和文件介绍如下。

1. **src 目录**：用于存放编译时产生的目标文件。

2. **Makefile 文件**：用于编译 Nginx 工程以及在加入 install 参数后安装 Nginx。

3. **autoconf.err**：保存 configure 执行过程中产生的结果。

4. **ngx_auto_headers.h 和 ngx_auto_config.h**：保存了一些宏，这两个头文件会被 src/core/ngx_config.h 及 src/os/unix/ngx_linux_config.h 文件（可将“linux”替换为其他 UNIX 操作系统）引用。

5. **ngx_modules.c**：是一个关键文件，我们需要看看它的内部结构。一个默认配置下生成的 ngx_modules.c 文件内容如下：

   ```c
   #include <ngx_config.h>
   #include <ngx_core.h>
   ngx_module_t *ngx_modules[] = {
       &ngx_core_module,
       &ngx_errlog_module,
       &ngx_conf_module,
       &ngx_events_module,
       &ngx_event_core_module,
       &ngx_epoll_module,
       &ngx_http_module,
       &ngx_http_core_module,
       &ngx_http_log_module,
       &ngx_http_upstream_module,
       &ngx_http_static_module,
       &ngx_http_autoindex_module,
       &ngx_http_index_module,
       &ngx_http_auth_basic_module,
       &ngx_http_access_module,
       &ngx_http_limit_zone_module,
       &ngx_http_limit_req_module,
       &ngx_http_geo_module,
       &ngx_http_map_module,
       &ngx_http_split_clients_module,
       &ngx_http_referer_module,
       &ngx_http_rewrite_module,
       &ngx_http_proxy_module,
       &ngx_http_fastcgi_module,
       &ngx_http_uwsgi_module,
       &ngx_http_scgi_module,
       &ngx_http_memcached_module,
       &ngx_http_empty_gif_module,
       &ngx_http_browser_module,
       &ngx_http_upstream_ip_hash_module,
       &ngx_http_write_filter_module,
       &ngx_http_header_filter_module,
       &ngx_http_chunked_filter_module,
       &ngx_http_range_header_filter_module,
       &ngx_http_gzip_filter_module,
       &ngx_http_postpone_filter_module,
       &ngx_http_ssi_filter_module,
       &ngx_http_charset_filter_module,
       &ngx_http_userid_filter_module,
       &ngx_http_headers_filter_module,
       &ngx_http_copy_filter_module,
       &ngx_http_range_body_filter_module,
       &ngx_http_not_modified_filter_module,
       NULL
   };
   ```

   ngx_modules.c 文件就是用来定义 ngx_modules 数组的。

   ngx_modules 是非常关键的数组，它指明了每个模块在 Nginx 中的优先级，当一个请求同时符合多个模块的处理规则时，将按照它们在 ngx_modules 数组中的顺序选择最靠前的模块优先处理。对于 HTTP 过滤模块而言则是相反的，因为 HTTP 框架在初始化时，会在 ngx_modules 数组中将过滤模块按先后顺序向过滤链表中添加，但每次都是添加到链表的表头，因此，对 HTTP 过滤模块而言，在 ngx_modules 数组中越是靠后的模块反而会首先处理 HTTP 响应（参见第 6 章及第 11 章的 11.9 节）。

   因此，ngx_modules 中模块的先后顺序非常重要，不正确的顺序会导致 Nginx 无法工作，这是 auto/modules 脚本执行后的结果。读者可以体会一下上面的 ngx_modules 中同一种类型下（第 8 章会介绍模块类型，第 10 章、第 11 章将介绍的 HTTP 框架对 HTTP 模块的顺序是最敏感的）各个模块的顺序以及这种顺序带来的意义。

可以看出，在安装过程中，configure 做了大量的幕后工作，我们需要关注在这个过程中 Nginx 做了哪些事情。configure 除了寻找依赖的软件外，还针对不同的 UNIX 操作系统做了许多优化工作。这是 Nginx 跨平台的一种具体实现，也体现了 Nginx 追求高性能的一贯风格。

configure 除了生成 Makefile 外，还生成了 ngx_modules.c 文件，它决定了运行时所有模块的优先级（在编译过程中而不是编码过程中）。对于不需要的模块，既不会加入 ngx_modules 数组，也不会编译进 Nginx 产品中，这也体现了轻量级的概念。

### 1.6 Nginx 的命令行控制

在 Linux 中，需要使用命令行来控制 Nginx 服务器的启动与停止、重载配置文件、回滚日志文件、平滑升级等行为。默认情况下，Nginx 被安装在目录 /usr/local/nginx/ 中，其二进制文件路径为 /usr/local/nginx/sbin/nginx，配置文件路径为 /usr/local/nginx/conf/nginx.conf。当然，在 configure 执行时是可以指定把它们安装在不同目录的。为了简单起见，本节只说明默认安装情况下的命令行的使用情况，如果读者安装的目录发生了变化，那么替换一下即可。

1. **默认方式启动**

   直接执行 Nginx 二进制程序。例如：

   ```bash
   /usr/local/nginx/sbin/nginx
   ```

   这时，会读取默认路径下的配置文件：/usr/local/nginx/conf/nginx.conf。

   实际上，在没有显式指定 nginx.conf 配置文件路径时，将打开在 configure 命令执行时使用 --conf-path=PATH 指定的 nginx.conf 文件（参见 1.5.1 节）。

2. **另行指定配置文件的启动方式**

   使用 -c 参数指定配置文件。例如：

   ```bash
   /usr/local/nginx/sbin/nginx -c /tmp/nginx.conf
   ```

   这时，会读取 -c 参数后指定的 nginx.conf 配置文件来启动 Nginx。

3. **另行指定安装目录的启动方式**

   使用 -p 参数指定 Nginx 的安装目录。例如：

   ```bash
   /usr/local/nginx/sbin/nginx -p /usr/local/nginx/
   ```

4. **另行指定全局配置项的启动方式**

   可以通过 -g 参数临时指定一些全局配置项，以使新的配置项生效。例如：

   ```bash
   /usr/local/nginx/sbin/nginx -g "pid /var/nginx/test.pid;"
   ```

   上面这行命令意味着会把 pid 文件写到 /var/nginx/test.pid 中。

   -g 参数的约束条件是指定的配置项不能与默认路径下的 nginx.conf 中的配置项相冲突，否则无法启动。就像上例那样，类似这样的配置项：pid logs/nginx.pid，是不能存在于默认的 nginx.conf 中的。

   另一个约束条件是，以 -g 方式启动的 Nginx 服务执行其他命令行时，需要把 -g 参数也带上，否则可能出现配置项不匹配的情形。例如，如果要停止 Nginx 服务，那么需要执行下面代码：

   ```bash
   /usr/local/nginx/sbin/nginx -g "pid /var/nginx/test.pid;" -s stop
   ```

   如果不带上 -g "pid /var/nginx/test.pid;"，那么找不到 pid 文件，也会出现无法停止服务的情况。

5. **测试配置信息是否有错误**

   在不启动 Nginx 的情况下，使用 -t 参数仅测试配置文件是否有错误。例如：

   ```bash
   /usr/local/nginx/sbin/nginx -t
   ```

   执行结果中显示配置是否正确。

6. **在测试配置阶段不输出信息**

   测试配置选项时，使用 -q 参数可以不把 error 级别以下的信息输出到屏幕。例如：

   ```bash
   /usr/local/nginx/sbin/nginx -t -q
   ```

7. **显示版本信息**

   使用 -v 参数显示 Nginx 的版本信息。例如：

   ```bash
   /usr/local/nginx/sbin/nginx -v
   ```

8. **显示编译阶段的参数**

   使用 -V 参数除了可以显示 Nginx 的版本信息外，还可以显示配置编译阶段的信息，如 GCC 编译器的版本、操作系统的版本、执行 configure 时的参数等。例如：

   ```bash
   /usr/local/nginx/sbin/nginx -V
   ```

9. **快速地停止服务**

   使用 -s stop 可以强制停止 Nginx 服务。-s 参数其实是告诉 Nginx 程序向正在运行的 Nginx 服务发送信号量，Nginx 程序通过 nginx.pid 文件中得到 master 进程的进程 ID，再向运行中的 master 进程发送 TERM 信号来快速地关闭 Nginx 服务。例如：

   ```bash
   /usr/local/nginx/sbin/nginx -s stop
   ```

   实际上，如果通过 kill 命令直接向 nginx master 进程发送 TERM 或者 INT 信号，效果是一样的。例如，先通过 ps 命令来查看 nginx master 的进程 ID：

   ```bash
   :ahf5wapi001:root > ps -ef | grep nginx
   root 10800 1 0 02:27 ? 00:00:00 nginx: master process ./nginx
   root 10801 10800 0 02:27 ? 00:00:00 nginx: worker process
   ```

   接下来直接通过 kill 命令来发送信号：

   ```bash
   kill -s SIGTERM 10800
   ```

   或者：

   ```bash
   kill -s SIGINT 10800
   ```

   上述两条命令的效果与执行 /usr/local/nginx/sbin/nginx -s stop 是完全一样的。

10. **“优雅”地停止服务**

    如果希望 Nginx 服务可以正常地处理完当前所有请求再停止服务，那么可以使用 -s quit 参数来停止服务。例如：

    ```bash
    /usr/local/nginx/sbin/nginx -s quit
    ```

    该命令与快速停止 Nginx 服务是有区别的。当快速停止服务时，worker 进程与 master 进程在收到信号后会立刻跳出循环，退出进程。而“优雅”地停止服务时，首先会关闭监听端口，停止接收新的连接，然后把当前正在处理的连接全部处理完，最后再退出进程。

    与快速停止服务相似，可以直接发送 QUIT 信号给 master 进程来停止服务，其效果与执行 -s quit 命令是一样的。例如：

    ```bash
    kill -s SIGQUIT <nginx master pid>
    ```

    如果希望“优雅”地停止某个 worker 进程，那么可以通过向该进程发送 WINCH 信号来停止服务。例如：

    ```bash
    kill -s SIGWINCH <nginx worker pid>
    ```

11. **使运行中的 Nginx 重读配置项并生效**

    使用 -s reload 参数可以使运行中的 Nginx 服务重新加载 nginx.conf 文件。例如：

    ```bash
    /usr/local/nginx/sbin/nginx -s reload
    ```

    事实上，Nginx 会先检查新的配置项是否有误，如果全部正确就以“优雅”的方式关闭，再重新启动 Nginx 来实现这个目的。类似的，-s 是发送信号，仍然可以用 kill 命令发送 HUP 信号来达到相同的效果。

    ```bash
    kill -s SIGHUP <nginx master pid>
    ```

12. **日志文件回滚**

    使用 -s reopen 参数可以重新打开日志文件，这样可以先把当前日志文件改名或转移到其他目录中进行备份，再重新打开时就会生成新的日志文件。这个功能使得日志文件不至于过大。例如：

    ```bash
    /usr/local/nginx/sbin/nginx -s reopen
    ```

    当然，这与使用 kill 命令发送 USR1 信号效果相同。

    ```bash
    kill -s SIGUSR1 <nginx master pid>
    ```

13. **平滑升级 Nginx**

    当 Nginx 服务升级到新的版本时，必须要将旧的二进制文件 Nginx 替换掉，通常情况下这是需要重启服务的，但 Nginx 支持不重启服务来完成新版本的平滑升级。

    升级时包括以下步骤：

    1. 通知正在运行的旧版本 Nginx 准备升级。通过向 master 进程发送 USR2 信号可达到目的。例如：

       ```bash
       kill -s SIGUSR2 <nginx master pid>
       ```

       这时，运行中的 Nginx 会将 pid 文件重命名，如将 /usr/local/nginx/logs/nginx.pid 重命名为 /usr/local/nginx/logs/nginx.pid.oldbin，这样新的 Nginx 才有可能启动成功。

    2. 启动新版本的 Nginx，可以使用以上介绍过的任意一种启动方法。这时通过 ps 命令可以发现新旧版本的 Nginx 在同时运行。

    3. 通过 kill 命令向旧版本的 master 进程发送 SIGQUIT 信号，以“优雅”的方式关闭旧版本的 Nginx。随后将只有新版本的 Nginx 服务运行，此时平滑升级完毕。

14. **显示命令行帮助**

    使用 -h 或者 -? 参数会显示支持的所有命令行参数。

## 1.7 小结

本章介绍了 Nginx 的特点以及在什么场景下需要使用 Nginx，同时介绍了如何获取 Nginx 以及如何配置、编译、安装运行 Nginx。本章还深入介绍了最为复杂的 configure 过程，这部分内容是学习本书第二部分和第三部分的基础。
