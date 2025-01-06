---
outline: [2, 3]
---

# 第 12 章 upstream 机制的设计与实现

[第 5 章]中曾经举例说明过 upstream 机制的一种基础用法，本章将讨论 upstream 机制的设计和实现，以此帮助读者全面了解如何使用 upstream 访问上游服务器。upstream 机制是事件驱动框架与 HTTP 框架的综合，它既属于 HTTP 框架的一部分，又可以处理所有基于 TCP 的应用层协议（不限于 HTTP）。它不仅没有任何阻塞地实现了 Nginx 与上游服务器的交互，同时又很好地解决了**一个请求、多个 TCP 连接、多个读/写事件间的复杂关系**。为了帮助 Nginx 实现反向代理功能，upstream 机制除了提供基本的与上游交互的功能之外，还实现了转发上游应用层协议的响应包体到下游客户端的功能（与下游之间当然还是使用 HTTP）。在这些过程中，upstream 机制使用内存时极其“节省”，特别是在转发响应包体时，它从不会把一份上游的协议包复制多份。考虑到上下游间网速的不对称，upstream 机制还提供了以大内存和磁盘文件来缓存上游响应的功能。

因此，拥有高性能、高效率以及高度灵活性的 upstream 机制值得我们花费精力去了解它的设计、实现，这样才能更好地使用它。同时，通过学习它的设计思想，也可以深入了解配合应用层业务基于第 9 章的事件框架开发 Nginx 模块的方法。

由于 upstream 机制较为复杂，同时在第 11 章“HTTP 框架”中我们已经非常熟悉如何使用事件驱动架构了，所以本章将不会纠结于事件驱动架构的细节、分支，而是专注于 upstream 机制的主要流程。也就是说，本章将会略过处理 upstream 的过程中超时、连接关闭、失败后重新执行等非核心事件，仅聚焦于正常的处理过程（在由源代码对应的流程图中，就是会把许多执行失败的分支略过，对于这些错误分支的执行情况，读者可以通过阅读 ngx_http_upstream 源代码来了解）。虽然 upstream 机制也包含了部分文件缓存功能的代码，但限于篇幅，本章将不介绍文件缓存，这部分内容也会直接略过。经过这样处理，读者就可以清晰、直观地看到 upstream 到底是如何工作的了，如果还需要了解细节，那么可以由主要流程附近的相关代码查询到各种分支的处理方式。

Nginx 访问上游服务器的流程大致可以分为以下 6 个阶段：启动 upstream 机制、连接上游服务器、向上游服务器发送请求、接收上游服务器的响应包头、处理接收到的响应包体、结束请求。本章首先在 12.1 节系统地讨论 upstream 机制的设计目的，以及为了实现这些目的需要用到的数据结构，之后会按照顺序介绍上述 6 个阶段。

## 12.1 upstream 机制概述

本节将说明 upstream 机制的设计目的，包括它能够解决哪几类问题。接下来就会介绍一个关键结构体 ngx_http_upstream_t 以及它的 conf 成员（ngx_http_upstream_conf_t 结构体），事实上这两个结构体中的各个成员意义有些混淆不清，有些仅用于 upstream 框架使用，有些却是希望使用 upstream 的 HTTP 模块来设置的，这也是 C 语言编程的弊端。因此，如果希望直接编写使用 upstream 机制的复杂模块，可以采取顺序阅读的方式；如果希望更多地了解 upstream 的工作流程，则不妨先跳过对这两个结构体的详细说明，继续向下了解 upstream 流程，在流程的每个阶段中都会使用到这两个结构体中的成员，到时可以再返回查询每个成员的意义，这样会更有效率。

### 12.1.1 设计目的

那么，到底什么是 upstream 机制？它的设计目的有哪些？先来看看图 12-1。

（1）上游和下游

图 12-1 中出现了上游和下游的概念，这是从 Nginx 视角上得出的名词，怎么理解呢？我们不妨把它看成一条产业链，Nginx 是其中的一环，离消费者近的环节属于下游，离消费者远的环节属于上游。Nginx 的客户端可以是一个浏览器，或者是一个应用程序，又或者是一个服务器，对于 Nginx 来说，它们都属于“下游”，Nginx 为了实现“下游”所需要的功能，很多时候是从“上游”的服务器获取一些原材料的（如数据库中的用户信息等）。图 12-1 中的两个英文单词，upstream 表示上游，而 downstream 表示下游。因此，所谓的 upstream 机制就是用来使 HTTP 模块在处理客户端请求时可以访问“上游”的后端服务器。

图 12-1 upstream 机制的场景示意图

（2）上游服务器提供的协议

Nginx 不仅仅可以用做 Web 服务器。upstream 机制其实是由 ngx_http_upstream_module 模块实现的，它是一个 HTTP 模块，使用 upstream 机制时客户端的请求必须基于 HTTP。

既然 upstream 是用于访问“上游”服务器的，那么，Nginx 需要访问什么类型的“上游”服务器呢？是 Apache、Tomcat 这样的 Web 服务器，还是 memcached、cassandra 这样的 Key-Value 存储系统，又或是 mongoDB、MySQL 这样的数据库？这就涉及 upstream 机制的范围了。其实非常明显，回顾一下第 9 章中系统介绍过的主要用于处理 TCP 的事件驱动架构，基于事件驱动架构的 upstream 机制所要访问的就是所有支持 TCP 的上游服务器。因此，既有 ngx_http_proxy_module 模块基于 upstream 机制实现了 HTTP 的反向代理功能，也有类似 ngx_http_memcached_module 的模块基于 upstream 机制使得请求可以访问 memcached 服务器。

（3）每个客户端请求实际上可以向多个上游服务器发起请求

在图 12-1 中，似乎一个客户端请求只能访问一个上游服务器，事实上并不是这样，否则 Nginx 的功能就太弱了。对于每个 ngx_http_request_t 请求来说，只能访问一个上游服务器，但对于一个客户端请求来说，可以派生出许多子请求，任何一个子请求都可以访问一个上游服务器，这些子请求的结果组合起来就可以使来自客户端的请求处理复杂的业务。

可为什么每个 ngx_http_request_t 请求只能访问一个上游服务器？这是由于 upstream 机制还有更复杂的目的。以反向代理功能为例，upstream 机制需要把上游服务器的响应全部转发给客户端，那么如果响应的长度特别大怎么办？例如，用户下载一个 5GB 的视频文件，upstream 机制肯定不能够在 Nginx 接收了完整的响应后，再把它转发给客户端，这样效率太差了。因此，upstream 机制不只提供了直接处理上游服务器响应的功能，还具有将来自上游服务器的响应即时转发给下游客户端的功能。因为有了这个独特的需求，每个 ngx_http_request_t 结构体只能用来访问一个上游服务器，大大简化了设计。

（4）反向代理与转发上游服务器的响应

转发响应时同样有两个需要解决的问题。

1）下游协议是 HTTP，而上游协议可以是基于 TCP 的任何协议，这需要有一个适配的过程。所以，upstream 机制会将上游的响应划分为包头、包体两部分，包头部分必须由 HTTP 模块实现的 process_header 方法解析、处理，包体则由 upstream 不做修改地进行转发。

2）上、下游的网速可能差别非常大，通常在产品环境中，Nginx 与上游服务器之间是内网，网速会很快，而 Nginx 与下游的客户端之间则是公网，网速可能非常慢。对于这种情况，将会有以下两种解决方案：

-   当上、下游网速差距不大，或者下游速度更快时，出于能够并发更多请求的考虑，必然希望**内存可以使用得少一些**，这时将会开辟一块固定大小的内存（由 ngx_http_upstream_conf_t 中的 buffer_size 指定大小），既用它来接收上游的响应，也用它来把保存的响应内容转发给下游。这样做也是有缺点的，当下游速度过慢而导致这块充当缓冲区的内存写满时，将无法再接收上游的响应，必须等待缓冲区中的内容全部发送给下游后才能继续接收。

-   当上游网速远快于下游网速时，就必须要开辟足够的内存缓冲区来缓存上游响应（ngx_http_upstream_conf_t 中的 bufs 指定了每块内存缓冲区的大小，以及最多可以有多少块内存缓冲区），当达到内存使用上限时还会把上游响应缓存到磁盘文件中（当然，磁盘文件也是有大小限制的，ngx_http_upstream_conf_t 中的 max_temp_file_size 指定了临时缓存文件的最大长度），虽然内存和磁盘的缓冲都满后，仍然会发生暂时无法接收上游响应的场景，但这种概率就小得多了，特别是临时文件的上限设置得较大时。

转发响应时一个比较难以解决的问题是 Nginx 对内存使用得太“节省”，即从来不会把接收到的上游响应缓冲区复制为两份。这就带来了一个问题，当同一块缓冲区既用于接收上游响应，又用于向下游发送响应，同时可能还在写入临时文件，那么，这块缓冲区何时可以释放，以便接收新的缓冲区呢？对于这个问题，Nginx 是采用多个 ngx_buf_t 结构体指向同一块内存的做法来解决的，并且这些 ngx_buf_t 缓冲区的 shadow 域会互相引用，以确保真实的缓冲区真的不再使用时才会回收、复用。

### 12.1.2 ngx_http_upstream_t 数据结构的意义

使用 upstream 机制时必须构造 ngx_http_upstream_t 结构体，下面详述其中每个成员的意义。

```c
typedef struct ngx_http_upstream_s ngx_http_upstream_t;
struct ngx_http_upstream_s {
    // 处理读事件的回调方法，每一个阶段都有不同的 read_event_handler
    ngx_http_upstream_handler_pt read_event_handler;

    // 处理写事件的回调方法，每一个阶段都有不同的 write_event_handler
    ngx_http_upstream_handler_pt write_event_handler;

    /*表示主动向上游服务器发起的连接。关于 ngx_peer_connection_t 结构体，可参见 9.3.2 节 */
    ngx_peer_connection_t peer;

    // 当向下游客户端转发响应时（ngx_http_request_t 结构体中的subrequest_in_memory 标志位为0），如果打开了缓存且认为上游网速更快（conf 配置中的buffering 标志位为1），这时会使用pipe 成员来转发响应。在使用这种方式转发响应时，必须由HTTP 模块在使用upstream 机制前构造pipe 结构体，否则会出现严重的coredump 错误。详见 12.8.1 节
    ngx_event_pipe_t *pipe;
    // 定义了向下游发送响应的方式
    ngx_output_chain_ctx_t output;
    ngx_chain_writer_ctx_t writer;
    // 使用 upstream 机制时的各种配置，详见 12.1.3 节
    ngx_http_upstream_conf_t *conf;

    /*HTTP 模块在实现process_header 方法时，如果希望upstream 直接转发响应，就需要把解析出的响应头部适配为HTTP 的响应头部，同时需要把包头中的信息设置到headers_in 结构体中，这样，在图12-5 的第 8 步中，会把 headers_in 中设置的头部添加到要发送到下游客户端的响应头部 headers_out 中 */
    ngx_http_upstream_headers_in_t headers_in;

    // 用于解析主机域名，本章不作介绍
    ngx_http_upstream_resolved_t *resolved;
    /*接收上游服务器响应包头的缓冲区，在不需要把响应直接转发给客户端，或者 buffering 标志位为 0 的情况下转发包体时，接收包体的缓冲区仍然使用 buffer。注意，如果没有自定义 input*filter 方法处理包体，将会使用 buffer 存储全部的包体，这时 buffer 必须足够大！它的大小由 ngx_http_upstream_conf_t 配置结构体中的 buffer_size 成员决定 */
    ngx_buf_t buffer;

    // 表示来自上游服务器的响应包体的长度
    size_t length;

    /* out*bufs 在两种场景下有不同的意义：① 当不需要转发包体，且使用默认的 input_filter 方法（也就是 ngx_http_upstream_non_buffered_filter 方法）处理包体时， out_bufs 将会指向响应包体，事实上， out_bufs 链表中会产生多个 ngx_buf_t 缓冲区，每个缓冲区都指向 buffer 缓存中的一部分，而这里的一部分就是每次调用 recv 方法接收到的一段 TCP 流。② 当需要转发响应包体到下游时（ buffering 标志位为 0，即以下游网速优先，参见 12.7 节），这个链表指向上一次向下游转发响应到现在这段时间内接收自上游的缓存响应 */
    ngx_chain_t *out_bufs;

    /*当需要转发响应包体到下游时（ buffering 标志位为 0，即以下游网速优先，参见 12.7 节），它表示上一次向下游转发响应时没有发送完的内容 */
    ngx_chain_t *busy_bufs;

    /*这个链表将用于回收 out*bufs 中已经发送给下游的 ngx_buf_t 结构体，这同样应用在 buffering 标志位为 0 即以下游网速优先的场景 */
    ngx_chain_t *free_bufs;

    /*处理包体前的初始化方法，其中 data 参数用于传递用户数据结构，它实际上就是下面的 input_filter_ctx 指针 */
    ngx_int_t (*input_filter_init)(void *data);

    /*处理包体的方法，其中 data 参数用于传递用户数据结构，它实际上就是下面的 input_filter_ctx 指针，而 bytes 表示本次接收到的包体长度。返回 NGX_ERROR 时表示处理包体错误，请求需要结束，否则都将继续 upstream 流程 */
    ngx_int_t (*input_filter)(void *data, size_t bytes);

    /*用于传递 HTTP 模块自定义的数据结构，在 input_filter_init 和 input_filter 方法被回调时会作为参数传递过去 */
    void *input_filter_ctx;

    // HTTP 模块实现的 create_request 方法用于构造发往上游服务器的请求
    ngx_int_t (*create_request)(ngx_http_request_t *r);

    /*与上游服务器的通信失败后，如果按照重试规则还需要再次向上游服务器发起连接，则会调用 reinit*request 方法 */
    ngx_int_t (*reinit_request)(ngx_http_request_t *r);

    /*解析上游服务器返回响应的包头，返回 NGX_AGAIN 表示包头还没有接收完整，返回 NGX_HTTP_UPSTREAM_INVALID_HEADER 表示包头不合法，返回 NGX_ERROR 表示出现错误，返回 NGX_OK 表示解析到完整的包头 */
    ngx_int_t (*process_header)(ngx_http_request_t *r);

    // 当前版本下 abort_request 回调方法没有任意意义，在 upstream 的所有流程中都不会调用
    void (*abort_request)(ngx_http_request_t *r);
    // 请求结束时会调用，参见 12.9.1 节
    void (*finalize_request)(ngx_http_request_t *r, ngx_int_t rc);

    /*在上游返回的响应出现 Location 或者 Refresh 头部表示重定向时，会通过 ngx_http_upstream_process_headers 方法（参见图 12-5 中的第 8 步）调用到可由 HTTP 模块实现的 rewrite_redirect 方法 */
    ngx_int_t (*rewrite_redirect)(ngx_http_request_t *r, ngx_table_elt_t *h, size_t prefix);

    // 暂无意义
    ngx_msec_t timeout;

    // 用于表示上游响应的错误码、包体长度等信息
    ngx_http_upstream_state_t *state;

    // 不使用文件缓存时没有意义
    ngx_str_t method;

    // schema 和 uri 成员仅在记录日志时会用到，除此以外没有意义
    ngx_str_t schema;
    ngx_str_t uri;

    /*目前它仅用于表示是否需要清理资源，相当于一个标志位，实际不会调用到它所指向的方法 */
    ngx_http_cleanup_pt *cleanup;

    // 是否指定文件缓存路径的标志位，本章不讨论文件缓存，略过
    unsigned store:1;

    // 是否启用文件缓存，本章仅讨论 cacheable 标志位为 0 的场景
    unsigned cacheable:1;

    // 暂无意义
    unsigned accel:1;

    // 是否基于 SSL 协议访问上游服务器
    unsigned ssl:1;

    /*向下游转发上游的响应包体时，是否开启更大的内存及临时磁盘文件用于缓存来不及发送到下游的响应包体 */
    unsigned buffering:1;

    /* request_bufs 以链表的方式把 ngx_buf_t 缓冲区链接起来，它表示所有需要发送到上游服务器的请求内容。所以， HTTP 模块实现的 create_request 回调方法就在于构造 request_bufs 链表 */
    ngx_chain_t *request_bufs;

    /*request_sent 表示是否已经向上游服务器发送了请求，当 request_sent 为 1 时，表示 upstream 机制已经向上游服务器发送了全部或者部分的请求。事实上，这个标志位更多的是为了使用 ngx_output_chain 方法发送请求，因为该方法发送请求时会自动把未发送完的 request_bufs 链表记录下来，为了防止反复发送重复请求，必须有 request_sent 标志位记录是否调用过 ngx_output_chain 方法 */
    unsigned request_sent:1;

    /*将上游服务器的响应划分为包头和包尾，如果把响应直接转发给客户端， header_sent 标志位表示包头是否发送， header_sent 为 1 时表示已经把包头转发给客户端了。如果不转发响应到客户端，则 header_sent 没有意义*/
    unsigned header_sent:1;
};
```

到目前为止，ngx_http_upstream_t 结构体中有些成员仍然没有使用到，还有更多的成员其实仅是 HTTP 框架自己使用，HTTP 模块在使用 upstream 时需要设置的成员并不是太多，但在实现 process_header、input_filter 等回调方法时，还是需要对各个成员有一个初步的了解，这样才能高效地使用 upstream 机制。

### 12.1.3 ngx_http_upstream_conf_t 配置结构体

ngx_http_upstream_t 结构体中的 conf 成员是非常关键的，它指定了 upstream 的运行方式。注意，它必须在启动 upstream 机制前设置。下面来看看这个结构体中各个成员的意义。

```c
typedef struct {
/* 当在 ngx_http_upstream_t 结构体中没有实现 resolved 成员时， upstream 这个结构体才会生效，它会定义上游服务器的配置 */
ngx_http_upstream_srv_conf_t *upstream;

/*建立 TCP 连接的超时时间，实际上就是写事件添加到定时器中时设置的超时时间，参见图 12-3 中的第 8 步 */
ngx_msec_t connect_timeout;

/*发送请求的超时时间。通常就是写事件添加到定时器中设置的超时时间，参见图 12-4 中的第 3 步 */
ngx_msec_t send_timeout;

/*接收响应的超时时间。通常就是读事件添加到定时器中设置的超时时间，参见图 12-4 中的第 5 步 */
ngx_msec_t read_timeout;

// 目前无意义
ngx_msec_t timeout;

// TCP 的 SO_SNOLOWAT 选项，表示发送缓冲区的下限
size_t send_lowat;

/*定义了接收头部的缓冲区分配的内存大小（ ngx_http_upstream_t 中的 buffer 缓冲区），当不转发响应给下游或者在 buffering 标志位为 0 的情况下转发响应时，它同样表示接收包体的缓冲区大小 */
size_t buffer_size;

/*仅当 buffering 标志位为 1，并且向下游转发响应时生效。它会设置到 ngx_event_pipe_t 结构体的 busy_size 成员中，具体含义参见 12.8.1 节 */
size_t busy_buffers_size;

/*在 buffering 标志位为 1 时，如果上游速度快于下游速度，将有可能把来自上游的响应存储到临时文件中，而 max_temp_file_size 指定了临时文件的最大长度。实际上，它将限制 ngx_event_pipe_t 结构体中的 temp_file*/
size_t max_temp_file_size;

// 表示将缓冲区中的响应写入临时文件时一次写入字符流的最大长度
size_t temp_file_write_size;

// 以下 3 个成员目前都没有任何意义
size_t busy_buffers_size_conf;
size_t max_temp_file_size_conf;
size_t temp_file_write_size_conf;
// 以缓存响应的方式转发上游服务器的包体时所使用的内存大小
ngx_bufs_t bufs;
/*针对 ngx_http_upstream_t 结构体中保存解析完的包头的 headers_in 成员， ignore_headers 可以按照二进制位使得 upstream 在转发包头时跳过对某些头部的处理。作为 32 位整型，理论上 ignore_headers 最多可以表示 32 个需要跳过不予处理的头部，然而目前 upstream 机制仅提供 8 个位用于忽略 8 个 HTTP 头部的处理，包括：
define NGX_HTTP_UPSTREAM_IGN_XA_REDIRECT 0x00000002
define NGX_HTTP_UPSTREAM_IGN_XA_EXPIRES 0x00000004
define NGX_HTTP_UPSTREAM_IGN_EXPIRES 0x00000008
define NGX_HTTP_UPSTREAM_IGN_CACHE_CONTROL 0x00000010
define NGX_HTTP_UPSTREAM_IGN_SET_COOKIE 0x00000020
define NGX_HTTP_UPSTREAM_IGN_XA_LIMIT_RATE 0x00000040
define NGX_HTTP_UPSTREAM_IGN_XA_BUFFERING 0x00000080
define NGX_HTTP_UPSTREAM_IGN_XA_CHARSET 0x00000100*/
ngx_uint_t ignore_headers;

/*以二进制位来表示一些错误码，如果处理上游响应时发现这些错误码，那么在没有将响应转发给下游客户端时，将会选择下一个上游服务器来重发请求。参见 12.9 节中介绍的 ngx_http_upstream_next 方法 */
ngx_uint_t next_upstream;

/*在 buffering 标志位为 1 的情况下转发响应时，将有可能把响应存放到临时文件中。在 ngx_http_upstream_t 中的 store 标志位为 1 时， store_access 表示所创建的目录、文件的权限 */
ngx_uint_t store_access;

/*决定转发响应方式的标志位， buffering 为 1 时表示打开缓存，这时认为上游的网速快于下游的网速，会尽量地在内存或者磁盘中缓存来自上游的响应；如果 buffering 为 0，仅会开辟一块固定大小的内存块作为缓存来转发响应 */
ngx_flag_t buffering;

// 暂无意义
ngx_flag_t pass_request_headers;

// 暂无意义
ngx_flag_t pass_request_body;

/*表示标志位。当它为 1 时，表示与上游服务器交互时将不检查 Nginx 与下游客户端间的连接是否断开。也就是说，即使下游客户端主动关闭了连接，也不会中断与上游服务器间的交互 */
ngx_flag_t ignore_client_abort;

/*当解析上游响应的包头时，如果解析后设置到 headers_in 结构体中的 status_n 错误码大于 400，则会试图把它与 error_page 中指定的错误码相匹配，如果匹配上，则发送 error_page 中指定的响应，否则继续返回上游服务器的错误码。详见 ngx_http_upstream_intercept_errors 方法 */
ngx_flag_t intercept_errors;

/*buffering 标志位为 1 的情况下转发响应时才有意义。这时，如果 cyclic_temp_file 为 1，则会试图复用临时文件中已经使用过的空间。不建议将 cyclic_temp_file 设为 1 */
ngx_flag_t cyclic_temp_file;

// 在 buffering 标志位为 1 的情况下转发响应时，存放临时文件的路径
ngx_path_t *temp_path;

/*不转发的头部。实际上是通过 ngx*http_upstream_hide_headers_hash 方法，根据 hide_headers 和 pass_headers 动态数组构造出的需要隐藏的 HTTP 头部散列表 */
ngx_hash_t hide_headers_hash;

/*当转发上游响应头部（ ngx*http_upstream_t 中 headers_in 结构体中的头部）给下游客户端时，如果不希望某些头部转发给下游，就设置到 hide_headers 动态数组中 */
ngx_array_t *hide_headers;

/*当转发上游响应头部（ ngx_http_upstream_t 中 headers_in 结构体中的头部）给下游客户端时， upstream 机制默认不会转发如“ Date”、“ Server”之类的头部，如果确实希望直接转发它们到下游，就设置到 pass_headers 动态数组中 */
ngx_array_t *pass_headers;

// 连接上游服务器时使用的本机地址
ngx_addr_t *local;

/*当 ngx_http_upstream_t 中的 store 标志位为 1 时，如果需要将上游的响应存放到文件中， store_lengths 将表示存放路径的长度，而 store_values 表示存放路径 */
ngx_array_t *store_lengths;
ngx_array_t *store_values;

/*到目前为止， store 标志位的意义与 ngx_http_upstream_t 中的 store 相同，仍只有 0 和 1 被使用到 */
signed store:2;

/*上面的 intercept_errors 标志位定义了 400 以上的错误码将会与 error_page 比较后再行处理，实际上这个规则是可以有一个例外情况的，如果将 intercept_404 标志位设为 1，当上游返回 404 时会直接转发这个错误码给下游，而不会去与 error_page 进行比较 */
unsigned intercept_404:1;

/*当该标志位为 1 时，将会根据 ngx_http_upstream_t 中 headers_in 结构体里的 X-Accel-Buffering 头部（它的值会是 yes 和 no）来改变 buffering 标志位，当其值为 yes 时， buffering 标志位为 1。因此， change_buffering 为 1 时将有可能根据上游服务器返回的响应头部，动态地决定是以上游网速优先还是以下游网速优先 */
unsigned change_buffering:1;

    // 使用 upstream 的模块名称，仅用于记录日志
    ngx_str_t module;
} ngx_http_upstream_conf_t;
```

ngx_http_upstream_conf_t 结构体中的配置都比较重要，它们会影响访问上游服务器的方式。同时，该结构体中的大量成员是与如何转发上游响应相关的。如果用户希望直接转发上游的包体到下游，那就需要注意 ngx_http_upstream_conf_t 中每一个成员的意义了。

## 12.2 启动 upstream

在把请求里 ngx_http_request_t 结构体中的 upstream 成员（ngx_http_upstream_t 类型）创建并设置好，并且正确设置 upstream-\>conf 配置结构体（ngx_http_upstream_conf_t 类型）后，就可以启动 upstream 机制了。启动方式非常简单，调用 ngx_http_upstream_init 方法即可。

注意，默认情况下请求的 upstream 成员只是 NULL 空指针，在设置 upstream 之前需要调用 ngx_http_upstream_create 方法从内存池中创建 ngx_http_upstream_t 结构体，该方法的原型如下。

```c
ngx_int_t ngx_http_upstream_create(ngx_http_request_t *r)
```

ngx_http_upstream_create 方法只是创建 ngx_http_upstream_t 结构体而已，其中的成员还需要各个 HTTP 模块自行设置。启动 upstream 机制的 ngx_http_upstream_init 方法定义如下。

```c
void ngx_http_upstream_init(ngx_http_request_t \*r)
```

ngx_http_upstream_init 方法将会根据 ngx_http_upstream_conf_t 中的成员初始化 upstream，同时会开始连接上游服务器，以此展开整个 upstream 处理流程。图 12-2 简要描述了 ngx_http_upstream_init 方法所做的主要工作。

图 12-2 ngx_http_upstream_init 方法的流程图

下面依次说明图 12-2 中各个步骤的意义。

1）首先检查请求对应于客户端的连接，这个连接上的读事件如果在定时器中，也就是说，读事件的 timer_set 标志位为 1，那么调用 ngx_del_timer 方法把这个读事件从定时器中移除。为什么要做这件事呢？因为一旦启动 upstream 机制，就不应该对客户端的读操作带有超时时间的处理，请求的主要触发事件将以与上游服务器的连接为主。

2）检查 ngx_http_upstream_conf_t 配置结构中的 ignore_client_abort 标志位（参见 [12.1.3 节](#1213-ngx_http_upstream_conf_t-配置结构体)），如果 ignore_client_abort 为 1，则跳到第 3 步，否则（实际上，还需要让 store 标志位为 0、请求 ngx_http_request_t 结构体中的 post_action 标志位为 0）就会设置 Nginx 与下游客户端之间 TCP 连接的检查方法，如下所示。

```c
r->read_event_handler = ngx_http_upstream_rd_check_broken_connection;
r->write_event_handler = ngx_http_upstream_wr_check_broken_connection;
```

实际上，这两个方法都会通过 ngx_http_upstream_check_broken_connection 方法检查 Nginx 与下游的连接是否正常，如果出现错误，就会立即终止连接。

3）调用请求中 ngx_http_upstream_t 结构体里由某个 HTTP 模块实现的 create_request 方法，构造发往上游服务器的请求（请求中的内容是设置到 request_bufs 缓冲区链表中的）。如果 create_request 方法没有返回 NGX_OK，则 upstream 机制结束，此时会调用 11.10.6 节中介绍过的 ngx_http_finalize_request 方法来结束请求。

4）在 11.10.2 节中介绍过，ngx_http_cleanup_t 是用于清理资源的结构体，还说明了它何时会被执行。在这一步中，upstream 机制就用到了 ngx_http_cleanup_t。首先，调用 ngx_http_cleanup_add 方法向这个请求 main 成员指向的原始请求中的 cleanup 链表末尾添加一个新成员，然后把 handler 回调方法设为 ngx_http_upstream_cleanup，这意味着当请求结束时，一定会调用 ngx_http_upstream_cleanup 方法（参见 12.9.1 节）。

5）调用 ngx_http_upstream_connect 方法向上游服务器发起连接（详见 12.3 节）。

注意启动 upstream 机制时还有许多分支流程，如缓存文件的使用、上游服务器地址的选取等，图 12-2 概括了最主要的 5 个步骤，这样方便读者了解 upstream 的核心思想。其他分支的处理不影响这 5 个主要流程，如需了解可自行查看 ngx_http_upstream_init 和 ngx_http_upstream_init_request 方法的源代码。

## 12.3 与上游服务器建立连接

upstream 机制与上游服务器是通过 TCP 建立连接的，众所周知，建立 TCP 连接需要三次握手，而三次握手消耗的时间是不可控的。为了保证建立 TCP 连接这个操作不会阻塞进程，Nginx 使用无阻塞的套接字来连接上游服务器。图 12-2 的第 5 步调用的 ngx_http_upstream_connect 方法就是用来连接上游服务器的，由于使用了非阻塞的套接字，当方法返回时与上游之间的 TCP 连接未必会成功建立，可能还需要等待上游服务器返回 TCP 的 SYN/ACK 包。因此，ngx_http_upstream_connect 方法主要负责发起建立连接这个动作，如果这个方法没有立刻返回成功，那么需要在 epoll 中监控这个套接字，当它出现可写事件时，就说明连接已经建立成功了。

在图 12-3 中可以看到，如果连接立刻成功建立，在第 9 步就会开始向上游服务器发送请求，如果连接没有马上建立成功，在第 8 步就会将这个连接的写事件加入到 epoll 中，等待连接上的可写事件被触发后，回调 ngx_http_upstream_send_request 方法发送请求给上游服务器。

下面详细说明图 12-3 中每个步骤的意义。

1）调用 socket 方法建立一个 TCP 套接字，同时，这个套接字需要设置为非阻塞模式。

2）由于 Nginx 的事件框架要求每个连接都由一个 ngx_connection_t 结构体来承载，因此这一步将调用 ngx_get_connection 方法，由 ngx_cycle_t 核心结构体中 free_connections 指向的空闲连接池处获取到一个 ngx_connection_t 结构体，作为承载 Nginx 与上游服务器间的 TCP 连接。

3）第 9 章我们介绍过事件模块的 ngx_event_actions 接口，其中的 add_conn 方法可以将 TCP 套接字以期待可读、可写事件的方式添加到事件搜集器中。对于 epoll 事件模块来说， add_conn 方法就是把套接字以期待 EPOLLIN|EPOLLOUT 事件的方式加入 epoll 中，这一步即调用 add_conn 方法把刚刚建立的套接字添加到 epoll 中，表示如果这个套接字上出现了预期的网络事件，则希望 epoll 能够回调它的 handler 方法。

图 12-3 ngx_http_upstream_connect 方法的流程图

4）调用 connect 方法向上游服务器发起 TCP 连接，作为非阻塞套接字，connect 方法可能立刻返回连接建立成功，也可能告诉用户继续等待上游服务器的响应，对 connect 连接是否建立成功的检查会在第 7 步之后进行。注意，这里并没有涉及 connect 返回失败的情形，读者可以参考第 11 章中这种系统调用失败后的处理，本章不会讨论细节。

5）将这个连接 ngx_connection_t 上的读/写事件的 handler 回调方法都设置为 ngx_http_upstream_handler。下文会介绍 ngx_http_upstream_handler 方法。

6）将 upstream 机制的 write_event_handler 方法设为 ngx_http_upstream_send_request_handler。write_event_handler 和 read_event_handler 的用法参见下面将要介绍的 ngx_http_upstream_handler 方法。这一步骤实际上决定了向上游服务器发送请求的方法是 ngx_http_upstream_send_request_handler。

7）设置 upstream 机制的 read_event_handler 方法为 ngx_http_upstream_process_header，也就是由 ngx_http_upstream_process_header 方法接收上游服务器的响应。

现在开始检查在第 4 步中调用 connect 方法连接上游服务器是否成功，如果已经连接成功，则跳到第 9 步执行；如果尚未收到上游服务器连接建立成功的应答，则跳到第 8 步执行。

8）这一步处理非阻塞的连接尚未成功建立时的动作。实际上，在第 3 步中，套接字已经加入到 epoll 中监控了，因此，这一步将调用 ngx_add_timer 方法把写事件添加到定时器中，超时时间就是 12.1.3 节中介绍的 ngx_http_upstream_conf_t 结构体中的 connect_timeout 成员，这是在设置建立 TCP 连接的超时时间。

9）如果已经成功建立连接，则调用 ngx_http_upstream_send_request 方法向上游服务器发送请求。注意，在第 6 步中设置的发送请求方法为 ngx_http_upstream_send_request_handler，它与 ngx_http_upstream_send_request 方法的不同之处将在 12.4 节中介绍。

以上的第 5、第 6、第 7 步都与 ngx_http_upstream_handler 方法相关，同时我们又看到了类似 ngx_http_request_t 结构体中 write_event_handler、read_event_handler 的同名方法。实际上，ngx_http_upstream_handler 方法与图 11-7 展示的 ngx_http_request_handler 方法也非常相似，下面看看它到底做了些什么。

```C
static void ngx_http_upstream_handler(ngx_event_t ev)
{
ngx_connection_t c;
ngx_http_request_t r;
ngx_http_upstream_t u;
/*由事件的 data 成员取得 ngx_connection_t 连接。注意，这个连接并不是 Nginx 与客户端的连接，而是 Nginx 与上游服务器间的连接 */
c = ev->data;
// 由连接的 data 成员取得 ngx*http_request_t 结构体
r = c->data;
//由请求的 upstream 成员取得表示 upstream 机制的 Ngx*http_upstream_t 结构体
u = r->upstream;
// 注意， ngx_http_request_t 结构体中的这个 connection 连接是客户端与 Nginx 间的连接
c = r->connection;
if (ev->write) {
// 当 Nginx 与上游服务器间 TCP 连接的可写事件被触发时， upstream 的 write_event_handler 方法会被调用
u->write_event_handler(r, u);
} else {
// 当 Nginx 与上游服务器间 TCP 连接的可读事件被触发时， upstream 的 read_event_handler 方法会被调用
u->read_event_handler(r, u);
}

// ngx_http_run_posted_requests 方法正是第 11 章图 11-12 所说的方法。注意，这个参数 c 是来自客户端的连接， post 请求的执行也与图 11-12 完全一致 */
ngx_http_run_posted_requests(c);
}
```

## 12.4 发送请求到上游服务器

向上游服务器发送请求是一个阶段，因为请求的大小是未知的，所以发送请求的方法需要被 epoll 调度许多次后才可能发送完请求的全部内容。在图 12-3 中的第 6 步将 ngx_http_upstream_t 里的 write_event_handler 成员设为 ngx_http_upstream_send_request_handler 方法，也就是说，由该方法负责反复地发送请求，可是，在图 12-3 的第 9 步又直接调用了 ngx_http_upstream_send_request 方法发送请求，那这两种方法之间有什么关系吗？先来看看前者的实现，它相对简单，这里直接列举了它的主要源代码，如下所示。

```c
static void ngx_http_upstream_send_request_handler(ngx_http_request_t r, ngx_http_upstream_t u)
{
ngx_connection_t *c;

// 获取与上游服务器间表示连接的 ngx_connection_t 结构体
c = u->peer.connection;
// 写事件的 timedout 标志位为 1 时表示向上游服务器发送的请求已经超时
if (c->write->timedout) {
// 将超时错误传递给 ngx_http_upstream_next 方法，该方法将会根据允许的错误重连策略决定：重新发起连接执行 upstream 请求，或者结束 upstream 请求，详见 12.9.2 节
ngx_http_upstream_next(r, u, NGX_HTTP_UPSTREAM_FT_TIMEOUT);
return;
}
// header_sent 标志位为 1 时表明上游服务器的响应需要直接转发给客户端，而且此时 Nginx 已经把响应包头转发给客户端了
if (u->header_sent) {
// 事实上， header_sent 为 1 时一定是已经解析完全部的上游响应包头，并且开始向下游发送 HTTP 的包头了。到此，是不应该继续向上游发送请求的，所以把 write_event_handler 设为任何工作都没有做的 ngx_http_upstream_dummy_handler 方法
u->write_event_handler = ngx_http_upstream_dummy_handler;
// 将写事件添加到 epoll 中
(void) ngx_handle_write_event(c->write, 0);
// 因为不存在继续发送请求到上游的可能，所以直接返回
return;
}
// 调用 ngx_http_upstream_send_request 方法向上游服务器发送请求
ngx_http_upstream_send_request(r, u);
}
```

可见，ngx_http_upstream_send_request_handler 方法更多的时候是在检测请求的状态，而
实际负责发送请求的方法是 ngx_http_upstream_send_request，图 12-4 列出了
ngx_http_upstream_send_request 方法的主要执行步骤。

下面说明以上 8 个步骤的意义。

1）调用 ngx_output_chain 方法向上游服务器发送 ngx_http_upstream_t 结构体中的
request_bufs 链表，这个方法对于发送缓冲区构成的 ngx_chain_t 链表非常有用，它会把未发送
完成的链表缓冲区保存下来，这样就不用每次调用时都携带上 request_bufs 链表。怎么理解
呢？当第一次调用 ngx_output_chain 方法时，需要传递 request_bufs 链表构成的请求，如下所
示。

```C
rc = ngx_output_chain(&u->output, u->request_bufs);
```

这里的 u 就是请求对应的 ngx_http_request_t 结构体中的 upstream 成员（ngx_http_upstream_t 类型），如果 ngx_output_chain 一次无法发送完所有的 request_bufs 请求内容，ngx_output_chain_ctx_t 类型的 u-\>output 会把未发送完的请求保存在自己的成员中，同时返回 NGX_AGAIN。当可写事件再次触发，发送请求时就不需要再传递参数了，例如：

```c
rc = ngx_output_chain(&u->output, NULL);
```

为了标识这一点，ngx_http_upstream_t 结构体中专门有一个标志位 request_sent 表示是否已经传递了 request_bufs 缓冲区。因此，在第一次以 request_bufs 作为参数调用 ngx_output_chain 方法后，request_sent 会置为 1。

2）检测写事件的 timer_set 标志位，timer_set 为 1 时表示写事件仍然在定时器中，那么这一步首先把写事件由定时器中取出，再由 ngx_output_chain 的返回值决定是否再次向定时器中加入写事件，那时超时时间也会重置。

图 12-4 ngx_http_upstream_send_request 方法的流程图

检测 ngx_output_chain 的返回值，返回 NGX_AGAIN 时表示还有请求未被发送，此时跳到第 3 步；如果返回 NGX_OK，则表示已经发送完全部请求，跳到第 5 步执行。

3）调用 ngx_add_timer 方法将写事件添加到定时器中，防止发送请求超时。超时时间就是 ngx_http_upstream_conf_t 配置结构体的 send_timeout 成员。

4）调用 ngx_handle_write_event 方法将写事件添加到 epoll 中， ngx_http_upstream_send_request 方法结束。

5）如果已经向上游服务器发送完全部请求，这时将准备开始处理响应，首先把读事件添加到定时器中检查接收响应是否超时，超时时间就是 ngx_http_upstream_conf_t 配置结构体的 read_timeout 成员。

检测读事件的 ready 标志位，如果 ready 为 1，则表示已经有响应可以读出，这时跳到第 6 步执行；如果 ready 为 0，则跳到第 7 步执行。

6）调用 ngx_http_upstream_process_header 方法接收上游服务器的响应，在 12.5 节中会详细讨论该方法。

7）如果暂无响应可读，由于此时请求已经全部发送到上游服务器了，所以要防止可写事件再次触发而又调用 ngx_http_upstream_send_request 方法。这时，把 write_event_handler 设为 ngx_http_upstream_dummy_handler 方法，前文说过，该方法不会做任何事情。这样即使与上游间的 TCP 连接上再次有可写事件时也不会有任何动作发生，它就像第 11 章我们介绍的 ngx_http_empty_handler 方法。

8）调用 ngx_handle_write_event 方法将写事件加入到 epoll 中。

在发送请求到上游服务器的这个阶段中，每当 TCP 连接上再次可以发送字符流时，虽然事件框架就会回调 ngx_http_upstream_send_request_handler 方法处理可写事件，但最终还是通过调用 ngx_http_upstream_send_request 方法把请求发送出去的。

## 12.5 接收上游服务器的响应头部

当请求全部发送给上游服务器时，Nginx 开始准备接收来自上游服务器的响应。在图 12-3 的第 7 步中设置了由 ngx_http_upstream_process_header 方法处理上游服务器的响应，而图 12-4 的第 8 步也是通过调用该方法接收响应的，本节的内容就在于说明可能会被反复多次调用的 ngx_http_upstream_process_header 方法。

## 12.5.1 应用层协议的两段划分方式

在 12.1.1 节我们已经了解到，只要上游服务器提供的应用层协议是基于 TCP 实现的，那么 upstream 机制都是适用的。基于 TCP 的响应其实就是有顺序的数据流，那么，upstream 机制只需要按照接收到的顺序调用 HTTP 模块来解析数据流不就行了吗？多么简单和清晰！然而，实际上，应用层协议要比这复杂得多，这主要表现在协议长度的不可确定和协议内容的解析上。首先，应用层协议的响应包可大可小，如最小的响应可能只有 128B，最大的响应可能达到 5GB，如果属于 HTTP 框架的 ngx_http_upstream_module 模块在内存中接收到全部响应内容后再调用各个 HTTP 模块处理响应，就很容易引发 OutOfMemory 错误，即使没有错误也会因为内存消耗过大从而降低了并发处理能力。如果在磁盘文件中接收全部响应，又会带来大量的磁盘 I/O 操作，最终大幅提高服务器的负载。其次，对响应中的所有内容都进行解析并无必要（解析操作毕竟对 CPU 是有消耗的）。例如，从 Memcached 服务器上下载一幅图片，Nginx 只需要解析 Memcached 协议，并不需要解析图片的内容，对于图片内容，Nginx 只需要边接收边转发给客户端即可。

为了解决上述问题，应用层协议通常都会将请求和响应分成两部分：包头和包体，其中包头在前而包体在后。包头相当于把不同的协议包之间的共同部分抽象出来，不同的数据包之间包头都具备相同的格式，服务器必须解析包头，而包体则完全不做格式上的要求，服务器是否解析它将视业务上的需要而定。包头的长度要么是固定大小，要么是限制在一个数值以内（例如，类似 Apache 这样的 Web 服务器默认情况下仅接收包头小于 4KB 的 HTTP 请求），而包体的长度则非常灵活，可以非常大，也可以为 0。对于 Nginx 服务器来说，在 process_header 处理包头时，需要开辟的内存大小只要能够容纳包头的长度上限即可，而处理包体时需要开辟的内存大小情况较复杂，可参见 12.6 节~12.8 节。

包头和包体存储什么样的信息完全取决于应用层协议，包头中的信息通常必须包含包体的长度，这是应用层协议分为包头、包体两部分的最主要原因。很多包头还会包含协议版本、请求的方法类型、数据包的序列号等信息，这些是 upstream 机制并不关心的，它已经在 ngx_http_upstream_t 结构体中抽象出了 process_header 方法，由具体的 HTTP 模块实现的 process_header 来解析包头。实际上，upstream 机制并没有对 HTTP 模块怎样实现 process_header 方法进行限制，但如果 HTTP 模块的目的是实现反向代理，不妨将接收到的包头按照上游的应用层协议与 HTTP 的关系，把解析出的一些头部适配到 ngx_http_upstream_t 结构体中的 headers_in 成员中，这样，upstream 机制在图 12-5 的第 8 步就会自动地调用 ngx_http_upstream_process_headers 方法将这些头部设置到发送给下游客户端的 HTTP 响应包头
中。

包体的内容往往较为简单，当 HTTP 模块希望实现反向代理功能时大都不希望解析包体。这样的话，upstream 机制基于这种最常见的需求，把包体的常见处理方式抽象出 3 类加以实现，12.5.2 节中将介绍这 3 种包体的处理方式。

## 12.5.2 处理包体的 3 种方式

为什么 upstream 机制不是仅仅负责接收上游服务器发来的包体，再交由 HTTP 模块决定如何处理这个包体呢？这是因为 upstream 有一个最重要的使命要完成！Nginx 作为一个试图取代 Apache 的 Web 服务器，最基本的反向代理功能是必须存在的，而实现反向代理的 Web 服务器并不仅仅希望可以访问上游服务器，它更希望 upstream 能够实现透传、转发上游响应的功能。

upstream 机制不关心如何构造发送到上游的请求内容，这事实上是由各个使用 upstream 的 HTTP 模块实现的 create_request 方法决定的（目前的 HTTP 反向代理模块是这么做的：Nginx 将客户端的请求全部接收后再透传给上游服务器，这种方式很简单，又对减轻上游服务器的并发负载很有帮助），但对响应的处理就比较复杂了，下面举两个例子来说明其复杂性。

如果 Nginx 与上游服务器间的网速很快（例如，两者都在一个机房的内网中，或者两者间拥有专线），而 Nginx 与下游的客户端间网速又很慢（例如，下游客户端通过公网访问机房内的 Nginx），这样就会导致 Nginx 接收上游服务器的响应非常快，而向下游客户端转发响应时很慢，这也就为 upstream 机制带来一个需求：应当尽可能地把上游服务器的响应接收到 Nginx 服务器上，包括将来自上游的、还没来及发送到下游的包体缓存到内存中，如果使用的内存过大，达到某个限制阈值后，为了降低内存的消耗，还需要把包体缓存到磁盘文件中。

如果 Nginx 与上游服务器间的网速较慢（假设是公网线路），而 Nginx 与下游的客户端间的网速很快（例如，客户端其实是 Nginx 所在机房里的另一个 Web 服务器），这时就不存在大量缓存上游响应的需求了，完全可以开辟一块固定大小的内存作为缓冲区，一边接收上游响应，一边向下游转发。每当向下游成功转发部分响应后就可以复用缓冲区，这样既不会消耗大量内存（增加 Nginx 并发量），又不会使用到磁盘 I/O（减少了用户等待响应的时间）。

因此，upstream 机制提供了 3 种处理包体的方式：不转发响应（即不实现反向代理）、转发响应时以下游网速优先、转发响应时以上游网速优先。怎样告诉 upstream 机制使用哪种方式处理上游的响应包体呢？当请求 ngx_http_request_t 结构体的 subrequest_in_memory 标志位为 1 时，将采用第 1 种方式，即不转发响应；当 subrequest_in_memory 为 0 时，将转发响应。而 ngx_http_upstream_conf_t 配置结构体中的 buffering 标志位，会决定转发响应时是否开启更多的内存和磁盘文件用于缓存上游响应，如果 buffering 为 0，则以下游网速优先，使用固定大小的内存作为缓存；如果 buffering 为 1，则以上游网速优先，使用更多的内存、硬盘文件作为缓存。

1.不转发响应

不转发包体是 upstream 机制最基本的功能，特别是客户端请求派生出的子请求多半不需要转发包体，upstream 机制的最低目标就是允许 HTTP 模块以 TCP 访问上游服务器，这时 HTTP 模块仅希望解析包头、包体，没有转发上游响应的需求。upstream 机制提供的解析包头 的回调方法是 process_header，而解析包体的回调方法则是 input_filter。在 12.6 节将会描述这种处理包体的最基本方式是如何工作的。

2.转发响应时下游网速优先

在转发响应时，如果下游网速快于上游网速，或者它们速度相差不大，这时不需要开辟大块内存或者磁盘文件来缓存上游的响应。我们将在 12.7 节中讲述这种处理方式下 upstream 机制是如何工作的。

3.转发响应时上游网速优先

在转发响应时，如果上游网速快于下游网速（由于 Nginx 支持高并发特性，所以大多数时候都用于做最前端的 Web 服务器，这时上游网速都会快于下游网速），这时需要开辟内存或者磁盘文件缓存来自上游服务器的响应，注意，缓存可能会非常大。这种处理方式比较复杂，在 12.8 节中我们会详细描述其主要流程。

## 12.5.3 接收响应头部的流程

下面开始介绍读取上游服务器响应的 ngx_http_upstream_process_header 方法，这个方法主要用于接收、解析响应头部，当然，由于 upstream 机制是不涉及应用层协议的，谁使用了 upstream 谁就要负责解析应用层协议，所以必须由 HTTP 模块实现的 process_header 方法解析响应包头。当包头接收、解析完毕后，ngx_http_upstream_process_header 方法还会决定以哪种方式处理包体（参见 12.5.2 节中介绍的 3 种包体处理方式）。

在接收响应包头的阶段中，处理连接读事件的方法始终是 ngx_http_upstream_process_header，也就是说，该方法会反复被调用，在研究其流程时需要特别注意。图 12-5 描述了它的主要流程。

图 12-5 ngx_http_upstream_process_header 方法的流程图

下面详细介绍图 12-5 中的 13 个步骤。

1）首先检查读事件是否有效，包括检查 timedout 标志位是否为 1，如果 timedout 为 1，则表示读取响应已经超时，这时跳到第 2 步调用 ngx_http_upstream_next 方法决定下一步的动作，其中传递的参数是 NGX_HTTP_UPSTREAM_FT_TIMEOUT。如果 timedout 为 0，则继续检查 request_sent 标志位。如果 request_sent 为 0，则表示还没有发送请求到上游服务器就收到来自上游的响应，不符合 upstream 的设计场景，这时仍然跳到第 2 步调用 ngx_http_upstream_next 方法，传递的参数是 NGX_HTTP_UPSTREAM_FT_ERROR。如果读事件完全有效，则跳到第 3 步执行。

2）只有请求触发了失败条件后，才会执行 ngx_http_upstream_next 方法，该方法将会根据配置信息决定下一步究竟是重新发起 upstream 请求，还是结束当前请求，在 12.9.2 节会详细说明该方法的工作流程。当前读事件处理完毕。

3）检查 ngx_http_upstream_t 结构体中接收响应头部的 buffer 缓冲区，如果它的 start 成员指向 NULL，说明缓冲区还未分配内存，这时将按照 ngx_http_upstream_conf_t 配置结构体中的 buffer_size 成员指定的大小来为 buffer 缓冲区分配内存。

4）调用 recv 方法在 buffer 缓冲区中读取上游服务器发来的响应。检测 recv 方法的返回值，有 3 类返回值会导致 3 种不同的结果：如果返回 NGX_AGAIN，则表示还需要继续接收响应，这时跳到第 5 步执行；如果返回 0（表示上游服务器主动关闭连接）或者返回 NGX_ERROR，这时跳到第 2 步执行 ngx_http_upstream_next 方法，传递的参数是 NGX_HTTP_UPSTREAM_FT_ERROR；如果返回正数，这时该数值表示接收到的响应长度，跳到第 6 步处理响应。

5）调用 ngx_handle_read_event 方法将读事件再添加到 epoll 中，等待读事件的下次触发。

ngx_http_upstream_process_header 方法执行完毕。

6）调用 HTTP 模块实现的 process_header 方法解析响应头部，检测其返回值：返回 NGX_HTTP_UPSTREAM_INVALID_HEADER 表示包头不合法，这时跳到第 2 步调用 ngx_http_upstream_next 方法，传递的参数是 NGX_HTTP_UPSTREAM_FT_INVALID_HEADER；返回 NGX_ERROR 表示出现错误，直接跳到第 7 步执行；返回 NGX_OK 表示解析到完整的包头，这时跳到第 8 步执行；返回 NGX_AGAIN 表示包头还没有接收完整，这时将检测 buffer 缓冲区是否用尽，如果缓冲区已经用尽，则说明包头太大了，超出了缓冲区允许的大小，这时跳到第 2 步调用 ngx_http_upstream_next 方法，传递的参数依然是 NGX_HTTP_UPSTREAM_FT_INVALID_HEADER，其表示包头不合法，而如果缓冲区还有空闲空间，则返回第 4 步继续接收上游服务器的响应。

7）调用 ngx_http_upstream_finalize_request 方法结束请求（详见 12.9.3 节）， ngx_http_upstream_process_header 方法执行完毕。

8）调用 ngx_http_upstream_process_headers 方法处理已经解析出的头部，该方法将会把已经解析出的头部设置到请求 ngx_http_request_t 结构体的 headers_out 成员中，这样在调用 ngx_http_send_header 方法发送响应包头给客户端时将会发送这些设置了的头部。

接下来检查是否需要转发响应，ngx_http_request_t 结构体中的 subrequest_in_memory 标志位为 1 时表示不需要转发响应，跳到第 10 步执行；subrequest_in_memory 为 0 时表示需要转发响应到客户端，跳到第 9 步执行。

9）调用 ngx_http_upstream_send_response 方法开始转发响应给客户端，同时 ngx_http_upstream_process_header 方法执行完毕。

10）首先检查 HTTP 模块是否实现了用于处理包体的 input_filter 方法，如果没有实现，则使用 upstream 定义的默认方法 ngx_http_upstream_non_buffered_filter 代替 input_filter，其中 input_filter_ctx 将会被设置为 ngx_http_request_t 结构体的指针。如果用户已经实现了 input_filter 方法，则表示用户希望自己处理包体（如 ngx_http_memcached_module 模块），这时首先调用 input_filter_init 方法为处理包体做初始化工作。

11）在第 6 步的 process_header 方法中，如果解析完包头后缓冲区中还有多余的字符，则表示还接收到了包体，这时将调用 input_filter 方法第一次处理接收到的包体。

12）设置 upstream 的 read_event_handler 为 ngx_http_upstream_process_body_in_memory 方法，这也表示再有上游服务器发来响应包体，将由该方法来处理（参见 12.6 节）。

13）调用 ngx_http_upstream_process_body_in_memory 方法开始处理包体。

从上面的第 12 步可以看出，当不需要转发响应时， ngx_http_upstream_process_body_in_memory 方法将作为读取上游服务器包体的回调方法。什么时候无须转发包体呢？在 subrequest_in_memory 标志位为 1 时，实际上，这也意味着当前请求是个 subrequest 子请求。也就是说，在通常情况下，如果来自客户端的请求直接使用 upstream 机制，那都需要将上游服务器的响应直接转发给客户端，而如果是客户端请求派生出的子请求，则不需要转发上游的响应。因此，当我们开发 HTTP 模块实现某个功能时，若需要访问上游服务器获取一些数据，那么可开发两个 HTTP 模块，第一个 HTTP 模块用于处理客户端请求，当它需要访问上游服务器时就派生出子请求访问，第二个 HTTP 模块则专用于访问上游服务器，在子请求解析完上游服务器的响应后，再激活父请求处理客户端要求的业务。

注意以上描述的开发场景是 Nginx 推荐用户使用的方式，虽然可以通过任意地修改 subrequest 标志位来更改以上特性，但目前这种设计对于分离关注点还是非常有效的，是一种很好的设计模式，如无必要最好不要更改。

从上面的第 9 步可以看出，当需要转发包体时将调用 ngx_http_upstream_send_response 方法来转发包体。ngx_http_upstream_send_response 方法将会根据 ngx_http_upstream_conf_t 配置结构体中的 buffering 标志位来决定是否打开缓存来处理响应，也就是说，buffering 为 0 时通常会默认下游网速更快，这时不需要缓存响应（在 12.7 节中将会介绍这一流程）。如果 buffering 为 1，则表示上游网速更快，这时需要用大量内存、磁盘文件来缓存来自上游的响应（在 12.8 节中会介绍这一流程）。

## 12.6 不转发响应时的处理流程

实际上，这里的不转发响应只是不使用 upstream 机制的转发响应功能而已，但如果 HTTP
模块有意愿转发响应到下游，还是可以通过 input_filter 方法实现相关功能的。

当请求属于 subrequest 子请求，且要求在内存中处理包体时（在第 5 章介绍过 ngx_http_subrequest 方法，通过它派生子请求时，可以将最后一个 flag 参数设置为 NGX_HTTP_SUBREQUEST_IN_MEMORY 宏，这样就将 ngx_http_request_t 结构体中的 subrequest_in_memory 标志位设为 1 了），就会进入本节描述的不转发响应这个流程。或者通过主动设置 subrequest_in_memory 标志位为 1 也可以做到，当然并不推荐这样做。为什么呢？因为不需要转发响应时的应用场景通常如下：业务需求导致需要综合上游服务器的数据来重新构造发往客户端的响应，如从上游的数据库或者 Tomcat 服务器中获取用户权限信息等。这时，根据 Nginx 推荐的设计模式，应当由原始请求处理客户端的请求，并派生出子请求访问上游服务器，在这种场景下，一般会希望在内存中解析上游服务器的响应。

注意其实，在内存中处理上游响应的包体也有两种方式，第一种方式接收到全部的包体后再开始处理，第二种方式是每接收到一部分响应后就处理这一部分。第一种方式可能浪费大量内存用于接收完整的响应包体，第二种方式则会始终复用同一块内存缓冲区。

HTTP 模块可以自由地选择使用哪种方式。

ngx_http_upstream_process_body_in_memory 就是在 upstream 机制不转发响应时，作为读事件的回调方法在内存中处理上游服务器响应包体的。每次与上游的 TCP 连接上有读事件触发时，它都会被调用，HTTP 模块通过重新实现 input_filter 方法来处理包体，在 12.6.1 节中会讨论如何实现这个回调方法；如果 HTTP 模块不实现 input_filter 方法，那么 upstream 机制就会自动使用默认的 ngx_http_upstream_non_buffered_filter 方法来处理包体，在 12.6.2 节中会讨论这个默认的 input_filter 方法做了些什么；在 12.6.3 节中将会具体分析 ngx_http_upstream_process_body_in_memory 方法的工作流程。

## 12.6.1 input_filter 方法的设计

先来看一下 input_filter 回调方法的定义，如下所示。

```c
ngx_int_t (*input_filter)(void *data, ssize_t bytes);
```

其中，bytes 参数是本次接收到的包体长度。而 data 参数却不是指向接收到的包体的，它实际上是在启动 upstream 机制之前，所设置的 ngx_http_upstream_t 结构体中的 input_filter_ctx 成员，下面看一下它的定义。

```C
void *input_filter_ctx;
```

它被设计为可以指向任意结构体，其实就是用来传递参数的。因为在内存中处理包体时，可能需要一个结构体作为上下文存储状态、结果等一些信息，这个结构体必须在启动 upstream 机制前设置。同时，在处理包体前，还会调用一次 input_filter_init 方法（HTTP 模块如果需要在开始接收包体时初始化变量，都会在这个方法中实现），下面看一下它的定义。

```c
ngx_int_t (*input_filter_init)(void *data);
```

data 参数意义同上，仍然是 input_filter_ctx 成员。

下面将重点讨论如何在 input_filter 方法中处理包体。首先要弄清楚是从哪里获取到本次接收到的上游响应包体。答案是可由 ngx_buf_t 类型的 buffer 缓冲区获得。buffer 缓冲区中的 last 成员指向本次接收到的包体的起始地址，而 input_filter 方法的 bytes 参数表明了本次接收到包体的字节数。通过 buffer-\>last 和 bytes 获取到本次接收到的包体后，下面的工作就是由 HTTP 模块处理接收到的包体。

在处理完这一次收到的包体后，需要告诉 buffer 缓冲区已经处理过刚接收到的包体吗？这就需要看业务需求了。

如果我们需要反复使用 buffer 缓冲区，即 buffer 指向的这块内存需要复用，或者换句话说，下次接收到的响应将会覆盖 buffer 上刚刚接收到的响应，那么 input_filter 方法被调用时必须处理完 buffer 缓冲区中的全部内容，这种情况下不需要修改 buffer 缓冲区中的成员。当再次接收到后续的包体时，将会继续从 buffer-\>last 指向的内存地址处覆盖上次的包体内容。

如果我们希望 buffer 缓冲区保存部分或者全部的包体，则需要进行针对性的处理。我们知道，在 ngx_buf_t 表示的缓冲区中，start 和 end 成员圈定了缓冲区的可用内存，这对于 buffer 缓冲区来说同样成立，last 成员将指向接收到的上游服务器的响应包体的起始内存地址。因此，自由地移动 last 指针就是在改变 buffer 缓冲区。例如，如果希望 buffer 缓冲区存储全部包体内容，那么不妨把 last 指针向后移动 bytes 字节（参见 12.6.2 节）；如果希望 buffer 缓冲区尽可能地接收包体，等缓冲区满后再从头接收，那么可以检测 last 指针，在 last 未达到 end 指针的位置时可以继续向后移动，直到 last 到达 end 指针处，在到达 end 指针后可以把 last 指针指向 start 成员，这样又会重头复用这块内存了。

input_filter 的返回值非常简单，只要不是返回 NGX_ERROR，就都认为是成功的，当然，不出错时最好还是返回 NGX_OK。如果返回 NGX_ERROR，则请求会结束，参见图 12-6。

## 12.6.2 默认的 input_filter 方法

如果 HTTP 模块没有实现 input_filter 方法，那么将使用 ngx_http_upstream_non_buffered_filter 方法作为 input_filter，这个默认的方法将会试图在 buffer 缓冲区中存放全部的响应包体。

ngx_http_upstream_non_buffered_filter 方法其实很简单，下面直接列出其主要代码来分析该方法。

```C
static ngx*int_t ngx_http_upstream_non_buffered_filter(void *data, ssize_t bytes)
{
/* 前文说过， data 参数就是 ngx_http_upstream_t 结构体中的 input_filter_ctx，当 HTTP 模块未实现 input_filter 方法时， input_filter_ctx 成员会指向请求的 ngx_http_request_t 结构体 */
ngx_http_request_t r = data;
ngx_buf_t b;
ngx_chain_t cl, **ll;
ngx_http_upstream_t u;
u = r->upstream;
// 找到 out_bufs 链表的末尾，其中 cl 指向链表中最后一个 ngx_chain_t 元素的 next 成员，所以 cl 最后一定是 NULL 空指针，而 ll 指向最后一个缓冲区的地址，它用来在后面的代码中向 out_bufs 链表添加新的缓冲区
for (cl = u->out_bufs, ll = &u->out_bufs; cl; cl = cl->next)
{
ll = &cl->next;
}
// free_bufs 指向空闲的 ngx_buf_t 结构体构成的链表，如果 free_bufs 此时是空的，那么将会重新由 r-\>pool 内存池中分配一个 ngx_buf_t 结构体给 cl；如果 free_bufs 链表不为空，则直接由 free_bufs 中获取一个 ngx_buf_t 结构体给 cl
cl = ngx_chain_get_free_buf(r->pool, &u->free_bufs);
if (cl == NULL) {
return NGX_ERROR;
}
// 将新分配的 ngx_buf_t 结构体添加到 out_bufs 链表的末尾
ll = cl;
// 修改新分配缓冲区的标志位，表明在内存中， flush 标志位为可能发送缓冲区到客户端服务，参见 12.7 节
cl->buf->flush = 1;
cl->buf->memory = 1;

// buffer 缓冲区才是真正接收上游服务器响应包体的缓冲区
b = &u->buffer;

// last 实际指向本次接收到的包体首地址
cl->buf->pos = b->last;

// last 向后移动 bytes 字节，意味着 buffer 需要保存这次收到的包体
b->last += bytes;

// last 和 pos 成员确定了 out_bufs 链表中每个缓冲区的包体数据
cl->buf->last = b->last;
cl->buf->tag = u->output.tag;
/*如果没有设置包体长度， u-\>length 就是 NGX_MAX_SIZE_T_VALUE，那么到这里结束*/
if (u->length == NGX_MAX_SIZE_T_VALUE) {
return NGX_OK;
}
// 更新 length，需要接收到的包体长度减少 bytes 字节
u->length -= bytes;
return NGX_OK;
}
```

可以看到，默认的 input_filter 方法会试图让独立的 buffer 缓冲区保存全部的包体，这就要求我们对上游服务器的响应包体大小有绝对正确的判断，否则一旦上游服务器发来的响应包体超过 buffer 缓冲区的大小，请求将会出错。

注意对于上述这段代码的理解，可参见图 12-8 第 4 步中 ngx_chain_update_chains 方法的执行过程，它们是配对执行的。

## 12.6.3 接收包体的流程

本节介绍的实际就是 ngx_http_upstream_process_body_in_memory 方法的执行流程，它会负责接收上游服务器的包体，同时调用 HTTP 模块实现的 input_filter 方法处理包体，如图 12-6 所示。

下面分析图 12-6，了解一下在内存中处理包体的流程。

1）首先要检查 Nginx 接收上游服务器的响应是否超时，也就是检查读事件的 timedout 标志位。如果 timedout 为 1，则表示读取响应超时，这时跳到第 2 步调用 ngx_http_upstream_finalize_request 方法结束请求，传递的参数是 NGX_ETIMEDOUT（详见 12.9.3 节）；如果 timedout 为 0，则继续执行第 3 步。

2）调用 ngx_http_upstream_finalize_request 方法结束请求，该方法类似于 ngx_http_finalize_request 方法，它们都需要一个 rc 参数，来决定该方法的行为。

3）在保存着响应包体的 buffer 缓冲区中，last 成员指向空闲内存块的地址（下次还会由 last 处开始接收响应包体），而 end 成员指向缓冲区的结尾，用 end-last 即可计算出剩余空闲内存。如果缓冲区全部用尽，则跳到第 2 步调用 ngx_http_upstream_finalize_request 方法结束请求；如果还有空闲缓冲区，则跳到第 4 步接收包体。

4）调用 recv 方法接收上游服务器的响应，接收到的内容存放在 buffer 缓冲区的 last 成员指向的内存中。检查 recv 的返回值，不同的返回值会导致 3 种结果：如果返回 NGX_AGAIN，则表示期待下一次的读事件，这时跳到第 6 步执行；如果返回 NGX_ERROR 或者上游服务器主动关闭连接，则跳到第 2 步结束请求；如果返回正数，则表示接收到的响应长度，这时跳到第 5 步处理包体。

5）调用 HTTP 模块实现的 input_filter 方法处理本次接收到的包体。检测 input_filter 方法的返回值，返回 NGX_ERROR 时跳到第 2 步结束请求。否则，再检测读事件的 ready 标志位，如果 ready 为 1，则表示仍有 TCP 流可以读取，这时跳到第 3 步执行；如果 ready 为 0，则跳到第 6 步执行。

6）调用 ngx_handle_read_event 方法将读事件添加到 epoll 中。

7）调用 ngx_add_timer 方法将读事件添加到定时器中，超时时间为 ngx_http_upstream_conf_t 配置结构体中的 read_timeout 成员。

在内存中处理包体的关键在于如何实现 input_filter 方法，特别是在该方法中对 buffer 缓冲区的管理。如果上游服务器的响应包体非常小，可以考虑本节说明的这种方式，它的效率很高。

图 12-6 ngx_http_upstream_process_body_in_memory 方法的流程图

## 12.7 以下游网速优先来转发响应

转发上游服务器的响应到下游客户端，这项工作必然是由上游事件来驱动的。因此，以下游网速优先实际上只是意味着需要开辟一块固定长度的内存作为缓冲区。在图 12-5 的第 9 步中会调用 ngx_http_upstream_send_response 方法向客户端转发响应，在该方法中将会判断 buffering 标志位，如果 buffering 为 1，则表明需要打开缓冲区，这时将会优先考虑上游网速，尽可能多地接收上游服务器的响应到内存或者磁盘文件中；而如果 buffering 为 0，则只开辟固定大小的缓冲区内存，在接收上游服务器的响应时如果缓冲区已满则暂停接收，等待缓冲区中的响应发送给客户端后缓冲区会自然清空，于是就可以继续接收上游服务器的响应了。这种设计的好处是没有使用大量内存，这对提高并发连接是有好处的，同时也没有使用磁盘文件，这对降低服务器负载、某些情况下提高请求处理能力也是有益的。

本节我们讨论的正是 buffering 标志位为 0 时的转发响应方式，事实上，这时使用的缓冲区也是接收上游服务器头部时所用的内存，其大小由 ngx_http_upstream_conf_t 配置结构体中的 buffer_size 配置指定。

注意 buffering 标志位的值其实可以根据上游服务器的响应头部而改变。在 12.1.3 节中我们介绍过 change_buffering 标志位，当它的值为 1 时，如果 process_header 方法解析出 X-Accel-Buffering 头部并设置到 headers_in 结构体中后，将根据该头部的值改变 buffering 标志位。

当 X-Accel-Buffering 头部值为 yes 时，对于本次请求而言，buffering 相当于重设为 1，如果头部值为 no，则相当于 buffering 改为 0，除此以外的头部值将不产生作用（参见 ngx_http_upstream_process_buffering 方法）。因此，转发响应时究竟是否需要打开缓存，可以在运行时根据请求的不同而灵活变换。

## 12.7.1 转发响应的包头

转发响应包头这一动作是在 ngx_http_upstream_send_response 方法中完成的，无论 buffering 标志位是否为 0，都会使用该方法来发送响应的包头，图 12-7 和图 12-9 共同构成了 ngx_http_upstream_send_response 方法的完整流程。先来看一下图 12-7，它描述了单一缓冲区下是如何转发包头到客户端，以及为转发包体做准备的。

因为转发响应包头这一过程并不存在反复调用的问题，所以图 12-7 中主要完成了两项工作：将 12.5 节中解析出的包头发送给下游的客户端、设置转发包体的处理方法。下面详细解释图 12-7 描述的 11 个步骤。

1）调用 ngx_http_send_header 方法向下游的客户端发送 HTTP 包头。在接收上游服务器的响应包头时，在图 12-5 的第 6 步中，HTTP 模块会通过 process_header 方法解析包头，并将解析出的值设置到 ngx_http_upstream_t 结构体的 headers_in 成员中，而在第 8 步中， ngx_http_upstream_process_headers 方法则会把 headers_in 中的头部设置到将要发送给客户端的 headers_out 结构体中，ngx_http_send_header 方法就是用来把这些包头发送给客户端的。这一步同时会将 header_sent 标志位置为 1（header_sent 标志位在 12.4 节中发送请求到上游服务器时
会使用）。

图 12-7 buffering 标志位为 0 时发送响应包头的流程

2）如果客户端的请求中有 HTTP 包体，而且曾经调用过 11.8.1 节中的 ngx_http_read_client_request_body 方法接收 HTTP 包体并把包体存放在了临时文件中，这时就会调用 ngx_pool_run_cleanup_file 方法清理临时文件。为什么要在这一步清理临时文件呢？因为上游服务器发送响应时可能会使用到临时文件，之后收到响应解析响应包头时也不可以清理临时文件，而一旦开始向下游客户端转发 HTTP 响应时，则意味着肯定不会再需要客户端请求的包体了，这时可以关闭、转移或者删除临时文件，具体动作由 HTTP 模块实现的 hander 回调方法决定。

3）如果 HTTP 模块没有实现过滤包体的 input_filter 方法，则再把 12.6.2 节介绍过的默认的 ngx_http_upstream_non_buffered_filter 方法作为处理包体的方法，它的工作就在于使用 out_bufs 链表指向接收到的 buffer 缓冲区内容。在 12.7.2 节中将会综合介绍它的作用。

4）设置读取上游服务器响应的方法为 ngx_http_upstream_process_non_buffered_upstream， 即设置 upstream 中的 read_event_handler 回调方法，这样，当上游服务器接收到响应时，通过 ngx_http_upstream_handler 方法可最终调用 ngx_http_upstream_process_non_buffered_upstream 来接收响应。

5）将 ngx_http_upstream_process_non_buffered_downstream 设置为向下游客户端发送包体的方法，也就是把请求 ngx_http_request_t 中的 write_event_handler 设置为这个方法，这样，一旦 TCP 连接上可以向下游客户端发送数据时，会通过 ngx_http_handler 方法最终调用到 ngx_http_upstream_process_non_buffered_downstream 来发送响应包体。

6）调用 HTTP 模块实现的 input_filter_init 方法（当 HTTP 模块没有实现 input_filter 方法时，它是默认任何事情也不做的 ngx_http_upstream_non_buffered_filter_init 方法），为 input_filter 方法处理包体做初始化准备。

检测 buffer 缓冲区在解析完包头后，是否还有已经接收到的包体（实际上就是检查 buffer 缓冲区中的 last 指针是否等于 pos 指针）。如果已经接收到包体，则跳到第 7 步执行；如果没有接收到包体，则跳到第 9 步执行。

7）调用 input_filter 方法处理包体。

8）调用 ngx_http_upstream_process_non_buffered_downstream 方法把本次接收到的包体向下游客户端发送。

9）将 buffer 缓冲区清空，其实就是执行下面两行语句：

```C
u->buffer.pos = u->buffer.start;
u->buffer.last = u->buffer.start;
```

pos 指针一般指向未经处理的响应，而 last 指针一般指向刚接收到的响应，这时把它们全部设为指向缓冲区起始地址的 start 指针，即表示清空缓冲区。

10）调用 ngx_http_send_special 方法，如下所示。

```C
if (ngx_http_send_special(r, NGX_HTTP_FLUSH) == NGX_ERROR) {
ngx_http_upstream_finalize_request(r, u, 0);
return;
}
```

NGX_HTTP_FLUSH 标志位意味着如果请求 r 的 out 缓冲区中依然有等待发送的响应，则“催促”着发送出它们。

11）如果与上游服务器的连接上有可读事件，则调用 ngx_http_upstream_process_non_buffered_upstream 方法处理响应；否则，当前流程结束，将控制权交还给 Nginx 框架。

以上步骤提到的下游处理方法 ngx_http_upstream_process_non_buffered_downstream 和上游处理方法 ngx_http_upstream_process_non_buffered_upstream 都将在下文中介绍。

## 12.7.2 转发响应的包体

当接收到上游服务器的响应时，将会由 ngx_http_upstream_process_non_buffered_upstream 方法处理连接上的这个读事件，该方法比较简单，下面直接列举源代码说明其流程。

```C
static void ngx_http_upstream_process_non_buffered_upstream(ngx_http_request_t r, ngx_http_upstream_t u)
{
ngx_connection_t *c;
// 获取 Nginx 与上游服务器间的 TCP 连接 c
c = u->peer.connection;
// 如果读取响应超时（超时时间为 read_timeout），则需要结束请求
if (c->read->timedout) {
// ngx_http_upstream_finalize_request 方法可参见 12.9.3 节
ngx_http_upstream_finalize_request(r, u, 0);
return;
}
/*这个方法才是真正决定以固定内存块作为缓存时如何转发响应的，注意，传递的第 2 个参数是 0*/
ngx_http_upstream_process_non_buffered_request(r, 0);
}
```

可以看到，实际接收上游服务器响应的其实是 ngx_http_upstream_process_non_buffered_request 方法，先不着急看它的实现，先来看看向下游客户端发送响应时调用的 ngx_http_upstream_process_non_buffered_downstream 方法是怎样实现的，如下所示。

```C
static void ngx_http_upstream_process_non_buffered_downstream(ngx_http_request_t r)
{
ngx_event_t wev;
ngx_connection_t c;
ngx_http_upstream_t u;
// 注意，这个 c 是 Nginx 与客户端之间的 TCP 连接
c = r->connection;
u = r->upstream;
wev = c->write;
/*如果发送超时，那么同样要结束请求，超时时间就是 nginx.conf 文件中的 send*timeout 配置项 */
if (wev->timedout) {
c->timedout = 1;
// 注意，结束请求时传递的参数是 NGX_HTTP_REQUEST_TIME_OUT
ngx_http_upstream_finalize_request(r, u, NGX_HTTP_REQUEST_TIME_OUT);
return;
}
// 同样调用该方法向客户端发送响应包体，注意，传递的第 2 个参数是 1
ngx_http_upstream_process_non_buffered_request(r, 1);
}
```

无论是接收上游服务器的响应，还是向下游客户端发送响应，最终调用的方法都是 ngx_http_upstream_process_non_buffered_request，唯一的区别是该方法的第 2 个参数不同，当需要读取上游的响应时传递的是 0，当需要向下游发送响应时传递的是 1。下面先看看该方法到底做了哪些事情，如图 12-8 所示。

图 12-8 中的 do_write 变量就是 ngx_http_upstream_process_non_buffered_request 方法中的第 2 个参数，当然，首先它还会有一个初始化，如下所示。

```C
do_write = do_write || u->length == 0;
```

这里的 length 变量表示还需要接收的上游包体的长度，当 length 为 0 时，说明不再需要接收上游的响应，那只能继续向下游发送响应，因此，do_write 只能为 1。do_write 标志位表示本次是否向下游发送响应。下面详细解释图 12-8 中的每个步骤。

1）如果 do_write 标志位为 1，则跳到第 2 步开始向下游发送响应；如果 do_write 为 0，则表示需要由上游读取响应，这时跳到第 6 步执行。注意，在图 12-8 中，这一步是在一个大循环中执行的，也就是说，与上、下游间的通信可能反复执行。

2）首先检查缓存中来自上游的响应包体，是否还有未转发给下游的。这个检查过程很简单，因为每当在缓冲区中接收到上游的响应时，都会调用 input_filter 方法来处理。当 HTTP 模块没有实现该方法时，我们就会使用 12.6.2 节介绍过的 ngx_http_upstream_non_buffered_filter 方法来处理响应，该方法会在 out_bufs 链表中增加 ngx_buf_t 缓冲区（没有分配实际的内存） 指向 buffer 中接收到的响应。因此，在向下游发送包体时，直接发送 out_bufs 缓冲区指向的内容即可，每当发送成功时则会在下面的第 4 步中更新 out_bufs 缓冲区，从而将已经发送出去的 ngx_buf_t 成员回收到 free_bufs 链表中。

事实上，检查是否有内容需要转发给下游的代码是这样的：

```C
if (u->out_bufs || u->busy_bufs) { …
}
```

可能有人会奇怪，为什么除了 out_bufs 缓冲区链表以外还要检查 busy_bufs 呢？这是因为在第 3 步向下游发送 out_bufs 指向的响应时，未必可以一次发送完。这时，在第 4 步中，会使用 busy_bufs 指向 out_bufs 中的内容，同时将 out_bufs 置为空，使得它在继续处理接收到的响应包体的 ngx_http_upstream_non_buffered_filter 方法中指向新收到的响应。因此，只有 out_bufs 和 busy_bufs 链表都为空时，才表示没有响应需要转发到下游，这时跳到第 5 步执行，否则跳到第 2 步向下游发送响应。

3）调用 ngx_http_output_filter 方法向下游发送 out_bufs 指向的内容，其代码如下。

```C
rc = ngx_http_output_filter(r, u->out_bufs);
```

图 12-8 ngx_http_upstream_process_non_buffered_request 方法的流程图

读者在这里可能会有疑问，在 busy_bufs 不为空时，不是也有内容要发送吗？注意， busy_bufs 指向的是上一次 ngx_http_output_filter 未发送完的缓存，这时请求 ngx_http_request_t 结构体中的 out 缓冲区已经保存了它的内容，不需要再次发送 busy_bufs 了。

4）调用 ngx_chain_update_chains 方法更新上文说过的 free_bufs、busy_bufs、out_bufs 这 3 个缓冲区链表，它们实际上做了以下 3 件事情。

-   清空 out_bufs 链表。

-   把 out_bufs 中已经发送完的 ngx_buf_t 结构体清空重置（即把 pos 和 last 成员指向 start），同时把它们追加到 free_bufs 链表中。

-   如果 out_bufs 中还有未发送完的 ngx_buf_t 结构体，那么添加到 busy_bufs 链表中。这一步与 ngx_http_upstream_non_buffered_filter 方法的执行是对应的。

5）当 busy_bufs 链表为空时，表示到目前为止需要向下游转发的响应包体都已经全部发送完了（也就是说，ngx_http_request_t 结构体中的 out 缓冲区都发送完了），这时将把 buffer 接收缓冲区清空（pos 和 last 成员指向 start），这样，buffer 接收缓冲区中的内容释放后，才能继续接收更多的响应包体。

6）获取 buffer 缓冲区中还有多少剩余空间，即：

```C
size = u->buffer.end - u->buffer.last;
```

这里获取的 size 就是第 7 步 recv 方法能够接收的最大字节数。

当 size 大于 0，且与上游的连接上确实有可读事件时（检查读事件的 ready 标志位），就会跳到第 7 步开始接收响应，否则直接跳到 10 步准备结束本次调度中的转发动作。

7）调用 recv 方法将上游的响应接收到 buffer 缓冲区中。检查 recv 的返回值，如果返回正数，则表示确实接收到响应，跳到第 8 步处理接收到的包体；如果返回 NGX_AGAIN，则表示期待 epoll 下次有读事件时再继续调度，这时跳到第 10 步执行；如果返回 0，则表示上游服务器关闭了连接，跳到第 9 步执行。

8）调用 input_filter 方法处理包体（参考 12.6.2 节的默认处理方法）。

9）执行到这一步表示读取到了来自上游的响应，这时设置 do_write 标志位为 1，同时跳到第 1 步准备向下游转发刚收到的响应。

10）调用 ngx_handle_write_event 方法将 Nginx 与下游之间连接上的写事件添加到 epoll 中。

11）调用 ngx_add_timer 方法将 Nginx 与下游之间连接上的写事件添加到定时器中，超时时间就是配置文件中的 send_timeout 配置项。

12）调用 ngx_handle_read_event 方法将 Nginx 与上游服务器之间的连接上的读事件添加到 epoll 中。

13）调用 ngx_add_timer 方法将 Nginx 与上游服务器之间连接上的读事件添加到定时器中，超时时间就是 ngx_http_upstream_conf_t 配置结构体中的 read_timeout 成员。

阅读完第 11 章，读者应该很熟悉 Nginx 读/写事件的处理过程了。另外，理解转发包体这一过程最关键的是弄清楚缓冲区的用法，特别是分配了实际内存的 buffer 缓冲区与仅仅负责指向 buffer 缓冲区内容的 3 个链表（out_bufs、busy_bufs、free_bufs）之间的关系，这样就对这种转发过程的优缺点非常清楚了。如果下游网速慢，那么有限的 buffer 缓冲区就会降低上游的发送响应速度，可能对上游服务器带来高并发压力。

## 12.8 以上游网速优先来转发响应

如果上游服务器向 Nginx 发送响应的速度远快于下游客户端接收 Nginx 转发响应时的速度，这时可以通过将 ngx_http_upstream_conf_t 配置结构体中的 buffering 标志位设为 1，允许 upstream 机制打开更大的缓冲区来缓存那些来不及向下游转发的响应，允许当达到内存构成的缓冲区上限时以磁盘文件的形式来缓存来不及向下游转发的响应。什么是更大的缓冲区呢？由 12.7 节我们知道，当 buffering 标志位为 0 时，将使用 ngx_http_upstream_conf_t 配置结构体 中的 buffer_size 指定的一块固定大小的缓冲区来转发响应，而当 buffering 为 1 时，则使用 bufs 成员指定的内存缓冲区（最多拥有 bufs.num 个，每个缓冲区大小固定为 bufs.size 字节）来转发响应，当上游响应占满所有缓冲区时，使用最大不超过 max_temp_file_size 字节的临时文件来缓存响应。

事实上，官方发布的 ngx_http_proxy_module 反向代理模块默认配置下就是使用这种方式来转发上游服务器响应的，由于它涉及了多个内存缓冲区的配合问题，以及临时磁盘文件的使用，导致它的实现方式异常复杂，12.8.1 节介绍的 ngx_event_pipe_t 结构体是该转发方式的核心结构体，需要基于它来理解转发流程。

这种转发响应方式集成了 Nginx 的文件缓存功能，本节将只讨论纯粹转发响应的流程，不会涉及文件缓存部分（以临时文件缓存响应并不属于文件缓存，因为临时文件在请求结束后会被删除）。

## 12.8.1 ngx_event_pipe_t 结构体的意义

如果将 ngx_http_upstream_conf_t 配置结构体的 buffering 标志位设置为 1，那么 ngx_event_pipe_t 结构体必须要由 HTTP 模块创建。

注意 upstream 中的 pipe 成员默认指向 NULL 空指针，而且 upstream 机制永远不会为它自动实例化，因此，必须由使用 upstream 的 HTTP 模块为 pipe 分配内存。

ngx_event_pipe_t 结构体维护着上下游间转发的响应包体，它相当复杂。例如，缓冲区链表 ngx_chain_t 类型的成员就定义了 6 个（包括 free_raw_bufs、in、out、free、busy、preread_bufs），为什么要用如此复杂的数据结构支撑看似简单的转发过程呢？这是因为 Nginx 的宗旨就是高效率，所以它绝不会把相同内容复制到两块内存中，而同一块内存如果既要用于接收上游发来的响应，又要准备向下游发送，很可能还要准备写入临时文件中，这就带来了很高的复杂度，ngx_event_pipe_t 结构体的任务就在于解决这个问题。

理解这个结构体中各个成员的含义将会帮助我们弄清楚 buffering 为 1 时转发响应的流程，特别是可以弄清楚 Nginx 绝不复制重复内存的高效做法是如何实现的。当然，我们也可以先跳到 12.8.2 节综合理解这种转发方式下的运行机制，再针对流程中遇到的 ngx_event_pipe_t 结构体中的成员返回到本节来查询其意义。下面看一下它各个成员的意义。

```C
typedef struct ngx*event_pipe_s ngx_event_pipe_t;
// 处理接收自上游的包体的回调方法原型
typedef ngx_int_t (*ngx_event_pipe_input_filter_pt) (ngx_event_pipe_t p, ngx_buf_t buf);
// 向下游发送响应的回调方法原型
typedef ngx_int_t (*ngx_event_pipe_output_filter_pt)(void data, ngx_chain_t chain);
struct ngx_event_pipe_s {
// Nginx 与上游服务器间的连接
ngx_connection_t *upstream;
// Nginx 与下游客户端间的连接
ngx_connection_t *downstream;
/*直接接收自上游服务器的缓冲区链表，注意，这个链表中的顺序是逆序的，也就是说，链表前端的 ngx_buf_t 缓冲区指向的是后接收到的响应，而后端的 ngx_buf_t 缓冲区指向的是先接收到的响应。因此， free_raw_bufs 链表仅在接收响应时使用 */
ngx_chain_t free_raw_bufs;
/*表示接收到的上游响应缓冲区。通常， in 链表是在 input_filter 方法中设置的，可参考 ngx_event_pipe_copy_input_filter 方法，它会将接收到的缓冲区设置到 in 链表中 */
ngx_chain_t in;
// 指向刚刚接收到的一个缓冲区
ngx_chain_t **last_in;
/*保存着将要发送给客户端的缓冲区链表。在写入临时文件成功时，会把 in 链表中写入文件的缓冲区添加到 out 链表中 */
ngx_chain_t out;
// 指向刚加入 out 链表的缓冲区，暂无实际意义
ngx_chain_t **last_out;
// 等待释放的缓冲区
ngx_chain_t free;
// 设置 busy 缓冲区中待发送的响应长度触发值，当达到 busy_size 长度时，必须等待 busy 缓冲区发送了足够的内容，才能继续发送 out 和 in 缓冲区中的内容
ssize_t busy_size;
// 表示上次调用 ngx_http_output_filter 方法发送响应时没有发送完的缓冲区链表。这个链表中的缓冲区已经保存到请求的 out 链表中， busy 仅用于记录还有多大的响应正等待发送
ngx_chain_t busy;
/*处理接收到的来自上游服务器的缓冲区。一般使用 upstream 机制默认提供的 ngx*event_pipe_copy_input_filter 方法作为 input_filter*/
ngx_event_pipe_input_filter_pt input_filter;
/*用于 input_filter 方法的成员，一般将它设置为 ngx_http_request_t 结构体的地址 */
void input_ctx;
/*表示向下游发送响应的方法，默认使用 ngx_http_output_filter 方法作为 output_filter*/
ngx_event_pipe_output_filter_pt output_filter;
// 指向 ngx_http_request_t 结构体
void *output_ctx;
// 标志位， read 为 1 时表示当前已经读取到上游的响应
unsigned read:1;
/*标志位，为 1 时表示启用文件缓存。本章描述的场景都忽略了文件缓存，也就是默认 cacheable 值为 0*/
unsigned cacheable:1;
// 标志位，为 1 时表示接收上游响应时一次只能接收一个 ngx_buf_t 缓冲区
unsigned single_buf:1;
/*标志位，为 1 时一旦不再接收上游响应包体，将尽可能地立刻释放缓冲区。所谓尽可能是指，一旦这个缓冲区没有被引用，如没有用于写入临时文件或者用于向下游客户端释放，就把缓冲区指向的内存释放给 pool 内存池 */
unsigned free_bufs:1;

// 提供给 HTTP 模块在 input_filter 方法中使用的标志位，表示 Nginx 与上游间的交互已结束。如果 HTTP 模块在解析包体时，认为从业务上需要结束与上游间的连接，那么可以把 upstream_done 标志位置为 1*/
unsigned upstream_done:1;

/* Nginx 与上游服务器之间的连接出现错误时， upstream_error 标志位为 1，一般当接收上游响应超时，或者调用 recv 接收出现错误时，就会把该标志位置为 1*/
unsigned upstream_error:1;

/*表示与上游的连接状态。当 Nginx 与上游的连接已经关闭时， upstream_eof 标志位为 1*/
unsigned upstream*eof:1;

/*表示暂时阻塞住读取上游响应的流程，期待通过向下游发送响应来清理出空闲的缓冲区，再用空出的缓冲区接收响应。也就是说， upstream*blocked 标志位为 1 时会在 ngx_event_pipe 方法的循环中先调用 ngx_event_pipe_write_to_downstream 方法发送响应，然后再次调用 ngx_event_pipe_read_upstream 方法读取上游响应 */
unsigned upstream_blocked:1;

// downstream_done 标志位为 1 时表示与下游间的交互已经结束，目前无意义
unsigned downstream_done:1;
/* Nginx 与下游客户端间的连接出现错误时， downstream_error 标志位为 1。在代码中，一般是向下游发送响应超时，或者使用 ngx_http_output_filter 方法发送响应却返回 NGX_ERROR 时，把 downstream_error 标志位设为 1*/
unsigned downstream_error:1;

/* cyclic*temp_file 标志位为 1 时会试图复用临时文件中曾经使用过的空间。不建议将 cyclic_temp_file 设为 1。它是由 ngx_http_upstream_conf_t 配置结构体中的同名成员赋值的 */
unsigned cyclic_temp_file:1;

// 表示已经分配的缓冲区数目， allocated 受到 bufs.num 成员的限制
ngx_int_t allocated;
/* bufs 记录了接收上游响应的内存缓冲区大小，其中 bufs.size 表示每个内存缓冲区的大小，而 bufs.num 表示最多可以有 num 个接收缓冲区 */
ngx_bufs_t bufs;

// 用于设置、比较缓冲区链表中 ngx_buf_t 结构体的 tag 标志位
ngx_buf_tag_t tag;
// 已经接收到的上游响应包体长度
off_t read_length;
/*与 ngx*http_upstream_conf_t 配置结构体中的 max_temp_file_size 含义相同，同时它们的值也是相等的，表示临时文件的最大长度 off_t max_temp_file_size; 与 ngx_http_upstream_conf_t 配置结构体中的 temp_file_write_size 含义相同，同时它们的值也是相等的，表示一次写入文件时的最大长度 */
ssize_t temp_file_write_size;

// 读取上游响应的超时时间
ngx_msec_t read_timeout;
// 向下游发送响应的超时时间
ngx_msec_t send_timeout;
// 向下游发送响应时， TCP 连接中设置的 send_lowat“水位”
ssize_t send_lowat;
// 用于分配内存缓冲区的连接池对象
ngx_pool_t *pool;
// 用于记录日志的 ngx_log_t 对象
ngx_log_t *log;
// 表示在接收上游服务器响应头部阶段，已经读取到的响应包体
ngx_chain_t *preread_bufs;
// 表示在接收上游服务器响应头部阶段，已经读取到的响应包体长度
size_t preread_size;
// 仅用于缓存文件的场景，本章不涉及，故不再详述该缓冲区
ngx_buf_t *buf_to_file;
// 存放上游响应的临时文件，最大长度由 max_temp_file_size 成员限制
ngx_temp_file_t *temp_file;
// 已使用的 ngx_buf_t 缓冲区数目
int num;
};
```

注意，ngx_event_pipe_t 结构体仅用于转发响应。

## 12.8.2 转发响应的包头

开始转发响应也是通过 ngx_http_upstream_send_response 方法执行的。图 12-9 展示了转发响应包头和初始化 ngx_event_pipe_t 结构体的流程。

图 12-9 buffering 标志位为 0 时转发响应包头的流程图

下面说明一下图 12-9 中的步骤。

1）首先调用 ngx_http_send_header 方法向下游客户端发送 ngx_http_request_t 结构体的 headers_out 中设置过的 HTTP 响应包头。

2）如果客户端请求中存在 HTTP 包体，而且包体已经保存到临时文件中了，这时将会调用 ngx_pool_run_cleanup_file 方法清理临时文件，以释放不必要的资源。这里的第 1 步和第 2 步与图 12-8 中的完全一样，不再详述。

3）ngx_http_upstream_t 结构体中的 pipe 成员并不是在这一步中创建，它仅在这一步中初始化部分成员，因此，一旦 pipe 到这一步还没有创建，就会出现内存访问越界，引发严重错误。ngx_event_pipe_t 结构体的初始化大概包括以下部分：

```C
// 注意，这里是直接引用必须分配过内存的 pipe 指针
ngx_event_pipe_t* p = u->pipe;
// 设置向下游客户端发送响应的方法为 ngx_http_output_filter，该方法在第 11 章中介绍过
p->output_filter = (ngx_event_pipe_output_filter_pt) ngx_http_output_filter;
// output_ctx 指向当前请求的 ngx_http_request_t 结构体，这是因为接下来转发包体的方法都只接受 ngx_event_pipe_t 参数，且只能由 output_ctx 成员获取到表示请求的 ngx_http_request_t 结构体
p->output_ctx = r;
// 设置转发响应时启用的每个缓冲区的 tag 标志位
p->tag = u->output.tag;
// bufs 指定了内存缓冲区的限制
p->bufs = u->conf->bufs;
// 设置 busy 缓冲区中待发送的响应长度触发值
p->busy_size = u->conf->busy_buffers_size;
// upstream 在这里被初始化为 Nginx 与上游服务器之间的连接
p->upstream = u->peer.connection;
// downstream 在这里被初始化为 Nginx 与下游客户端之间的连接
p->downstream = c;
// 初始化用于分配内存缓冲区的内存池
p->pool = r->pool;
// 初始化记录日志的 log 成员
p->log = c->log;
// 设置临时存放上游响应的单个缓存文件的最大长度
p->max_temp_file_size = u->conf->max_temp_file_size;
// 设置一次写入文件时写入的最大长度
p->temp_file_write_size = u->conf->temp_file_write_size;
// 以当前 location 下的配置来设置读取上游响应的超时时间
p->read_timeout = u->conf->read_timeout;
// 以当前 location 下的配置来设置发送到下游的超时时间
p->send_timeout = clcf->send_timeout;
// 设置向客户端发送响应时 TCP 中的 send_lowat“水位”
p->send_lowat = clcf->send_lowat;
```

4）初始化 preread_bufs 预读缓冲区链表（所谓预读，就是在读取包头时也预先读取到了部分包体），注意，该链表中的缓冲区都是不会分配内存来存放上游响应内容的，而仅使用 ngx_buf_t 结构体指向实际的存放响应包体的内存。如何初始化 preread_bufs 呢？如下所示。

```C
p->preread_bufs->buf = &u->buffer;
p->preread_bufs->next = NULL;
p->preread_size = u->buffer.last - u->buffer.pos;
```

实际上就是把 preread_bufs 中的缓冲区指向存放头部的 buffer 缓冲区，在图 12-11 中的第 1 步会介绍它的用法。

5）设置处理上游读事件回调方法为 ngx_http_upstream_process_upstream。

6）设置处理下游写事件的回调方法为 ngx_http_upstream_process_downstream。

7）调用 ngx_http_upstream_process_upstream 方法处理上游发来的响应包体。

ngx_event_pipe_t 结构体是打开缓存转发响应的关键，下面的章节中我们会一直与它“打交道”。

## 12.8.3 转发响应的包体

在图 12-9 中我们看到，处理上游读事件的方法是 ngx_http_upstream_process_upstream，处理下游写事件的方法是 ngx_http_upstream_process_downstream，但它们最终都是通过 ngx_event_pipe 方法实现缓存转发响应功能的（类似于在 12.7.2 节中介绍过的无缓存转发响应情形，ngx_http_upstream_process_non_buffered_upstream 方法负责处理上游读事件，ngx_http_upstream_process_non_buffered_downstream 方法负责处理下游写事件，但它们最终都是通过 ngx_http_upstream_process_non_buffered_request 方法实现转发响应功能的）。无论是否打开缓存，它们的代码都非常相似，所以本节不再罗列这两种方法的代码，直接开始介绍 ngx_event_pipe 方法，先来看看它的定义。

```C
ngx_int_t ngx_event_pipe(ngx_event_pipe_t *p, ngx_int_t do_write)
```

其中，p 参数正是负责转发响应的 ngx_event_pipe_t 结构体，而 do_write 则是标志位，其为 1 时表示需要向下游客户端发送响应，为 0 时表示仅需要由上游客户端接收响应。图 12-10 给出了 ngx_event_pipe 方法的流程图，该方法通过调用 ngx_event_pipe_read_upstream 方法读取上游响应，调用 ngx_event_pipe_write_to_downstream 方法向下游发送响应，因此，在流程图中暂时看不出内存缓冲区与临时缓存文件的用法。

下面介绍图 12-10 中的 10 个步骤。

1）检查 do_write 标志位，如果 do_write 为 0，则直接跳到第 5 步开始读取上游服务器发来的响应；如果 do_write 为 1，则继续执行第 2 步。

2）调用 ngx_event_pipe_write_to_downstream 方法（参见 12.8.5 节）向下游客户端发送响应包体，检测其返回值：如果返回 NGX_OK，则跳到第 5 步处理上游的读事件；如果返回 NGX_ABORT，则跳到第 3 步执行；如果返回 NGX_BUSY，则跳到第 4 步执行。

图 12-10 ngx_event_pipe 方法的流程图

3）ngx_event_pipe 方法结束，返回 NGX_ABORT 表示请求处理失败。

4）ngx_event_pipe 方法结束，返回 NGX_OK 表示本次暂不往下执行。

5）调用 ngx_event_pipe_read_upstream 方法（参见 12.8.4 节）读取上游服务器的响应，同时检测其返回值以及 ngx_event_pipe_t 结构体中的 read 和 upstream_blocked 标志位：如果返回 NGX_ABORT，则跳到第 3 步执行，否则检查 read 和 upstream_blocked 标志位。如果这两个标志位同时为 0，那么跳到第 7 步执行；如果这两个标志位有任一个为 1，则表示需要向下游发送读到的响应，跳到第 6 步执行。在这里，read 标志位为 1 时表示 ngx_event_pipe_read_upstream 方法执行后读取到了响应，而 upstream_blocked 为 1 时则表示执行后需要暂时停止读取上游响应，需要通过向下游发送响应来清理出空闲缓冲区，以供 ngx_event_pipe_read_upstream 方法再次读取上游的响应。

6）设置 do_write 标志位为 1，继续跳到第 1 步向下游发送刚收到的上游响应，重复这个循环。

7）调用 ngx_handle_read_event 方法将上游的读事件添加到 epoll 中，等待下一次接收到上游响应的事件出现。

8）调用 ngx_add_timer 方法将上游的读事件添加到定时器中，超时时间就是 ngx_event_pipe_t 结构体的 read_timeout 成员（参见图 12-9 的第 3 步关于该成员的初始化）。

9）调用 ngx_handle_write_event 方法将下游的写事件添加到 epoll 中，等待下一次可以向下游发送响应的事件出现。

10）调用 ngx_add_timer 方法将下游的写事件添加到定时器中，超时时间就是 ngx_event_pipe_t 结构体的 send_timeout 成员（参见图 12-9 的第 3 步关于该成员的初始化）。

可以看到，ngx_event_pipe 方法在没有涉及缓存细节的情况下设计了转发响应的流程，它是通过调用 ngx_event_pipe_read_upstream 方法和 ngx_event_pipe_write_to_downstream 方法，以及检测它们的返回值来把握缓存响应的转发，再把事件与 epoll 和定时器关联起来的。下面我们将详细描述如何读取响应、如何分配内存缓冲区、如何通过写入临时文件释放缓冲区、如何通过向下游发送响应来更新缓冲区。

## 12.8.4 ngx_event_pipe_read_upstream 方法

ngx_event_pipe_read_upstream 方法负责接收上游的响应，在这个过程中会涉及以下 4 种情况。

-   接收响应头部时可能接收到部分包体。

-   如果没有达到 bufs.num 上限，那么可以分配 bufs.size 大小的内存块充当接收缓冲区。

-   如果恰好下游的连接处于可写状态，则应该优先发送响应来清理出空闲缓冲区。

-   如果缓冲区全部写满，则应该写入临时文件。

这 4 种情况会造成 ngx_event_pipe_read_upstream 方法较为复杂，特别是任何一个 ngx_buf_t 缓冲区都存在复用的情况，什么时候释放、重复使用它们会很麻烦，因此，首先把纯粹地接收自上游缓冲区的代码提取出来，概括为流程图，如图 12-11 所示，读者首先看看到底怎样接收上游响应，然后再来分析 ngx_event_pipe_read_upstream 方法。

图 12-11 使用缓冲区接收上游响应的流程图

图 12-11 中的步骤很清晰，主要是在寻找使用哪一块缓冲区接收上游响应。注意，在选择缓冲区时也有优先级。下面我们分析其中的 7 个步骤。

1）首先检查 ngx_event_pipe_t 结构体中的 preread_bufs 缓冲区（若无特殊说明，以下介绍的成员都属于 ngx_event_pipe_t 结构体），它存放着在接收响应包头时可能接收到的包体（图 12-9 中的第 4 步初始化了 preread_bufs 缓冲区），如果 preread_bufs 中有内容，意味着需要优先处理这部分包体，而不是去接收更多的包体，这样，接收流程就结束了。如果 preread_bufs 缓冲区是空的，那么继续向下执行。

2）检查 free_raw_bufs 缓冲区链表，free_raw_bufs 用来表示一次 ngx_event_pipe_read_upstream 方法调用过程中接收到的上游响应。注意，free_raw_bufs 链表中缓冲区的顺序与接收顺序是相反的，每次使用缓冲区接收到上游发来的响应后，都会把该缓冲区添加到 free_raw_bufs 末尾。如果 free_raw_bufs 为空，则继续第 3 步执行；否则，跳到第 6 步使用 free_raw_bufs 缓冲区接收上游响应。

3）将已经分配的缓冲区数量（allocated 成员）与 bufs.num 配置相比，如果 allocated 小于 bufs.num，则可以从 pool 内存池中分配到一块新的缓冲区，再跳到第 6 步用这块缓冲区来接收上游响应，否则说明分配的缓冲区已经达到上限，跳到第 4 步继续向下执行。

4）检查 Nginx 与下游的连接 downstream 成员，检查它的写事件的 ready 标志位，如果 ready 为 1，则表示当前可以向下游发送响应，再检查写事件的 delayed 标志位，如果 delayed 为 0，则说明并不是由于限速才使得写事件准备好，这两个条件都满足时表明应当由向下游发送响应来释放缓冲区，以期可以使用释放出的空闲缓冲区再接收上游响应。怎么做到呢？将 upstream_blocked 置为 1 即可。当无法满足上述条件时，继续执行第 5 步。

5）检查临时文件中已经写入的响应内容长度（也就是 temp_file-\>offset）是否达到配置上限（也就是 max_temp_file_size 配置），如果已经达到，则暂时不再接收上游响应；如果没有达到，调用 ngx_event_pipe_write_chain_to_temp_file 方法将响应写入临时文件中。下面简单地看看这个方法做了些什么：首先将 in 缓冲区链表中的内容写入 temp_file 临时文件中，再把写入临时文件的 ngx_buf_t 缓冲区由 in 缓冲区链表中移出，添加到 out 缓冲区链表中。在写入临时文件成功后，跳到第 6 步使用 free_raw_bufs 缓冲区接收上游响应。

6）调用 recv_chain 方法接收上游的响应。

7）将新接收到的缓冲区置到 free_raw_bufs 链表的最后。

图 12-11 中的这 7 个步骤将会找出一个缓冲区接收上游的响应，并把这个缓冲区添加到 free_raw_bufs 链表中，下面我们以此为基础，看看图 12-12 中 ngx_event_pipe_read_upstream 方法是如何处理 free_raw_bufs 链表的。

图 12-12 展示了 ngx_event_pipe_read_upstream 方法的全部流程，其中主要包括一个接收上游响应的循环，而每一次接收到上游响应后又会有一个循环来处理 free_raw_bufs 链表中的全部缓冲区，下面详细分析一下这 11 个步骤。

图 12-12 ngx_event_pipe_read_upstream 方法接收上游响应的流程

1）检查上游连接是否结束，以及与上游连接的读事件是否已经就绪，代码如下。

```C
// 这 3 个标志位的意义可参见 12.8.1 节，其中任一个为 1 都表示上游连接需要结束
if (p->upstream*eof || p->upstream_error || p->upstream_done) {
// 跳到第 9 步执行
break;
}
/*如果读事件的 ready 标志位为 0，则说明没有上游响应可以接收； preread*bufs 预读缓冲区为空，表示接收包头时没有收到包体，或者收到过包体但已经处理过了 */
if (p->preread_bufs == NULL && !p->upstream->read->ready) {
// 跳到第 9 步执行
break;
}
```

如果这两个条件有一个满足，则需要跳到第 9 步，准备结束 ngx_event_pipe_read_upstream 方法，否则继续执行第 2 步。

2）接收上游响应，这一步实际上就是执行图 12-11 中列出的 7 个步骤。它会导致 3 种结果：① 如果 free_raw_bufs 链表中有需要处理的包体，则跳到第 3 步执行；② 执行到图 12-11 的第 4 步分支，upstream_blocked 标志位置为 1，同时，ngx_event_pipe_read_upstream 方法返回 NGX_OK；③ 如果没有接收到包体，则跳到第 8 步执行。

3）置 read 标志位为 1，表示接收到的包体待处理。

4）从接收到的缓冲区链表中取出一块 ngx_buf_t 缓冲区。

5）调用 ngx_event_pipe_remove_shadow_links 方法将这块缓冲区中的 shadow 域释放掉，因为刚刚接收到的缓冲区，必然不存在多次引用的情况，所以 shadow 成员要指向空指针。

6）检查本次读取到的包体是否大于或等于缓冲区的剩余空间大小。这一步的意义在于，如果当前接收到的长度小于缓冲区长度，则说明这个缓冲区还可以用于再次接收响应，这时跳到第 7 步执行；否则，这个缓冲区已满，则应该调用 input_filter 方法处理，当然，默认的 input_filter 方法就是 ngx_event_pipe_copy_input_filter，它所做的事情就是在 in 链表中添加这个缓冲区。继续循环执行第 4 步，遍历本次接收到的所有缓冲区。

7）将本次接收到的缓冲区添加到 free_raw_bufs 链表末尾，继续第 1 步执行这个大循环。

8）将 upstream_eof 标志位置为 1，表示上游服务器已经关闭了连接。

9）检查 upstream_eof 和 upstream_error 标志位是否有任意一个为 1，如果有，则说明上游连接已经结束，这时如果 free_raw_bufs 缓冲区链表不为空，则需要跳到第 10 步处理 free_raw_bufs 中的缓冲区；否则返回 NGX_OK，结束 ngx_event_pipe_read_upstream 方法。

10）再次调用 input_filter 方法处理 free_raw_bufs 中的缓冲区（类似第 6 步，但这次只处理可能剩余的最后一个缓冲区）。

11）检查 free_bufs 标志位，如果 free_bufs 为 1，则说明需要尽快释放缓冲区中用到的内存，这时调用 ngx_pfree 方法释放 shadow 域为空的缓冲区。

可以看到，ngx_event_pipe_read_upstream 方法将会把接收到的响应存放到内存或者磁盘文件中，同时用 ngx_buf_t 缓冲区指向这些响应，最后用 in 和 out 缓冲区链表把这些 ngx_buf_t 缓冲区管理起来。图 12-12 只是展示了 ngx_event_pipe_read_upstream 方法的主要流程，如果需要理解这种转发时缓冲区的详细用法，还需要对照着图 12-11 和图 12-12 来阅读 ngx_event_pipe.c 源文件。

## 12.8.5 ngx_event_pipe_write_to_downstream 方法

ngx_event_pipe_write_to_downstream 方法负责把 in 链表和 out 链表中管理的缓冲区发送给下游客户端，因为 out 链表中的缓冲区内容在响应中的位置要比 in 链表更靠前，所以 out 需要优先发送给下游。图 12-13 给出了 ngx_event_pipe_write_to_downstream 方法的流程图，这个流程图的核心就是在与下游的连接事件上出于可写状态时，尽可能地循环发送 out 和 in 链表缓冲区中的内容，其中在第 7、第 8 步中还会涉及 shadow 域中指向的缓冲区释放的问题。

下面详细分析一下图 12-13 中的 13 个步骤。

1）首先检查上游连接是否结束，判断依据与图 12-12 中的第 1 步非常相似，检查 upstream_eof、upstream_error 还有 upstream_done 标志位，任意一个标志位为 1 都表示上游连接不会再收到响应了，这时跳到第 2 步执行；否则继续检查与下游连接的写事件 ready 标志位，如果 ready 为 1，表示可以向下游发送响应，这时跳到第 5 步执行，否则 ngx_event_pipe_write_to_downstream 方法结束。

2）调用 output_filter 方法把 out 链表中的缓冲区发送到下游客户端。

3）调用 output_filter 方法把 in 链表中的缓冲区发送到下游客户端。

4）将 downstream_done 标志位置为 1（目前没有任何意义），ngx_event_pipe_write_to_downstream 方法结束。

5）计算 busy 缓冲区中待发送的响应长度，检查它是否超过 busy_size 配置，如果其大于或等于 busy_size，则跳到第 10 步执行；否则继续向下准备发送 out 或者 in 缓冲区中的内容。也就是说，当 ngx_http_request_t 结构体中 out 缓冲区中的待发送内容已经超过了 busy_size，就跳到第 10 步，不再发送 out 和 in 缓冲区中的内容，优先把 ngx_http_request_t 结构体的 out 中的内容发送出去。

6）首先检查 out 链表是否为空，如果 out 中有内容，那么立刻跳到第 7 步准备发送 out 缓冲区中的响应，如果 out 为空，那么再检查 in 链表。如果 in 链表中有内容，立刻跳到第 8 步准备发送 in 缓冲区中的响应，如果 in 链表也为空，则说明这次调用中没有需要发送的响应，跳到第 10 步执行。

7）取出 out 链表首部的第一个 ngx_buf_t 缓冲区，检查待发送的长度加上这个缓冲区后是否已经超过 busy_size 配置，如果超过，则立刻跳到第 10 步执行；如果没有超过，则 out 自动指向链表中的下一个 ngx_chain_t 元素，跳到第 9 步准备将之前取出的第一个缓冲区发送出去。注意，这里还会调用 ngx_event_pipe_free_shadow_raw_buf 方法来处理这个待发送的缓冲区的 shadow 域，实际上，这一步就是为了释放 free_raw_bufs 链表中的缓冲区。

图 12-13 ngx_event_pipe_write_to_downstream 方法的流程图

8）取出 in 链表首部的第一个缓冲区准备发送，所有步骤与第 7 步相同。

9）将刚才调用 ngx_event_pipe_free_shadow_raw_buf 方法处理过的缓冲区再添加到 out 链表首部（待发送的内容都添加到 out 缓冲区链表中了），同时跳到第 6 步继续执行这个循环。

10）检查 out 链表以及之前各个步骤中是否有需要发送的内容（其实是通过一个局部变量 flush 作为标志位来表示是否有需要发送的内容），当 out 为空且确实没有待发送的内容时，返回 NGX_OK，ngx_event_pipe_write_to_downstream 方法结束，否则跳到第 11 步向下游发送响应。

11）调用 output_filter 方法向下游发送 out 缓冲区。

12）调用 ngx_chain_update_chains 方法更新 free、busy、out 缓冲区。在图 12-8 的第 4 步中曾经介绍过该方法，不再赘述。

13）遍历 free 链表中的缓冲区，释放缓冲区中的 shadow 域，这样，这些暂不使用的缓冲区才可以继续用来接收新的来自上游服务器的响应。然后，跳到第 1 步继续发送响应来执行这个大循环。

至此，buffering 配置为 1 时转发上游响应到下游的整个流程就全部介绍完了，它的流程复杂，但效率很高，作为反向代理使用非常有优势。

## 12.9 结束 upstream 请求

当 Nginx 与上游服务器的交互出错，或者正常处理完来自上游的响应时，就需要结束请求了。这时当然不能调用第 11 章中介绍的 ngx_http_finalize_request 方法来结束请求，这样 upstream 中使用到的资源（如与上游间建立的 TCP 连接）将无法释放，事实上，upstream 机制提供了一个类似的方法 ngx_http_upstream_finalize_request 用于结束 upstream 请求，在 12.9.1 节中将会详细介绍这个方法。除了直接调用 ngx_http_upstream_finalize_request 方法结束请求以外，还有两种独特的结束请求方法，分别是 ngx_http_upstream_cleanup 方法和 ngx_http_upstream_next 方法。

在启动 upstream 机制时，ngx_http_upstream_cleanup 方法会挂载到请求的 cleanup 链表中（参见图 12-2 的第 3 步），这样，HTTP 框架在请求结束时就会调用 ngx_http_upstream_cleanup 方法（参见 11.10.2 节 ngx_http_free_request 方法的流程），这保证了 ngx_http_upstream_cleanup 一定会被调用。而 ngx_http_upstream_cleanup 方法实际上还是通过调用 ngx_http_upstream_finalize_request 来结束请求的，如下所示。

```C
static void ngx_http_upstream_cleanup(void *data) {
ngx_http_request_t *r = data;
ngx_http_upstream_t *u = r->upstream; …
/*最终还是调用 ngx_http_upstream_finalize_request 方法来结束请求，注意传递的是 NGX_DONE 参数*/
ngx_http_upstream_finalize_request(r, u, NGX_DONE); }
```

当处理请求的流程中出现错误时，往往会调用 ngx_http_upstream_next 方法。例如，在图 12-5 中，如果在接收上游服务器的包头时出现错误，接下来就会调用该方法，这是因为 upstream 机制还提供了一个较为灵活的功能：当与上游的交互出现错误时，Nginx 并不想立刻认为这个请求处理失败，而是试图多给上游服务器一些机会，可以重新向这台或者另一台上游服务器发起连接、发送请求、接收响应，以避免网络故障。这个功能可以帮助 HTTP 模块实现简单的负载均衡机制（如最常见的 HTTP 反向代理模块）。而该功能正是通过 ngx_http_upstream_next 方法实现的，因为该方法在结束请求之前，会检查 ngx_peer_connection_t 结构体的 tries 成员（参见 9.3.2 节）。tries 成员会初始化为每个连接的最大重试次数，每当这个连接与上游服务器出现错误时就会把 tries 减 1。在出错时 ngx_http_upstream_next 方法首先会检查 tries，如果它减到 0，才会真正地调用 ngx_http_upstream_finalize_request 方法结束请求，否则不会结束请求，而是调用 ngx_http_upstream_connect 方法重新向上游发起请求，如下所示。

```C
static void ngx_http_upstream_next(ngx_http_request_t *r, ngx_http_upstream_t *u, ngx_uint_t ft_type) {
…
/*只有向这台上游服务器的重试次数 tries 减为 0 时，才会真正地调用 ngx_http_upstream_finalize_request 方法结束请求，否则会再次试图重新与上游服务器交互，这个功能将帮助感兴趣的 HTTP 模块实现简单的负载均衡机制。 u->conf->next_upstream 表示的含义在 12.1.3 节中已介绍过，它实际上是一个 32 位的错误码组合，表示当出现这些错误码时不能直接结束请求，需要向下一台上游服务器再次重发 */
if (u->peer.tries == 0 || !(u->conf->next_upstream & ft_type)) {
ngx_http_upstream_finalize_request(r, u, status); return;
}
// 如果与上游间的 TCP 连接还存在，那么需要关闭
if (u->peer.connection) {
ngx_close_connection(u->peer.connection); u->peer.connection = NULL;
}
// 重新发起连接，参见 12.3 节
ngx_http_upstream_connect(r, u);
}
```

下面来看一下 ngx_http_upstream_finalize_request 到底做了些什么工作。

ngx_http_upstream_finalize_request 方法还是会通过调用 HTTP 框架提供的 ngx_http_finalize_request 方法释放请求，但在这之前需要释放与上游交互时分配的资源，如文件句柄、TCP 连接等。它的源代码很简单，下面直接列举其源代码说明它所做的工作。

```C
static void ngx_http_upstream_finalize_request(ngx_http_request_t *r, ngx_http_upstream_t *u, ngx_int_t rc) {
ngx_time_t *tp;
// 将 cleanup 指向的清理资源回调方法置为 NULL 空指针
if (u->cleanup) {
*u->cleanup = NULL;
u->cleanup = NULL;
}
// 释放解析主机域名时分配的资源
if (u->resolved && u->resolved->ctx) {
  ngx_resolve_name_done(u->resolved->ctx);
  u->resolved->ctx = NULL;
}
if (u->state && u->state->response_sec) {
// 设置当前时间为 HTTP 响应结束时间
tp = ngx_timeofday();
u->state->response_sec = tp->sec - u->state->response_sec;
u->state->response_msec = tp->msec - u->state->response_msec;
if (u->pipe) {
u->state->response_length = u->pipe->read_length; }
}
/*表示调用 HTTP 模块负责实现的 finalize_request 方法。 HTTP 模块可能会在 upstream 请求结束时执行一些操作 */
u->finalize_request(r, rc);
/*如果使用了 TCP 连接池实现了 free 方法，那么调用 free 方法（如 ngx_http_upstream_free_round_robin_peer）释放连接资源 */
if (u->peer.free) {
u->peer.free(&u->peer, u->peer.data, 0); }
// 如果与上游间的 TCP 连接还存在，则关闭这个 TCP 连接
if (u->peer.connection) {
ngx_close_connection(u->peer.connection); }
u->peer.connection = NULL;
if (u->store && u->pipe && u->pipe->temp_file && u->pipe->temp_file->file.fd != NGX_INVALID_FILE) {
/*如果使用了磁盘文件作为缓存来向下游转发响应，则需要删除用于缓存响应的临时文件 */
if (ngx_delete_file(u->pipe->temp_file->file.name.data) == NGX_FILE_ERROR)
{
ngx_log_error(NGX_LOG_CRIT, r->connection->log, ngx_errno, ngx_delete_file_n " "%s" failed", u->pipe->temp_file->file.name.data); }
}
/*如果已经向下游客户端发送了 HTTP 响应头部，却出现了错误，那么将会通过下面的 ngx_http_send_special(r, NGX_HTTP_LAST)将头部全部发送完毕 */
if (u->header_sent && rc != NGX_HTTP_REQUEST_TIME_OUT
&& (rc == NGX_ERROR || rc >= NGX_HTTP_SPECIAL_RESPONSE)) {
rc = 0;
}
if (rc == NGX_DECLINED) {
return;
}
r->connection->log->action = "sending to client"; if (rc == 0)
{
rc = ngx_http_send_special(r, NGX_HTTP_LAST); }
/*最后还是通过调用 HTTP 框架提供的 ngx_http_finalize_request 方法来结束请求 */
ngx_http_finalize_request(r, rc);
}
```

## 12.10 小结

本章介绍的 upstream 机制也属于 HTTP 框架的一部分，它同样是基于事件框架实现了异步访问上游服务器的功能，同时，它并不满足于仅仅帮助应用级别的 HTTP 模块基于 TCP 访问上游，而是提供了非常强大的转发上游响应功能，而且在转发方式上更加灵活、高效，并且对于内存的使用相当节省，这些功能帮助 Nginx 的 ngx_http_proxy_module 模块实现了强大的反向代理功能。同时，配合着 ngx_http_upstream_ip_hash_module 或者 Round Robin 相关的代码（它们负责管理 ngx_peer_connection_t 上游连接），ngx_http_upstream_next 方法还可以帮助 HTTP 模块实现简单的负载均衡功能。

由于 upstream 机制属于 HTTP 框架，所以它仅抽象出了通用代码，而尽量地把组装发往上游请求、解析上游响应的部分都交给使用它的 HTTP 模块实现，这使得使用 upstream 的 HTTP 模块不会太复杂，而性能却非常高效，算是在灵活性和简单性之间找到了一个平衡点。在阅读完本章后，我们就有可能写出非常强大的访问第三方服务器的代码了，在这个过程中，尽
量使用 upstream 已经提供的各种功能，将会简化 HTTP 模块的开发过程。
