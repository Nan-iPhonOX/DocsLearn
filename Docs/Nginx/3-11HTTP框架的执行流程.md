## 第 11 章 HTTP 框架的执行流程

本章将介绍动态的 HTTP 框架，主要探讨在请求的生命周期中，基于事件驱动的 HTTP 框
架是怎样处理网络事件以及怎样集成各个 HTTP 模块来共同处理 HTTP 请求的，同时，还会介
绍为了简化 HTTP 模块的开发难度而提供的多个非阻塞的异步方法。本章内容与第 9 章介绍的
事件模块密切相关，同时还会使用到第 10 章介绍过的 http 配置项和 11 个阶段。另外，本书第
二部分讲述了怎样开发 HTTP 模块，本章将会回答为什么可以这样开发 HTTP 模块。

HTTP 框架存在的主要目的有两个：

-   Nginx 事件框架主要是针对传输层的 TCP 的，作为 Web 服务器 HTTP 模块需要处理的则
    是 HTTP，HTTP 框架必须要针对基于 TCP 的事件框架解决好 HTTP 的网络传输、解析、组装
    等问题。

-   虽然事件驱动架构在性能上是不错的，但它的开发效率并不高，而 HTTP 模块的业务
    通常较复杂，我们希望 HTTP 模块在拥有事件框架的高性能优势的同时，尽量只关注业务。

这样，HTTP 框架就需要为 HTTP 模块屏蔽事件驱动架构，使得 HTTP 模块不需要关心网络事
件的处理，同时又能灵活地介入那 11 个阶段中以处理请求。

根据以上 HTTP 框架的设计目的，我们再来看 HTTP 框架在动态执行中的大概流程：先与
客户端建立 TCP 连接，接收 HTTP 请求行、头部并解析出它们的意义，再根据 nginx.conf 配置
文件找到一些 HTTP 模块，使其依次合作着处理这个请求。同时为了简化 HTTP 模块的开发，
HTTP 框架还提供了接收 HTTP 包体、发送 HTTP 响应、派生子请求等工具和方法。

对于 TCP 网络事件，可粗略地分为可读事件和可写事件，然而可读事件中又可细分为收
到 SYN 包带来的新连接事件、收到 FIN 包带来的连接关闭事件，以及套接字缓冲区上真正收
到 TCP 流。可写事件虽然相对简单点，但 Nginx 提供限制速度功能，有时可写事件触发时未必
可以去发送响应。同时，为了精确地控制超时，还需要把读/写事件放置到定时器中。这些
事件的管理都需要依靠 HTTP 框架，这给 HTTP 框架带来了复杂性。在清楚了解这些设计后，
我们将对 HTTP 模块的开发有一个非常透彻的认识，因为 HTTP 模块完全是由 HTTP 框架设
计、定义的，它就像 Android 应用程序与 Android 操作系统间的关系。同时，深入了解 HTTP 框
架后，读者会明白如何把复杂的事件驱动机制从关注于业务的模块中分离，这些设计方法都
是值得读者学习的。

11.1 HTTP 框架执行流程概述
本章在介绍 HTTP 框架的同时会说明它怎样使用事件模块提供的操作方法，在这之前，
先来回顾一下第 9 章中关于事件驱动模式的内容。

每一个事件都是由 ngx_event_t 结构体表示的，而 TCP 连接则由 ngx_connection_t 结构体表
示，HTTP 请求毫无疑问是基于一个 TCP 连接实现的。每个 TCP 连接包括一个读事件和一个写
事件，它们放在 ngx_connection_t 中的 read 成员和 write 成员中。通过事件模块提供的
ngx_handle_read_event 方法和 ngx_handle_write_event 方法，可以把相应的事件添加到 epoll 中，
我们可以期待在满足事件触发条件时，Nginx 进程会调用 ngx_event_t 事件的 handler 回调方法执
行业务。而通过事件模块提供的 ngx_add_timer 方法可以将上面的读事件或者写事件添加到定
时器中，在满足超时条件后，Nginx 进程同样会调用 ngx_event_t 事件的 handler 回调方法执行业
务。

在第 3 章开发 HTTP 模块时，并没有看到事件模块的影子，但 HTTP 框架确实是依靠事件
驱动机制实现的。基于这一点，先来总结一下 HTTP 框架需要完成的最主要的 4 项工作。

HTTP 框架需要完成的第一项工作是集成事件驱动机制，管理用户发起的 TCP 连接，处
理网络读/写事件，并在定时器中处理请求超时的事件。这些内容将在 11.2 节~11.5 节介绍，
其中 11.2 节会讨论新连接建立成功后 HTTP 框架的行为，11.3 节介绍第一个网络可读事件到达
后 HTTP 框架的行为，11.4 节介绍在没有接收到完整的 HTTP 请求行之前 HTTP 框架所要完成的
工作，11.5 节介绍在没有接收到完整的 HTTP 请求头部之前 HTTP 框架所要完成的工作。

HTTP 框架需要完成的第二项工作是与各个 HTTP 模块共同处理请求。实际上，通过第 3
章的例子我们已经知道，只有请求的 URI 与 location 配置匹配后 HTTP 框架才会调度 HTTP 模块
处理请求。而在第 10 章中也已看到，HTTP 框架定义了 11 个阶段，其中 4 个基本的阶段只能由
HTTP 框架处理，其余的 7 个阶段可以让各 HTTP 模块介入来共同处理请求。因此，HTTP 框架
需要在这 7 个阶段中调度合适的 HTTP 模块处理请求。第 11.6 节中将介绍 HTTP 框架如何调度
HTTP 模块参与到请求的处理中。

第三项工作与第 5 章介绍过的 subrequest 功能有关。为了实现复杂的业务，HTTP 框架允许
将一个请求分解为多个子请求，当然，子请求还可以继续向下派生“孙子”请求，这样就可以
把复杂的功能分散到多个子请求中，每个子请求仅专注于一个功能。这种设计也是一种平
衡，使用事件驱动机制在提高性能的同时其实大大增加了程序的复杂度，特别是开发复杂功
能时太多事件的处理会让代码混乱不堪，而子请求的派生则可以降低复杂度，使得 Nginx 可
以提供多样化的功能。在第 11.7 节中，将讨论 HTTP 框架是如何设计、实现 subrequest 功能
的。

HTTP 框架的第四项工作则是提供基本的工具接口，供各 HTTP 模块使用，诸如接收
HTTP 包体，以及发送 HTTP 响应头部、响应包体等。在 11.8 节中将说明 HTTP 框架提供的接收
HTTP 包体功能，11.9 节将说明发送 HTTP 响应是怎样实现的，在 11.10 节中将讨论如何结束
HTTP 请求。为什么要专门讨论请求的结束呢？因为在基于事件驱动的 HTTP 框架中，由于每
个 HTTP 模块仅能在某一时刻介入到请求中，所以有时候它需要表达一种希望“延后”结束请
求的意思，这一特性造成了结束请求的动作十分复杂，因而使用独立的一节来专门说明。

本章的全部内容就是在探讨如何完成以上四项工作。

11.2 新连接建立时的行为
当 Nginx 接收到用户发起 TCP 连接的请求时，事件框架将会负责把 TCP 连接建立起来，如
果 TCP 连接成功建立，HTTP 框架就会介入请求的处理了，如图 9-5 所示，在 ngx_event_accept
方法建立新连接的最后 1 步，将会调用 ngx_listening_t 监听结构体的 handler 方法。在 10.3 节中讲
过，HTTP 框架在初始化时就会将每个监听 ngx_listening_t 结构体的 handler 方法设为
ngx_http_init_connection 方法，如下所示。

void ngx_http_init_connection(ngx_connection_t \*c)
即 HTTP 框架处理请求的第一步就在 ngx_http_init_connection 方法中，这里传入的参数 c 就
是新建立的连接。图 11-1 列举了 ngx_http_init_connection 方法所做的主要工作。

图 11-1 建立连接成功后 HTTP 框架的行为
下面简单解释一下图 11-1 中的 4 个步骤：
1）将新建立的连接 c 的可读事件处理方法设置为 ngx_http_init_request。在 9.3 节我们介绍
过 ngx_connection_t 结构体中会用 read 成员表示连接上的可读事件，write 成员表示可写事件。

读/写事件均使用 ngx_event_t 结构体表示。在 9.2 节中又介绍过每个事件发生时事件框架都会
调用其中的 handler 方法。这一步骤实际上就是把连接 c 的 read 读事件的 handler 方法设为
ngx_http_init_request，它意味着当用户在这个 TCP 连接上发送的数据到达服务器后，
ngx_http_init_request 方法将会被调用（参见 11.3 节）。

事实上，对于可写事件，也会设置它的 handler 回调方法为 ngx_http_empty_handler，这个
方法不会做任何工作，如下所示。

void ngx_http_empty_handler(ngx_event_t \*wev)
{
ngx_log_debug0(NGX_LOG_DEBUG_HTTP, wev-\>log, 0, "http empty handler");
return;
}
这个方法仅有一个用途：当业务上不需要处理可写事件时，就把 ngx_http_empty_handler
方法设置到连接的可写事件的 handler 中，这样可写事件被定时器或者 epoll 触发后是不做任何
工作的。

注意下面会多次使用 ngx_http_empty_handler 方法。

2）如果新连接的读事件 ngx_event_t 结构体中的标志位 ready 为 1，实际上表示这个连接对
应的套接字缓存上已经有用户发来的数据，这时就可调用上面说过的 ngx_http_init_request 方
法处理请求，参见 11.3 节。

3）在 9.7.3 节的表 9-5 中我们介绍过定时器的用法，在这一步骤中将调用 ngx_add_timer 方
法把读事件添加到定时器中，设置的超时时间则是 nginx.conf 中 client_header_timeout 配置项指
定的参数。也就是说，如果经过 client_header_timeout 时间后这个连接上还没有用户数据到
达，则会由定时器触发调用读事件的 ngx_http_init_request 处理方法。

4）我们在 9.2.1 节中介绍过 ngx_handle_read_event 方法，它可以将一个事件添加到 epoll
中。在这一步骤中，将调用 ngx_handle_read_event 方法把连接 c 的可读事件添加到 epoll 中。注
意，这里并没有把可写事件添加到 epoll 中，因为现在不需要向客户端发送任何数据。

以上 4 个步骤就是 ngx_http_init_connection 方法的主要工作，也就是新连接建立成功时
HTTP 框架对请求的处理。

11.3 第一次可读事件的处理
当 TCP 连接上第一次出现可读事件时，将会调用 ngx_http_init_request 方法初始化这个
HTTP 请求，如下所示。

static void ngx_http_init_request(ngx_event_t \*rev)
实际上，HTTP 框架并不会在连接建立成功后就开始初始化请求（参见 11.2 节），而是在
这个连接对应的套接字缓冲区上确实接收到了用户发来的请求内容时才进行，这种设计体现
了 Nginx 出于高性能的考虑，这样减少了无谓的内存消耗，降低了一个请求占用内存资源的
时间。因此，当有些客户端建立起 TCP 连接后一直没有发送内容时，Nginx 是不会为它分配内
存的。

从 11.2 节中可以看出，在有些情况下，当 TCP 连接建立成功时同时也出现了可读事件
（例如，在套接字设置了 deferred 选项时，内核仅在套接字上确实收到请求时才会通知 epoll
调度事件的回调方法），这时 ngx_http_init_request 方法是在图 11-1 的第 2 步中执行的。当然，
在大部分情况下，ngx_http_init_request 方法和 ngx_http_init_connection 方法都是由两个事件
（TCP 连接建立成功事件和连接上的可读事件）触发调用的。图 11-2 中展示了在
ngx_http_init_request 方法中究竟做了哪些工作。

图 11-2 第一次接收到可读事件后的行为
从图 11-2 中可以看出，第一次读事件的回调方法 ngx_http_init_request 主要做了 3 件事：对
请求构造 ngx_http_request_t 结构体并初始化部分参数、修改读事件的回调方法为
ngx_http_process_request_line 并调用该方法开始接收并解析 HTTP 请求行。下面详细分析图 11-
2 中的 11 个步骤：
1）首先回顾一下图 11-1 的第 3 步，那里曾经将读事件也添加到了定时器中，超时时间就
是配置文件中的 client_header_timeout，因此，首先要检查读事件是否已经超时，也就是检查
ngx_event_t 事件的 timeout 成员是否为 1。如果 timeout 为 1，则表示接收请求已经超时，则不应
该继续处理该请求，于是调用 ngx_http_close_request 方法关闭请求，同时由
ngx_http_init_request 方法中返回。ngx_http_close_request 方法的详细介绍可参见 11.10.3 节。

2）在第 3 章介绍 HTTP 模块的开发时曾提到，每个请求都会有一个 ngx_http_request_t 结构
体，所有的 HTTP 模块都以此作为核心结构体来处理请求。这个 ngx_http_request_t 结构体就是
在此步骤中创建的，同时还将这个关键结构体的地址存放到表示 TCP 连接的 ngx_connection_t
结构体中的 data 成员上。这一步中还会把表示这个 ngx_connection_t 结构体被使用次数的
requests 成员加 1。11.3.1 节将会详细介绍 ngx_http_request_t 结构体。

3）从 10.3 节可以看出，配置文件的每个 server{}块中都可以针对不同的本机 IP 地址监听
同一个端口，事实上每一个监听对象 ngx_listening_t 都会对应着监听这个端口的所有监听地
址。回顾一下 8.3.1 节，ngx_listening_t 结构体中有一个 servers 指针，在 HTTP 框架中，它指向
监听这一端口的所有监听地址，而每个监听地址也包含了其所属 server 块的配置项，如下所
示。

typedef struct {
ngx_http_core_srv_conf_t *default_server; ngx_http_virtual_names_t *virtual_names; } ngx_http_addr_conf_t;
default_server 也就是这个监听地址对应的 server 块配置信息，在第 10 章中我们曾经介绍
过 ngx_http_core_srv_conf_t 结构体是如何管理配置信息的。这一步中将会遍历 ngx_listening_t
结构体的 servers 指向的数组，找到合适的监听地址，然后找到默认的 server 虚拟主机对应的
ngx_http_core_srv_conf_t 配置结构体。

4）在第 2 步建立好的 ngx_http_request_t 结构体中，main_conf、srv_conf、loc_conf 这 3 个成
员表示这个请求对应的 main、srv、loc 级别的配置项，这时会通过刚刚获取到的默认的
ngx_http_core_srv_conf_t 结构体设置（10.2 节中介绍过，ngx_http_core_srv_conf_t 结构体具有
一个 ngx_http_conf_ctx_t 类型的成员 ctx，从这里可以获取到 3 个级别的配置项指针数组）。

5）第一次读事件的回调方法是 ngx_http_init_request，它仅用于初始化请求，之后的读事
件意味着接收到请求内容，显而易见，它的回调方法是需要改变一下的，即在这一步中将把
这个读事件的回调方法设为 ngx_http_process_request_line，这个方法将会负责接收并解析出
完整的 HTTP 请求行。

6）读事件被触发，其实就意味着对应的套接字缓冲区上已经接收到用户的请求了，这
时需要在用户态的进程空间分配内存，用来把内核缓冲区上的 TCP 流复制到用户态的内存
中，并使用状态机来解析它是否是合法的、完整的 HTTP 请求。这一步将在 ngx_connection_t
的内存池中分配一块内存（读者可以思考为何没有在 ngx_http_request_t 结构体的内存池中分
配接收请求的缓存），内存块的大小与 nginx.conf 文件中的 client_header_buffer_size 配置项参
数一致，ngx_connection_t 结构体的 buffer 指针以及 ngx_http_request_t 结构体的 header_in 指针共
同指向这块内存缓冲区。这个 header_in 缓冲区（除了在 11.8.1 节外）将负责接收用户发送来
的请求内容。当这个 TCP 连接复用于其他 HTTP 请求时，这个 buffer 指针指向的内存仍然是可
用的，新的 HTTP 请求初始化执行到这一步时，就不用再次由 ngx_connection_t 的内存池分配
内存了。

7）ngx_http_request_t 结构体同样有一个内存池，HTTP 模块更应该在 ngx_http_request_t 结
构体的 pool 内存池上申请新的内存，这样请求结束时（连接可能会被复用）该内存池中分配
的内存都会及时回收。这一步中将会创建这个内存池，内存池的初始大小由 nginx.conf 文件中
的 request_pool_size 配置项参数决定。这个内存池只会在 11.10.2 节中介绍的
ngx_http_free_request 方法中销毁。

8）初始化 ngx_http_request_t 结构体中的部分容器，如 headers_out 结构体中的 ngx_list_t 类
型的 headers 链表、variables 数组等。

9）在 4.5 节曾经讲过，每个 HTTP 模块都可以针对一个请求设置上下文结构体，并通过
ngx_http_set_ctx 和 ngx_http_get_module_ctx 宏来设置和获取上下文。那么，这些 HTTP 模块针对
请求设置的上下文结构体指针，实际上是保存到 ngx_http_request_t 结构体的 ctx 指针数组中
的。在这一步骤中，会分配一个具有 ngx_http_max_module（HTTP 模块的总数）个成员的指
针数组，也就是说，为每个 HTTP 模块都提供一个位置存放上下文结构体的指针。

10）ngx_http_request_t 结构体中有两个成员表示这个请求的开始处理时间：start_sec 成员
和 start_msec 成员。这一步中将会初始化这两个成员。在 11.9.2 节中将会看到这两个成员的用
法，它们会为限速功能服务。

11）调用 ngx_http_process_request_line 方法开始接收、解析 HTTP 请求行。

以上步骤构成了 ngx_http_init_request 方法的主要内容，其中构造的 ngx_http_request_t 结构
体在接下来的小节中会详细介绍。

从第 3 章开始，我们已经多次见过 ngx_http_request_t 结构体了，但大多是站在 HTTP 模块
的角度来思考如何使用 Nginx 已经为我们构造好的 ngx_http_request_t 结构体。本节再次介绍
ngx_http_request_t 结构体，则是站在 HTTP 框架的角度来思考如何完成 HTTP 框架的基本功
能。下面首先说明它与 HTTP 框架密切相关的成员。

typedef struct ngx_http_request_s ngx_http_request_t; struct ngx_http_request_s {
// 这个请求对应的客户端连接
ngx_connection_t *connection;
// 指向存放所有
HTTP 模块的上下文结构体的指针数组
void **ctx;
// 指向请求对应的存放
main 级别配置结构体的指针数组
void **main_conf;
// 指向请求对应的存放
srv 级别配置结构体的指针数组
void **srv_conf;
// 指向请求对应的存放
loc 级别配置结构体的指针数组
void **loc_conf;
/*在接收完
HTTP 头部，第一次在业务上处理
HTTP 请求时，
HTTP 框架提供的处理方法是
ngx_http_process_request。但如果该方法无法一次处理完该请求的全部业务，在归还控制权到
epoll 事件模块后，该请求再次被回调时，将通过
ngx_http_request_handler 方法来处理，而这个方法中对于可读事件的处理就是调用
read_event_handler 处理请求。也就是说，
HTTP 模块希望在底层处理请求的读事件时，重新实现
read_event_handler 方法
*/
ngx_http_event_handler_pt read_event_handler; /*与
read_event_handler 回调方法类似，如果
ngx_http_request_handler 方法判断当前事件是可写事件，则调用
write_event_handler 处理请求。

ngx*http_request_handler 的流程可参见图
11-7*/
ngx*http_event_handler_pt write_event_handler; // upstream 机制用到的结构体，在第
12 章中会详细说明
ngx_http_upstream_t *upstream;
/*表示这个请求的内存池，在
ngx*http*free_request 方法中销毁。它与
ngx_connection_t 中的内存池意义不同，当请求释放时，
TCP 连接可能并没有关闭，这时请求的内存池会销毁，但
ngx_connection_t 的内存池并不会销毁
*/
ngx*pool_t \_pool;
// 用于接收
HTTP 请求内容的缓冲区，主要用于接收
HTTP 头部
ngx_buf_t \_header_in;
/\_ngx_http_process_request_headers 方法在接收、解析完
HTTP 请求的头部后，会把解析完的每一个
HTTP 头部加入到
headers_in 的
headers 链表中，同时会构造
headers_in 中的其他成员
*/
ngx*http_headers_in_t headers_in;
/\_HTTP 模块会把想要发送的
HTTP 响应信息放到
headers_out 中，期望
HTTP 框架将
headers_out 中的成员序列化为
HTTP 响应包发送给用户
*/
ngx_http_headers_out_t headers_out; // 接收
HTTP 请求中包体的数据结构，详见
11.8 节
ngx_http_request_body_t *request_body; // 延迟关闭连接的时间
time_t lingering_time;
/*当前请求初始化时的时间。

start_sec 是格林威治时间
1970 年
1 月
1 日凌晨
0 点
0 分
0 秒到当前时间的秒数。如果这个请求是子请求，则该时间是子请求的生成时间；如果这个请求是用户发来的请求，则是在建立起
TCP 连接后，第一次接收到可读事件时的时间
*/
time_t start_sec;
// 与
start_sec 配合使用，表示相对于
start_set 秒的毫秒偏移量
ngx_msec_t start_msec;
/*以下
9 个成员都是
ngx_http_process_request_line 方法在接收、解析
HTTP 请求行时解析出的信息，其意义在第
3 章已经详细描述过，这里不再介绍
*/
ngx_uint_t method;
ngx_uint_t http_version;
ngx_str_t request_line;
ngx_str_t uri;
ngx_str_t args;
ngx_str_t exten;
ngx_str_t unparsed_uri;
ngx_str_t method_name;
ngx_str_t http_protocol;
/*表示需要发送给客户端的
HTTP 响应。

out 中保存着由
headers*out 中序列化后的表示
HTTP 头部的
TCP 流。在调用
ngx_http_output_filter 方法后，
out 中还会保存待发送的
HTTP 包体，它是实现异步发送
HTTP 响应的关键，参见
11.9 节
*/
ngx_chain_t *out;
/*当前请求既可能是用户发来的请求，也可能是派生出的子请求，而
main 则标识一系列相关的派生子请求的原始请求，我们一般可通过
main 和当前请求的地址是否相等来判断当前请求是否为用户发来的原始请求
*/
ngx_http_request_t *main;
// 当前请求的父请求。注意，父请求未必是原始请求
ngx_http_request_t *parent;
/*与
subrequest 子请求相关的功能。在
11.10.6 节中会看到它们在
HTTP 框架中的部分使用方式
*/
ngx_http_postponed_request_t *postponed; ngx_http_post_subrequest_t *post_subrequest; /*所有的子请求都是通过
posted*requests 这个单链表来链接起来的，执行
post 子请求时调用的
ngx_http_run_posted_requests 方法就是通过遍历该单链表来执行子请求的
*/
ngx_http_posted_request_t *posted_requests; /*全局的
ngx_http_phase_engine_t 结构体中定义了一个
ngx_http_phase_handler_t 回调方法组成的数组，而
phase_handler 成员则与该数组配合使用，表示请求下次应当执行以
phase_handler 作为序号指定的数组中的回调方法。

HTTP 框架正是以这种方式把各个
HTTP 模块集成起来处理请求的
*/
ngx_int_t phase_handler;
/*表示
NGX*HTTP_CONTENT_PHASE 阶段提供给
HTTP 模块处理请求的一种方式，
content_handler 指向
HTTP 模块实现的请求处理方法，详见
11.6.4 节
*/
ngx*http_handler_pt content_handler; /*在
NGX*HTTP_ACCESS_PHASE 阶段需要判断请求是否具有访问权限时，通过
access_code 来传递
HTTP 模块的
handler 回调方法的返回值，如果
access_code 为
0，则表示请求具备访问权限，反之则说明请求不具备访问权限
*/
ngx*uint_t access_code;
// HTTP 请求的全部长度，包括
HTTP 包体
off_t request_length;
/*在这个请求中如果打开了某些资源，并需要在请求结束时释放，那么都需要在把定义的释放资源方法添加到
cleanup 成员中，详见
11.10.2 节
\_/
ngx_http_cleanup_t *cleanup;
/*表示当前请求的引用次数。例如，在使用
subrequest 功能时，依附在这个请求上的子请求数目会返回到
count 上，每增加一个子请求，
count 数就要加
1。其中任何一个子请求派生出新的子请求时，对应的原始请求（
main 指针指向的请求）的
count 值都要加
1。又如，当我们接收
HTTP 包体时，由于这也是一个异步调用，所以
count 上也需要加
1，这样在结束请求时（
11.10 节中介绍），就不会在
count 引用计数未清零时销毁请求。可以参见
11.10.3 节的
ngx*http_close_request 方法
*/
unsigned count:8;
// 阻塞标志位，目前仅由
aio 使用，本章不涉及
unsigned blocked:8;
// 标志位，为
1 时表示当前请求正在使用异步文件
IO
unsigned aio:1;
// 标志位，为
1 时表示
URL 发生过
rewrite 重写
unsigned uri*changed:1;
/*表示使用
rewrite 重写
URL 的次数。因为目前最多可以更改
10 次，所以
uri*changes 初始化为
11，而每重写
URL 一次就把
uri_changes 减
1，一旦
uri_changes 等于
0，则向用户返回失败
*/
unsigned uri*changes:4;
/*标志位，为
1 时表示当前请求是
keepalive 请求
*/
unsigned keepalive:1;
/*延迟关闭标志位，为
1 时表示需要延迟关闭。例如，在接收完
HTTP 头部时如果发现包体存在，该标志位会设为
1，而放弃接收包体时则会设为
0，参见
11.8 节
*/
unsigned lingering_close:1;
// 标志位，为
1 时表示正在丢弃
HTTP 请求中的包体
unsigned discard_body:1;
/*标志位，为
1 时表示请求的当前状态是在做内部跳转。具体用法可参见图
11-5 中的第
4 步和第
5 步
*/
unsigned internal:1;
/*标志位，为
1 时表示发送给客户端的
HTTP 响应头部已经发送。在调用
ngx*http_send_header 方法（参见
11.9.1 节）后，若已经成功地启动响应头部发送流程，该标志位就会置为
1，用来防止反复地发送头部
*/
unsigned header_sent:1;
// 表示缓冲中是否有待发送内容的标志位
unsigned buffered:4;
// 状态机解析
HTTP 时使用
state 来表示当前的解析状态
ngx_uint_t state;
…
};
以上介绍的 ngx_http_request_t 结构体成员，大多都会出现在本章后续章节中，读者在看到相应的变量时可及时回到本节查询其意义。

11.4 接收 HTTP 请求行
接收 HTTP 请求行这个行为必然是在初始化请求之后发生的。在图 11-2 的第 11 步表明已
经调用了 ngx_http_process_request_line 方法来接收 HTTP 请求行。HTTP 请求行的格式如下所
示。

GET uri HTTP1.1
可以看出，这样的请求行长度是不定的，它与 URI 长度相关，这意味着在读事件被触发
时，内核套接字缓冲区的大小未必足够接收到全部的 HTTP 请求行，由此可以得出结论：调
用一次 ngx_http_process_request_line 方法不一定能够做完这项工作。所以，
ngx_http_process_request_line 方法也会作为读事件的回调方法，它可能会被 epoll 这个事件驱
动机制多次调度，反复地接收 TCP 流并使用状态机解析它们，直到确认接收到了完整的
HTTP 请求行，这个阶段才算完成，才会进入下一个阶段接收 HTTP 头部。

因此，ngx_http_process_request_line 方法与 ngx_http_init_connection 方法、
ngx_http_init_request 方法都不一样，后两种方法在一个请求中只会被调用一次，而
ngx_http_process_request_line 方法则至少会被调用一次，而到底会调用多少次则取决于客户
端的行为及网络中 IP 包的转发等。图 11-3 展示了 ngx_http_process_request_line 方法的流程，需
要注意其中对各个步骤的描述，其中有些步骤会导致 ngx_http_process_request_line 方法暂时
结束，但会在下一次读事件来临时继续被调用。

图 11-3 描述了 ngx_http_process_request_line 方法的主要流程，由于它涉及了 TCP 字符流的
接收、解析，因此会相对复杂一些，下面详细描述一下这 12 个步骤：
1）首先检查这个读事件是否已经超时，超时时间仍然是 nginx.conf 配置文件中指定的
client_header_timeout。如果 ngx_event_t 事件的 timeout 标志为 1，则认为接收 HTTP 请求已经超
时，调用 ngx_http_close_request 方法（参见 11.10.3 节）关闭请求，同时由
ngx_http_process_request_line 方法中返回。

2）在当前读事件未超时的情况下，检查 header_in 接收缓冲区（参见图 11-2 的第 6 步）中
是否还有未解析的字符流。第一次调用 ngx_http_process_request_line 方法时缓冲区里必然是
空的，这时会调用封装的 recv 方法把 Linux 内核套接字缓冲区中的 TCP 流复制到 header_in 缓冲
区中。header_in 的类型是 ngx_buf_t，它的 pos 成员和 last 成员指向的地址之间的内存就是接收
到的还未解析的字符流。如果 header_in 接收缓冲区中还有未解析的字符流，则不会调用 recv
方法接收，而是跳到下面的第 4 步继续执行。

3）在第 2 步中曾经调用封装的 recv 方法，如果返回值表示连接出现错误或者客户端已经
关闭连接，则跳转到第 1 步；如果返回值表示接收到客户端发送的字符流，则跳转到第 5 步中
解析；如果返回值表示本次没有接收到 TCP 流，需要继续检测这个读事件，则开始本步骤的
执行。

首先检查这个读事件是否在定时器中，如果已经在定时器，则跳转到第 4 步；反之，调
用 ngx_add_timer 方法向定时器添加这个读事件。

4）调用 ngx_handle_read_event 方法把该读事件添加到 epoll 中，同时
ngx_http_process_request_line 方法结束。

图 11-3 接收、解析 HTTP 请求行的流程图
5）在第 2 步接收到字符流后，将在这一步骤用状态机解析已经接收到的 TCP 字符流，确
认其是否构成完整的 HTTP 请求行。这个状态机解析请求行的方法叫做
ngx_http_parse_request_line，它使用 ngx_http_request_t 结构体中的 state 成员来保存解析状态，
如下所示。

ngx_int_t ngx_http_parse_request_line(ngx_http_request_t r, ngx_buf_t b)
这里传入的参数 b 是 header_in 缓冲区，返回值主要有 3 类：返回 NGX_OK 表示成功地解析
到完整的 HTTP 请求行；返回 NGX_AGAIN 表示目前接收到的字符流不足以构成完成的请求
行，还需要接收更多的字符流；返回 NGX_HTTP_PARSE_INVALID_REQUEST 或者
NGX_HTTP_PARSE_INVALID_09_METHOD 等其他值时表示接收到非法的请求行。

6）如果 ngx_http_parse_request_line 方法返回 NGX_OK，表示成功地接收到完整的请求
行，这时跳转到第 7 步继续执行。

如果 ngx_http_parse_request_line 方法返回 NGX_AGAIN，则表示需要接收更多的字符流，
这时需要对 header_in 缓冲区做判断，检查是否还有空闲的内存，如果还有未使用的内存可以
继续接收字符流，则跳转到第 2 步，检查缓冲区是否有未解析的字符流，否则调用
ngx_http_alloc_large_header_buffer 方法分配更大的接收缓冲区。到底分配多大呢？这由
nginx.conf 文件中的 large_client_header_buffers 配置项指定。

如果 ngx_http_parse_request_line 方法返回 NGX_HTTP_PARSE_INVALID_REQUEST 或者
NGX_HTTP_PARSE_INVALID_09_METHOD 等其他值，那么 HTTP 框架将不再处理非法请
求，跳转到第 1 步关闭请求。

7）在接收到完整的 HTTP 请求行后，首先要把请求行中的信息如方法名、URI 及其参
数、HTTP 版本等信息设置到 ngx_http_request_t 结构体的相应成员中（如 request_line、uri、
method_name、unparsed_uri、http_protocol、exten、args 等），在 3.6.2 节开发 HTTP 模块时曾介
绍过这些成员的用法，它们就是在这一步中被赋值的。

8）如果在第 7 步得到的 http_version 成员中显示用户请求的 HTTP 版本小于 1.0（如 HTTP
0.9 版本），其处理过程将与 HTTP 1.0 和 HTTP 1.1 的完全不同，它不会有接收 HTTP 头部这一
步骤。这时将会调用 ngx_http_find_virtual_server 方法寻找到相应的虚拟主机，回顾一下在
10.4 节中虚拟主机是使用散列表来进行管理的，ngx_http_find_virtual_server 方法就是用于在
散列表中检索出虚拟主机。

如果 http_version 成员中显示出用户请求的 HTTP 版本是 1.0 或者更高的版本，则直接跳到
第 10 步中执行。

9）继续处理 HTTP 版本小于 1.0 的情形。由于不需要再次接收 HTTP 头部，调用
ngx_http_process_request 方法开始处理请求（参见 11.6 节）。

10）初始化 ngx_http_request_t 结构体中存放 HTTP 头部的一些容器，如 headers_in 结构体中
ngx_list_t 类型的 headers 链表容器、ngx_array_t 类型的 cookies 动态数组容器等，为下一步接收
HTTP 头部做好准备（参见 11.5 节）。

11）由于已经接收完 HTTP 请求行，因此这时把读事件的回调方法由
ngx_http_process_request_line 改为 ngx_http_process_request_headers，准备接收 HTTP 头部。

12）调用 ngx_http_process_request_headers 方法开始接收 HTTP 头部。

接收完 HTTP 请求行后，在下一节中我们将分析接收 HTTP 头部这一步骤。

11.5 接收 HTTP 头部
本节将描述接收 HTTP 头部这一阶段，该阶段是通过 ngx_http_process_request_headers 方
法实现的，该方法将被设置为连接的读事件回调方法，在接收较大的 HTTP 头部时，它有可
能会被反复多次地调用。HTTP 头部类似下面加了下划线的字符串，而
ngx_http_process_request_headers 方法的目的就在于接收到当前请求全部的 HTTP 头部。

GET uri HTTP1.1
cred: xxx
username: ttt
content-length: 4
test
可以看出，HTTP 头部也属于可变长度的字符串，它与 HTTP 请求行和包体间都是通过换
行符来区分的。同时，它与解析 HTTP 请求行一样，都需要使用状态机来解析数据。既然
HTTP 请求行和头部都是变长的，对它们的总长度当然是有限制的。从图 11-3 的第 6 步可以看
出，当最初分配的大小为 client_header_buffer_size 的缓冲区且无法容纳下完整的 HTTP 请求行
或者头部时，会再次分配大小为 large_client_header_buffers（这两个值皆为 nginx.conf 文件中指
定的配置项）的缓冲区，同时会将原先缓冲区的内容复制到新的缓冲区中。所以，这意味着
可变长度的 HTTP 请求行加上 HTTP 头部的长度总和不能超过 large_client_header_buffers 指定的
字节数，否则 Nginx 将会报错。

先来看看图 11-4 中展示的 HTTP 框架使用 ngx_http_process_request_headers 方法接收、解析
HTTP 头部的流程。

图 11-4 中分支较多，下面详细地解释一下图中的 11 个步骤。

1）如同接收 http 请求行一样，首先检查当前的读事件是否已经超时。检查方法仍然是检
查事件的 timeout 标志位，如果为 1，则表示接收请求已经超时，这时调用
ngx_http_close_request 方法关闭连接，同时退出 ngx_http_process_request_headers 方法。

2）检查接收 HTTP 请求头部的 header_in 缓冲区是否用尽，当 header_in 缓冲区的 pos 成员指
向了 end 成员时，表示已经用尽，这时需要调用 ngx_http_alloc_large_header_buffer 方法分配更
大、更多的缓冲区，如同图 11-3 中的第 6 步。如果缓冲区还没有用尽，则跳到第 4 步中执行。

3）事实上，ngx_http_alloc_large_header_buffer 方法会有 3 种返回值，其中 NGX_OK 表示
成功分配到更大的缓冲区，可以继续接收客户端发来的字符流；NGX_DECLINED 表示已经
达到缓冲区大小的上限，无法分配更大的缓冲区；NGX_ERROR 表示出现错误。所以，当返
回 NGX_ERROR 时，跳转到第 1 步执行；而当返回 NGX_DECLINED 时，需要向用户返回错误
并且同时退出 ngx_http_process_request_headers 方法，错误码由宏
NGX_HTTP_REQUEST_HEADER_TOO_LARGE 表示，也就是 494，实际上这一过程是通过调
用 ngx_http_finalize_request 方法来实现的（参见 11.10.6 节）；如果返回 NGX_OK，则继续第 4
步执行。

图 11-4 ngx_http_process_request_headers 方法接收 HTTP 头部的流程图
4）接收客户端发来的字符流，即把内核套接字缓冲区上的字符流接收到 header_in 缓冲
区中。这一过程是通过调用封装过的 recv 方法实现的，如果过程中出现错误，仍然跳转到第
1 步执行；如果没有接收到数据，但错误码表明仍然需要再次接收数据，则跳转到第 5 步执
行；如果成功接收到数据，则跳转到第 6 步执行。

5）这个步骤将该读事件添加到 epoll 和定时器中，实际上就是图 11-3 中第 3 步和第 4 步的
合并，不再赘述。

6）调用 ngx_http_parse_header_line 方法解析缓冲区中的字符流。这种方法有 3 个返回值：
返回 NGX_OK 时，表示解析出一行 HTTP 头部，这时需要跳转到第 7 步设置这行已经解析出的
HTTP 头部；返回 NGX_HTTP_PARSE_HEADER_DONE 时，表示已经解析出了完整的 HTTP 头
部，这时可以准备开始处理 HTTP 请求了（11.6 节介绍）；返回 NGX_AGAIN 时，表示还需要
接收到更多的字符流才能继续解析，这时需要跳转到第 2 步去接收更多的字符流；除此之外
的错误情况，将跳转到第 8 步发送 400 错误给客户端。

7）将解析出的 HTTP 头部设置到表示 ngx_http_request_t 结构体 headers_in 成员的 headers 链
表中。从 3.6.3 节中可以看出，开发 HTTP 模块时获取到的 HTTP 头部就是在这个步骤中设置
的。

8）当调用 ngx_http_parse_header_line 方法解析字符串构成的 HTTP 时，是有可能遇到非法
的或者 Nginx 当前版本不支持的 HTTP 头部的，这时该方法会返回错误，于是调用
ngx_http_finalize_request 方法，向客户端发送 NGX_HTTP_BAD_REQUEST 宏对应的 400 错误码
响应。

9）当 ngx_http_parse_header_line 方法认为已经解析到完整的 HTTP 头部时，将会根据
HTTP 头部中的 host 字段情况，调用 ngx_http_find_virtual_server 方法找到对应的虚拟主机配置
块，也就是第 10 章中介绍过的 ngx_http_core_srv_conf_t 结构体。这一步会导致图 11-2 的第 4 步
中 ngx_http_request_t 结构体里的 srv_conf、loc_conf 成员被重新设置，以指向正确的虚拟主
机。

10）这一步骤将检查以上步骤中接收解析出的 HTTP 头部是否合法，主要包括以下几
项：如果 HTTP 版本为 1.1，则 host 头部不可以为空，否则返回 400 Bad Request 错误响应给客户
端；如果传递了 Content-Length 头部，那么它必须是合法的数字，否则会返回 400 Length
Required 错误响应给客户端；如果请求使用了 PUT 方法，那么必须传递 Content-Length 头部，
否则会返回 400 Length Required 错误响应给客户端。

11）调用 ngx_http_process_request 方法开始使用各 HTTP 模块正式地在业务上处理 HTTP 请
求。

以上 11 步骤仅专注于接收并解析出全部的 HTTP 头部，同时检查它们的合法性，并将解
析出的 HTTP 头部设置到 ngx_http_request_t 结构体里的合适位置。接下来开始讨论如何使用以
上两节中已经解析好的 HTTP 请求行和头部。

11.6 处理 HTTP 请求
在接收到完整的 HTTP 头部后，已经拥有足够的必要信息开始在业务上处理 HTTP 请求
了。本节将说明 HTTP 框架是如何召集负责具体功能的各 HTTP 模块合作处理请求的。在图
11-4 的第 11 步及图 11-3 的第 10 步中，最后都是通过调用 ngx_http_process_request 方法开始处理
请求，本节将讨论 ngx_http_process_request 方法的流程，而且 ngx_http_process_request 方法只
是处理请求的开始，对于基于事件驱动的异步 HTTP 框架来说，处理请求并不是一步可以完
成的，所以我们也会讨论后续 TCP 连接上的回调方法 ngx_http_request_handler 的流程。首先来
看看接收完 HTTP 头部后 ngx_http_process_request 方法所做的事情，如图 11-5 所示。

图 11-5 ngx_http_process_request 处理 HTTP 请求的流程图
下面详细介绍图 11-5 中的 8 个步骤。

1）由于现在已经开始准备调用各 HTTP 模块处理请求了，因此不再存在接收 HTTP 请求
头部超时的问题，那就需要从定时器中把当前连接的读事件移除了。检查读事件对应的
timer_set 标志位，为 1 时表示读事件已经添加到定时器中了，这时需要调用 ngx_del_timer 从定
时器中移除读事件；如果 timer_set 标志位为 0，则直接执行第 2 步。

2）从现在开始不会再需要接收 HTTP 请求行或者头部，所以需要重新设置当前连接读/
写事件的回调方法。在这一步骤中，将同时把读事件、写事件的回调方法都设置为
ngx_http_request_handler 方法，在下面的图 11-7 中会介绍到这个方法，请求的后续处理都是通
过 ngx_http_request_handler 方法进行的。

3）设置 ngx_http_request_t 结构体的 read_event_handler 方法为 ngx_http_block_reading。前面
11.3 节中曾介绍过 read_event_handler 方法，当再次有读事件到来时，将会调用
read_event_handler 方法处理请求。而这里将它设置为 ngx_http_block_reading 方法，这个方法
可认为不做任何事，它的意义在于，目前已经开始处理 HTTP 请求，除非某个 HTTP 模块重新
设置了 read_event_handler 方法，否则任何读事件都将得不到处理，也可以认为读事件被阻塞
了。

4）检查 ngx_http_request_t 结构体的 internal 标志位，如果 internal 为 0，则继续执行第 5 步；
如果 internal 标志位为 1，则表示请求当前需要做内部跳转，将要把结构体中的 phase_handler
序号置为 server_rewrite_index。先来回顾一下 10.6.1 节，注意 ngx_http_phase_engine_t 结构体中
的 handlers 动态数组中保存了请求需要经历的所有回调方法，而 server_rewrite_index 则是
handlers 数组中 NGX_HTTP_SERVER_REWRITE_PHASE 处理阶段的第一个
ngx_http_phase_handler_t 回调方法所处的位置。

究竟 handlers 数组是怎么使用的呢？事实上，它要配合着 ngx_http_request_t 结构体的
phase_handler 序号使用，由 phase_handler 指定着请求将要执行的 handlers 数组中的方法位置。

注意，handlers 数组中的方法都是由各个 HTTP 模块实现的，这就是所有 HTTP 模块能够共同
处理请求的原因。

在这一步骤中，把 phase_handler 序号设为 server_rewrite_index，这意味着无论之前执行
到哪一个阶段，马上都要重新从 NGX_HTTP_SERVER_REWRITE_PHASE 阶段开始再次执
行，这是 Nginx 的请求可以反复 rewrite 重定向的基础。

5）当 internal 标志位为 0 时，表示不需要重定向（如刚开始处理请求时），将
phase_handler 序号置为 0，意味着从 ngx_http_phase_engine_t 指定数组的第一个回调方法开始执
行（参见 10.6 节，了解 ngx_http_phase_engine_t 是如何将各 HTTP 模块的回调方法构造成
handlers 数组的）。

6）设置 ngx_http_request_t 结构体的 write_event_handler 成员为 ngx_http_core_run_phases 方
法。如同 read_event_handler 方法一样，在图 11-7 中可以看到 write_event_handler 方法是如何被
调用的。

7）执行 ngx_http_core_run_phases 方法，其流程如图 11-6 所示。

8）调用 ngx_http_run_posted_requests 方法执行 post 请求，参见 11.7 节。

上述第 7 步调用了 ngx_http_core_run_phases 方法，该方法将开始调用各个 HTTP 模块共同
处理请求。在第 10 章我们讨论过 HTTP 框架的初始化，在这一过程中是允许各个 HTTP 模块将
自己的处理方法按照 11 个 ngx_http_phases 阶段添加到全局的 ngx_http_core_main_conf_t 结构体
中的。下面简单地回顾一下它的定义，如下所示。

typedef struct {
…
// HTTP 框架初始化后各个
HTTP 模块构造的处理方法将组成
phase_engine
ngx_http_phase_engine_t phase_engine;
} ngx_http_core_main_conf_t;
typedef struct {
/*由
ngx_http_phase_handler_t 结构体构成的数组，每一个数组成员代表着一个
HTTP 模块所添加的一个处理方法
/
ngx_http_phase_handler_t handlers;
…
} ngx_http_phase_engine_t;
typedef struct ngx_http_phase_handler_s ngx_http_phase_handler_t;
struct ngx_http_phase_handler_s {
/*每个
handler 方法必须对应着一个
checker 方法，这个
checker 方法由
HTTP 框架实现
\*/
ngx_http_phase_handler_pt checker;
// 各个
HTTP 模块实现的方法
ngx_http_handler_pt handler;
…
};
可以看到，根据 ngx_http_core_main_conf_t 结构体的 phase_engine 成员即可依次调用各个
HTTP 模块来共同处理一个请求。下面看看图 11-6 中展示的 ngx_http_core_run_phases 方法的流
程。

图 11-6 ngx_http_core_run_phases 方法的执行流程
在图 11-6 中仅会执行每个 ngx_http_phase_handler_t 处理阶段的 checker 方法，而不会执行
handler 方法，其原因已在 10.6 节讲过，这是因为 handler 方法其实仅能在 checker 方法中被调
用，而且 checker 方法由 HTTP 框架实现，所以可以控制各 HTTP 模块实现的处理方法在不同的
阶段中采用不同的调用行为。再来简单地看一下调用的源代码。

void ngx_http_core_run_phases(ngx_http_request_t \*r)
{
ngx_int_t rc;
ngx_http_phase_handler_t ph;
ngx_http_core_main_conf_t cmcf;
cmcf = ngx_http_get_module_main_conf(r, ngx_http_core_module);
ph = cmcf-\>phase_engine.handlers;
while (ph[r-\>phase_handler].checker) {
rc = ph[r-\>phase_handler].checker(r, &ph[r-\>phase_handler]);
if (rc == NGX_OK) {
return;
}
}
}
可以看到，ngx_http_request_t 结构体中的 phase_handler 成员将决定执行到哪一阶段，以及
下一阶段应当执行哪个 HTTP 模块实现的内容。在图 11-5 的第 4 步和第 5 步中可以看到请求的
phase_handler 成员会被重置，而 HTTP 框架实现的 checker 方法也会修改 phase_handler 成员的
值。表 11-1 列出了 HTTP 框架实现的所有 checker 方法，如下所示。

表 11-1 HTTP 框架为 11 个阶段实现的 checker 方法
我们在 10.6 节中曾经详细介绍过 HTTP 阶段。在 11 个阶段中其中 7 个是允许各个 HTTP 模块
向阶段中任意添加自己实现的 handler 处理方法的，但同一个阶段中的所有 handler 处理方法都
拥有相同的 checker 方法，见表 11-1。我们知道，每个阶段中处理方法的返回值都会以不同的
方式影响 HTTP 框架的行为，而在图 11-6 中也可以看到，checker 方法在返回 NGX_OK 和其他
值时也会导致不同的结果（每个 checker 方法的返回值实际上与 handler 处理方法的返回是相关
的，参见 10.6.2 节~10.6.12 节中对各个阶段的说明）。当 checker 方法的返回值非 NGX_OK 时，
意味着向下执行 phase_engine 中的各处理方法；反之，当任何一个 checker 方法返回 NGX_OK
时，意味着把控制权交还给 Nginx 的事件模块，由它根据事件（网络事件、定时器事件、异
步 I/O 事件等）再次调度请求。然而，一个请求多半需要 Nginx 事件模块多次地调度 HTTP 模块
处理，这时就要看在图 11-5 中第 2 步设置的读/写事件的回调方法 ngx_http_request_handler 的功
能了，如图 11-7 所示。

图 11-7 ngx_http_request_handler 方法的执行流程
通常来说，在接收完 HTTP 头部后，是无法在一次 Nginx 框架的调度中处理完一个请求
的。在第一次接收完 HTTP 头部后，HTTP 框架将调度 ngx_http_process_request 方法开始处理请
求，这时根据图 11-6 中的流程可以看到，如果某个 checker 方法返回了 NGX_OK，则将会把控
制权交还给 Nginx 框架。当这个请求上对应的事件再次触发时，HTTP 框架将不会再调度
ngx_http_process_request 方法处理请求，而是由 ngx_http_request_handler 方法开始处理请求。

下面来看看图 11-7 中列出的 ngx_http_request_handler 方法的流程：
1）ngx_http_request_handler 是 HTTP 请求上读/写事件的回调方法。在 ngx_event_t 结构体表
示的事件中，data 成员指向了这个事件对应的 ngx_connection_t 连接，而根据 11.3 节中的内容
可以看到，在 HTTP 框架的 ngx_connection_t 结构体中的 data 成员则指向了 ngx_http_request_t 结
构体。毫无疑问，只有拥有了 ngx_http_request_t 结构体才可以处理 HTTP 请求，而第一个步骤
是从事件中取出 ngx_http_request_t 结构体。

2）检查这个事件的 write 可写标志，如果 write 标志为 1，则调用 ngx_http_request_t 结构体
中的 write_event_handler 方法。注意，我们在 ngx_http_handler 方法中（即图 11-5 的第 6 步）已
经将 write_event_handler 设置为 ngx_http_core_run_phases 方法，而一般我们开发的不太复杂的
HTTP 模块是不会重新设置 write_event_handler 方法的，因此，一旦有可写事件时，就会继续
按照图 11-6 的流程执行 ngx_http_core_run_phases 方法，并继续按阶段调用各个 HTTP 模块实现
的方法处理请求。

3）调用 ngx_http_request_t 结构体中的 read_event_handler 方法。注意比较第 2 步和第 3 步，
如果一个事件的读写标志同时为 1 时，仅 write_event_handler 方法会被调用，即可写事件的处
理优先于可读事件（这正是 Nginx 高性能设计的体现，优先处理可写事件可以尽快释放内
存，尽量保持各 HTTP 模块少使用内存以提高并发能力）。

4）调用 ngx_http_run_posted_requests 方法执行 post 请求，参见 11.7 节。

以上重点讨论了 ngx_http_process_request 和 ngx_http_request_handler 这两个方法，其中
ngx_http_process_request 方法负责在接收完 HTTP 头部后，第一次与各个 HTTP 模块共同按阶段
处理请求，而对于 ngx_http_request_handler 方法，如果 ngx_http_process_request 没能处理完请
求，这个请求上的事件再次被触发，那就将由此方法继续处理了。

这两个方法的共通之处在于，它们都会先按阶段调用各个 HTTP 模块处理请求，再处理
post 请求。关于 post 请求的内容下文会介绍，而按阶段处理请求实际上就是图 11-6 中描述的流
程，也就是通过每个阶段的 checker 方法来实现。在表 11-1 中可以看到，在各个 HTTP 模块能
够介入的 7 个阶段中，实际上共享了 4 个 checker 方法：ngx_http_core_generic_phase、
ngx_http_core_rewrite_phase、ngx_http_core_access_phase、ngx_http_core_content_phase，在
10.6 节中我们曾经简单地介绍过它们。

这 4 个 checker 方法的主要任务在于，根据 phase_handler 执行某个 HTTP 模块实现的回调方
法，并根据方法的返回值决定：当前阶段已经完全结束了吗？下次要执行的回调方法是哪一
个？究竟是立刻执行下一个回调方法还是先把控制权交还给 epoll？下面通过介绍这 4 个
checker 方法来回答上述 3 个问题（其他 checker 方法仅由 HTTP 框架使用，这里不再详细介
绍）。

11.6.1 ngx_http_core_generic_phase
从表 11-1 中可以看出，有 3 个 HTTP 阶段都使用了 ngx_http_core_generic_phase 作为它们的
checker 方法，这意味着任何试图在 NGX_HTTP_POST_READ_PHASE、
NGX_HTTP_PREACCESS_PHASE、NGX_HTTP_LOG_PHASE 这 3 个阶段处理请求的 HTTP 模
块都需要了解 ngx_http_core_generic_phase 方法到底做了些什么。图 11-8 中描述了
ngx_http_core_generic_phase 方法的流程，可以看到，在调用了当前阶段的 handler 方法后，根
据返回值的不同可能导致 4 种不同的结果。

下面说明图 11-8 中所列的 5 个步骤。

1）首先调用 HTTP 模块实现的 handler 方法，这个方法的实现当然是不允许有阻塞操作
的，它会立刻返回。根据它的返回值类型，将会有 4 种不同的结果：返回 NGX_OK 时直接跳
转到第 2 步执行；返回 NGX_DECLINED 时跳转到第 3 步执行；返回 NGX_AGAIN 或者
NGX_DONE 时跳转到第 4 步执行；返回其他值时跳转到第 5 步执行。

2）如果 HTTP 模块实现的 handler 方法返回 NGX_OK，这意味着当前阶段已经执行完毕，
需要跳转到下一个阶段执行。例如，在 NGX_HTTP_ACCESS_PHASE 阶段中可能有两个
HTTP 模块都注册了回调方法，在执行第 1 个 HTTP 模块的回调方法时，如果它返回了
NGX_OK，那么就不再执行第 2 个 HTTP 模块实现的回调方法了，而是跳转到下一个阶段（如
NGX_HTTP_POST_ACCESS_PHASE）开始执行。注意，此时 ngx_http_core_generic_phase 方
法会返回 NGX_AGAIN，从图 11-6 中可以看到，非 NGX_OK 的返回值不会使 HTTP 框架把进程
控制权交还给 epoll 等事件模块，而是会继续立刻执行请求的后续处理方法。

图 11-8 ngx_http_core_generic_phase 方法的执行流程
3）如果 handler 方法返回 NGX_DECLINED，则会执行下一个回调方法。继续第 2 步中的
例子，在 NGX_HTTP_ACCESS_PHASE 阶段，第 1 个 HTTP 模块的回调方法返回
NGX_DECLINED 后，下一个将要执行的方法仍然属于 NGX_HTTP_ACCESS_PHASE 阶段，
即第 2 个 HTTP 模块实现的回调方法。注意，这时 ngx_http_core_generic_phase 返回的仍然是
NGX_AGAIN，它意味着 HTTP 框架会紧接着继续执行请求的后续处理方法。

4）如果 handler 方法返回 NGX_AGAIN 或者 NGX_DONE，则意味着刚才的 handler 方法无
法在这一次调度中处理完这一个阶段，它需要多次调度才能完成，也就是说，刚刚执行过的
handler 方法希望：如果请求对应的事件再次被触发时，将由 ngx_http_request_handler 通过
ngx_http_core_run_phases 再次调用这个 handler 方法。直接返回 NGX_OK 会使得 HTTP 框架立刻
把控制权交还给 epoll 事件框架，不再处理当前请求，唯有这个请求上的事件再次被触发才会
继续执行。

图 11-9 ngx_http_core_rewrite_phase 方法的执行流程
5）如果 handler 方法返回了第 2、第 3、第 4 步中以外的返回值，则调用
ngx_http_finalize_request 结束请求。ngx_http_finalize_request 方法中的参数就是 handler 方法的返
回值，其影响参见 11.10.6 节。

当我们开发的 HTTP 模块试图介入 NGX_HTTP_POST_READ_PHASE、
NGX_HTTP_PREACCESS_PHASE、NGX_HTTP_LOG_PHASE 这 3 个阶段处理请求时，实现
的 handler 方法需要根据上述步骤决定返回值。ngx_http_core_generic_phase 可以帮助我们较为
简单地实现强大的异步无阻塞处理能力。

11.6.2 ngx_http_core_rewrite_phase
ngx_http_core_rewrite_phase 方法充当了用于重写 URL 的
NGX_HTTP_SERVER_REWRITE_PHASE 和 NGX_HTTP_REWRITE_PHASE 这两个阶段的
checker 方法。图 11-9 中描述了 ngx_http_core_rewrite_phase 方法的流程，可以看到，在调用了
当前阶段的 handler 方法后，根据返回值的不同可能会导致 3 种结果。

下面简要描述一下图 11-9 中所列的 4 个步骤。

1）首先调用 HTTP 模块实现的 handler 方法，根据它的返回值类型，将会有 3 种不同的结
果：返回 NGX_DECLINED 时跳转到第 2 步执行；返回 NGX_DONE 时跳转到第 3 步执行；返回
其他值时跳转到第 4 步执行。

2）如果 handler 方法返回 NGX_DECLINED，将 phase_handler 加 1 表示将要执行下一个回调
方法。注意，此时返回的是 NGX_AGAIN，HTTP 框架不会把进程控制权交还给 epoll 事件框
架，而是继续立刻执行请求的下一个回调方法。

3）如果 handler 方法返回 NGX_DONE，则意味着刚才的 handler 方法无法在这一次调度中
处理完这一个阶段，它需要多次的调度才能完成。注意，此时返回 NGX_OK，它会使得
HTTP 框架立刻把控制权交还给 epoll 等事件模块，不再处理当前请求，唯有这个请求上的事
件再次被触发时才会继续执行。

4）如果 handler 方法返回除去 NGX_DECLINED 或者 NGX_DONE 以外的其他值，则调用
ngx_http_finalize_request 结束请求，其参数为 handler 方法的返回值。

可以注意到，ngx_http_core_rewrite_phase 方法与 ngx_http_core_generic_phase 方法有一个
显著的不同点：前者永远不会导致跨过同一个 HTTP 阶段的其他处理方法，就直接跳到下一
个阶段来处理请求。原因其实很简单，可能有许多 HTTP 模块在
NGX_HTTP_SERVER_REWRITE_PHASE 和 NGX_HTTP_REWRITE_PHASE 阶段同时处理重写
URL 这样的业务，HTTP 框架认为这两个阶段的 HTTP 模块是完全平等的，序号靠前的 HTTP
模块优先级并不会更高，它不能决定序号靠后的 HTTP 模块是否可以再次重写 URL。因此，
ngx_http_core_rewrite_phase 方法绝对不会把 phase_handler 直接设置到下一个阶段处理方法的
流程中，即不可能存在类似下面的代码。

ngx_int_t ngx_http_core_rewrite_phase(ngx_http_request_t r, ngx_http_phase_handler_t ph)
{
…
r-\>phase_handler = ph-\>next;
…
}
11.6.3 ngx_http_core_access_phase
ngx_http_core_access_phase 方法是仅用于 NGX_HTTP_ACCESS_PHASE 阶段的处理方
法，这一阶段用于控制用户发起的请求是否合法，如检测客户端的 IP 地址是否允许访问。它
涉及 nginx.conf 配置文件中 satisfy 配置项的参数值，见表 11-2。

表 11-2 相对于 NGX_HTTP_ACCESS_PHASE 阶段处理方法，satisfy 配置项参数的意义
对于表 11-2 的 any 配置项，是通过 ngx_http_request_t 结构体中的 access_code 成员来传递
handler 方法的返回值的，因此，ngx_http_core_access_phase 方法会比较复杂，如图 11-10 所
示。

图 11-10 ngx_http_core_access_phase 方法的执行流程
下面开始分析 ngx_http_core_access_phase 方法的流程。

1）既然 NGX_HTTP_ACCESS_PHASE 阶段用于控制客户端是否有权限访问服务，那么
它就不需要对子请求起作用。如何判断请求究竟是来自客户端的原始请求还是被派生出的子
请求呢？很简单，检查 ngx_http_request_t 结构体中的 main 指针即可。在 11.3 节介绍过的
ngx_http_init_request 方法会把 main 指针指向其自身，而由这个请求派生出的其他子请求中的
main 指针，仍然会指向 ngx_http_init_request 方法初始化的原始请求。因此，检查 main 成员与
ngx_http_request_t 自身的指针是否相等即可，如下面的源代码。

if (r != r-\>main) {
r-\>phase_handler = ph-\>next;
return NGX_AGAIN;
}
如果当前请求只是一个派生出的子请求的话，是不需要执行
NGX_HTTP_ACCESS_PHASE 阶段的处理方法的，那么直接将 phase_handler 设为下一个阶段
（实际上是 NGX_HTTP_POST_ACCESS_PHASE 阶段）的处理方法的序号。这时会返回
NGX_AGAIN，也就是希望 HTTP 框架立刻执行新的 HTTP 阶段的处理方法。

2）如果当前请求就是来自客户端的原始请求，那么调用 HTTP 模块在这一阶段中实现
handler 方法，它的返回值将会导致出现 3 个分支：返回 NGX_AGAIN 或者 NGX_DONE 时跳转
到第 3 步执行；返回 NGX_DECLINED 时跳转到第 4 步执行；返回其他值时跳转到第 5 步继续向
下执行。同时，在第 5 步之后，这个返回值由于 nginx.conf 文件中配置项 satisfy 的参数值不同，
也将具有不同的意义。

3）返回 NGX_AGAIN 或者 NGX_DONE 意味着当前的 NGX_HTTP_ACCESS_PHASE 阶段
没有一次性执行完毕，所以在这一步中会暂时结束当前请求的处理，将控制权交还给事件模
块，ngx_http_core_access_phase 方法结束。当请求中对应的事件再次触发时才会继续处理该
请求。

4）返回 NGX_DECLINED 意味着 handler 方法执行完毕且“意犹未尽”，希望立刻执行下一
个 handler 方法，无论其是否属于 NGX_HTTP_ACCESS_PHASE 阶段，在这一步中只需要把
phase_handler 加 1，同时 ngx_http_core_access_phase 方法返回 NGX_AGAIN 即可。

5）现在开始处理非第 3、第 4 步中返回值的情况。由于 NGX_HTTP_ACCESS_PHASE 阶
段是在 NGX_HTTP_FIND_CONFIG_PHASE 阶段之后的，因此这时请求已经找到了匹配的
location 配置块，先把 location 块对应的 ngx_http_core_loc_conf_t 配置结构体取出来，因为这里
有一个配置项 satisfy 是下一步需要用到的。

6）检查 ngx_http_core_loc_conf_t 结构体中的 satisfy 成员，如果值为
NGX_HTTP_SATISFY_ALL（即 nginx.conf 文件中配置了 satisfy all 参数），则意味着所有
NGX_HTTP_ACCESS_PHASE 阶段的 handler 方法必须共同作用于这个请求。这时，handler 方
法的返回值就具有不同的意义了。如果它的返回值是 NGX_OK，则意味着这个 handler 方法所
在的 HTTP 模块认为当前请求是具备访问权限的，需要再次检查
NGX_HTTP_ACCESS_PHASE 阶段的下一个 HTTP 模块的 handler 方法，于是会跳到第 4 步执
行；反之，如果返回值不是 NGX_OK，就意味着当前请求无权访问服务，这时需要跳到第 8
步调用 ngx_http_finalize_request 方法结束请求，方法的参数也就是这个返回值。

如果 ngx_http_core_loc_conf_t 结构体中的 satisfy 成员值为 NGX_HTTP_SATISFY_ANY（即
nginx.conf 文件中配置了 satisfy any 参数），也就是说，并不强制要求
NGX_HTTP_ACCESS_PHASE 阶段的所有 handler 方法必须同时起作用，那么这时 handler 方法
的返回值又具有了不同的意义。如果该返回值是 NGX_OK，则表示第 2 步执行的 handler 方法
认为这个请求有权限访问服务，而且不用再调用 NGX_HTTP_ACCESS_PHASE 阶段的其他
handler 方法了，直接跳到第 7 步执行；如果返回值是 NGX_HTTP_FORBIDDEN 或者
NGX_HTTP_UNAUTHORIZED，则表示这个 HTTP 模块的 handler 方法认为请求没有权限访问
服务，但只要 NGX_HTTP_ACCESS_PHASE 阶段的任何一个 handler 方法返回 NGX_OK 就认为
请求合法，所以后续的 handler 方法可能会更改这一结果。这时将请求的 access_code 成员设置
为 handler 方法的返回值，用于传递当前 HTTP 模块的处理结果，然后跳到第 4 步执行下一个
handler 方法；如果返回值为其他值，可以认为请求绝对无权访问服务，则跳到第 8 步执行。

7）上面已经解释过，在 satisfy any 配置下，handler 方法返回 NGX_OK 时意味着这个请求
具备访问权限，将请求的 access_code 成员置为 0，跳到第 1 步执行。

8）调用 ngx_http_finalize_request 方法结束请求。

虽然 ngx_http_core_access_phase 方法有些复杂，即它为 NGX_HTTP_ACCESS_PHASE 阶
段中的 handler 方法的返回值增加了过多的含义，但当我们开发的 HTTP 模块需要处理请求的
访问权限时，就会发现 ngx_http_core_access_phase 方法给我们带来强大的功能，可以实现复
杂的权限控制。

11.6.4 ngx_http_core_content_phase
ngx_http_core_content_phase 是 NGX_HTTP_CONTENT_PHASE 阶段的 checker 方法，可以
说它是我们开发 HTTP 模块时最常用的一个阶段了。顾名思义，
NGX_HTTP_CONTENT_PHASE 阶段用于真正处理请求的内容。其余 10 个阶段中各 HTTP 模块
的处理方法都是放在全局的 ngx_http_core_main_conf_t 结构体中的，也就是说，它们对任何一
个 HTTP 请求都是有效的。但在 NGX_HTTP_CONTENT_PHASE 阶段却很自然地有另一种需
求，有的 HTTP 模块可能仅希望在这个处理请求内容的阶段，仅仅针对某种请求唯一生效，
而不是对所有请求生效。例如，仅当请求的 URI 匹配了配置文件中的某个 location 块时，再根
据 location 块下的配置选择一个 HTTP 模块执行它的 handler 处理方法，并以此替代
NGX_HTTP_CONTENT_PHASE 阶段的其他 handler 方法（这些 handler 方法对于该请求将得不
到执行）。

既然我们希望请求在 NGX_HTTP_CONTENT_PHASE 阶段的 handler 方法仅与 location 相
关，那么就肯定与 ngx_http_core_loc_conf_t 结构体相关了，注意 handler 成员：
struct ngx_http_core_loc_conf_s {
…
ngx_http_handler_pt handler;
…
｝
这个 handler 成员属于 nginx.conf 中匹配了请求的 location 块下配置的 HTTP 模块（当然，如
果请求匹配的 location 块下没有配置 HTTP 模块处理请求，那么这个 handler 指针将为 NULL 空指
针）。回顾一下第 3 章中的 ngx_http_mytest 方法，它正是在某个 location 下检测到 mytest 配置项
后，取到当前 location 下的 ngx_http_core_loc_conf_t 结构体，并把 handler 成员设置为希望在
NGX_HTTP_CONTENT_PHASE 阶段处理请求的 ngx_http_mytest_handler 方法的。

实际上，为了加快处理速度，HTTP 框架又在 ngx_http_request_t 结构体中增加了一个成员
content_handler（参见 11.3.1 节），在 NGX_HTTP_FIND_CONFIG_PHASE 阶段就会把它设为
匹配了请求 URI 的 location 块中对应的 ngx_http_core_loc_conf_t 结构体的 handler 成员（参见
Nginx 源代码的 ngx_http_update_location_config 方法）。

以上所述是 NGX_HTTP_CONTENT_PHASE 阶段的特殊之处，当然，它还可以像其余 10
个阶段一样具备全局生效的 handler 方法，但如果设置了 content_handler 方法，会优先以
content_handler 为准，如图 11-11 所示。

下面详细介绍一下 ngx_http_core_content_phase 方法是如何处理
NGX_HTTP_CONTENT_PHASE 阶段的请求的。

1）首先检测 ngx_http_request_t 结构体的 content_handler 成员是否为空，其实就是看在
NGX_HTTP_FIND_CONFIG_PHASE 阶段匹配了 URI 请求的 location 内，是否有 HTTP 模块把处
理方法设置到了 ngx_http_core_loc_conf_t 结构体的 handler 成员中。如果 content_handler 为空，
则跳到第 2 步开始执行全局有效的 handler 方法；否则仅执行 content_handler 方法，看看源代码
中做了些什么，如下所示。

r-\>write_event_handler = ngx_http_request_empty_handler;
ngx_http_finalize_request(r, r-\>content_handler(r));
其中，首先设置 ngx_http_request_t 结构体的 write_event_handler 成员为不做任何事的
ngx_http_request_empty_handler 方法，也就是告诉 HTTP 框架再有可写事件时就调用
ngx_http_request_empty_handler 直接把控制权交还给事件模块。为何要这样做呢？因为 HTTP
框架在这一阶段调用 HTTP 模块处理请求就意味着接下来只希望该模块处理请求，先把
write_event_handler 强制转化为 ngx_http_request_empty_handler，可以防止该 HTTP 模块异步地
处理请求时却有其他 HTTP 模块还在同时处理可写事件、向客户端发送响应。接下来调用
content_handler 方法处理请求，并把它的返回值作为参数传递给 ngx_http_finalize_request 方法
来结束请求。ngx_http_finalize_request 方法是非常复杂的，它会根据引用计数来确定自己的行
为，具体参见 11.10.6 节。

2）在没有 content_handler 方法时，又回到了我们惯用的方式，首先根据 phase_handler 序
号调用 handler 处理方法，检测它的返回值：当返回值为 NGX_DECLINED 时跳到第 4 步，否则
跳到第 3 步执行。

3）如果 NGX_HTTP_CONTENT_PHASE 阶段中全局的 handler 方法没有返回
NGX_DECLINED，则意味着不再执行该阶段的其他 handler 方法。因此，这时简单地以
handler 方法作为参数调用 ngx_http_finalize_request 结束请求即可。同时，
ngx_http_core_content_phase 方法返回 NGX_OK，表示归还控制权给事件模块。

图 11-11 ngx_http_core_content_phase 方法的流程
4）虽然 handler 方法返回了 NGX_DECLINED，表示希望执行本阶段的下一个 handler 方
法，但是当前的 handler 方法是否已经是最后一个 handler 方法了呢？这需要进行检测，首先转
到数组中的下一个 handler 方法，检测其 checker 方法是否存在，若存在，则跳到第 5 步执行，
若不存在，则结束请求，但需要根据 URI 确定返回什么样的 HTTP 响应，如果 URI 是以“/”结
尾，则跳到第 6 步执行，否则跳到第 7 步执行。

5）既然 handler 方法返回 NGX_DECLINED 希望执行下一个 handler 方法，那么这一步把请
求的 phase_handler 序号加 1，ngx_http_core_content_phase 方法返回 NGX_AGAIN，表示希望
HTTP 框架立刻执行下一个 handler 方法。

6）以 NGX_HTTP_FORBIDDEN 作为参数调用 ngx_http_finalize_request 方法，表示结束请
求并返回 403 错误码。同时，ngx_http_core_content_phase 方法返回 NGX_OK，表示交还控制权
给事件模块。

7）以 NGX_HTTP_NOT_FOUND 作为参数调用 ngx_http_finalize_request 方法，表示结束请
求并返回 404 错误码。同时，ngx_http_core_content_phase 方法返回 NGX_OK，表示交还控制权
给事件模块。

NGX_HTTP_CONTENT_PHASE 阶段是各 HTTP 模块最常介入的阶段。只有对
ngx_http_core_content_phase 方法的流程足够熟悉，才能实现复杂的功能。

注意从 ngx_http_core_content_phase 方法中可以看到，请求在第 10 个阶段
NGX_HTTP_CONTENT_PHASE 后，并没有去调用第 11 个阶段 NGX_HTTP_LOG_PHASE 的
处理方法，通过比较 11.6 节的其他 checker 方法，就会发现它与之前的方法都不同。事实上，
记录访问日志是必须在请求将要结束时才能进行的，因此，NGX_HTTP_LOG_PHASE 阶段
的回调方法在 11.10.2 节介绍的 ngx_http_free_request 方法中才会调用到。

11.7 subrequest 与 post 请求
从 11.6 节中可以看到，HTTP 框架无论是调用 ngx_http_process_request 方法（首次从业务
上处理请求）还是 ngx_http_request_handler 方法（TCP 连接上后续的事件触发时）处理请求，
最后都有一个步骤，就是调用 ngx_http_run_posted_requests 方法处理 post 请求（如图 11-5 中的
第 8 步、图 11-7 中的第 4 步）。那么，什么是 post 请求？为什么要定义 post 请求？post 请求又是
怎样实现于 HTTP 框架中的呢？本节内容将回答这 3 个问题。

Nginx 使用的完全无阻塞的事件驱动框架是难以编写功能复杂的模块的，可以想见，一
个请求在处理一个 TCP 连接时，将需要处理这个连接上的可读、可写以及定时器事件，而可
读事件中又包含连接建立成功、连接关闭事件，正常的可读事件在接收到 HTTP 的不同部分
时又要做不同的处理，这就比较复杂了。如果一个请求同时需要与多个上游服务器打交道，
同时处理多个 TCP 连接，那么它需要处理的事件就太多了，这种复杂度会使得模块难以维
护。Nginx 解决这个问题的手段就是第 5 章中介绍过的 subrequest 机制。

subrequest 机制有以下两个特点：

-   从业务上把一个复杂的请求拆分成多个子请求，由这些子请求共同合作完成实际的用
    户请求。

-   每一个 HTTP 模块通常只需要关心一个请求，而不用试图掌握派生出的所有子请求，
    这极大地降低了模块的开发复杂度。

这两个特点使得用户可以通过开发多个功能相对单一独立的模块，来共同完成复杂的业
务。

post 请求的设计就是用于实现 subrequest 子请求机制的，如果一个请求具备了 post 请求，
并且 HTTP 框架保证 post 请求可以在当前请求执行完毕后获得执行机会，那么 subrequest 功能
就可以实现了。子请求的设计在数据结构上是通过 ngx_http_request_t 结构体的 3 个成员
（posted_requests、parent、main）来保证的。下面看一下表示单向链表的 posted_requests 成
员，它的类型是 ngx_http_posted_request_t 结构体，如下所示。

typedef struct ngx_http_posted_request_s ngx_http_posted_request_t;
struct ngx_http_posted_request_s {
// 指向当前待处理子请求的
ngx_http_request_t 结构体
ngx_http_request_t *request;
// 指向下一个子请求，如果没有，则为
NULL 空指针
ngx_http_posted_request_t *next;
};
这样，通过 posted_requests 就把各个子请求以单向链表的数据结构形式组织起来了。

ngx_http_request_t 结构体中的 parent 指向了当前子请求的父请求，这为子请求向前寻找父
请求提供了可能性。

ngx_http_request_t 结构体中的 main 成员始终指向一系列有亲缘关系的请求中的唯一的那
个原始请求。我们可以在任何一个子请求中通过 main 成员找到原始请求，而无论怎样执行子
请求，都是围绕着 main 指向的原始请求进行的，在图 11-12 中可以看到。

图 11-12 post 请求的执行
ngx_http_request_t 结构体中的 count 成员将作为引用计数，每当派生出子请求时，原始请
求的 count 成员都会加 1，在真正销毁请求前，可以通过检查 count 成员是否为 0 以确认是否销
毁原始请求，这样可以做到唯有所有的子请求都结束时，原始请求才会销毁，内存池、TCP
连接等资源才会释放。

对于 subrequest 子请求的用法，可参见 5.4 节，这里不再赘述。图 11-12 展示
ngx_http_run_posted_requests 方法是怎么执行一个请求的 post 请求的，也就是如果一个请求拥
有子请求时，子请求是怎么被调度的。

从图 11-12 中可以看到，在执行某一个请求时，它的所有 post 请求都可能被执行一遍。下
面详细介绍以上流程。

1）首先检查连接是否已销毁，如果连接被销毁，就结束 ngx_http_run_posted_requests 方
法，否则根据 ngx_http_request_t 结构体中的 main 成员找到原始请求，这个原始请求的
posted_requests 成员指向待处理的 post 请求组成的单链表，如果 posted_requests 指向 NULL 空指
针，则结束 ngx_http_run_posted_requests 方法，否则取出链表中首个指向 post 请求的指针，并
跳到第 2 步执行。

2）将原始请求的 posted_requests 指针指向链表中下一个 post 请求（通过第 1 个 post 请求的
next 指针可以获得），当然，下一个 post 请求有可能不存在，这在下一次循环中就会检测
到。

3）调用这个 post 请求 ngx_http_request_t 结构体中的 write_event_handler 方法。为什么不是
执行 read_event_handler 方法呢？原因很简单，子请求不是被网络事件驱动的，因此，执行
post 请求时就相当于有可写事件，由 Nginx 主动做出动作。

在本节可以看到，HTTP 框架在处理一个请求时，如果发现其有子请求则一定会处理。

通过修改原始请求的 posted_requests 指针，甚至还可以控制从哪一个子请求开始执行，当
然，直接修改 HTTP 框架中的成员很容易出错，一定要慎重。

11.8 处理 HTTP 包体
本节开始介绍 HTTP 框架为 HTTP 模块提供的工具方法。在 HTTP 中，一个请求通常由必
选的 HTTP 请求行、请求头部，以及可选的包体组成，因此，在接收完 HTTP 头部后，就可以
开始调用各 HTTP 模块处理请求了（见 11.6 节），然后由 HTTP 模块决定如何处理包体。

HTTP 框架提供了两种方式处理 HTTP 包体，当然，这两种方式保持了完全无阻塞的事件
驱动机制，非常高效。第一种方式就是把请求中的包体接收到内存或者文件中，当然，由于
包体的长度是可变的，同时内存又是有限的，因此，一般都是将包体存放到文件中（本节不
会详细讨论包体的存储策略）。第二种方式是选择丢弃包体，注意，丢弃不等于可以不接收
包体，这样做可能会导致客户端出现发送请求超时的错误，所以，这个丢弃只是对于 HTTP
模块而言的，HTTP 框架还是需要“尽职尽责”地接收包体，在接收后直接丢弃。

本节将会遇到一个问题，这个问题需要用请求 ngx_http_request_t 结构体中的 count 引用计
数解决。举个例子，HTTP 模块在处理请求时，接收包体的同时可能还需要处理其他业务，
如使用 upstream 机制与另一台服务器通信，这样两个动作都不是一次调度可以完成的，它们
各自都可能需要多次调度才能完成，那么在其中一个动作出现错误导致请求失败时，如果销
毁请求可能会导致另一个动作出现严重错误，怎么办？这时就需要用到引用计数了。

在 HTTP 模块中每进行一类新的操作，包括为一个请求添加新的事件，或者把一些已经
由定时器、epoll 中移除的事件重新加入其中，都需要把这个请求的引用计数加 1。这是因为
需要让 HTTP 框架知道，HTTP 模块对于该请求有独立的异步处理机制，将由该 HTTP 模块决
定这个操作什么时候结束，防止在这个操作还未结束时 HTTP 框架却把这个请求销毁了（如
其他 HTTP 模块通过调用 ngx_http_finalize_request 方法要求 HTTP 框架结束请求），导致请求出
现不可知的严重错误。这就要求每个操作在“认为”自身的动作结束时，都得最终调用到
ngx_http_close_request 方法，该方法会自动检查引用计数，当引用计数为 0 时才真正地销毁请
求。实际上，很多结束请求的方法最后一定会调用到 ngx_http_close_request 方法（参见
11.10.3 节）。

由于 HTTP 包体是可变长度的，接收包体可能导致 HTTP 框架将 TCP 连接上的读事件再次
添加到 epoll 和定时器中，表示希望事件驱动机制发现 TCP 连接上接收到全部或者部分 HTTP
包体时，回调相应的方法读取套接字缓冲区上的 TCP 流，这时必须把请求的引用计数加 1，
这在图 11-13 的第 1 步中就可以看到。类似的，在第 5 章介绍的 subrequest 子请求的使用方法
中，派生子请求也是独立的动作，它会向 epoll 和定时器中添加新的事件，引用计数也会加
1，而 upstream 试图连接新的服务器，它同样也需要把当前请求的引用计数加 1。当这类操作
结束时，如 HTTP 包体全部接收完毕时，务必调用或者间接地调用 ngx_http_close_request 方
法，把引用计数减 1，这才能使引用计数机制正常工作。

注意引用计数一般都作用于这个请求的原始请求上，因此，在结束请求时统一检
查原始请求的引用计数就可以了。当然，目前的 HTTP 框架也要求我们必须这样做，因为
ngx_http_close_request 方法只是把原始请求上的引用计数减 1。对应到代码就是操作 r-\>main-
\>count 成员，其中 r 是请求对应的 ngx_http_request_t 结构体。

下面来看看 HTTP 框架提供的方法是如何使用的，接收包体的方法其实在 3.6.4 节中已经
讲过，再来回顾一下。

ngx_int_t ngx_http_read_client_request_body(ngx_http_request_t \*r, ngx_http_client_body_handler_pt post_handler);
调用了 ngx_http_read_client_request_body 方法就相当于启动了接收包体这一动作，在这个
动作完成后，就会回调 HTTP 模块定义的 post_handler 方法。post_handler 是一个函数指针，如
下所示。

typedef void (*ngx_http_client_body_handler_pt) (ngx_http_request_t *r);
而决定丢弃包体时，HTTP 框架提供的方法是 ngx_http_discard_request_body，如下所示。

ngx_int_t ngx_http_discard_request_body(ngx_http_request_t \*r)
当然，它是不需要再让 HTTP 模块定义类似 post_handler 的回调方法的，当丢弃包体后，
HTTP 框架会自动调用 ngx_http_finalize_request 方法把引用计数减 1，详见 11.8.2 节。

在 11.8.1 节中将会讨论 HTTP 框架是怎样实现 ngx_http_read_client_request_body 方法的，而
在 11.8.2 节中则会讨论 ngx_http_discard_request_body 方法的实现，由于这两个方法都需要被事
件框架多次调度，学习它们的设计方法可以帮助我们开发高效的 Nginx 模块。

11.8.1 接收包体
在讨论 ngx_http_read_client_request_body 方法的实现方式前，先来看一下用于保存 HTTP
包体的结构体 ngx_http_request_body_t，如下所示。

typedef struct {
// 存放
HTTP 包体的临时文件
ngx*temp_file_t temp_file;
/接收
HTTP 包体的缓冲区链表。当包体需要全部存放在内存中时，如果一块
ngx_buf_t 缓冲区无法存放完，这时就需要使用
ngx_chain_t 链表来存放
/
ngx_chain_t bufs;
// 直接接收
HTTP 包体的缓存
ngx_buf_t buf;
/根据
content-length 头部和已接收到的包体长度，计算出的还需要接收的包体长度
*/
off*t rest;
// 该缓冲区链表存放着将要写入文件的包体
ngx_chain_t \_to_write;
/\_HTTP 包体接收完毕后执行的回调方法，也就是
ngx_http_read_client_request_body 方法传递的第
2 个参数
*/
ngx_http_client_body_handler_pt post_handler;
} ngx_http_request_body_t;
这个 ngx_http_request_body_t 结构体就存放在保存着请求的 ngx_http_request_t 结构体的
request_body 成员中，接收 HTTP 包体就是围绕着这个数据结构进行的。

上文说过，在接收较大的包体时，无法在一次调度中完成。通俗地讲，就是接收包体不
是调用一次 ngx_http_read_client_request_body 方法就能完成的。但是 HTTP 框架希望对于它的
用户，也就是 HTTP 模块而言，接收包体时只需要调用一次 ngx_http_read_client_request_body
方法就好，这时就需要有另一个方法在 ngx_http_read_client_request_body 没接收到完整的包体
时，如果连接上再次接收到包体就被调用，这个方法就是
ngx_http_read_client_request_body_handler。

ngx_http_read_client_request_body_handler 方法对于 HTTP 模块是不可见的，它在“幕后”工
作。当继续接收发自客户端的包体时，将由它来处理。可见，它与
ngx_http_read_client_request_body 方法有很多共通之处，它们都会去试图读取连接套接字上的
缓冲区，把它们共性的部分提取出来构成 ngx_http_do_read_client_request_body 方法，它负责
具体的读取包体工作。本节的内容就在于说明这 3 个方法的流程。

图 11-13 为 ngx_http_read_client_request_body 方法的流程图，在该图中同时可以看到
ngx_http_request_t 结构体中的 request_body 成员是如何分配和使用的。

图 11-13 ngx_http_read_client_request_body 方法的流程图
图 11-13 把 ngx_http_read_client_request_body 方法的主要流程概括为 7 个步骤，下面详细说
明一下。

1）首先把该请求对应的原始请求的引用计数加 1。这同时是在要求每一个 HTTP 模块在
传入的 post_handler 方法被回调时，务必调用类似 ngx_http_finalize_request 的方法去结束请
求，否则引用计数会始终无法清零，从而导致请求无法释放。

检查请求 ngx_http_request_t 结构体中的 request_body 成员，如果它已经被分配过了，证明
已经读取过 HTTP 包体了，不需要再次读取一遍，这时跳到第 2 步执行；再检查请求
ngx_http_request_t 结构体中的 discard_body 标志位，如果 discard_body 为 1，则证明曾经执行过
丢弃包体的方法，现在包体正在被丢弃中，仍然跳到第 2 步执行。只有这两个条件都不满
足，才说明真正需要接收 HTTP 包体，这时跳到第 3 步执行。

2）这一步将直接执行各 HTTP 模块提供的 post_handler 回调方法，接着，
ngx_http_read_client_request_body 方法返回 NGX_OK。

3）分配请求的 ngx_http_request_t 结构体中的 request_body 成员（之前 request_body 是 NULL
空指针），准备接收包体。

4）检查请求的 content-length 头部，如果指定了包体长度的 content-length 字段小于或等于
0，当然不用继续接收包体，跳到第 2 步执行；如果 content-length 大于 0，则意味着继续执行，
但 HTTP 模块定义的 post_handler 方法不会知道在哪一次事件的触发中会被回调，所以先把它
设置到 request_body 结构体的 post_handler 成员中。

5）注意，在 11.5 节描述的接收 HTTP 头部的流程中，是有可能接收到 HTTP 包体的。首先
我们需要检查在 header_in 缓冲区中已经接收到的包体长度，确定其是否大于或者等于 contentlength 头部指定的长度，如果大于或等于则说明已经接收到完整的包体，这时跳到第 2 步执
行。

当上述条件不满足时，再检查 header_in 缓冲区里的剩余空闲空间是否可以存放下全部的
包体（content-length 头部指定），如果可以，就不用分配新的包体缓冲区浪费内存了，直接
跳到第 6 步执行。

当以上两个条件都不满足时，说明确实需要分配用于接收包体的缓冲区了。缓冲区长度
由 nginx.conf 文件中的 client_body_buffer_size 配置项指定，缓冲区就在 ngx_http_request_body_t
结构体的 buf 成员中存放着，同时，bufs 和 to_write 这两个缓冲区链表首部也指向该 buf。

6）设置请求 ngx_http_request_t 结构体的 read_event_handler 成员为上面介绍过的
ngx_http_read_client_request_body_handler 方法，它意味着如果 epoll 再次检测到可读事件或者
读事件的定时器超时，HTTP 框架将调用 ngx_http_read_client_request_body_handler 方法处理，
该方法所做的工作参见图 11-15。

7）调用 ngx_http_do_read_client_request_body 方法接收包体。该方法的意义在于把客户端
与 Nginx 之间 TCP 连接上套接字缓冲区中的当前字符流全部读出来，并判断是否需要写入文
件，以及是否接收到全部的包体，同时在接收到完整的包体后激活 post_handler 回调方法，如
图 11-14 所示。

图 11-14 ngx_http_do_read_client_request_body 方法的流程图
图 11-14 中列出的 ngx_http_do_read_client_request_body 方法流程稍显复杂，下面详细解释
一下这 11 个步骤。

1）首先检查请求的 request_body 成员中的 buf 缓冲区，如果缓冲区还有空闲的空间，则跳
到第 3 步读取内核中套接字缓冲区里的 TCP 字符流；如果缓冲区已经写满，则调用
ngx_http_write_request_body 方法把缓冲区中的字符流写入文件。

2）通过第 1 步把 request_body 缓冲区中的内容写入文件后，缓冲区就可以重复使用了，
只需要把缓冲区 ngx_buf_t 结构体的 last 指针指向 start 指针，缓冲区即可复用。

3）调用封装了 recv 的方法从套接字缓冲区中读取包体到缓冲区中。如果 recv 方法返回错
误，或者客户端主动关闭了连接，则跳到第 4 步执行；如果读取到内容，则跳到第 5 步执行。

4）设置 ngx_http_request_t 结构体的 error 标志位为 1，同时返回
NGX_HTTP_BAD_REQUEST 错误码。

5）根据接收到的 TCP 流长度，修改缓冲区参数。例如，把缓冲区 ngx_buf_t 结构体的 last
指针加上接收到的长度，同时更新 request_body 结构体中表示待接收的剩余包体长度的 rest 成
员、更新 ngx_http_request_t 结构体中表示已接收请求长度的 request_length 成员。

根据 rest 成员检查是否接收到完整的包体，如果接收到了完整的包体，则跳到第 8 步继续
执行；否则查看套接字缓冲区上是否仍然有可读的字符流，如果有则跳到第 1 步继续接收包
体，如果没有则跳到第 6 步。

6）如果当前已经没有可读的字符流，同时还没有接收到完整的包体，则说明需要把读
事件添加到事件模块，等待可读事件发生时，事件框架可以再次调度到这个方法接收包体。

这一步是调用 ngx_add_timer 方法将读事件添加到定时器中，超时时间以 nginx.conf 文件中的
client_body_timeout 配置项参数为准。

7）调用 ngx_handle_read_event 方法将读事件添加到 epoll 等事件收集器中，同时
ngx_http_do_read_client_request_body 方法结束，返回 NGX_AGAIN。

8）到这一步，表明已经接收到完整的包体，需要做一些收尾工作了。首先不需要检查
是否接收 HTTP 包体超时了，要把读事件从定时器中取出，防止不必要的定时器触发。这一
步会检查读事件的 timer_set 标志位，如果为 1，则调用 ngx_del_timer 方法把读事件从定时器中
移除。

9）如果缓冲区中还有未写入文件的内容，调用 ngx_http_write_request_body 方法把最后
的包体内容也写入文件。

10）在图 11-13 的第 5 步中曾经把请求的 read_event_handler 成员设置为
ngx_http_read_client_request_body_handler 方法，现在既然已经接收到完整的包体了，就会把
read_event_handler 设为 ngx_http_block_reading 方法，表示连接上再有读事件将不做任何处
理。

11）执行 HTTP 模块提供的 post_handler 回调方法后，ngx_http_do_read_client_request_body
方法结束，返回 NGX_OK。

图 11-13 中的第 6 步把请求的 read_event_handler 成员设置为
ngx_http_read_client_request_body_handler 方法，从 11.6 节的图 11-7 可以看出，这个请求连接上
的读事件触发时的回调方法 ngx_http_request_handler 会调用 read_event_handler 方法，下面根据
图 11-15 来看看这时 ngx_http_read_client_request_body_handler 方法做了些什么。

图 11-15 ngx_http_read_client_request_body_handler 方法的流程图
简单解释一下图 11-15 中的 3 个步骤。

1）首先检查连接上读事件的 timeout 标志位，如果为 1，则表示接收 HTTP 包体超时，这
时把连接 ngx_connection_t 结构体上的 timeout 标志位也置为 1，同时调用
ngx_http_finalize_request 方法结束请求，并发送 408 超时错误码。如果没有超时，则跳到第 2 步
执行。

2）调用图 11-14 中介绍的 ngx_http_do_read_client_request_body 方法接收包体，检测这个
方法的返回值，如果它大于 300，那么一定表示希望返回错误码。例如，图 11-14 的第 4 步就
返回了 400 错误码，这时跳到第 3 步执行；否则 ngx_http_read_client_request_body_handler 方法
结束，直接返回 NGX_OK。

3）调用 ngx_http_finalize_request 方法结束请求，第 2 个参数传递的是
ngx_http_do_read_client_request_body 方法的返回值，详见 11.10.6 节。

以上 3 个方法完整地描述了 HTTP 框架接收包体的流程，以及最后如何执行 HTTP 模块实
现的 post_handler 方法。读者可以参照它再看看第 3 章中开发 HTTP 模块时是如何接收包体的，
相信经过本章的分析，读者会对这一机制有新的认识。

11.8.2 放弃接收包体
对于 HTTP 模块而言，放弃接收包体就是简单地不处理包体了，可是对于 HTTP 框架而
言，并不是不接收包体就可以的。因为对于客户端而言，通常会调用一些阻塞的发送方法来
发送包体，如果 HTTP 框架一直不接收包体，会导致实现上不够健壮的客户端认为服务器超
时无响应，因而简单地关闭连接，可这时 Nginx 模块可能还在处理这个连接。因此，HTTP 模
块中的放弃接收包体，对 HTTP 框架而言就是接收包体，但是接收后不做保存，直接丢弃。

HTTP 框架提供了一个方法—ngx_http_discard_request_body 用于丢弃包体，使用上也非常
简单，直接调用这个方法就可以了，不像 11.8.1 节中接收包体一样还需要一个回调方法。下
面先来看看 ngx_http_discard_request_body 方法的定义。

ngx_int_t ngx_http_discard_request_body(ngx_http_request_t \*r)
可以看到，它是没有 post_handler 回调方法的，那么接收完全部的包体后怎么办呢？很简
单，在图 11-18 的第 3 步就是接收到全部包体后的动作，其代码如下所示。

ngx_http_finalize_request(r, NGX_DONE);
这里实际上相当于把原始请求的引用计数减 1 了，当然，如果引用计数为 0（如 HTTP 模
块已经调用过结束请求的方法），还是会真正结束请求的。

放弃接收包体和接收包体的实现方式是极其相似的，它也使用了 3 个方法实现，HTTP 模
块调用的 ngx_http_discard_request_body 方法用于第一次启动丢弃包体动作，而
ngx_http_discarded_request_body_handler 是作为请求的 read_event_handler 方法的，在有新的可
读事件时会调用它处理包体。ngx_http_read_discarded_request_body 方法则是根据上述两个方
法通用部分提取出的公共方法，用来读取包体且不做任何处理。

下面看看 ngx_http_discard_request_body 方法做了些什么，如图 11-16 所示。

下面解释一下图 11-16 中所列的 7 个步骤。

1）首先检查当前请求是一个子请求还是原始请求。为什么要检查这个呢？因为对于子
请求而言，它不是来自客户端的请求，所以不存在处理 HTTP 请求包体的概念。如果当前请
求是原始请求，则跳到第 2 步中继续执行；如果它是子请求，则直接返回 NGX_OK 表示丢弃
包体成功。

2）检查请求连接上的读事件是否在定时器中，这是因为丢弃包体不用考虑超时问题
（linger_timer 例外，本章不考虑此情况）。如果读事件的 timer_set 标志位为 1，则从定时器中
移除此事件。还要检查 content-length 头部，如果它的值小于或等于 0，同样意味着可以直接返
回 NGX_OK，表示成功丢弃了全部包体。或者检查 ngx_http_request_t 结构体的 request_body 成
员，如果它已经被赋值过且不再为 NULL 空指针，则说明已经接收过包体了，这时也需要返
回 NGX_OK 表示成功。

3）就像 11.8.1 节中介绍的那样，在接收 HTTP 头部时，还是要检查是否凑巧已经接收到
完整的包体（如果包体很小，那么这是非常可能发生的事），如果已经接收到完整的包体，
则跳到第 1 步直接返回 NGX_OK，表示丢弃包体成功，否则，说明需要多次的调度才能完成
丢弃包体这一动作，此时把请求的 read_event_handler 成员设置为
ngx_http_discarded_request_body_handler 方法。

图 11-16 ngx_http_discard_request_body 方法的流程图
4）调用 ngx_handle_read_event 方法把读事件添加到 epoll 中。

5）调用 ngx_http_read_discarded_request_body 方法接收包体，检测它的返回值。如果返
回 NGX_OK，则跳到第 7 步，否则跳到第 6 步。

6）返回非 NGX_OK 表示 Nginx 的事件框架触发事件需要多次调度才能完成丢弃包体这一
动作，于是先把引用计数加 1，防止这边还在丢弃包体，而其他事件却已让请求意外销毁，
引发严重错误。同时把 ngx_http_request_t 结构体的 discard_body 标志位置为 1，表示正在丢弃
包体，并返回 NGX_OK，当然，这时的 NGX_OK 绝不表示已经成功地接收完包体，只是说明
ngx_http_discard_request_body 执行完毕而已。

7）返回 NGX_OK 表示已经接收到完整的包体了，这时将请求的 lingering_close 延时关闭
标志位设为 0，表示不需要为了包体的接收而延时关闭了，同时返回 NGX_OK 表示丢弃包体
成功。

从以上步骤可以看出，当 ngx_http_discard_request_body 方法返回 NGX_OK 时，是可能表
达很多意思的。HTTP 框架的目的是希望各个 HTTP 模块不要去关心丢弃包体的执行情况，这
些工作完全由 HTTP 框架完成。

下面再看看在第 5 步调用的 ngx_http_read_discarded_request_body 方法的执行流程，如图
11-17 所示。

图 11-17 ngx_http_read_discarded_request_body 方法的流程图
可以看到，虽然 ngx_http_read_discarded_request_body 方法与
ngx_http_do_read_client_request_body 方法很类似，但前者比后者简单多了，毕竟不需要保存
接收到的包体。下面简单分析一下图 11-17 中的 5 个步骤。

1）丢弃包体时请求的 request_body 成员实际上是 NULL 空指针，那么用什么变量来表示
已经丢弃的包体有多大呢？实际上这时使用了请求 ngx_http_request_t 结构体 headers_in 成员里
的 content_length_n，最初它等于 content-length 头部，而每丢弃一部分包体，就会在
content_length_n 变量中减去相应的大小。因此，content_length_n 表示还需要丢弃的包体长
度，这里首先检查请求的 content_length_n 成员，如果它已经等于 0，则表示已经接收到完整的
包体，这时要把 read_event_handler 重置为 ngx_http_block_reading 方法，表示如果再有可读事
件被触发时，不做任何处理。同时返回 NGX_OK，告诉上层的方法已经丢弃了所有包体。

2）如果连接套接字的缓冲区上没有可读内容，则直接返回 NGX_AGAIN，告诉上层方
法需要等待读事件的触发，等待 Nginx 框架的再次调度。

3）调用 recv 方法读取包体。根据返回值确定，如果套接字缓冲区中没有读取到内容，
而需要继续读取则跳到第 2 步；如果客户端主动关闭了连接，则跳到第 4 步；如果读取到了内
容，则跳到第 5 步。

4）既然客户端主动关闭了连接，直接返回 NGX_OK 告诉上层方法结束丢弃包体动作即
可。

5）接收到包体后，要更新请求的 content_length_n 成员（参见第 1 步中的描述），同时再
跳回到第 1 步准备再次接收包体。

最后再看看请求的 ngx_handle_read_event 指定的 ngx_http_discarded_request_body_handler
方法，在新的可读事件被触发时，HTTP 框架将会调用它来处理事件，图 11-18 给出了该方法
的流程。

图 11-18 ngx_http_discarded_request_body_handler 方法的流程图
实际上，ngx_http_discarded_request_body_handler 方法还涉及 lingering_time 的处理，为了
减少非主干内容的篇幅，本章将不涉及此内容，因此图 11-18 中也没有给出。下面分析一下
图 11-18 中的 4 个步骤：
1）首先检查 TCP 连接上的读事件的 timedout 标志位，为 1 时表示已经超时，这时调用
ngx_http_finalize_request 方法结束请求，传递的参数是 NGX_ERROR，流程结束。

2）调用 ngx_http_read_discarded_request_body 方法接收包体，检测其返回值。如果返回
NGX_OK，则跳到第 3 步执行，否则跳到第 4 步。

3）此时表示已经成功地丢弃完所有的包体，这一步骤将请求的正在丢弃包体
discard_body 标志位置为 0，将延迟关闭标志位 lingering_close 也置为 0，再调用
ngx_http_finalize_request 方法结束请求注意，它的第 2 个参数是 NGX_DONE，11.10.6 节将会介
绍 NGX_DONE 参数引发的动作。然后流程结束。

4）仍然需要调用 ngx_handle_read_event 方法把读事件添加到 epoll 中，期待新的可读事件
到来。

以上介绍了丢弃包体的全部流程，可以看到，这个简单的动作其实也需要很多步骤才能
完成，但它非常高效，没有任何阻塞进程，也没有让进程休眠的操作。同时，对于 HTTP 模
块而言，它使用起来也比较简单，值得读者学习。

11.9 发送 HTTP 响应
本节开始讨论第 3 章中已出现过的发送 HTTP 响应的两个方法：ngx_http_send_header 方法
和 ngx_http_output_filter 方法。这两个方法将负责把 HTTP 响应中的应答行、头部、包体发送给
客户端。Nginx 是一个全异步的事件驱动架构，那么仅仅调用 ngx_http_send_header 方法和
ngx_http_output_filter 方法，就可以把响应全部发送给客户端吗？当然不是，当响应过大无法
一次发送完时（TCP 的滑动窗口也是有限的，一次非阻塞的发送多半是无法发送完整的
HTTP 响应的），就需要向 epoll 以及定时器中添加写事件了，当连接再次可写时，就调用
ngx_http_writer 方法继续发送响应，直到全部的响应都发送到客户端为止。

以上大致说了一下 HTTP 框架为发送响应所要做的工作，然而，对于各个 HTTP 模块而
言，绝大多数情况下发送 HTTP 响应时就是这个请求结束的时候，难道说还要像接收包体那
样，传递一个 post_handler 回调方法，等所有的响应都发送完时再回调 HTTP 模块的
post_handler 方法来关闭请求吗？这个设计显然是不好的，根据 HTTP 的特点，只要开始发送
响应基本上可以确定请求就要结束了。因此，HTTP 采用的设计是，使用 ngx_http_output_filter
方法发送响应时，必须与结束请求的 ngx_http_finalize_request 方法配合使用
（ngx_http_finalize_request 方法会把请求的 write_event_handler 设置为 ngx_http_writer 方法，并
将写事件添加到 epoll 和定时器中），这样就使得真正负责在后台异步地发送响应的
ngx_http_writer 方法对 HTTP 模块而言也是透明的。

11.9.1 节中将介绍发送 HTTP 响应行、头部的 ngx_http_send_header 方法，11.9.2 节将介绍发
送响应包体的 ngx_http_output_filter 方法，同时在这两节中还会穿插介绍如何配合
ngx_http_finalize_request 方法使用，实现异步的发送机制。最后在 11.9.3 节会介绍在后台发送
响应的 ngx_http_writer 方法。

11.9.1 ngx_http_send_header
ngx_http_send_header 方法负责构造 HTTP 响应行、头部，同时会把它们发送给客户端。

发送响应头部使用了第 6 章所述的流水线式的过滤模块思想，即通过提供统一的接口，让各
个感兴趣的 HTTP 模块加入到 ngx_http_send_header 方法中，然后通过每个过滤模块 C 源文件中
独有的 ngx_http_next_header_filter 指针将各个过滤头部的方法连接起来，这样，在调用
ngx_http_send_header 方法时，实际就是依次调用了所有头部过滤模块的方法，其中，链表里
的最后一个头部过滤方法将负责发送头部。因此，这些过滤模块组成的链表顺序是非常重要
的，我们在第 6 章的 6.2.1 节和 6.2.2 节已经介绍过这部分内容，这里不再赘述。

调用 ngx_http_send_header 方法时，最后一个头部过滤模块叫做
ngx_http_header_filter_module 模块，之前的头部过滤模块会根据特性去修改表示请求的
ngx_http_request_t 结构体中 headers_out 成员里的内容，而最后一个头部过滤模块
ngx_http_header_filter_module 提供的 ngx_http_header_filter 方法则会根据 HTTP 规则把
headers_out 中的成员变量序列化为字符流，并发送出去，而本节的重点就在于说明
ngx_http_header_filter 方法所做的工作。

在了解 ngx_http_header_filter 方法之前，我们还是得先回顾一下事件驱动机制，因为它要
求任何操作都不可以阻塞进程，ngx_http_header_filter 方法当然也不能例外。那么，如果要发
送的响应头部大于套接字可写的缓存，无法一次把响应头部发送出去怎么办？这就需要使用
ngx_http_request_t 结构体中 ngx_chain_t 类型的成员 out 了，它将会保存没有发送完的（剩余
的）响应头部。那么，什么时候发送请求 out 成员中保存的剩余响应头部呢？这就要结合用
于结束请求的 ngx_http_finalize_request 方法来说了。

当 ngx_http_header_filter 方法无法一次性发送 HTTP 头部时，将会有以下两个现象同时发
生。

-   请求的 out 成员中将会保存剩余的响应头部。

-   ngx_http_header_filter 方法返回 NGX_AGAIN。

如果这个响应没有包体，那么这时通常已经可以调用 ngx_http_finalize_request 方法来结束
请求了，参见 11.10.6 节中 ngx_http_finalize_request 方法的原型，它的第 2 个参数很关键，我们
需要把 NGX_AGAIN 传进去，这样 ngx_http_finalize_request 方法就理解了实际上还需要 HTTP
框架继续发送请求 out 成员中保存的剩余响应字符流。ngx_http_finalize_request 方法会设置请
求的 write_event_handler 成员为 ngx_http_writer 方法，这样，当连接上有可写事件时，就会调
用 11.9.3 节描述的 ngx_http_writer 方法继续发送剩余的 HTTP 响应。下面先来看看
ngx_http_header_filter 方法的流程图，如图 11-19 所示。

图 11-19 ngx_http_header_filter 方法的流程图
下面描述一下图 11-19 中的 6 个步骤。

1）首先检查请求 ngx_http_request_t 结构体的 header_sent 标志位，如果 header_sent 为 1，则
表示这个请求的响应头部已经发送过了，不需要再向下执行，直接返回 NGX_OK 即可。

2）正式进入发送响应头部阶段，为防止反复地发送响应头部，将 header_sent 标志位置
为 1。同时需要检查当前请求是否是客户端发来的原始请求，如果当前请求只是一个子请
求，它是不存在发送 HTTP 响应头部这个概念的，因此，如果当前请求不是 main 成员指向的
原始请求时，跳到第 1 步直接返回 NGX_OK。如果 HTTP 版本小于 1.0，同样不需要发送响应
头部，仍然跳到第 1 步返回 NGX_OK。

3）根据请求 headers_out 结构体中的错误码、HTTP 头部字符串，计算出如果把响应头部
序列化为一个字符串共需要多少字节。

4）在请求的内存池中分配第 3 步计算出的缓冲区。

5）将响应行、头部按照 HTTP 的规范序列化地复制到缓冲区中。

6）将第 4 步中分配的缓冲区作为参数调用 ngx_http_write_filter 方法，将响应头部发送出
去。

注意，第 6 步是通过调用 ngx_http_write_filter 方法来发送响应头部的。事实上，这个方法
是包体过滤模块链表中的最后一个模块 ngx_http_write_filter_module 的处理方法，当 HTTP 模
块调用 ngx_http_output_filter 方法发送包体时，最终也是通过该方法发送响应的（在 11.9.2 节中
将详细地介绍这一方法）。当一次无法发送全部的缓冲区内容时，ngx_http_write_filter 方法
是会返回 NGX_AGAIN 的（同时将未发送完成的缓冲区放到请求的 out 成员中），也就是说，
发送响应头部的 ngx_http_header_filter 方法会返回 NGX_AGAIN。如果不需要再发送包体，那
么这时就需要调用 ngx_http_finalize_request 方法来结束请求，其中第 2 个参数务必要传递
NGX_AGAIN，这样 HTTP 框架才会继续将可写事件注册到 epoll，并持续地把请求的 out 成员
中缓冲区里的 HTTP 响应发送完毕才会结束请求。

11.9.2 ngx_http_output_filter
ngx_http_output_filter 方法用于发送响应包体，它的第 2 个参数就是用于存放响应包体的缓
冲区，如下所示。

ngx_int_t ngx_http_write_filter(ngx_http_request_t r, ngx_chain_t in)
其中第 2 个参数 in 在第 6 章中已有过详细的介绍，这里不再赘述。用于过滤包体的 HTTP
模块将以 ngx_http_next_body_filter 作为链表指针连接成一个流水线，ngx_http_output_filter 方法
在发送包体时会依次调用各个过滤包体方法，其中最后一个过滤包体方法就是 11.9.1 节中介
绍过的 ngx_http_write_filter 方法，它属于 ngx_http_write_filter_module 模块。

本节与 ngx_http_send_header 方法的介绍一样，不会讨论每个过滤模块的功能，我们只看
最后一个包体过滤模块是怎样发送响应包体的。在图 11-20 中，ngx_http_write_filter 方法展示
了 HTTP 框架是如何开始发送 HTTP 响应包体的。

图 11-20 中描述的 ngx_http_write_filter 方法主要有 13 个步骤，下面详细介绍这些步骤到底
是如何工作的。

1）首先检查请求的连接上 ngx_connection_t 结构体的 error 标志位，如果 error 为 1 表示请求
出错，那么直接返回 NGX_ERROR。

2）找到请求的 ngx_http_request_t 结构体中存放的等待发送的缓冲区链表 out，遍历这个
ngx_chain_t 类型的缓冲区链表，计算出 out 缓冲区共占用了多大的字节数，为第 9 步发送响应
做准备。

注意这个 out 链表通常都保存着待发送的响应。例如，在调用 ngx_http_send_header
方法时，如果 HTTP 响应头部过大导致无法一次性发送完，那么剩余的响应头部就会在 out 链
表中。

图 11-20 ngx_http_write_filter 方法的流程图
3）ngx_http_write_filter 方法的第 2 个参数 in 就是本次要发送的缓冲区链表（正是由 HTTP
模块构造、传递），本步骤将类似第 2 步遍历这个 ngx_chain_t 类型的缓存链表 in，将 in 中的缓
冲区加入到 out 链表的末尾，并计算 out 缓冲区共占用多大的字节数，为第 9 步发送响应做准
备。

在第 2、第 3 步的遍历过程中，会检查缓冲区中每个 ngx_buf_t 块的 3 个标志位：flush、
recycled、last_buf，如果这 3 个标志位同时为 0（即待发送的 out 链表中没有一个缓冲区表示响
应已经结束或需要立刻发送出去），而且本次要发送的缓冲区 in 虽然不为空，但以上两步骤
中计算出的待发送响应的大小又小于配置文件中的 postpone_output 参数，那么说明当前的缓
冲区是不完整的且没有必要立刻发送，于是跳到第 13 步直接返回 NGX_OK。

4）取出 nginx.conf 文件中匹配请求的 sendfile_max_chunk 配置项（如它属于某个 location 块
下的配置项），为第 9 步计算发送响应的速度做准备。

首先检查连接上写事件的标志位 delayed，如果 delayed 为 1，则表示这一次的 epoll 调度中
请求仍需要减速，是不可以发送响应的，delayed 为 1 指明了响应需要延迟发送，这时跳到第 5
步执行；如果 delayed 为 0，表示本次不需要减速，那么再检查 ngx_http_request_t 结构体中的
limit_rate 发送响应的速率，如果 limit_rate 为 0，表示这个请求不需要限制发送速度，直接跳
到第 9 步执行；如果 limit_rate 大于 0，则说明发送响应的速度不能超过 limit_rate 指定的速度，
这时跳到第 6 步执行。

5）将客户端对应的 ngx_connection_t 结构体中的 buffered 标志位放上
NGX_HTTP_WRITE_BUFFERED 宏，同时返回 NGX_AGAIN，这是在告诉 HTTP 框架 out 缓冲
区中还有响应等待发送。

6）ngx_http_request_t 结构体中的 limit_rate 成员表示发送响应的最大速率，当它大于 0
时，表示需要限速，首先需要计算当前请求的发送速度是否已经达到限速条件。

这里需要解释第 2 章中介绍过的 nginx.conf 文件里的两个配置项：limit_rate 和
limit_rate_after。limit_rate 表示每秒可以发送的字节数，超过这个数字就需要限速；然而，限
速这个动作必须是在发送了 limit_rate_after 字节的响应后才能生效（对于小响应包的优化设
计）。下面看看这一步是如何使用这两个配置项来计算限速的，如下所示。

limit = r-\>limit_rate \* (ngx_time() - r-\>start_sec + 1)

-   (c-\>sent - clcf-\>limit_rate_after);

第 9 章已介绍过 ngx_time()方法，它取出了当前时间，而 start_sec 表示开始接收到客户端

请求内容的时间，c-\>sent 表示这条连接上已经发送了的 HTTP 响应长度，这样计算出的变量
limit 就表示本次可以发送的字节数了。如果 limit 小于或等于 0，它表示这个连接上的发送响
应速度已经超出了 limit_rate 配置项的限制，所以本次不可以继续发送，跳到第 7 步执行；如
果 limit 大于 0，表示本次可以发送 limit 字节的响应，那么跳到第 9 步开始发送响应。

7）由于达到发送响应的速度上限，这时将连接上写事件的 delayed 标志位置为 1。

8）将写事件加入定时器中，其中超时时间要根据第 7 步算出的 limit 来计算，如下所示：
ngx_add_timer(c-\>write, (ngx_msec_t) (- limit \* 1000 / r-\>limit_rate + 1));
limit 是已经超发的字节数，它是 0 或者负数。这个定时器的超时时间是超发字节数按照
limit_rate 速率算出需要等待的时间再加上 1 毫秒，它可以使 Nginx 定时器准确地在允许发送响
应时激活请求。之后转到第 5 步执行。

9）本步将把响应发送给客户端。然而，缓冲区中的响应可能非常大，那么这一次应该
发送多少字节呢？这要根据第 6 步计算出的 limit 变量，以及第 4 步取得的配置项
sendfile_max_chunk 来计算，同时要根据第 2、第 3 步遍历缓冲区计算出的待发送字节数来决
定，这 3 个值中的最小值即作为本次发送的响应长度。

发送响应后再次检查请求的 limit_rate 标志位，如果 limit_rate 为 0，则表示不需要限速，
跳到第 12 步执行；如果 limit_rate 大于 0，则表示需要限速，跳到第 10 步执行。

10）再次按照第 6 步中的方法计算刚发送了部分响应后，请求的发送速率是否达到
limit_rate 上限，如果不需要减速就直接跳到第 12 步；否则继续执行第 11 步。

11）这时表示第 9 步发送的响应速度还是过快了，已经超发了一些响应，那么这里类似
第 8 步，计算出至少要经过多少毫秒后才可以继续发送，调用 ngx_add_timer 方法将写事件按
照上面计算出的毫秒作为超时时间添加到定时器中。同时，把写事件的 delayed 标志位置为
1。

12）重置 ngx_http_request_t 结构体的 out 缓冲区，把已经发送成功的缓冲区归还给内存
池。如果 out 链表中还有剩余的没有发送出去的缓冲区，则添加到 out 链表头部，跳到第 5 步执
行；如果已经将 out 链表中的所有缓冲区都发送给客户端了，则执行第 13 步。

13）返回 NGX_OK 表示成功。

以上较为详尽地描述了负责实际发送响应的 ngx_http_write_filter 方法是怎样工作的，包
括如何更新请求里的 out 缓冲区，如何根据限速条件以及配置文件中的 sendfile_max_chunk 参
数决定一次可以发送多少字节的响应。

ngx_http_send_header 方法最终会调用 ngx_http_write_filter 方法来发送响应头部，而
ngx_http_output_filter 方法最终也是调用 ngx_http_write_filter 方法来发送响应包体的，同样，
ngx_http_output_filter 也有可能得到返回值 NGX_AGAIN（图 11-20 的第 5 步），它表示还有未发
送的响应缓冲区在 out 成员中。这时，需要以 NGX_AGAIN 作为参数调用
ngx_http_finalize_request 方法，该方法将把写事件的回调方法设为 ngx_http_writer 方法，并由
它来把剩下的响应全部发送给客户端。

11.9.3 ngx_http_writer
本节介绍的 ngx_http_writer 方法对各个 HTTP 模块而言是不可见的，但实际上它非常重
要，因为无论是 ngx_http_send_header 还是 ngx_http_output_filter 方法，它们在调用时一般都无
法发送全部的响应，剩下的响应内容都得靠 ngx_http_writer 方法来发送。如何把
ngx_http_writer 方法设置为请求写事件的回调方法呢？这部分内容将在 11.10.6 节中介绍，此
处关注的重点是 ngx_http_writer 方法在后台究竟做了些什么。图 11-21 是 ngx_http_writer 方法的
流程图，如果这个请求的连接上可写事件被触发，也就是 TCP 的滑动窗口在告诉 Nginx 进程可
以发送响应了，这时 ngx_http_writer 方法就开始工作了。

图 11-21 ngx_http_writer 方法的流程图
下面将详细介绍图 11-21 中的 7 个步骤。

1）首先检查连接上写事件的 timedout 标志位，如果 timedout 为 0，则表示写事件未超时，
跳到第 5 步执行；如果 timedout 为 1，则表示当前的写事件已经超时，这时有两种可能性：第
一种，由于网络异常或者客户端长时间不接收响应，导致真实的发送响应超时；第二种，由
于上一次发送响应时发送速率过快，超过了请求的 limit_rate 速率上限，而上节的
ngx_http_write_filter 方法就会设置一个超时时间将写事件添加到定时器中，这时本次的超时
只是由限速导致，并非真正超时（结合图 11-20 理解）。那么，如何判断这个超时是真的超
时还是出于限速的考虑呢？这要看事件的 delayed 标志位。从图 11-20 中可以看出，如果是限
速把写事件加入定时器，一定会把 delayed 标志位置为 1，如其中的第 7 步和第 11 步。如果写事
件的 delayed 标志位为 0，那就是真的超时了，这时调用 ngx_http_finalize_request 方法结束请
求，传入的参数是 NGX_HTTP_REQUEST_TIME_OUT，表示需要向客户端发送 408 错误码；
如果 delayed 标志位为 1，则继续执行第 2 步。

2）既然当前事件的超时是由限速引起的，那么此时可以把写事件的 timedout 标志位和
delayed 标志位都重置为 0。

再检查写事件的 ready 标志位，如果为 1，则表示在与客户端的 TCP 连接上可以发送数
据，跳到第 5 步执行；如果为 0，则表示暂不可发送数据，跳到第 3 步执行。

3）将写事件添加到定时器中，这里的超时时间就是配置文件中的 send_timeout 参数，与
限速功能无关。

4）调用 ngx_handle_write_event 方法将写事件添加到 epoll 等事件收集器中，同时
ngx_http_writer 方法结束。

5）调用 ngx_http_output_filter 方法发送响应，其中第 2 个参数（也就是表示需要发送的缓
冲区）为 NULL 指针。这意味着，需要调用各包体过滤模块处理 out 缓冲区中的剩余内容，最
后调用 ngx_http_write_filter 方法把响应发送出去。

发送响应后，查看 ngx_http_request_t 结构体中的 buffered 和 postponed 标志位，如果任一个
不为 0，则意味着没有发送完 out 中的全部响应，这时跳到第 3 步执行；请求 main 指针指向请求
自身，表示这个请求是原始请求，再检查与客户端间的连接 ngx_connection_t 结构体中的
buffered 标志位，如果 buffered 不为 0，同样表示没有发送完 out 中的全部响应，仍然跳到第 3 步
执行；除此以外，都表示 out 中的全部响应皆发送完毕，跳到第 6 步执行。

6）将请求的 write_event_handler 方法置为 ngx_http_request_empty_handler，也就是说，如
果这个请求的连接上再有可写事件，将不做任何处理。

7）调用 ngx_http_finalize_request 方法结束请求，其中第 2 个参数传入的是
ngx_http_output_filter 方法的返回值。

注意 ngx_http_writer 方法仅用于在后台发送响应到客户端。

11.10 结束 HTTP 请求
对于事件驱动的架构来说，结束请求是一项复杂的工作。因为一个请求可能会被许多个
事件触发，这使得 Nginx 框架调度到某个请求的回调方法时，在当前业务内似乎需要结束
HTTP 请求，但如果真的结束了请求，销毁了与请求相关的内存，多半会造成重大错误，因
为这个请求可能还有其他事件在定时器或者 epoll 中。当这些事件被回调时，请求却已经不存
在了，这就是严重的内存访问越界错误！如果尝试在属于某个 HTTP 模块的回调方法中试图
结束请求，先要把这个请求相关的所有事件（有些事件可能属于其他 HTTP 模块）都从定时
器和 epoll 中取出并调用其 handler 方法，这又太复杂了，另外，不同 HTTP 模块上的代码耦合
太紧密将会难以维护。

那 HTTP 框架又是怎样解决这个问题的呢？HTTP 框架把一个请求分为多种动作，如果
HTTP 框架提供的方法会导致 Nginx 再次调度到请求（例如，在这个方法中产生了新的事件，
或者重新将已有事件添加到 epoll 或者定时器中），那么可以认为这一步调用是一种独立的动
作。例如，接收 HTTP 请求的包体、调用 upstream 机制提供的方法访问第三方服务、派生出
subrequest 子请求等。这些所谓独立的动作，都是在告诉 Nginx，如果机会合适就再次调用它
们处理请求，因为这个动作并不是 Nginx 调用一次它们的方法就可以处理完毕的。因此，每
一种动作对于整个请求来说都是独立的，HTTP 框架希望每个动作结束时仅维护自己的业
务，不用去关心这个请求是否还做了其他动作。这种设计大大降低了复杂度。

这种设计具体又是怎么实现的呢？实际上，在 11.8 节中已经介绍过，每个 HTTP 请求都有
一个引用计数，每派生出一种新的会独立向事件收集器注册事件的动作时（如
ngx_http_read_client_request_body 方法或者 ngx_http_subrequest 方法），都会把引用计数加 1，
这样每个动作结束时都通过调用 ngx_http_finalize_request 方法来结束请求，而
ngx_http_finalize_request 方法实际上却会在引用计数减 1 后先检查引用计数的值，如果不为 0 是
不会真正销毁请求的。

也就是说，HTTP 框架要求在请求的某个动作结束时，必须调用 ngx_http_finalize_request
方法来结束请求。ngx_http_finalize_request 方法也设计得比较复杂，在第 3 章中曾经谈到过它
最基本的用法，本节中将详细讨论 ngx_http_finalize_request 方法到底做了些什么。

在说明 ngx_http_finalize_request 方法前，先介绍一下 HTTP 框架提供的几个更低级别的结
束请求方法。

11.10.1 ngx_http_close_connection
ngx_http_close_connection 方法是 HTTP 框架提供的一个用于释放 TCP 连接的方法，它的目
的很简单，就是关闭这个 TCP 连接，当且仅当 HTTP 请求真正结束时才会调用这个方法。图
11-22 列出了 ngx_http_close_connection 方法所做的工作。

图 11-22 ngx_http_close_connection 方法的流程图
下面先来分析一下这个底层的方法 ngx_http_close_connection 究竟做了些什么。

1）首先将连接的读/写事件从定时器中取出。实际上就是检查读/写事件的 time_set 标志
位，如果为 1，则证明事件在定时器中，那么需要调用 ngx_del_timer 方法把事件从定时器中移
除。

2）调用 ngx_del_conn 宏（或者 ngx_del_event 宏）将读/写事件从 epoll 中移除。实际上就是
调用第 9 章重点介绍过的 ngx_event_actions_t 接口中的 del_conn 方法，当事件模块是 epoll 模块
时，就是从 epoll 中移除这个连接的读/写事件。同时，如果这个事件在
ngx_posted_accept_events 或者 ngx_posted_events 队列中，还需要调用 ngx_delete_posted_event 宏
把事件从 post 事件队列中移除。

3）调用 ngx_free_connection 方法把表示连接的 ngx_connection_t 结构体归还给 ngx_cycle_t
核心结构体的空闲连接池 free_connections。

4）调用系统提供的 close 方法关闭这个 TCP 连接套接字。

5）销毁 ngx_connection_t 结构体中的 pool 内存池。

可见，这个 ngx_http_close_connection 方法主要是针对连接做了一些工作，它是非常基础
的方法。

11.10.2 ngx_http_free_request
ngx_http_free_request 方法将会释放请求对应的 ngx_http_request_t 数据结构，它并不会像
ngx_http_close_connection 方法一样去释放承载请求的 TCP 连接，每一个 TCP 连接可以反复地
承载多个 HTTP 请求，因此，ngx_http_free_request 是比 ngx_http_close_connection 更高层次的方
法，前者必然先于后者调用。下面看看图 11-23 中 ngx_http_free_request 方法到底做了哪些工
作。

在描述图 11-23 之前，先来看一个数据结构 ngx_http_cleanup_t，它的定义如下。

图 11-23 ngx_http_free_request 方法的流程图
typedef struct ngx_http_cleanup_s ngx_http_cleanup_t;
struct ngx_http_cleanup_s {
// 由
HTTP 模块提供的清理资源的回调方法
ngx_http_cleanup_pt handler;
// 希望给上面的
handler 方法传递的参数
void data;
/一个请求可能会有多个
ngx_http_cleanup_t 清理方法，这些清理方法间就是通过
next 指针连接成单链表的
/
ngx_http_cleanup_t next;
};
事实上，任何一个请求的 ngx_http_request_t 结构体中都有一个 ngx_http_cleanup_t 类型的成
员 cleanup，如果没有需要清理的资源，则 cleanup 为空指针，否则 HTTP 模块可以向 cleanup 中
以单链表的形式无限制地添加 ngx_http_cleanup_t 结构体，用以在请求结束时释放资源。再看
看 handler 方法的定义，如下所示。

typedef void (*ngx_http_cleanup_pt)(void *data);
如果需要在请求释放时执行一些回调方法，首先需要实现一个 ngx_http_cleanup_pt 方法。

当然，HTTP 框架还很友好地提供了一个工具方法 ngx_http_cleanup_add，用于向请求中添加
ngx_http_cleanup_t 结构体，其定义如下。

ngx_http_cleanup_t * ngx_http_cleanup_add(ngx_http_request_t *r, size_t size)
这个方法返回的就是已经插入请求的 ngx_http_cleanup_t 结构体指针，其中 data 成员指向
的内存都已经分配好，内存的大小由 size 参数指定。

注意事实上，在 3.8.2 节中曾经简单地介绍过同样用于清理资源的
ngx_pool_cleanup_t，它与 ngx_http_cleanup_pt 是不同的，ngx_pool_cleanup_t 仅在所用的内存池
销毁时才会被调用来清理资源，它何时释放资源将视所使用的内存池而定，而
ngx_http_cleanup_pt 是在 ngx_http_request_t 结构体释放时被调用来释放资源的。

下面说明一下 ngx_http_free_request 方法所做的 3 项主要工作。

1）循环地遍历请求 ngx_http_request_t 结构体中的 cleanup 链表，依次调用每一个
ngx_http_cleanup_pt 方法释放资源。

2）在 11 个 ngx_http_phases 阶段中，最后一个阶段叫做 NGX_HTTP_LOG_PHASE，它是用
来记录客户端的访问日志的。在这一步骤中，将会依次调用 NGX_HTTP_LOG_PHASE 阶段的
所有回调方法记录日志。官方的 ngx_http_log_module 模块就是在这里记录 access log 的。

3）销毁请求 ngx_http_request_t 结构体中的 pool 内存池。在销毁内存池时，挂在该内存池
下的由各 Nginx 模块实现的 ngx_pool_cleanup_t 方法也会被调用，注意它与第 1 步的区别。

注意如果打开了统计 HTTP 请求的功能，ngx_http_free_request 方法还会更新共享内
存中的统计请求数量的两个原子变量：ngx_stat_reading、ngx_stat_writing，详见 14.2.1 节。

11.10.3 ngx_http_close_request
ngx_http_close_request 方法是更高层的用于关闭请求的方法，当然，HTTP 模块一般也不
会直接调用它的。在上面几节中反复提到的引用计数，就是由 ngx_http_close_request 方法负
责检测的，同时它会在引用计数清零时正式调用 ngx_http_free_request 方法和
ngx_http_close_connection 方法来释放请求、关闭连接。先来看看图 11-24 中列出的
ngx_http_close_request 方法所做的工作。

图 11-24 ngx_http_close_request 方法的流程图
下面简单说明一下 ngx_http_close_request 方法所做的工作。

1）首先，由 ngx_http_request_t 结构体的 main 成员中取出对应的原始请求（当然，可能就
是这个请求本身），再取出 count 引用计数并减 1。然后，检查 count 引用计数是否已经为 0，
以及 blocked 标志位是否为 0。如果 count 已经为 0，则证明请求没有其他动作要使用了，同时
blocked 标志位也为 0，表示没有 HTTP 模块还需要处理请求，所以此时请求可以真正释放，这
时跳到第 2 步执行；如果 count 引用计数大于 0，或者 blocked 大于 0，这样都不可以结束请求，
ngx_http_close_request 方法直接结束。

2）调用 ngx_http_free_request 方法释放请求。

3）调用 ngx_http_close_connection 方法关闭连接。

注意在官方发布的 HTTP 模块中，ngx_http_request_t 结构体中的 blocked 标志位主要
由异步 I/O 使用，ngx_http_close_request 方法正是通过 blocked 配合着异步 I/O 工作，如果 AIO
上下文中还在处理这个请求，blocked 必然是大于 0 的，这时 ngx_http_close_request 方法不能结
束请求。由于本章不涉及异步 AIO，所以略过不提。

11.10.4 ngx_http_finalize_connection
ngx_http_finalize_connection 方法虽然比 ngx_http_close_request 方法高了一个层次，但
HTTP 模块一般还是不会直接调用它。ngx_http_finalize_connection 方法在结束请求时，解决了
keepalive 特性和子请求的问题，图 11-25 中展示了它所做的工作。

下面简单分析一下 ngx_http_finalize_connection 方法所做的工作。

1）首先查看原始请求的引用计数，如果不等于 1，则表示还有多个动作在操作着请求，
接着继续检查 discard_body 标志位。如果 discard_body 为 0，则直接跳到第 3 步；如果
discard_body 为 1，则表示正在丢弃包体，这时会再一次把请求的 read_event_handler 成员设为
ngx_http_discarded_request_body_handler 方法，就如同 11.8.2 节中描述的一样。

图 11-25 ngx_http_finalize_connection 方法的流程
如果引用计数为 1，则说明这时要真的准备结束请求了。不过，还要检查请求的
keepalive 成员，如果 keepalive 为 1，则说明这个请求需要释放，但 TCP 连接还是要复用的，这
时跳到第 5 步执行；如果 keepalive 为 0 就不需要考虑 keepalive 请求了，但还需要检测请求的
lingering_close 成员，如果 lingering_close 为 1，则说明需要延迟关闭请求，这时也不能真的去
结束请求，而是跳到第 4 步，如果 lingering_close 为 0，才真的跳到第 5 步结束请求。

2）将读事件添加到定时器中，其中超时时间是 lingering_timeout 配置项。

3）调用 11.10.3 节介绍的 ngx_http_close_request 方法结束请求。

4）调用 ngx_http_set_lingering_close 方法延迟关闭请求。实际上，这个方法的意义就在于
把一些必须做的事情做完（如接收用户端发来的字符流）再关闭连接。

5）调用 ngx_http_set_keepalive 方法将当前连接设为 keepalive 状态。它实际上会把表示请
求的 ngx_http_request_t 结构体释放，却又不会调用 ngx_http_close_connection 方法关闭连接，同
时也在检测 keepalive 连接是否超时，对于这个方法，此处不做详细解释。

11.10.5 ngx_http_terminate_request
ngx_http_terminate_request 方法是提供给 HTTP 模块使用的结束请求方法，但它属于非正
常结束的场景，可以理解为强制关闭请求。也就是说，当调用 ngx_http_terminate_request 方法
结束请求时，它会直接找出该请求的 main 成员指向的原始请求，并直接将该原始请求的引用
计数置为 1，同时会调用 ngx_http_close_request 方法去关闭请求。与上文不同的是，它是
HTTP 框架提供给各个 HTTP 模块直接使用的方法，篇幅所限，这个方法就不再详细介绍了。

11.10.6 ngx_http_finalize_request
ngx_http_finalize_request 方法是开发 HTTP 模块时最常使用的结束请求方法，在第 3 章中早
已介绍过它的简单用法。事实上，ngx_http_finalize_request 方法被 HTTP 框架设计得极为复
杂，各种结束请求的场景都被它考虑到了，下面将详细讲述这个方法究竟做了些什么。首先
回顾一下它的定义。

void ngx_http_finalize_request(ngx_http_request_t \*r, ngx_int_t rc)
其中，参数 r 就是当前请求，它可能是派生出的子请求，也可能是客户端发来的原始请
求。后面的参数 rc 就非常复杂了，它既可能是 NGX_OK、NGX_ERROR、NGX_AGAIN、
NGX_DONE、NGX_DECLINED 这种系统定义的返回值，又可能是类似
NGX_HTTP_REQUEST_TIME_OUT 这样的 HTTP 响应码，因此，ngx_http_finalize_request 方法
的流程异常复杂。学习如何正确地使用 ngx_http_finalize_request 方法非常关键，因为会涉及不
同动作导致的引用计数增加、异常情况下自动构造响应、未发送完所有响应时自动向事件框
架添加写事件回调方法 ngx_http_writer 等各种场景。大多数情况下，我们都会把其他 Nginx 方
法的返回值作为 rc 参数来调用 ngx_http_finalize_request 方法，但如果要编写复杂的 HTTP 模
块，还是需要清晰地认识 ngx_http_finalize_request 方法的工作原理。

下面把 ngx_http_finalize_request 方法的主要流程简化为了 17 个主要步骤，如图 11-26 所
示。

图 11-26 ngx_http_finalize_request 方法的流程图
下面解释一下 ngx_http_finalize_request 方法所做的工作。

1）首先检查 rc 参数。如果 rc 为 NGX_DECLINED，则跳到第 2 步执行；如果 rc 为
NGX_DONE，则跳到第 4 步执行；除此之外，都继续执行第 5 步。

2）NGX_DECLINED 参数表示请求还需要按照 11 个 HTTP 阶段继续处理下去，参考 11.6 节
的内容可以知道，这时需要继续调用 ngx_http_core_run_phases 方法处理请求。这一步中首先
会把 ngx_http_request_t 结构体的 write_event_handler 设为 ngx_http_core_run_phases 方法。同时，
将请求的 content_handler 成员置为 NULL 空指针，11.6 节已介绍过这个成员，它是一种用于在
NGX_HTTP_CONTENT_PHASE 阶段处理请求的方式，将其设置为 NULL 是为了让
ngx_http_core_content_phase 方法（11.6.4 节介绍）可以继续调用
NGX_HTTP_CONTENT_PHASE 阶段的其他处理方法。

3）调用 ngx_http_core_run_phases 方法继续处理请求，ngx_http_finalize_request 方法结束。

4）NGX_DONE 参数表示不需要做任何事，直接调用 ngx_http_finalize_connection 方法，
之后 ngx_http_finalize_request 方法结束。当某一种动作（如接收 HTTP 请求包体）正常结束而
请求还有业务要继续处理时，多半都是传递 NGX_DONE 参数。由 11.10.4 节我们知道，这个
ngx_http_finalize_connection 方法还会去检查引用计数情况，并不一定会销毁请求。

5）检查当前请求是否为 subrequest 子请求，如果不是，则跳到第 6 步执行；如果是子请
求，那么调用 post_subrequest 下的 handler 回调方法。在第 6 章中曾经介绍过 subrequest 的用法，
可以看到 post_subrequest 正是此时被调用的。

6）第 1 步只是把 rc 参数的两种特殊值处理掉了，现在又需要再次检查 rc 参数了。如果 rc
值为 NGX_ERROR、NGX_HTTP_REQUEST_TIME_OUT、NGX_HTTP_CLOSE、
NGX_HTTP_CLIENT_CLOSED_REQUEST，或者这个连接的 error 标志为 1，那么跳到第 7 步执
行；如果 rc 为 NGX_HTTP_CREATED、NGX_HTTP_NO_CONTENT 或者大于或等于
NGX_HTTP_SPECIAL_RESPONSE，则表示请求的动作是上传文件，或者 HTTP 模块需要
HTTP 框架构造并发送响应码大于或等于 300 以上的特殊响应，这时跳到第 8 步执行；其他情
况下，直接跳到第 12 步执行。

7）这一步直接调用 ngx_http_terminate_request 方法强制结束请求，同时，
ngx_http_finalize_request 方法结束。

8）检查当前请求的 main 是否指向自己，如果是，这个请求就是来自客户端的原始请求
（非子请求），这时检查读/写事件的 timer_set 标志位，如果 timer_set 为 1，则表明事件在定时
器中，需要调用 ngx_del_timer 方法把读/写事件从定时器中移除。

9）设置读/写事件的回调方法为 ngx_http_request_handler 方法，这个方法在 11.6 节中介绍
过，它会继续处理 HTTP 请求。

10）调用 ngx_http_special_response_handler 方法，该方法负责根据 rc 参数构造完整的
HTTP 响应。为什么可以在这一步中构造这样的响应呢？回顾一下第 7 步，这时 rc 要么是表示
上传成功的 201 或者 204，要么就是表示异步的 300 以上的响应码，对于这些情况，都是可以
让 HTTP 框架独立构造响应包的。

11）再次调用 ngx_http_finalize_request 方法结束请求，不过这时的 rc 参数实际上是第 10 步
ngx_http_special_response_handler 方法的返回值。

12）再次检查请求的 main 成员是否指向自己，即当前请求是否为原始请求。如果不是客
户端发来的原始请求，跳到 13 步继续执行；如果是原始请求，那么还需要检查 out 缓冲区内
是否还有没发送完的响应，如果有，则跳到第 14 步继续执行，如果没有，则可以结束请求
了，此时跳到第 16 步。

13）由于当前请求是子请求，那么正常情况下需要跳到它的父请求上，激活父请求继续
向下执行，所以这一步首先根据 ngx_http_request_t 结构体的 parent 成员找到父请求，再构造一
个 ngx_http_posted_request_t 结构体把父请求放置其中，最后把该结构体添加到原始请求的
posted_requests 链表中，这样 11.7 节中介绍过的 ngx_http_run_posted_requests 方法就会在图 11-
12 描述的流程中调用父请求的 write_event_handler 方法了。

14）在 11.9 节中多次讲到，当 HTTP 响应过大，无法一次性发送给客户端时，需要调用
ngx_http_finalize_request 方法结束请求，而该方法会把 11.9.3 节介绍的 ngx_http_writer 方法注册
给 epoll 和定时器，当连接再次可写时就会继续发送剩余的响应，这些工作就是在第 14、第 15
步中完成的。这一步先把请求的 write_event_handler 成员设为 ngx_http_writer 方法。

15）如果写事件的 delayed 标志位为 0，就把写事件添加到定时器中，超时时间就是
nginx.conf 文件中的 send_timeout 配置项；当然，如果 delayed 为 1，则表示限制发送速度，从
11.9.2 节可以看出，在需要限速时，根据计算得到的超时时间已经把写事件添加到定时器中
了。再调用 ngx_handle_write_event 方法把写事件添加到 epoll 中。

16）到了这里真的要结束请求了。首先判断读/写事件的 timer_set 标志位，如果 timer_set
为 1，则需要把相应的读/写事件从定时器中移除。

17）调用 11.10.4 节中介绍过的 ngx_http_finalize_connection 方法结束请求。

事实上，ngx_http_finalize_request 方法的分支流程远不止上面的 17 步，为了让读者清晰地
理解其主要工作，许多不太重要的分支都从图 10-26 中去除了。到此，读者应当对
ngx_http_finalize_request 方法有了相当全面的了解，这时再开发 HTTP 模块就可以灵活地指定
rc 参数了。

11.11 小结
本章系统地介绍了 HTTP 框架是如何运行的，特别是它如何与第 9 章介绍的事件框架交
互，以及如何与本书第二部分介绍的普通 HTTP 模块交互。阅读完本章内容后，相信读者会
对 HTTP 模块的开发有一个全新的认识，甚至对于在 HTTP 请求的处理过程中 HTTP 模块占用
的服务器资源都会有深入的了解，也就是说，这时读者应当具备开发复杂的 HTTP 模块的能
力了，甚至可以处理非 HTTP，而是其他基于 TCP 的应用层协议，它们也可以仿照 HTTP 框
架，定义一种新的模块类型和处理框架，从而高效地处理新业务。

upstream 机制实际上也属于 HTTP 框架的内容，下一章中我们将介绍它的实现原理。
