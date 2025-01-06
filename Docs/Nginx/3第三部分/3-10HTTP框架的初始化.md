---
outline: [2, 3]
---

# 第 10 章 HTTP 框架的初始化

从本章开始将探讨事件消费模块的“大户”——HTTP 模块。Nginx 作为 Web 服务器，其
HTTP 模块的数量远超过了其他 4 类模块（核心模块、事件模块、配置模块、邮件模块），其
代码规模也同样遥遥领先。

这些实现了丰富多样功能的 HTTP 模块是以一种什么样的方式组织起来的呢？它们各自
功能的高度可定制性是如何实现的？共性在哪里？Nginx 又是怎样把这些共性的内容提取出
来，并以一个强大的 HTTP 框架帮助各个 HTTP 模块实现具体的功能呢？
在回答这些问题前，先来回顾一下本书的第二部分，因为第二部分始终在讲如何开发一
个 HTTP 模块，这种应用级别的 HTTP 模块就是由 HTTP 框架定义和管理的。HTTP 框架大致由
1 个核心模块（ngx_http_module）、两个 HTTP 模块（ngx_http_core_module、
ngx_http_upstream_module）组成，它将负责调度其他 HTTP 模块来一起处理用户请求。下面
先来弄清楚普通的 HTTP 模块和 HTTP 框架各自的关注点在哪里。

先来看第 3 章~第 5 章例子中的 HTTP 模块通常会做哪些工作：
1）处理已经解析完毕的 HTTP 请求（也就是第二部分中反复提到的填充好的
ngx_http_request_t 结构体）。

2）获取到 nginx.conf 里自己感兴趣的配置项，无论它们是否同时出现在不同的 http{}配置
块、server{}配置块或者 location{}配置块下，都需要正确地解析出，以此决定针对不同的用
户请求定制不同的功能。

3）调用 HTTP 框架提供的方法就可以发送 HTTP 响应，包括使用磁盘 I/O 读取数据并发
送。

4）将一个请求分为顺序性的多个处理阶段，前一个阶段的结果会影响后一个阶段的处
理。例如，ngx_http_access_module 模块根据 IP 信息拒绝一个用户请求后，本应接着执行的其
他 HTTP 模块将没有机会再处理这个请求。

5）异步接收 HTTP 请求中的包体，可以将网络数据保存到磁盘上。

6）异步访问第三方服务。

7）分解出多个子请求来构造处理复杂业务的能力，子请求间的处理仍然是异步化、非
阻塞的。

以上只是一个简单粗略的总结，HTTP 模块或多或少都会需要这些功能。以这些功能为
例，我们来探讨一下 HTTP 框架至少要完成哪些基础性的工作。

1）处理所有 http{}块内的配置项，管理每个 HTTP 模块感兴趣的配置项（允许同一个
http{}下出现多个 server{}、location{}等子配置块，允许同名的配置项同时出现在各种配置块
中）。

2）HTTP 框架要能够使用第 9 章介绍的事件模块监听 Web 端口，并处理新连接事件、可
读事件、可写事件等。

3）HTTP 框架需要有状态机来分析接收到的 TCP 字符流是否是完整的 HTTP 包。

4）HTTP 框架能够根据接收到的 HTTP 请求中的 URI 和 HTTP 头部，并以 nginx.conf 中
server_name 和 location 等配置项为依据，将请求按照其所在阶段准确地分发到某一个 HTTP 模
块，从而调用它的回调方法来处理该请求。

5）向 HTTP 模块提供必要的工具方法，可以处理网络 I/O（读取 HTTP 包体、发送 HTTP 响
应）和磁盘 I/O。

6）提供 upstream 机制帮助 HTTP 模块访问第三方服务。

7）提供 subrequest 机制帮助 HTTP 模块实现子请求。

HTTP 框架需要做的工作很多，实际上，HTTP 的框架性代码也是极为庞大的，为了简便
起见，本书以后的章节将专注在 HTTP 框架的流程代码中，完全不会涉及具体的 HTTP 功能模
块，也不会涉及框架中不太重要的工具性的代码。

本章会完整地介绍 ngx_http_module 模块，其中涉及少量 ngx_http_core_module 模块的功
能。因为构成 HTTP 框架的几个模块间的代码耦合性很高，所以对于 HTTP 框架的介绍并不会
按照模块进行，而是从 HTTP 框架的功能和架构上进行，其中本章介绍 Nginx 启动过程中
HTTP 框架是怎样初始化的，第 11 章介绍 Nginx 运行过程中 HTTP 框架是怎样调度 HTTP 模块处
理请求的，第 12 章讲述访问第三方服务的 upstream 机制是如何工作的。

10.1 HTTP 框架概述
为了让读者对 HTTP 框架所要完成的工作有一个直观的认识，本章将依托一个贯穿始终
的 nginx.conf 配置范例来说明框架的行为，如下所示。

http {
mytest_num 1;
server {
server_name A;
listen 127.0.0.1:8000;
listen 80;
mytest_num 2;
location /L1 {
mytest_num 3;
…
}
location /L2 {
mytest_num 4;
…
}
}
server {
server_name B;
listen 80;
listen 8080;
listen 173.39.160.51:8000; mytest_num 5;
location /L1 {
mytest_num 6;
…
}
location /L3 {
mytest_num 7;
…
}
}
}
从上面这个简单的例子中，可以获取下列信息：

-   HTTP 框架是支持在 http{}块内拥有多个 server{}、location{}配置块的。

-   选择使用哪一个 server 虚拟主机块是取决于 server_name 的。

-   任意的 server 块内都可以用 listen 来监听端口，在不同的 server 块内允许监听相同的端
    口。

-   选择使用哪一个 location 块是将用户请求 URI 与合适的 server 块内的所有 location 表达式
    做匹配后决定的。

-   同一个配置项可以出现在任意的 http{}、server{}、location{}等配置块中。

HTTP 框架如何实现上述的配置项特性呢？
HTTP 框架的首要任务是通过调用 ngx_http_module_t 接口中的方法来管理所有 HTTP 模块
的配置项，10.2 节中会详细描述这一过程。在 10.3 节中，我们会探讨监听端口与 server 虚拟主
机间的关系，包括它们是用何种数据结构关联在一起的。所有的 server 虚拟主机会以散列表
的数据结构组织起来，以达到高效查询的目的，在 10.4 节中会介绍这一过程。所有的 location
表达式会以一个静态的二叉查找树组织起来，以达到高效查询的目的，在 10.5 节中会说明
它。对于每一个 HTTP 请求，都会以流水线形式划分为多个阶段，以供 HTTP 模块插入到
HTTP 框架中来共同处理请求，10.6 节中会说明这些阶段划分、实现的依据所在。在 10.7 节
中，将会完整地说明在 Nginx 启动过程中，HTTP 框架是如何初始化的。

下面开始介绍 ngx_http_module_t 接口的相关内容。

ngx_http_module 核心模块定义了新的模块类型 NGX_HTTP_MODULE。这样的 HTTP 模块
对于 ctx 上下文使用了不同于核心模块、事件模块的新接口 ngx_http_module_t，虽然第 3 章中曾
经提到过 ngx_http_module_t 接口的定义，但那时我们介绍的角度是如何开发一个 HTTP 模块，
现在探讨实现 HTTP 框架时，对 ngx_http_module_t 接口的解读就不同了。在重新解读
ngx_http_module_t 接口之前，先对不同级别的 HTTP 配置项做个缩写名词的定义：

-   直接隶属于 http{}块内的配置项称为 main 配置项。

-   直接隶属于 server{}块内的配置项称为 srv 配置项。

-   直接隶属于 location{}块内的配置项称为 loc 配置项。

其他配置块本章不会涉及，因为它们与 HTTP 框架没有任何关系。

对于每一个 HTTP 模块，都必须实现 ngx_http_module_t 接口。下面将从 HTTP 框架的角度
来进行重新解读，如下所示。

typedef struct {
// 在解析
http{...}内的配置项前回调
ngx*int_t (*preconfiguration)(ngx*conf_t *cf); // 解析完
http{...}内的所有配置项后回调
ngx*int_t (*postconfiguration)(ngx*conf_t *cf); /_创建用于存储
HTTP 全局配置项的结构体，该结构体中的成员将保存直属于
http{}块的配置项参数。它会在解析
main 配置项前调用
_/
void *(*create*main_conf)(ngx_conf_t \_cf); // 解析完
main 配置项后回调
char *(*init_main_conf)(ngx_conf_t cf, void conf); /*创建用于存储可同时出现在
main、
srv 级别配置项的结构体，该结构体中的成员与
server 配置是相关联的
_/
void _(*create_srv_conf)(ngx_conf_t *cf); /\_create*srv_conf 产生的结构体所要解析的配置项，可能同时出现在
main、
srv 级别中，
merge_srv_conf 方法可以把出现在
main 级别中的配置项值合并到
srv 级别配置项中
*/
char *(*merge*srv_conf)(ngx_conf_t cf, void prev, void *conf); /_创建用于存储可同时出现在
main、
srv、
loc 级别配置项的结构体，该结构体中的成员与
location 配置是相关联的
_/
void _(*create_loc_conf)(ngx_conf_t *cf); /\_create_loc_conf 产生的结构体所要解析的配置项，可能同时出现在
main、
srv、
loc 级别中，
merge_loc_conf 方法可以分别把出现在
main、
srv 级别的配置项值合并到
loc 级别的配置项中
_/
char *(*merge_loc_conf)(ngx_conf_t cf, void prev, void \*conf); } ngx_http_module_t;
可以看到，ngx_http_module_t 接口完全是围绕着配置项来进行的，这与第 8 章提到过的可
定制性、可扩展性等架构特性是一致的。每一个 HTTP 模块都将根据 main、srv、loc 这些不同
级别的配置项来决定自己的行为。

10.2 管理 HTTP 模块的配置项
上文介绍过事件配置项的管理，其实 HTTP 配置项的管理与事件模块有些相似，但由于
它具有 3 种不同级别配置项，所以管理要复杂许多。对于 HTTP 模块而言，只需关心工作时能
够取到正确的配置项。但对于 HTTP 框架而言，任何一个 HTTP 模块的 server 相关的配置项都
是可能出现在 main 级别中，而 location 相关的配置项可能出现在 main、srv 级别中。而 server 是
可能存在许多个的，location 更是可以反复嵌套的，这样就要为每个 HTTP 模块按照 nginx.conf
里的配置块建立许多份配置。在 10.1 节的例子中，共出现了 7 个配置块，对于 HTTP 框架而
言，就需要为所有的 HTTP 模块分配 7 个用于存储配置结构体指针的数组。

在处理 http{}块内的 main 级别配置项时，对每个 HTTP 模块来说，都会调用
create_main_conf、create_srv_conf、create_loc_conf 方法建立 3 个结构体，分别用于存储 HTTP
全局配置项、server 配置项、location 配置项。现在问题来了，http{}内的配置项明明就是 main
级别的，有了 create_main_conf 生成的结构体已经足够保存全局配置项参数了，为什么还要调
用 create_srv_conf、create_loc_conf 方法建立结构体呢？其实，这是为了把同时出现在 http{}、
server{}、location{}内的相同配置项进行合并而做的准备。假设有一个与 server 相关的配置
项（例如负责指定每个 TCP 连接上内存池大小的 connection_pool_size 配置项）同时出现在
http{}、server{}中，那么对它感兴趣的 HTTP 模块就有权决定 srv 结构体内的成员究竟是以
main 级别配置项为准，还是 srv 级别配置项为准。结合 10.1 节的例子来看，mytest_num 出现在
http{}下时参数为 1，出现在 server A{}下时参数为 2，那么，mytest 模块就有权决定，当处理
server A 虚拟主机时，究竟是把 mytest_num 参数当做 1 还是 2，或者把它们俩相加，这都是任何
一个 HTTP 模块的自由。对于 HTTP 框架而言，在解析 main 级别的配置项时，必须同时创建 3
个结构体，用于合并之后会解析到的 server、location 相关的配置项。

对于 server{}块内配置项的处理，需要调用每个 HTTP 模块的 create_srv_conf 方法、
create_loc_conf 方法建立两个结构体，分别用于存储 server、location 相关的配置项，其中
create_loc_conf 产生的结构体仅用于合并 location 相关的配置项。

对于 location 块内配置项的处理则简单许多，只需要调用每个 HTTP 模块的 create_loc_conf
方法建立 1 个结构体即可。

结合 10.1 节中 nginx.conf 配置文件的片断来看，实际上 HTTP 框架最多必须为一个 HTTP 模
块（如 mytest 模块）创建 3+2+1+1+2+1+1=11 个配置结构体，而经过合并后实际上每个 HTTP
模块会用到的结构体有 7 个。可为什么 mytest 模块使用 ngx_http_mytest_conf_t 结构体时好像只
有 1 个配置结构体呢？因为在 HTTP 框架处理到某个阶段时，例如，在寻找到适合的 location
前，如果试图去取 ngx_http_mytest_conf_t 结构体，得到的将是 srv 级别下的配置，而寻找到
location 后，ngx_http_mytest_conf_t 结构体中的成员将是 loc 级别下的配置。

下面介绍一下 ngx_http_module 模块在实现上是如何体现上述思路的。

## 10.2.1 管理 main 级别下的配置项

上文说过，在解析 HTTP 模块定义的 main 级别配置项时，将会分别调用每个 HTTP 模块的 create_main_conf、create_srv_conf、create_loc_conf 方法建立 3 个结构体，分别用于存储全局、server 相关的、location 相关的配置项，但它们究竟是以何种数据结构保存的呢？与核心结构体 ngx_cycle_t 中的 conf_ctx 指针又有什么样的关系呢？在图 10-10 中的第 2 步~第 7 步包含了解析 main 级别配置项的所有流程，而图 10-1 将会展现它们在内存中的布局，可以看到，其中 ngx_http_core_module 模块完成了 HTTP 框架的大部分功能，而它又是第 1 个 HTTP 模块，因此，它使用到的 3 个结构体（ngx_http_core_main_conf_t、ngx_http_core_srv_conf_t、ngx_http_core_loc_conf_t）也是用户非常关心的。

图 10-1 中有一个结构体叫做 ngx_http_conf_ctx_t，它是 HTTP 框架中一个经常用到的数据结构，下面看看它的定义。

typedef struct {
/_指向一个指针数组，数组中的每个成员都是由所有
HTTP 模块的
create_main_conf 方法创建的存放全局配置项的结构体，它们存放着解析直属
http{}块内的
main 级别的配置项参数
_/
void **main*conf;
/*指向一个指针数组，数组中的每个成员都是由所有
HTTP 模块的
create*srv_conf 方法创建的与
server 相关的结构体，它们或存放
main 级别配置项，或存放
srv 级别配置项，这与当前的
ngx_http_conf_ctx_t 是在解析
http{}或者
server{}块时创建的有关
*/
void **srv*conf;
/*指向一个指针数组，数组中的每个成员都是由所有
HTTP 模块的
create*loc_conf 方法创建的与
location 相关的结构体，它们可能存放着
main、
srv、
loc 级别的配置项，这与当前的
ngx_http_conf_ctx_t 是在解析
http{}、
server{}或者
location{}块时创建的有关
*/
void \*\*loc_conf;
} ngx_http_conf_ctx_t;
ngx_http_conf_ctx_t 中仅有 3 个成员，它们分别指向 3 个指针数组。在 10.2.4 节中，读者会
看到 srv_conf 数组和 loc_conf 数组在配置项的合并操作中是如何使用的。

在核心结构体 ngx_cycle_t 的 conf_ctx 成员指向的指针数组中，第 7 个指针由
ngx_http_module 模块使用（ngx_http_module 模块的 index 序号为 6，由于由 0 开始，所以它在
ngx_modules 数组中排行第 7。在存放全局配置结构体的 conf_ctx 数组中，第 7 个成员指向
ngx_http_module 模块），这个指针设置为指向解析 http{}块时生成的 ngx_http_conf_ctx_t 结构
体，而 ngx_http_conf_ctx_t 的 3 个成员则分别指向新分配的 3 个指针数组。新的指针数组中成员
的意义由每个 HTTP 模块的 ctx_index 序号指定（ctx_index 在 HTTP 模块中表明它处于 HTTP 模块
间的序号），例如，第 6 个 HTTP 模块的 ctx_index 是 5（ctx_index 同样由 0 开始计数），那么在
ngx_http_conf_ctx_t 的 3 个数组中，第 6 个成员就指向第 6 个 HTTP 模块的 create_main_conf、
create_srv_conf、create_loc_conf 方法建立的结构体，当然，如果相应的回调方法没有实现，
该指针就为 NULL 空指针。

图 10-1 HTTP 框架解析 main 级别配置项时配置结构体的内存示意图
ngx_http_core_module 模块是第 1 个 HTTP 模块，它的 ctx_index 序号是 0，因此，数组中的
第 1 个指针将指向 ngx_http_core_module 模块生成的 ngx_http_core_main_conf_t、
ngx_http_core_srv_conf_t、ngx_http_core_loc_conf_t 结构体。

可如何由 ngx_cycle_t 核心结构体中找到 main 级别的配置结构体呢？Nginx 提供的
ngx_http_cycle_get_module_main_conf 宏可以实现这个功能，如下所示。

define ngx_http_cycle_get_module_main_conf(cycle, module) \
(cycle-\>conf_ctx[ngx_http_module.index] \
((ngx_http_conf_ctx_t *)
cycle-\>conf_ctx[ngx_http_module.index])
-\>main_conf[module.ctx_index]: \
NULL)
其中参数 cycle 是 ngx_cycle_t 核心结构体指针，而 module 则是所要操作的 HTTP 模块。它的
实现很简单，先由 cycle 的 conf_ctx 指针数组中找到 ngx_http_module.index 序号（上文说过，其
index 为 6）对应的指针，获取到 http{}块下的 ngx_http_conf_ctx_t 成员，然后经由 main_conf 数组
即可找到所有 HTTP 模块的 main 级别配置结构体。最后，根据所要查询的 module 数组的
ctx_index 序号取得其 main 级别下的配置结构体，例如：
ngx_http_perl_main_conf_t *pmcf = ngx_http_cycle_get_module_main_conf(cycle, ngx_http_perl_module);
注意 HTTP 全局配置项是基础，管理 server、location 等配置块时取决于
ngx_http_core_module 模块出现在 main 级别下存储全局配置项的 ngx_http_core_main_conf_t 结构
体。

10.2.2 管理 server 级别下的配置项
在解析 main 级别配置项时，如果发现了 server{}配置项，就会回调 ngx_http_core_server 方
法（该方法属于 ngx_http_core_module 模块），而在这个方法里则会开始解析 srv 级别的配置
项，其流程如图 10-2 所示。

下面简要说明图 10-2 中的步骤：
1）在解析到 server 块时，首先会像解析 http 块一样，建立属于这个 server 块的
ngx_http_conf_ctx_t 结构体。在 ngx_http_conf_ctx_t 的 3 个成员中，main_conf 将指向所属的 http 块
下 ngx_http_conf_ctx_t 结构体的 main_conf 指针数组，而 srv_conf 和 loc_conf 都将重新分配指针数
组，数组的大小为 ngx_http_max_module，也就是所有 HTTP 模块的总数。

2）循环调用所有 HTTP 模块的 create_srv_conf 方法，将返回的结构体指针按照模块序号
ctx_index 保存到上述的 srv_conf 指针数组中。

3）循环调用所有 HTTP 模块的 create_loc_conf 方法，将返回的结构体指针按照模块序号
ctx_index 保存到上述的 loc_conf 指针数组中。

4）第 1 个 HTTP 模块就是 ngx_http_core_module 模块，它在 create_srv_conf 方法中将会生成
非常关键的 ngx_http_core_srv_conf_t 配置结构体，这个结构体对应着当前正在解析的 server
块，这时，将 ngx_http_core_srv_conf_t 添加到全局的 ngx_http_core_main_conf_t 结构体的 servers
动态数组中，在图 10-3 中会看到这一点。

图 10-2 解析 server{}块内配置项的流程
5）解析当前 server{}块内的所有配置项。

6）如果在 server{}块内没有解析到 listen 配置项，则意味着当前的 server 虚拟主机并没有
监听 TCP 端口，这不符合 HTTP 框架的设计原则。于是将开始监听默认端口 80，实际上，如
果当前进程没有权限监听 1024 以下的端口，则会改为监听 8000 端口。

由于 http 块只有 1 个，因此在 10.2.1 节中可以简单地给出 main 级别配置项的内存示意图。

但 http 块内会包含任意个 server 块，对于每个 server 块都需要建立 1 个 ngx_http_conf_ctx_t 结构
体，这些 server 块的 ngx_http_conf_ctx_t 结构体是通过 ngx_array_t 动态数组组织起来的，这其中
的关系就比较复杂了，图 10-3 是它们简单的内存示意图。

图 10-3 HTTP 模块 srv 级别配置项结构体指针的内存示意图
图 10-3 是针对 10.1 节中的例子所画的示意图，在 http 块下有两个 server 块，分别表示虚拟
主机名为 A 的配置块和虚拟主机名为 B 的配置块。解析每一个 server 块时都会创建一个新的
ngx_http_conf_ctx_t 结构体，其中的 main_conf 将指向 http 块下 main_conf 指针数组，而 srv_conf 和
loc_conf 数组则都会重新分配，它们的内容就是所有 HTTP 模块的 create_srv_conf 方法、
create_loc_conf 方法创建的结构体指针。

在 10.2.1 节中提到的 main 级别配置项中，ngx_http_core_module 模块的
ngx_http_core_main_conf_t 结构体中有一个 servers 动态数组，如下所示。

typedef struct {
/_存储指针的动态数组，每个指针指向
ngx_http_core_srv_conf_t 结构体的地址，也就是其成员类型为
ngx_http_core_srv_conf_t\*\* _/
ngx_array_t servers;
…
} ngx_http_core_main_conf_t;
servers 动态数组中的每一个元素都是一个指针，它指向用于表示 server 块的
ngx_http_core_srv_conf_t 结构体的地址（属于 ngx_http_core_module 模块）。

ngx_http_core_srv_conf_t 结构体中有 1 个 ctx 指针，它指向解析 server 块时新生成的
ngx_http_conf_ctx_t 结构体，具体如下所示。

typedef struct {
// 指向当前
server 块所属的
ngx_http_conf_ctx_t 结构体
ngx_http_conf_ctx_t *ctx;
/*当前
server 块的虚拟主机名，如果存在的话，则会与
HTTP 请求中的
Host 头部做匹配，匹配上后再由当前
ngx_http_core_srv_conf_t 处理请求
\*/
ngx_str_t server_name;
…
} ngx_http_core_srv_conf_t;
这样，server 块下以 ngx_http_conf_ctx_t 组织起来的所有配置项结构体，就会由 servers 动
态数组关联起来。servers 动态数组中的元素个数与 http 块下的 server 配置块个数是一致的。

10.2.3 管理 location 级别下的配置项
在解析 srv 级别配置项时，如果发现了 location{}配置块，就会回调 ngx_http_core_location
方法（该方法属于 ngx_http_core_module 模块），在这个方法里则会开始解析 loc 级别的配置
项，其流程如图 10-4 所示。

下面简要介绍一下图 10-4 中的流程：
1）在解析到 location{}配置块时，仍然会像解析 http 块一样，先建立 ngx_http_conf_ctx_t 结
构体，只是这里的 main_conf 和 srv_conf 都将指向所属的 server 块下 ngx_http_conf_ctx_t 结构体的
main_conf 和 srv_conf 指针数组，而 loc_conf 则将指向重新分配的指针数组。

2）循环调用所有 HTTP 模块的 create_loc_conf 方法，将返回的结构体指针按照模块序号
ctx_index 保存到上述的 loc_conf 指针数组中。

3）如果在 location 中使用了正则表达式，那么这时将调用 pcre_compile 方法预编译正则表
达式，以提高性能。

4）第 1 个 HTTP 模块是 ngx_http_core_module 模块，它在 create_loc_conf 方法中将会生成
ngx_http_core_loc_conf_t 配置结构体，可以认为该结构体对应着当前解析的 location 块。这时
会生成 ngx_http_location_queue_t 结构体，因为每一个 ngx_http_core_loc_conf_t 结构体都对应着
1 个 ngx_http_location_queue_t，因此，此处将把 ngx_http_location_queue_t 串联成双向链表，在
图 10-5 中会看到这一点。

图 10-4 解析 location{}配置块的流程
5）解析当前 location{}配置块内的 loc 级别配置项。

图 10-5 为 HTTP 模块 loc 级别配置项结构体指针的内存示意图。

图 10-5 仍然是依据 10.1 节中的配置块例子所画的示意图，不过，这里仅涉及 server 块
A（其 server*name 的参数值为 A）以及它所属的 location L1 块。在解析 http 块时曾创建过 1 个
ngx_http_core_loc_conf_t 结构体（见 10.2.1 节），在解析 server 块 A 时曾经创建过 1 个
ngx_http_core_loc_conf_t 结构体（见 10.2.2 节），而解析其下的 location 块 L1 时也创建了
ngx_http_core_loc_conf_t 结构体，从图 10-5 中可以看出这 3 个结构体间的关系。下面先看看图
10-5 中 ngx_http_core_loc_conf_t 的 3 个关键成员：
typedef struct ngx_http_core_loc_conf_s ngx_http_core_loc_conf_t; struct ngx_http_core_loc_conf_s {
// location 的名称，即
nginx.conf 中
location 后的表达式
ngx_str_t name;
/*指向所属
location 块内
ngx*http_conf_ctx_t 结构体中的
loc_conf 指针数组，它保存着当前
location 块内所有
HTTP 模块
create_loc_conf 方法产生的结构体指针
*/
void \**loc_conf;
/*将同一个
server 块内多个表达
location 块的
ngx_http_core_loc_conf_t 结构体以双向链表方式组织起来，该
locations 指针将指向
ngx_http_location_queue_t 结构体
*/
ngx_queue_t *locations;
…
};

图 10-5 HTTP 模块 loc 级别配置项结构体指针的内存示意图
可以这么说，ngx_http_core_loc_conf_t 拥有足够的信息来表达 1 个 location 块，它的
loc_conf 成员也可以引用到各 HTTP 模块在当前 location 块中的配置项。所以，一旦通过某种容
器将 ngx_http_core_loc_conf_t 组织起来，也就是把 location 级别的配置项结构体管理起来了。

但 ngx_http_core_loc_conf_t 又是放置在什么样的容器中呢？注意，图 10-3 在解析 server 块 A 时
有 1 个 ngx_http_core_loc_conf_t 结构体，它的地位与 server 块 A 内的各个 location 块对应的
ngx_http_core_loc_conf_t 结构体是不同的，location L1、location L2 块内的
ngx_http_core_loc_conf_t 是通过 server A 块内产生的 ngx_http_core_loc_conf_t 关联起来的。

在 ngx_http_core_loc_conf_t 结构体中有一个成员 locations，它表示属于当前块的所有
location 块通过 ngx_http_location_queue_t 结构体构成的双向链表，如下所示。

typedef struct {
/_queue 将作为
ngx_queue_t 双向链表容器，从而将
ngx_http_location_queue_t 结构体连接起来
_/
ngx*queue_t queue;
/*如果
location 中的字符串可以精确匹配（包括正则表达式），
exact 将指向对应的
ngx*http_core_loc_conf_t 结构体，否则值为
NULL*/
ngx_http_core_loc_conf_t *exact;
/*如果
location 中的字符串无法精确匹配（包括了自定义的通配符），
inclusive 将指向对应的
ngx_http_core_loc_conf_t 结构体，否则值为
NULL*/
ngx_http_core_loc_conf_t *inclusive;
// 指向
location 的名称
ngx_str_t \*name;
…
} ngx_http_location_queue_t;
可以看到，ngx_http_location_queue_t 中的 queue 成员将把所有相关的
ngx_http_location_queue_t 结构体串联起来。同时，ngx_http_location_queue_t 将帮助用户把所有
的 location 块与其所属的 server 块关联起来。

那么，哪些 ngx_http_location_queue_t 结构体会被串联起来呢？还是看 10.1 节的例子，
server 块 A 以及其下所属的 location L1 和 location L2 共包括 3 个 ngx_http_core_loc_conf_t 结构体，
它们是相关的，下面看看它们是怎样关联起来的，如图 10-6 所示。

每一个 ngx_http_core_loc_conf_t 都将对应着一个 ngx_http_location_queue_t 结构体。在
server 块 A 拥有的 ngx_http_core_loc_conf_t 结构体中，locations 成员将指向它所属的
ngx_http_location_queue_t 结构体，这是 1 个双向链表的首部。当解析到 location L1 块时，会创
建一个 ngx_http_location_queue_t 结构体并添加到 locations 双向链表的尾部，该
ngx_http_location_queue_t 结构体中的 exact 或者 inclusive 指针将会指向 location L1 所属的
ngx_http_core_loc_conf_t 结构体（在 location 后的表达式属于完全匹配时，exact 指针有效，否
则表达式将带有通配符，这时 inclusive 有效。exact 优先级高于 inclusive），这样就把 location
L1 块对应的 ngx_http_core_loc_conf_t 结构体，以及其 loc_conf 成员指向的所有 HTTP 模块在
location L1 块内的配置项与 server A 块结合了起来。解析到 location L2 时会做相同处理，这也
就得到了图 10-6。

图 10-6 同一个 server 块下的 ngx_http_core_loc_conf_t 是通过双向链表关联起来的
事实上，location 之间是可以嵌套的，那么它们之间的关联关系又是怎样的呢？扩展一
下 10.1 节中的例子，即假设配置文件如下：
http {
mytest_num 1;
server {
server_name A;
listen 8000;
listen 80;
mytest_num 2;
location /L1 {
mytest_num 3;
…
location /L1/CL1 {
}
}
}
这时多了一个新的 location 块 L1/CL1，它隶属于 location L1。此时，每个 location 块对应的
ngx_http_core_loc_conf_t 结构体间是通过如图 10-7 所示的形式组织起来的。

图 10-7 location 块嵌套后 ngx_http_core_loc_conf_t 结构体间的关系
可以看到，仍然是通过 ngx_http_core_loc_conf_t 结构体中的 locations 指针来容纳属于它的
location 块的。当 locations 为空指针时，表示当前的 location 块下不再嵌套 location 块，否则表
示还有新的 location 块。在 10.2.4 节的合并配置项的代码中可以看到这一点。

10.2.4 不同级别配置项的合并
考虑到 HTTP 模块可能需要合并不同级别的同名配置项，因此，HTTP 框架为
ngx_http_module_t 接口提供了 merge_srv_conf 方法，用于合并 main 级别与 srv 级别的 server 相关
的配置项，同时，它还提供了 merge_loc_conf 方法，用于合并 main 级别、srv 级别、loc 级别的
location 相关的配置项。当然，如果不存在合并不同级别配置项的场景，那么可以不实现这
两个方法。下面仍然以 10.1 节的配置文件为例，展示了不同级别的配置项结构体是如何合并
的，如图 10-8 所示。

图 10-8 main、srv、loc 级别的同名配置项合并前的内存示意图
图 10-8 以第 5 个 HTTP 模块（通常是 ngx_http_static_module 模块）为例，展示了在解析完
http 块、server A 块、location L1 块后是如何合并配置项的。第 5 个 HTTP 模块在解析这 3 个配置
块时，create_loc_conf_t 方法被调用了 3 次，产生了 3 个结构体，分别存放了 main、srv、loc 级
别的 location 相关的配置项，这时可以合并为 location L1 相关的配置结构体；create_srv_conf_t
方法被调用了两次，产生了两个结构体，分别存放了 main、srv 级别的配置项，这时也可以合
并为 server A 块相关的配置结构体。

合并配置项可能不太容易理解，下面我们就在代码实现层面上再做个简要的介绍，同时
也对 10.2.2 节和 10.2.3 节的内容做一个回顾。这个合并操作是在 ngx*http_merge_servers 方法下
进行的，先来简单地看看它是怎么被调用的：
/\_cmcf 是
ngx_http_core_module 在
http 块下的全局配置结构体，在
10.2.2 节介绍过它的
servers 成员，这是一个动态数组，它保存着所有
ngx_http_core_srv_conf_t 的指针，从而关联了所有的
server 块
*/
cmcf = ctx-\>main*conf[ngx_http_core_module.ctx_index]; // ngx_modules 数组中包含所有的
Nginx 模块
for (m = 0; ngx_modules[m]; m++) {
// 遍历所有的
HTTP 模块
if (ngx_modules[m]-\>type != NGX_HTTP_MODULE) {
continue;
}
/* ngx*modules[m]是一个
ngx_module_t 模块结构体，它的
ctx 成员对于
HTTP 模块来说是
ngx_http_module_t 接口
*/
ngx_http_module_t \*module = ngx_modules[m]-\>ctx; // ctx_index 是这个
HTTP 模块在所有
HTTP 模块中的序号
mi = ngx_modules[m]-\>ctx_index;
// 调用
ngx_http_merge_servers 方法合并
ngx_modules[m]模块
rv = ngx_http_merge_servers(cf, cmcf, module, mi); }
ngx_http_merge_servers 方法不只是合并了 server 相关的配置项，它同时也会合并 location
相关的配置项，下面再来看看它的实现，代码如下。

static char ngx*http_merge_servers(ngx_conf_t cf, ngx_http_core_main_conf_t cmcf, ngx_http_module_t
char *rv;
ngx*uint_t s;
ngx_http_conf_ctx_t *ctx, saved;
ngx_http_core_loc_conf_t *clcf;
ngx_http_core_srv_conf_t \*\*cscfp;
/*从
ngx*http_core_main_conf_t 的
servers 动态数组中可以获取所有的
ngx_http_core_srv_conf_t 结构体
*/
cscfp = cmcf-\>servers.elts;
// 注意，这个
ctx 是在
http{}块下的全局
ngx*http_conf_ctx_t 结构体
ctx = (ngx_http_conf_ctx_t *) cf-\>ctx; saved = *ctx;
// 遍历所有的
server 块下对应的
ngx_http_core_srv_conf_t 结构体
for (s = 0; s \< cmcf-\>servers.nelts; s++) {
/*srv_conf 将指向所有的
HTTP 模块产生的
server 相关的
srv 级别配置结构体
*/
ctx-\>srv_conf = cscfp[s]-\>ctx-\>srv_conf; // 如果当前
HTTP 模块实现了
merge_srv_conf，则再调用合并方法
if (module-\>merge_srv_conf) {
/*注意，在这里合并配置项时，
saved.srv_conf[ctx_index]参数是当前
HTTP 模块在
http{}块下由
create_srv_conf 方法创建的结构体，而
cscfp[s]-\>ctx-\>srv_conf[ctx_index]参数则是在
server{}块下由
create_srv_conf 方法创建的结构体
*/
rv = module-\>merge_srv_conf(cf, saved.srv_conf[ctx_index], cscfp[s]-\> ctx-\>srv_conf[ctx_index]); }
// 如果当前
HTTP 模块实现了
merge_srv_conf，则再调用合并方法
if (module-\>merge_loc_conf) {
/*cscfp[s]-\>ctx-\>loc_conf 这个动态数组中的成员都是由
server{}块下所有
HTTP 模块的
create_loc_conf 方法创建的结构体指针
*/
ctx-\>loc_conf = cscfp[s]-\>ctx-\>loc_conf; /*首先将
http{}块下
main 级别与
server{}块下
srv 级别的
location 相关的结构体合并
*/
rv = module-\>merge_loc_conf(cf, saved.loc_conf[ctx_index], cscfp[s]-\> ctx-\>loc_conf[ctx_index]); /*clcf
server 块下
ngx_http_core_module 模块使用
create_loc_conf 方法产生的
ngx_http_core_loc_conf_t 结构体，在
10.2.3 节中曾经说过，它的
locations 成员将以双向链表的形式关联到所有当前
server{}块下的
location 块
*/
clcf = cscfp[s]-\>ctx-\>loc_conf[ngx_http_core_module.ctx_index]; /*调用
ngx_http_merge_locations 方法，将
server{}块与其所包含的
location{}块下的结构体进行合并
\*/
rv = ngx_http_merge_locations(cf, clcf-\>locations, cscfp[s]-\>ctx-\>loc_conf, module, ctx_index); }
}
}
ngx_http_merge_locations 方法负责合并 location 相关的配置项，上面已经将 main 级别与 srv
级别做过合并，接下来再次将 srv 级别与 loc 级别做合并。每个 server 块
ngx_http_core_loc_conf_t 中的 locations 双向链表会包含所属的全部 location 块，遍历它以合并
srv、loc 级别配置项，如下所示。

static char *
ngx_http_merge_locations(ngx_conf_t cf, ngx_queue_t locations, void \*\*loc_conf, ngx_http_module_t *module, ngx*uint_t ctx_index) {
char *rv;
ngx*queue_t *q;
ngx*http_conf_ctx_t *ctx, saved;
ngx*http_core_loc_conf_t *clcf;
ngx*http_location_queue_t *lq;
/_如果
locations 链表为空，也就是说，当前
server 块下没有
location 块，则立刻返回
_/
if (locations == NULL) {
return NGX*CONF_OK;
}
ctx = (ngx_http_conf_ctx_t *) cf-\>ctx; saved = \_ctx;
// 遍历
locations 双向链表
for (q = ngx*queue_head(locations);
q != ngx_queue_sentinel(locations); q = ngx_queue_next(q))
{
lq = (ngx_http_location_queue_t *) q; /*在
10.2.3 节中曾经讲过，如果
location 后的匹配字符串不依靠
Nginx 自定义的通配符就可以完全匹配的话，则
exact 指向当前
location 对应的
ngx*http*core_loc_conf_t 结构体，否则使用
inclusive 指向该结构体，且
exact 的优先级高于
inclusive */
clcf = lq-\>exact lq-\>exact : lq-\>inclusive; /\_clcf-\>loc*conf 这个指针数组里保存着当前
location 下所有
HTTP 模块使用
create_loc_conf 方法生成的结构体的指针
*/
ctx-\>loc*conf = clcf-\>loc_conf; // 调用
merge_loc_conf 方法合并
srv、
loc 级别配置项
rv = module-\>merge_loc_conf(cf, loc_conf[ctx_index], clcf-\>loc_conf[ctx_index]); /*注意，因为
location{}中可以继续嵌套
location{}配置块，所以是可以继续合并的。在
10.1 节的例子中没有
location 嵌套，
10.2.3 节的例子是体现出嵌套关系的，可以对照着图
10-5 来理解
\_/
rv = ngx_http_merge_locations(cf, clcf-\>locations, clcf-\>loc_conf, module, ctx_index); }
\*ctx = saved;
return NGX_CONF_OK;
}
在针对每个 HTTP 模块循环调用 ngx_http_merge_servers 方法后，就可以完成所有的合并配
置项工作了。

10.3 监听端口的管理
监听端口属于 server 虚拟主机，它是由 server{}块下的 listen 配置项决定的。同时，它与
server{}块对应的 ngx_http_core_srv_conf_t 结构体密切相关，本节将介绍这两者间的关系，以
及监听端口的数据结构。

每监听一个 TCP 端口，都将使用一个独立的 ngx_http_conf_port_t 结构体来表示，如下所
示。

typedef struct {
// socket 地址家族
ngx_int_t family;
// 监听端口
in_port_t port;
// 监听的端口下对应着的所有
ngx_http_conf_addr_t 地址
ngx_array_t addrs;
} ngx_http_conf_port_t;
这个保存着监听端口的 ngx_http_conf_port_t 将由全局的 ngx_http_core_main_conf_t 结构体
保存。下面再来看一下 ports 容器，如下所示。

typedef struct {
// 存放着该
http{}配置块下监听的所有
ngx_http_conf_port_t 端口
ngx_array_t \*ports;
…
} ngx_http_core_main_conf_t;
在前面的代码中，ngx_http_conf_port_t 的 addrs 动态数组可能不太容易理解。可先回顾一
下 listen 配置项的语法，在 10.1 节的例子中，对同一个端口 8000，我们可以同时监听
127.0.0.1:8000、173.39.160.51:8000 这两个地址，当一台物理机器具备多个 IP 地址时这是很有
用的。具体到 HTTP 框架的实现上，Nginx 是使用 ngx_http_conf_addr_t 结构体来表示一个对应
着具体地址的监听端口的，因此，一个 ngx_http_conf_port_t 将会对应多个
ngx_http_conf_addr_t，而 ngx_http_conf_addr_t 就是以动态数组的形式保存在 addrs 成员中的。

下面再来看看 ngx_http_conf_addr_t 的定义，如下所示。

typedef struct {
// 监听套接字的各种属性
ngx*http_listen_opt_t opt;
/*以下
3 个散列表用于加速寻找到对应监听端口上的新连接，确定到底使用哪个
server{}虚拟主机下的配置来处理它。所以，散列表的值就是
ngx*http_core_srv_conf_t 结构体的地址
*/
// 完全匹配
server name 的散列表
ngx*hash_t hash;
// 通配符前置的散列表
ngx_hash_wildcard_t *wc*head;
// 通配符后置的散列表
ngx_hash_wildcard_t \_wc_tail;
if (NGX_PCRE)
// 下面的
regex 数组中元素的个数
ngx_uint_t nregex;
/\_regex 指向静态数组，其数组成员就是
ngx_http_server_name_t 结构体，表示正则表达式及其匹配的
server{}虚拟主机
*/
ngx_http_server_name_t *regex; #endif
// 该监听端口下对应的默认
server{}虚拟主机
ngx_http_core_srv_conf_t *default_server; // servers 动态数组中的成员将指向
ngx_http_core_srv_conf_t 结构体
ngx_array_t servers;
} ngx_http_conf_addr_t;
在上面的 servers 动态数组中，保存的数据类型是 ngx_http_core_srv_conf_t\*\*，简单来说，
就是由 servers 数组把监听的端口与 server{}虚拟主机关联起来了。图 10-9 展示了 10.1 节的例子
中监听端口与 server{}虚拟主机间在内存中的关系。

图 10-9 监听端口与 server{}虚拟主机间的关系
下面来解释一下图 10-9。整个 http{}块下共监听了 3 个端口，分别是 80、8000、8080，因
此，ngx_http_core_main_conf_t 中的 ports 动态数组有 3 个 ngx_http_conf_port_t 成员存放这 3 个端
口。除了 8000 端口对应了两个 ngx_http_conf_addr_t 结构体外（分别是 127.0.0.1:8000 和
173.39.160.51:8000），80 和 8080 都相当于默认监听了该端口下的所有地址（实际上，listen
80 就相当于 listen*.80），因此，这两个端口各自对应了一个 ngx_http_conf_addr_t 结构体。每
个监听地址 ngx_http_conf_addr_t 的 servers 动态数组中关联着监听地址对应的 server{}虚拟主
机，根据 10.1 节的例子可以知道，server A 配置块对应着监听地址*.80 和 127.0.0.1:8000，而
server B 配置块对应着监听地址*.80、*.8080 和 173.39.160.51:8000。

对于每一个监听地址 ngx_http_conf_addr_t，都会有 8.3.1 节中介绍过的 ngx_listening_t 与其
相对应，而 ngx_listening_t 的 handler 回调方法设置为 ngx_http_init_connection，所以，新的 TCP
连接成功建立后都会调用 ngx_http_init_connection 方法初始化 HTTP 相关的信息，第 11 章将会
详细介绍 ngx_http_init_connection 方法的实现。

10.4 server 的快速检索
在 10.2.2 节中可以看到，每一个虚拟主机 server{}配置块都由一个
ngx_http_core_srv_conf_t 结构体来标识，这些 ngx_http_core_srv_conf_t 又是通过全局的
ngx_http_core_main_conf_t 结构中的 servers 动态数组关联起来的。这意味着当开始处理一个
HTTP 新连接时，接收到 HTTP 头部并取到 Host 后，需要遍历 ngx_http_core_main_conf_t 的
servers 数组才能找到与 server name 配置项匹配的虚拟主机配置块，这样的时间复杂度显然是
不可接受的，因为当 nginx.conf 配置文件中拥有数以百计的 server{}块时，查询效率就太低
了。于是，HTTP 框架使用了第 7 章中介绍过的散列表来存放虚拟主机，其中每个元素的关键
字是 server name 字符串，而值则是 ngx_http_core_srv_conf_t 结构体的指针。

在 10.3 节中介绍过，负责监听一个端口地址的 ngx_http_conf_addr_t 结构体拥有下面 3 个成
员：hash、wc_head、wc_tail，这 3 个成员对应着 7.7.3 节中介绍过的带通配符的散列表。这个
带通配符的散列表的使用方法（包括如何构造、检索）在 7.7 节中已详细描述过，这里不再
赘述。

10.5 location 的快速检索
从 10.2.3 节中可以了解到，每一个 server 块可以对应着多个 location 块，而一个 location 块
还可以继续嵌套多个 location 块。每一批 location 块是通过双向链表与它的父配置块（要么属
于 server 块，要么属于 location 块）关联起来的。由双向链表的查询效率可以知道，当一个请
求根据 10.4 节中描述过的散列表快速查询到 server 块时，必须遍历其下的所有 location 组成的
双向链表才能找到与其 URI 匹配的 location 配置块，这也是用户无法接受的。下面看看 HTTP
框架又是怎样通过静态的二叉查找树来保存 location 的。

// cmcf 就是该
http 块下全局的
ngx*http_core_main_conf_t 结构体
cmcf = ctx-\>main_conf[ngx_http_core_module.ctx_index]; /\_cscfp 指向保存所有
ngx_http_core_srv_conf_t 结构体指针的
servers 动态数组的第
1 个元素
*/
cscfp = cmcf-\>servers.elts;
// 遍历
http 块下的所有
server 块
for (s = 0; s \< cmcf-\>servers.nelts; s++) {
/_clcf 是
server 块下的
ngx_http_core_loc_conf_t 结构体，
10.2.3 节曾经介绍过它的
locations 成员以双向链表关联着隶属于这个
server 块的所有
location 块对应的
ngx_http_core_loc_conf_t 结构体
_/
clcf = cscfp[s]-\>ctx-\>loc*conf[ngx_http_core_module.ctx_index]; /*将
ngx*http_core_loc_conf_t 组成的双向链表按照
location 匹配字符串进行排序。注意：这个操作是递归进行的，如果某个
location 块下还具有其他
location，那么它的
locations 链表也会被排序
*/
if (ngx*http_init_locations(cf, cscfp[s], clcf) != NGX_OK) {
return NGX_CONF_ERROR;
}
/*根据已经按照
location 字符串排序过的双向链表，快速地构建静态的二叉查找树。与
ngx*http_init_locations 方法类似，这个操作也是递归进行的
*/
if (ngx_http_init_static_location_trees(cf, clcf) != NGX_OK) {
return NGX_CONF_ERROR;
}
}
注意，这里的二叉查找树并不是第 7 章中介绍过的红黑树，不过，为什么不使用红黑树
呢？因为 location 是由 nginx.conf 中读取到的，它是静态不变的，不存在运行过程中在树中添
加或者删除 location 的场景，而且红黑树的查询效率也没有重新构造的静态的完全平衡二叉
树高。

这棵静态的二叉平衡查找树是用 ngx_http_location_tree_node_t 结构体来表示的，如下所
示。

typedef struct ngx*http_location_tree_node_s ngx_http_location_tree_node_t; struct ngx_http_location_tree_node_s {
// 左子树
ngx_http_location_tree_node_t *left; // 右子树
ngx*http_location_tree_node_t *right; // 无法完全匹配的
location 组成的树
ngx_http_location_tree_node_t *tree; /*如果
location 对应的
URI 匹配字符串属于能够完全匹配的类型，则
exact 指向其对应的
ngx*http_core_loc_conf_t 结构体，否则为
NULL 空指针
*/
ngx_http_core_loc_conf_t *exact;
/*如果
location 对应的
URI 匹配字符串属于无法完全匹配的类型，则
inclusive 指向其对应的
ngx*http_core_loc_conf_t 结构体，否则为
NULL 空指针
*/
ngx_http_core_loc_conf_t \*inclusive; // 自动重定向标志
u_char auto_redirect;
// name 字符串的实际长度
u_char len;
// name 指向
location 对应的
URI 匹配表达式
u_char name[1];
};
HTTP 框架在 ngx_http_core_module 模块中定义了 ngx_http_core_find_location 方法，用于从
静态二叉查找树中快速检索到 ngx_http_core_loc_conf_t 结构体，这在第 11 章探讨 HTTP 请求的
处理过程时将会碰到。

10.6 HTTP 请求的 11 个处理阶段
Nginx 为什么要把 HTTP 请求的处理过程分为多个阶段呢？这要从第 8 章介绍过的“一切皆
模块”说起。Nginx 的模块化设计使得每一个 HTTP 模块可以仅专注于完成一个独立的、简单
的功能，而一个请求的完整处理过程可以由无数个 HTTP 模块共同合作完成。这种设计有非
常好的简单性、可测试性、可扩展性，然而，当多个 HTTP 模块流水式地处理同一个请求
时，单一的处理顺序是无法满足灵活性需求的，每一个正在处理请求的 HTTP 模块很难灵
活、有效地指定下一个 HTTP 处理模块是哪一个。而且，不划分处理阶段也会让 HTTP 请求的
完整处理流程难以管理，每一个 HTTP 模块也很难正确地将自己插入到完整流程中的合适位
置中。

因此，HTTP 框架依据常见的处理流程将处理阶段划分为 11 个阶段，其中每个处理阶段
都可以由任意多个 HTTP 模块流水式地处理请求。先来回顾一下第 3 章中曾经提到过的
ngx_http_phases 阶段的定义，如下所示。

typedef enum {
// 在接收到完整的
HTTP 头部后处理的
HTTP 阶段
NGX*HTTP_POST_READ_PHASE = 0,
/*在将请求的
URI 与
location 表达式匹配前，修改请求的
URI（所谓的重定向）是一个独立的
HTTP 阶段
*/
NGX_HTTP_SERVER_REWRITE_PHASE,
/*根据请求的
URI 寻找匹配的
location 表达式，这个阶段只能由
ngx*http_core_module 模块实现，不建议其他
HTTP 模块重新定义这一阶段的行为
*/
NGX*HTTP_FIND_CONFIG_PHASE,
/*在
NGX*HTTP_FIND_CONFIG_PHASE 阶段寻找到匹配的
location 之后再修改请求的
URI*/
NGX*HTTP_REWRITE_PHASE,
/*这一阶段是用于在
rewrite 重写
URL 后，防止错误的
nginx.conf 配置导致死循环（递归地修改
URI），因此，这一阶段仅由
ngx*http_core_module 模块处理。目前，控制死循环的方式很简单，首先检查
rewrite 的次数，如果一个请求超过
10 次重定向
,就认为进入了
rewrite 死循环，这时在
NGX_HTTP_POST_REWRITE_PHASE 阶段就会向用户返回
500，表示服务器内部错误
*/
NGX*HTTP_POST_REWRITE_PHASE,
/*表示在处理
NGX*HTTP_ACCESS_PHASE 阶段决定请求的访问权限前，
HTTP 模块可以介入的处理阶段
*/
NGX*HTTP_PREACCESS_PHASE,
// 这个阶段用于让
HTTP 模块判断是否允许这个请求访问
Nginx 服务器
NGX_HTTP_ACCESS_PHASE,
/*在
NGX*HTTP_ACCESS_PHASE 阶段中，当
HTTP 模块的
handler 处理函数返回不允许访问的错误码时（实际就是
NGX_HTTP_FORBIDDEN 或者
NGX_HTTP_UNAUTHORIZED），这里将负责向用户发送拒绝服务的错误响应。因此，这个阶段实际上用于给
NGX_HTTP_ACCESS_PHASE 阶段收尾
*/
NGX*HTTP_POST_ACCESS_PHASE,
/*这个阶段完全是为
try*files 配置项而设立的，当
HTTP 请求访问静态文件资源时，
try_files 配置项可以使这个请求顺序地访问多个静态文件资源，如果某一次访问失败，则继续访问
try_files 中指定的下一个静态资源。这个功能完全是在
NGX_HTTP_TRY_FILES_PHASE 阶段中实现的
*/
NGX*HTTP_TRY_FILES_PHASE,
// 用于处理
HTTP 请求内容的阶段，这是大部分
HTTP 模块最愿意介入的阶段
NGX_HTTP_CONTENT_PHASE,
/*处理完请求后记录日志的阶段。例如，
ngx*http_log_module 模块就在这个阶段中加入了一个
handler 处理方法，使得每个
HTTP 请求处理完毕后会记录
access_log 访问日志
*/
NGX_HTTP_LOG_PHASE
} ngx_http_phases;
对于这 11 个处理阶段，有些阶段是必备的，有些阶段是可选的，当然也可以有多个
HTTP 模块同时介入同一阶段（这时，将会在一个阶段中按照这些 HTTP 模块的 ctx_index 顺序
来依次执行它们提供的 handler 处理方法）。在 10.6.1 节中将会介绍这 11 个阶段共同适用的规
则，在 10.6.2 节~10.6.12 节则会描述这些具体的处理阶段。

注意 ngx_http_phases 定义的 11 个阶段是有顺序的，必须按照其定义的顺序执行。同
时也要意识到，并不是说一个用户请求最多只能经过 11 个 HTTP 模块提供的
ngx_http_handler_pt 方法来处理，NGX_HTTP_POST_READ_PHASE、
NGX_HTTP_SERVER_REWRITE_PHASE、NGX_HTTP_REWRITE_PHASE、
NGX_HTTP_PREACCESS_PHASE、NGX_HTTP_ACCESS_PHASE、
NGX_HTTP_CONTENT_PHASE、NGX_HTTP_LOG_PHASE 这 7 个阶段可以包括任意多个处
理方法，它们是可以同时作用于同一个用户请求的。而
NGX_HTTP_FIND_CONFIG_PHASE、NGX_HTTP_POST_REWRITE_PHASE、
NGX_HTTP_POST_ACCESS_PHASE、NGX_HTTP_TRY_FILES_PHASE 这 4 个阶段则不允许
HTTP 模块加入自己的 ngx_http_handler_pt 方法处理用户请求，它们仅由 HTTP 框架实现。

10.6.1 HTTP 处理阶段的普适规则
下面先来看看 HTTP 阶段的定义，它包括 checker 检查方法和 handler 处理方法，如下所
示。

typedef struct ngx*http_phase_handler_s ngx_http_phase_handler_t; /*一个
HTTP 处理阶段中的
checker 检查方法，仅可以由
HTTP 框架实现，以此控制
HTTP 请求的处理流程
_/
typedef ngx_int_t (*ngx_http_phase_handler_pt) (ngx_http_request_t r, ngx_http_phase_handler_t ph); /*由
HTTP 模块实现的
handler 处理方法，这个方法在第
3 章中曾经用
ngx_http_mytest_handler 方法实现过
*/
typedef ngx_int_t (*ngx_http_handler_pt)(ngx_http_request_t *r); // 注意：
ngx_http_phase_handler_t 结构体仅表示处理阶段中的一个处理方法
struct ngx_http_phase_handler_s {
/*在处理到某一个
HTTP 阶段时，
HTTP 框架将会在
checker 方法已实现的前提下首先调用
checker 方法来处理请求，而不会直接调用任何阶段中的
handler 方法，只有在
checker 方法中才会去调用
handler 方法。因此，事实上所有的
checker 方法都是由框架中的
ngx_http_core_module 模块实现的，且普通的
HTTP 模块无法重定义
checker 方法
*/
ngx_http_phase_handler_pt checker;
/*除
ngx_http_core_module 模块以外的
HTTP 模块，只能通过定义
handler 方法才能介入某一个
HTTP 处理阶段以处理请求
_/
ngx*http_handler_pt handler;
// 将要执行的下一个
HTTP 处理阶段的序号
/* next 的设计使得处理阶段不必按顺序依次执行，既可以向后跳跃数个阶段继续执行，也可以跳跃到之前曾经执行过的某个阶段重新执行。通常，
next 表示下一个处理阶段中的第
1 个
ngx_http_phase_handler_t 处理方法
\*/
ngx_uint_t next;
};
注意通常，在任意一个 ngx_http_phases 阶段，都可以拥有零个或多个
ngx_http_phase_handler_t 结构体，其含义更接近于某个 HTTP 模块的处理方法。

一个 http{}块解析完毕后将会根据 nginx.conf 中的配置产生由 ngx_http_phase_handler_t 组成
的数组，在处理 HTTP 请求时，一般情况下这些阶段是顺序向后执行的，但
ngx_http_phase_handler_t 中的 next 成员使得它们也可以非顺序执行。ngx_http_phase_engine_t 结
构体就是所有 ngx_http_phase_handler_t 组成的数组，如下所示。

typedef struct {
/_handlers 是由
ngx_http_phase_handler_t 构成的数组首地址，它表示一个请求可能经历的所有
ngx_http_handler_pt 处理方法
_/
ngx_http_phase_handler_t *handlers;
/*表示
NGX_HTTP_SERVER_REWRITE_PHASE 阶段第
1 个
ngx_http_phase_handler_t 处理方法在
handlers 数组中的序号，用于在执行
HTTP 请求的任何阶段中快速跳转到
NGX_HTTP_SERVER_REWRITE_PHASE 阶段处理请求
*/
ngx_uint_t server_rewrite_index;
/*表示
NGX_HTTP_REWRITE_PHASE 阶段第
1 个
ngx_http_phase_handler_t 处理方法在
handlers 数组中的序号，用于在执行
HTTP 请求的任何阶段中快速跳转到
NGX_HTTP_REWRITE_PHASE 阶段处理请求
\*/
ngx_uint_t location_rewrite_index;
} ngx_http_phase_engine_t;
可以看到，ngx_http_phase_engine_t 中保存了在当前 nginx.conf 配置下，一个用户请求可能
经历的所有 ngx_http_handler_pt 处理方法，这是所有 HTTP 模块可以合作处理用户请求的关
键！这个 ngx_http_phase_engine_t 结构体是保存在全局的 ngx_http_core_main_conf_t 结构体中
的，如下所示。

typedef struct {
/_由下面各阶段处理方法构成的
phases 数组构建的阶段引擎才是流水式处理
HTTP 请求的实际数据结构
_/
ngx*http_phase_engine_t phase_engine;
/*用于在
HTTP 框架初始化时帮助各个
HTTP 模块在任意阶段中添加
HTTP 处理方法，它是一个有
11 个成员的
ngx*http_phase_t 数组，其中每一个
ngx_http_phase_t 结构体对应一个
HTTP 阶段。在
HTTP 框架初始化完毕后，运行过程中的
phases 数组是无用的
*/
ngx_http_phase_t phases[NGX_HTTP_LOG_PHASE + 1]; …
} ngx_http_core_main_conf_t;
在 ngx_http_core_main_conf_t 中关于 HTTP 阶段有两个成员：phase_engine 和 phases，其中
phase_engine 控制运行过程中一个 HTTP 请求所要经过的 HTTP 处理阶段，它将配合
ngx_http_request_t 结构体中的 phase_handler 成员使用（phase_handler 指定了当前请求应当执行
哪一个 HTTP 阶段）；而 phases 数组更像一个临时变量，它实际上仅会在 Nginx 启动过程中用
到，它的唯一使命是按照 11 个阶段的概念初始化 phase_engine 中的 handlers 数组。下面看一下
ngx_http_phase_t 的定义。

typedef struct {
// handlers 动态数组保存着每一个
HTTP 模块初始化时添加到当前阶段的处理方法
ngx_array_t handlers;
} ngx_http_phase_t;
在 HTTP 框架的初始化过程中，任何 HTTP 模块都可以在 ngx_http_module_t 接口的
postconfiguration 方法中将自定义的方法添加到 handler 动态数组中，这样，这个方法就会最终
添加到 phase_engine 中（注意，第 3 章中 mytest 模块并没有把 ngx_http_mytest_handler 方法加入到
phases 的 handlers 数组中，这是因为对于 NGX_HTTP_CONTENT_PHASE 阶段来说，还有另一
种初始化方法，在 10.6.11 节中我们会介绍）。在第 11 章中可以看到这些 HTTP 阶段是如何执
行的。

下面将会简要介绍这 11 个 HTTP 处理阶段，读者关注重点是每个阶段的 checker 方法都做
了些什么。

10.6.2 NGX_HTTP_POST_READ_PHASE 阶段
当 HTTP 框架在建立的 TCP 连接上接收到客户发送的完整 HTTP 请求头部时，开始执行
NGX_HTTP_POST_READ_PHASE 阶段的 checker 方法。下面先来看看它的 checker 方法
ngx_http_core_generic_phase，这是一个很典型的 checker 方法，下面就给出相关代码，以便读
者对 checker 方法的执行过程有个直观认识。

ngx*int_t ngx_http_core_generic_phase(ngx_http_request_t r, ngx_http_phase_handler_t ph) {
// 调用这一阶段中各
HTTP 模块添加的
handler 处理方法
ngx_int_t rc = ph-\>handler(r);
/*如果
handler 方法返回
NGX_OK，之后将进入下一个阶段处理，而不会理会当前阶段中是否还有其他的处理方法
*/
if (rc == NGX_OK) {
r-\>phase_handler = ph-\>next;
return NGX_AGAIN;
}
/*如果
handler 方法返回
NGX_DECLINED，那么将进入下一个处理方法，这个处理方法既可能属于当前阶段，也可能属于下一个阶段。注意返回
NGX_OK 与
NGX_DECLINED 之间的区别
*/
if (rc == NGX_DECLINED) {
r-\>phase_handler++;
return NGX_AGAIN;
}
/*如果
handler 方法返回
NGX_AGAIN 或者
NGX_DONE，那么当前请求将仍然停留在这一个处理阶段中
*/
if (rc == NGX_AGAIN || rc == NGX_DONE) {
return NGX_OK;
}
/\*如果
handler 方法返回
NGX_ERROR 或者类似
NGX_HTTP*开头的返回码，则调用
ngx*http_finalize* request 结束请求
\*/
ngx_http_finalize_request(r, rc);
return NGX_OK;
}
任意 HTTP 模块需要在 NGX_HTTP_POST_READ_PHASE 阶段处理 HTTP 请求时，必须首
先在 ngx_http_core_main_conf_t 结构体中的 phases[NGX_HTTP_POST_READ_PHASE]动态数组
中添加自己实现的 ngx_http_handler_pt 方法。在此阶段中，ngx_http_handler_pt 方法的返回值可
以产生 4 种不同的影响，总结见表 10-1。

表 10-1 NGX_HTTP_POST_READ_PHASE、NGX_HTTP_PREACCESS_PHASE、
NGX_HTTP_LOG_PHASE 阶段下 HTTP 模块的 ngx_http_handler_pt 方法返回值意义
目前，官方的 ngx_http_realip_module 模块是从 NGX_HTTP_POST_READ_PHASE 阶段介
入以处理 HTTP 请求的，它在 postconfiguration 方法中是这样将自定义的 ngx_http_handler_pt 处
理方法添加到 HTTP 框架中的，如下所示。

// 这个
ngx*http_realip_init 方法实际上就是
postconfiguration 接口的实现
static ngx_int_t ngx_http_realip_init(ngx_conf_t *cf) {
ngx*http_handler_pt *h;
// 首先获取到全局的
ngx*http_core_main_conf_t 结构体
ngx_http_core_main_conf_t \_cmcf = ngx_http_conf_get_module_main_conf( cf, ngx_http_core_module); /\_phases 数组中有
11 个成员，取出
NGX_HTTP_POST_READ_PHASE 阶段的
handlers 动态数组，向其中添加
ngx_http_handler_pt 处理方法，这样
ngx_http_realip_module 模块就介入
HTTP 请求的
NGX_HTTP_POST_READ_PHASE 处理阶段了
*/
h = ngx*array_push(&cmcf-\>phases[NGX_HTTP_POST_READ_PHASE].handlers); if (h == NULL) {
return NGX_ERROR;
}
/* ngx*http_realip_handler 方法就是实现了
ngx_http_handler_pt 接口的方法
*/
*h = ngx_http_realip_handler;
/*实际上，同一个
HTTP 模块的同一个
ngx*http_realip_handler 方法，完全可以设置到两个不同的阶段中的。例如，
phases[NGX_HTTP_PREACCESS_PHASE.handlers]动态数组中也添加了
ngx_http_realip_handler 方法
*/
h = ngx*array_push(&cmcf-\>phases[NGX_HTTP_PREACCESS_PHASE].handlers); if (h == NULL) {
return NGX_ERROR;
}
/\_ngx_http_realip_handler 处理方法同时介入了
NGX_HTTP_POST_READ_PHASE、
NGX_HTTP_PREACCESS_PHASE 这两个
HTTP 处理阶段
*/
\*h = ngx_http_realip_handler;
return NGX_OK;
}
通过这个例子可以看到怎样在 NGX_HTTP_POST_READ_PHASE 或者
NGX_HTTP_PREACCESS_PHASE 阶段添加 HTTP 模块。

10.6.3 NGX_HTTP_SERVER_REWRITE_PHASE 阶段
NGX_HTTP_SERVER_REWRITE_PHASE 阶段的 checker 方法是
ngx_http_core_rewrite_phase。表 10-2 总结了该阶段下 ngx_http_handler_pt 处理方法的返回值是
如何影响 HTTP 框架执行的，注意，这个阶段中不存在返回值可以使请求直接跳到下一个阶
段执行。

表 10-2 NGX_HTTP_SERVER_REWRITE_PHASE、NGX_HTTP_REWRITE_PHASE 阶段下
HTTP 模块的 ngx_http_handler_pt 方法返回值意义
官方提供的 ngx_http_rewrite_module 模块定义了 ngx_http_rewrite_handler 方法，同时将它
添加到了 NGX_HTTP_SERVER_REWRITE_PHASE 和 NGX_HTTP_REWRITE_PHASE 阶段，这
里就不再列举其代码了。

10.6.4 NGX_HTTP_FIND_CONFIG_PHASE 阶段
NGX_HTTP_FIND_CONFIG_PHASE 是一个关键阶段，这个阶段是不可以跳过的，也就
是说，在 ngx_http_phase_engine_t 中，处理方法组成的数组必然要有阶段的处理方法，因为这
是 HTTP 框架基于 location 设计的基石。

HTTP 框架提供了 ngx_http_core_find_config_phase 方法用于执行这一步骤，也就是说，任
何 HTTP 模块不可以向这一阶段中添加处理方法（添加了也是无效
的）!ngx_http_core_find_config_phase 方法实际上就是根据
NGX_HTTP_SERVER_REWRITE_PHASE 步骤重写后的 URI 检索出匹配的 location 块的，其原
理为从 location 组成的静态二叉查找树中快速检索，具体可参照 10.5 节。

10.6.5 NGX_HTTP_REWRITE_PHASE 阶段
NGX_HTTP_FIND_CONFIG_PHASE 阶段检索到 location 后有机会再次利用 rewrite（重
写）URL，这一工作就是在 NGX_HTTP_REWRITE_PHASE 阶段完成的。

NGX_HTTP_REWRITE_PHASE 阶段与 10.6.3 节中的
NGX_HTTP_SERVER_REWRITE_PHASE 阶段几乎是完全相同的，它们的 checker 方法都是
ngx_http_core_rewrite_phase，在这一阶段中，ngx_http_handler_pt 方法的返回值意义与表 10-2
也是完全相同的，不再赘述。

10.6.6 NGX_HTTP_POST_REWRITE_PHASE 阶段
NGX_HTTP_POST_REWRITE_PHASE 阶段就像 NGX_HTTP_FIND_CONFIG_PHASE 阶段
一样，只能由 HTTP 框架实现，不允许 HTTP 模块向该阶段添加 ngx_http_handler_pt 处理方法。

NGX_HTTP_POST_REWRITE_PHASE 阶段的 checker 方法是
ngx_http_core_post_rewrite_phase，它的意义在于检查 rewrite 重写 URL 的次数不可以超过 10
次，以此防止由于 rewrite 死循环而造成整个 Nginx 服务都不可用。

10.6.7 NGX_HTTP_PREACCESS_PHASE 阶段
NGX_HTTP_PREACCESS_PHASE 阶段一般用于对当前请求进行限制性处理，它的
checker 方法与 10.6.1 节中详细描述过的 ngx_http_core_generic_phase 方法一样，因此，在这一
阶段中执行的 ngx_http_handler_pt 处理方法，其返回值意义也与表 10-1 是完全相同的，不再赘
述。

10.6.8 NGX_HTTP_ACCESS_PHASE 阶段
NGX_HTTP_ACCESS_PHASE 阶段与 NGX_HTTP_PREACCESS_PHASE 阶段大不相同，
这主要体现在它的 checker 方法是 ngx_http_core_access_phase 上，这也就致使在
NGX_HTTP_ACCESS_PHASE 阶段 ngx_http_handler_pt 处理方法的返回值有了新的意义，见表
10-3。

表 10-3 NGX_HTTP_ACCESS_PHASE 阶段下 HTTP 模块的 ngx_http_handler_pt 方法返回值意
义
从表 10-3 中可以看出，NGX_HTTP_ACCESS_PHASE 阶段实际上与 nginx.conf 配置文件中
的 satisfy 配置项有紧密的联系，所以，任何介入 NGX_HTTP_ACCESS_PHASE 阶段的 HTTP 模
块，在实现 ngx_http_handler_pt 方法时都需要注意 satisfy 的参数，该参数可以由
ngx_http_core_loc_conf_t 结构体中得到。

typedef struct ngx_http_core_loc_conf_s ngx_http_core_loc_conf_t; struct ngx_http_core_loc_conf_s {
// 仅可以取值为
NGX_HTTP_SATISFY_ALL 或者
NGX_HTTP_SATISFY_ANY
ngx_uint_t satisfy;
…
};
如果不根据所在 location 中的 satisfy 参数来决定返回值，那么可能造成未知结果。

10.6.9 NGX_HTTP_POST_ACCESS_PHASE 阶段
NGX_HTTP_POST_ACCESS_PHASE 阶段又是一个只能由 HTTP 框架实现的阶段，不允
许 HTTP 模块向该阶段添加 ngx_http_handler_pt 处理方法。这个阶段完全是为之前的
NGX_HTTP_ACCESS_PHASE 阶段服务的，换句话说，如果没有任何 HTTP 模块介入
NGX_HTTP_ACCESS_PHASE 阶段处理请求，NGX_HTTP_POST_ACCESS_PHASE 阶段就不
会存在。

NGX_HTTP_POST_ACCESS_PHASE 阶段的 checker 方法是
ngx_http_core_post_access_phase，它的工作非常简单，就是检查 ngx_http_request_t 请求中的
access_code 成员，当其不为 0 时就结束请求（表示没有访问权限），否则继续执行下一个
ngx_http_handler_pt 处理方法。

10.6.10 NGX_HTTP_TRY_FILES_PHASE 阶段
NGX_HTTP_TRY_FILES_PHASE 阶段也是一个只能由 HTTP 框架实现的阶段，不允许
HTTP 模块向该阶段添加 ngx_http_handler_pt 处理方法。

NGX_HTTP_TRY_FILES_PHASE 阶段的 checker 方法是 ngx_http_core_try_files_phase，它
是与 nginx.conf 中的 try_files 配置项密切相关的，如果 try_files 后指定的静态文件资源中有一个
可以访问，这时就会直接读取文件并发送响应给用户，不会再向下执行后续的阶段；如果所
有的静态文件资源都无法执行，将会继续执行 ngx_http_phase_engine_t 中的下一个
ngx_http_handler_pt 处理方法。

10.6.11 NGX_HTTP_CONTENT_PHASE 阶段
这是一个核心 HTTP 阶段，可以说大部分 HTTP 模块都会在此阶段重新定义 Nginx 服务器
的行为，如第 3 章中提到的 mytest 模块。NGX_HTTP_CONTENT_PHASE 阶段之所以被众多
HTTP 模块“钟爱”，主要基于以下两个原因：
其一，以上 9 个阶段主要专注于 4 件基础性工作：rewrite 重写 URL、找到 location 配置块、
判断请求是否具备访问权限、try_files 功能优先读取静态资源文件，这 4 个工作通常适用于绝
大部分请求，因此，许多 HTTP 模块希望可以共享这 9 个阶段中已经完成的功能。

其二，NGX_HTTP_CONTENT_PHASE 阶段与其他阶段都不相同的是，它向 HTTP 模块提
供了两种介入该阶段的方式：第一种与其他 10 个阶段一样，通过向全局的
ngx_http_core_main_conf_t 结构体的 phases 数组中添加 ngx_http_handler_pt 处理方法来实现，而
第二种是本阶段独有的，把希望处理请求的 ngx_http_handler_pt 方法设置到 location 相关的
ngx_http_core_loc_conf_t 结构体的 handler 指针中，这正是第 3 章中 mytest 例子的用法。

上面所说的第一种方式，也是 HTTP 模块介入其他 10 个阶段的唯一方式，是通过在必定
会被调用的 postconfiguration 方法向全局的 ngx_http_core_main_conf_t 结构体的
phases[NGX_HTTP_CONTENT_PHASE]动态数组添加 ngx_http_handler_pt 处理方法来达成的，
这个处理方法将会应用于全部的 HTTP 请求。

而第二种方式是通过设置 ngx_http_core_loc_conf_t 结构体的 handler 指针来实现的，在
10.2.3 节中我们已经知道，每一个 location 都对应着一个独立的 ngx_http_core_loc_conf_t 结构
体。这样，我们就不必在必定会被调用的 postconfiguration 方法中添加 ngx_http_handler_pt 处理
方法了，而可以选择在 ngx_command_t 的某个配置项（如第 3 章中的 mytest 配置项）的回调方
法中添加处理方法，将当前 location 块所属的 ngx_http_core_loc_conf_t 结构体中的 handler 设置
为 ngx_http_handler_pt 处理方法。这样做的好处是，ngx_http_handler_pt 处理方法不再应用于所
有的 HTTP 请求，仅仅当用户请求的 URI 匹配了 location 时（也就是 mytest 配置项所在的
location）才会被调用。这也就意味着它是一种完全不同于其他阶段的使用方式。

因此，当 HTTP 模块实现了某个 ngx_http_handler_pt 处理方法并希望介入
NGX_HTTP_CONTENT_PHASE 阶段来处理用户请求时，如果希望这个 ngx_http_handler_pt 方
法应用于所有的用户请求，则应该在 ngx_http_module_t 接口的 postconfiguration 方法中，向
ngx_http_core_main_conf_t 结构体的 phases[NGX_HTTP_CONTENT_PHASE]动态数组中添加
ngx_http_handler_pt 处理方法；反之，如果希望这个方式仅应用于 URI 匹配了某些 location 的用
户请求，则应该在一个 location 下配置项的回调方法中，把 ngx_http_handler_pt 方法设置到
ngx_http_core_loc_conf_t 结构体的 handler 中。

注意 ngx_http_core_loc_conf_t 结构体中仅有一个 handler 指针，它不是数组，这也就
意味着如果采用上述的第二种方法添加 ngx_http_handler_pt 处理方法，那么每个请求在
NGX_HTTP_CONTENT_PHASE 阶段只能有一个 ngx_http_handler_pt 处理方法。而使用第一
种方法时是没有这个限制的，NGX_HTTP_CONTENT_PHASE 阶段可以经由任意个 HTTP 模
块处理。

当同时使用这两种方式设置 ngx_http_handler_pt 处理方法时，只有第二种方式设置的
ngx_http_handler_pt 处理方法才会生效，也就是设置 handler 指针的方式优先级更高，而第一种
方式设置的 ngx_http_handler_pt 处理方法将不会生效。如果一个 location 配置块内有多个 HTTP
模块的配置项在解析过程都试图按照第二种方式设置 ngx_http_handler_pt 处理方法，那么后
面的配置项将有可能覆盖前面的配置项解析时对 handler 指针的设置。

NGX_HTTP_CONTENT_PHASE 阶段的 checker 方法是 ngx_http_core_content_phase。

ngx_http_handler_pt 处理方法的返回值在以上两种方式下具备了不同意义。

在第一种方式下，ngx_http_handler_pt 处理方法无论返回任何值，都会直接调用
ngx_http_finalize_request 方法结束请求。当然，ngx_http_finalize_request 方法根据返回值的不
同未必会直接结束请求，这在第 11 章中会详细介绍。

在第二种方式下，如果 ngx_http_handler_pt 处理方法返回 NGX_DECLINED，将按顺序向
后执行下一个 ngx_http_handler_pt 处理方法；如果返回其他值，则调用 ngx_http_finalize_request
方法结束请求。

10.6.12 NGX_HTTP_LOG_PHASE 阶段
NGX_HTTP_LOG_PHASE 阶段是 11 个 HTTP 处理阶段中的最后一个，顾名思义，它是用
来记录日志的，如 ngx_http_log_module 模块就是在这一阶段中记录 Nginx 访问日志的。如果希
望在请求的最后阶段做一些共性的收尾工作，不妨将 ngx_http_handler_pt 处理方法添加到这一
阶段中。

NGX_HTTP_LOG_PHASE 阶段的 checker 方法同样是 ngx_http_core_generic_phase，因此，
在这一阶段中，ngx_http_handler_pt 处理方法的返回值意义与表 10-1 是完全相同的。

10.7 HTTP 框架的初始化流程
本节将综合 10.1 节~10.6 节的内容，完整地介绍 HTTP 框架的初始化过程。实际上，这个
初始化过程就在 ngx_http_module 模块中，当配置文件中出现了 http{}配置块时就回调
ngx_http_block 方法，而这个方法就包括了 HTTP 框架的完整初始化流程，如图 10-10 所示。

下面分别介绍图 10-10 中的 15 个步骤。

1）按照在 ngx_modules 数组中的顺序，由 0 开始依次递增地设置所有 HTTP 模块的
ctx_index 字段。这个字段的值将决定 HTTP 模块应用于请求时的顺序。

2）第 2 步~第 7 步实际上就是 10.2.1 节中描述的内容。解析到 http{}块时产生 1 个
ngx_http_conf_ctx_t 结构体，同时初始化它的 main_conf、srv_conf、loc_conf 3 个指针数组，数
组的容量就是第 1 步中获取到的所有 HTTP 模块的数量。

3）依次调用所有 HTTP 模块的 create_main_conf 方法，产生的配置结构体指针将按照各模
块 ctx_index 字段指定的顺序放入 ngx_http_conf_ctx_t 结构体的 main_conf 数组中。

4）依次调用所有 HTTP 模块的 create_srv_conf 方法，产生的配置结构体指针将按照各模
块 ctx_index 字段指定的顺序放入 ngx_http_conf_ctx_t 结构体的 srv_conf 数组中。

5）依次调用所有 HTTP 模块的 create_loc_conf 方法，产生的配置结构体指针将按照各模
块 ctx_index 字段指定的顺序放入 ngx_http_conf_ctx_t 结构体的 loc_conf 数组中。

6）依次调用所有 HTTP 模块的 preconfiguration 方法。

7）解析 http{}块下的 main 级别配置项。

8）依次调用所有 HTTP 模块的 init_main_conf 方法。

图 10-10 HTTP 框架的初始化流程
注意在解析 main 级别配置项时，如果遇到 server{}配置块，将会触发
ngx_http_core_server 方法，并开始解析 server 级别下的配置项，这一过程可参见 10.2.2 节。在解
析 srv 级别配置项时，如果遇到 location{}配置块，将会触发 ngx_http_core_location 方法，并开
始解析 location 级别下的配置项，这一过程可参见 10.2.3 节。

9）调用 ngx_http_merge_servers 方法合并配置项，这一步骤的内容与 10.2.4 节介绍的多级
别配置项合并是一致的。

10）按照 10.5 节介绍的方式，创建由 location 块构造的静态二叉平衡查找树。

11）在 10.6 节中我们介绍过，有 7 个 HTTP 阶段（NGX_HTTP_POST_READ_PHASE、
NGX_HTTP_SERVER_REWRITE_PHASE、NGX_HTTP_REWRITE_PHASE、
NGX_HTTP_PREACCESS_PHASE、NGX_HTTP_ACCESS_PHASE、
NGX_HTTP_CONTENT_PHASE、NGX_HTTP_LOG_PHASE）是允许任何一个 HTTP 模块实
现自己的 ngx_http_handler_pt 处理方法，并将其加入到这 7 个阶段中去的。在调用 HTTP 模块的
postconfiguration 方法向这 7 个阶段中添加处理方法前，需要先将 phases 数组中这 7 个阶段里的
handlers 动态数组初始化（ngx_array_t 类型需要执行 ngx_array_init 方法初始化），在这一步骤
中，通过调用 ngx_http_init_phases 方法来初始化这 7 个动态数组。

12）依次调用所有 HTTP 模块的 postconfiguration 方法。HTTP 模块可以在这一步骤中将自
己的 ngx_http_handler_pt 处理方法添加到以上 7 个 HTTP 阶段中。

13）在上一步中，各 HTTP 模块会向全局的 ngx_http_core_main_conf_t 结构体中的 phases 数
组添加处理方法，该数组中存在 11 个成员，每个成员都是动态数组，可能包含任何数量的处
理方法。这一步骤将遍历以上所有处理方法，构造由所有处理方法构成的有序的
phase_engine.handlers 数组。关于 HTTP 阶段的用法可参见 10.6 节。

14）这一步骤构造 server 虚拟主机构成的支持通配符的散列表，可参见 10.4 节的内容。

15）这一步骤构造监听端口与 server 间的关联关系，设置新连接事件的回调方法为
ngx_http_init_connection，可参见 10.3 节。

以上 15 个步骤就是 HTTP 框架在 Nginx 的启动过程中所做的主要工作。

10.8 小结
本章介绍了静态的 HTTP 框架，主要讨论了 http 配置项的管理与合并操作，以及 HTTP 框
架怎样设计 server 和 location 的数据结构以期快速选择 server 和 location 处理用户请求，监听地
址是如何与 server 关联起来的，同时介绍了 HTTP 的 11 个处理阶段及其设计原理和使用方法。

通过了解这些内容，读者可以从 HTTP 框架的角度了解 HTTP 模块的运行机制。另外，本章扩
展了第 3 章中介绍的单一的 HTTP 模块设计方法，特别是根据 10.6 节介绍的内容，可以设计出
更加强大的 HTTP 模块，深入地介入到任何一个 HTTP 处理阶段中。

本章并没有涉及 HTTP 框架是如何处理用户请求的，HTTP 框架的动态处理流程将在第 11
章中介绍。
