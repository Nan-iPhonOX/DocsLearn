---
outline: [2, 3]
---

# 第三部分深入 Nginx

-   第 8 章 Nginx 基础架构
-   第 9 章 事件模块
-   第 10 章 HTTP 框架的初始化
-   第 11 章 HTTP 框架的执行流程
-   第 12 章 upstream 机制的设计与实现
-   第 13 章 邮件代理模块
-   第 14 章 进程间的通信机制
-   第 15 章 变量
-   第 16 章 slab 共享内存

## 第 8 章 Nginx 基础架构

在本书的第二部分，我们已经学习了如何开发 HTTP 模块，这使得我们可以实现高性能、定制化的 Web 服务器功能。不过，Nginx 自身是高度模块化设计的，它给予了每一个基本的 Nginx 模块足够的灵活性，也就是说，我们不仅仅能开发 HTTP 模块，还可以方便地开发任何基于 TCP 的模块，甚至可以定义一类新的 Nginx 模块，就像 HTTP 模块、mail 模块曾经做过的那样。任何我们能想到的功能，只要符合本章中描述的 Nginx 设计原则，都可以以模块的方式添加到 Nginx 服务中，从而提供强大的 Web 服务器。

另外，Nginx 的 BSD 许可证足够开放和自由，因此，当 Nginx 的一些通用功能与要求不符合我们的想象时，还可以尝试着直接更改它的官方代码，从而更直接地达到业务要求。同时，Nginx 也处于快速的发展中，代码中免不了会有一些 Bug，如果我们对 Nginx 的架构有充分的了解，也可以积极地协助完善 Nginx 框架代码。

以上这些方向，都需要我们在整体上对 Nginx 的架构有清晰的认识。因此，本章的写作目的只有两个：

-   对 Nginx 的设计思路做一个概括性的说明，帮助读者了解 Nginx 的设计原则（见 8.1 节和 8.2 节）。
-   将从具体的框架代码入手，讨论 Nginx 如何启动、运行和退出，这里会涉及具体实现细节，如 master 进程如何管理 worker 进程、每个模块是如何加载到进程中的等（见 8.3 节~8.6 节）。

通过阅读本章内容，我们将会对 Nginx 这个 Web 服务器有一个全面的认识，并对日益增长的各种 Nginx 模块与核心模块的关系有一个大概的了解。另外，本章内容将为下一章（事件模块）以及后续章节中 HTTP 模块的学习打下基础。

### 8.1 Web 服务器设计中的关键约束

Nginx 是一个功能堪比 Apache 的 Web 服务器。然而，在设计时，为了使其能够适应互联网用户的高速增长及其带来的多样化需求，在基本的功能需求之外，还有许多设计约束。

Nginx 作为 Web 服务器受制于 Web 传输协议自身的约束，另外，下面将说明的 7 个关注点也是 Nginx 架构设计中的关键约束，本章会分节简要介绍这些概念。在 8.2 节中，我们将带着这些问题再看一下 Nginx 是如何有效提升这些关注点属性的。

1.性能

性能是 Nginx 的根本，如果性能无法超越 Apache，那么它也就没有存在的意义了。这里所说的性能主体是 Web 服务器，因此，性能这个概念主要是从网络角度出发的，它包含以下 3 个概念。

（1）网络性能

这里的网络性能不是针对一个用户而言的，而是针对 Nginx 服务而言的。网络性能是指在不同负载下，Web 服务在网络通信上的吞吐量。而带宽这个概念，就是指在特定的网络连接上可以达到的最大吞吐量。因此，网络性能肯定会受制于带宽，当然更多的是受制于 Web 服务的软件架构。

在大多数场景下，随着服务器上并发连接数的增加，网络性能都会有所下降。目前，我们在谈网络性能时，更多的是对应于高并发场景。例如，在几万或者几十万并发连接下，要求我们的服务器仍然可以保持较高的网络吞吐量，而不是当并发连接数达到一定数量时，服务器的 CPU 等资源大都浪费在进程间切换、休眠、等待等其他活动上，导致吞吐量大幅下降。

（2）单次请求的延迟性

单次请求的延迟性与上面说的网络性能的差别很明显，这里只是针对一个用户而言的。

对于 Web 服务器，延迟性就是指服务器初次接收到一个用户请求直至返回响应之间持续的时间。

服务器在低并发和高并发连接数量下，单个请求的平均延迟时间肯定是不同的。Nginx 在设计时更应该考虑的是在高并发下如何保持平均时延性，使其不要上升得太快。

（3）网络效率

网络效率很好理解，就是使用网络的效率。例如，使用长连接（keepalive）代替短连接以减少建立、关闭连接带来的网络交互，使用压缩算法来增加相同吞吐量下的信息携带量， 使用缓存来减少网络交互次数等，它们都可以提高网络效率。

2.可伸缩性

可伸缩性指架构可以通过添加组件来提升服务，或者允许组件之间具有交互功能。一般可以通过简化组件、降低组件间的耦合度、将服务分散到许多组件等方法来改善可伸缩性。

可伸缩性受到组件间的交互频率，以及组件对一个请求是使用同步还是异步的方式来处理等条件制约。

3.简单性

简单性通常指组件的简单程度，每个组件越简单，就会越容易理解和实现，也就越容易被验证（被测试）。一般，我们通过分离关注点原则来设计组件，对于整体架构来说，通常使用通用性原则，统一组件的接口，这样就减少了架构中的变数。

4.可修改性

简单来讲，可修改性就是在当前架构下对于系统功能做出修改的难易程度，对于 Web 服务器来说，它还包括动态的可修改性，也就是部署好 Web 服务器后可以在不停止、不重启服务的前提下，提供给用户不同的、符合需求的功能。可修改性可以进一步分解为可进化性、 可扩展性、可定制性、可配置性和可重用性，下面简单说明一下这些概念。

（1）可进化性

可进化性表示我们在修改一个组件时，对其他组件产生负面影响的程度。当然，每个组件的可进化性都是不同的，越是核心的组件其可进化性可能会越低，也就是说，对这个组件的功能做出修改时可能同时必须修改其他大量的相关组件。

对于 Web 服务器来说，“进化”这个概念按照服务是否在运行中又可以分为静态进化和动态进化。优秀的静态进化主要依赖于架构的设计是否足够抽象，而动态进化则不然，它与整个服务的设计都是相关的。

（2）可扩展性

可扩展性表示将一个新的功能添加到系统中的能力（不影响其他功能）。与可进化性一样，除了静态可扩展性外，还有动态可扩展性（如果已经部署的服务在不停止、不重启情况下添加新的功能，就称为动态可扩展性）。

（3）可定制性

可定制性是指可以临时性地重新规定一个组件或其他架构元素的特性，从而提供一种非常规服务的能力。如果某一个组件是可定制的，那么是指用户能够扩展该组件的服务，而不会对其他客户产生影响。支持可定制性的风格一般会提高简单性和可扩展性，因为通常情况下只会实现最常用的功能，不太常用的功能则交由用户重新定制使用，这样组件的复杂性就降低了，整个服务也会更容易扩展。

（4）可配置性

可配置性是指在 Web 服务部署后，通过对服务提供的配置文件进行修改，来提供不同的功能。它与可扩展性、可重用性相关。

（5）可重用性

可重用性指的是一个应用中的功能组件在不被修改的情况下，可以在其他应用中重用的程度。

5.可见性

在 Web 服务器这个应用场景中，可见性通常是指一些关键组件的运行情况可以被监控的程度。例如，服务中正在交互的网络连接数、缓存的使用情况等。通过这种监控，可以改善服务的性能，尤其是可靠性。

6.可移植性

可移植性是指服务可以跨平台运行，这也是当下 Nginx 被大规模使用的必要条件。

7.可靠性

可靠性可以看做是在服务出现部分故障时，一个架构容易受到系统层面故障影响的程度。可以通过以下方法提高可靠性：避免单点故障、增加冗余、允许监视，以及用可恢复的动作来缩小故障的范围。

### 8.2 Nginx 的架构设计

8.1 节列出了进行 Nginx 设计时需要格外重视的 7 个关键点，本节将介绍 Nginx 是如何在这 7 个关键点上提升 Nginx 能力的。

#### 8.2.1 优秀的模块化设计

高度模块化的设计是 Nginx 的架构基础。在 Nginx 中，除了少量的核心代码，其他一切皆为模块。这种模块化设计同时具有以下几个特点：

（1）高度抽象的模块接口

所有的模块都遵循着同样的 ngx_module_t 接口设计规范，这减少了整个系统中的变数， 对于 8.1 节中列出的关键关注点，这种方式带来了良好的简单性、静态可扩展性、可重用性。

（2）模块接口非常简单，具有很高的灵活性

模块的基本接口 ngx_module_t 足够简单，只涉及模块的初始化、退出以及对配置项的处理，这同时也带来了足够的灵活性，使得 Nginx 比较简单地实现了动态可修改性（参见 8.5 节和 8.6 节，可知如何通过 HUP 信号在服务正常运行时使新的配置文件生效，以及通过 USR2 信号实现平滑升级），也就是保持服务正常运行下使系统功能发生改变。

如图 8-1 所示，ngx_module_t 结构体作为所有模块的通用接口，它只定义了 init_master、 init_module、init_process、init_thread、exit_thread、exit_process、exit_master 这 7 个回调方法 （事实上，init_master、init_thread、exit_thread 这 3 个方法目前都没有使用），它们负责模块的初始化和退出，同时它们的权限也非常高，可以处理系统的核心结构体 ngx_cycle_t。在 8.4 节~8.6 节中，可以看到以上 7 个回调方法何时会被调用。而 ngx_command_t 类型的 commands 数组则指定了模块处理配置项的方法（详见第 4 章）。

除了简单、基础的接口，ngx_module_t 中的 ctx 成员还是一个 void\*指针，它可以指向任何数据，这给模块提供了很大的灵活性，使得下面将要介绍的多层次、多类型的模块设计成为可能。ctx 成员一般用于表示在不同类型的模块中一种类型模块所具备的通用性接口。

（3）配置模块的设计

可以注意到，ngx_module_t 接口有一个 type 成员，它指明了 Nginx 允许在设计模块时定义模块类型这个概念，允许专注于不同领域的模块按照类型来区别。而配置类型模块是唯一一种只有 1 个模块的模块类型。配置模块的类型叫做 NGX_CONF_MODULE，它仅有的模块叫做 ngx_conf_module，这是 Nginx 最底层的模块，它指导着所有模块以配置项为核心来提供功能。因此，它是其他所有模块的基础。配置模块使 Nginx 提供了高可配置性、高可扩展性、 高可定制性、高可伸缩性。

图 8-1 ngx_module_t 接口及其对核心、事件、HTTP、mail 等 4 类模块 ctx 上下文成员的具体化

（4）核心模块接口的简单化

Nginx 还定义了一种基础类型的模块：核心模块，它的模块类型叫做 NGX_CORE_MODULE。目前官方的核心类型模块中共有 6 个具体模块，分别是 ngx_core_module、ngx_errlog_module、ngx_events_module、ngx_openssl_module、
ngx_http_module、ngx_mail_module 模块。为什么要定义核心模块呢？因为这样可以简化 Nginx 的设计，使得非模块化的框架代码只关注于如何调用 6 个核心模块（大部分 Nginx 模块都是非核心模块）。

核心模块的接口非常简单，如图 8-1 所示，它将 ctx 上下文进一步实例化为 ngx_core_module_t 结构体，代码如下。

```C
typedef struct {
  // 核心模块名称
  ngx_str_t name;
  // 解析配置项前， Nginx 框架会调用 create_conf 方法
  void (create_conf)(ngx_cycle_t *cycle);
  // 解析配置项完成后， Nginx 框架会调用 init_conf 方法
  char (init_conf)(ngx_cycle_t cycle, void conf);
} ngx_core_module_t;
```

ngx_core_module_t 上下文是以配置项的解析作为基础的，它提供了 create_conf 回调方法来创建存储配置项的数据结构，在读取 nginx.conf 配置文件时，会根据模块中的 ngx_command_t 把解析出的配置项存放在这个数据结构中；它还提供了 init_conf 回调方法，用于在解析完配置文件后，使用解析出的配置项初始化核心模块功能。除此以外，Nginx 框架不会约束核心模块的接口、功能，这种简洁、灵活的设计为 Nginx 实现动态可配置性、动态可扩展性、动态可定制性带来了极大的便利，这样，在每个模块的功能实现中就会较少地考虑如何不停止服务、不重启服务来实现以上功能。

这种设计也使得每一个核心模块都可以自由地定义全新的模块类型。因此，作为核心模块，ngx_events_module 定义了 NGX_EVENT_MODULE 模块类型，所有事件类型的模块都由 ngx_events_module 核心模块管理；ngx_http_module 定义了 NGX_HTTP_MODULE 模块类型，所有 HTTP 类型的模块都由 ngx_http_module 核心模块管理；而 ngx_mail_module 定义了 NGX_MAIL_MODULE 模块类型，所有 MAIL 类型的模块则都由 ngx_mail_module 核心模块管理。

（5）多层次、多类别的模块设计

所有的模块间是分层次、分类别的，官方 Nginx 共有五大类型的模块：核心模块、配置模块、事件模块、HTTP 模块、mail 模块。虽然它们都具备相同的 ngx_module_t 接口，但在请求处理流程中的层次并不相同。就如同上面介绍过的核心模块一样，事件模块、HTTP 模块、mail 模块都会再次具体化 ngx_module_t 接口（由于配置类型的模块只拥有 1 个模块，所以没有具体化 ctx 上下文成员），如图 8-2 所示。

图 8-2 展示了 Nginx 常用模块间的关系。配置模块和核心模块这两种模块类型是由 Nginx 的框架代码所定义的，这里的配置模块是所有模块的基础，它实现了最基本的配置项解析功能 （就是解析 nginx.conf 文件）。Nginx 框架还会调用核心模块，但是其他 3 种模块都不会与框架产生直接关系。事件模块、HTTP 模块、mail 模块这 3 种模块的共性是：实际上它们在核心模块中各有 1 个模块作为自己的“代言人”，并在同类模块中有 1 个作为核心业务与管理功能的模块。例如，事件模块是由它的“代言人”——ngx_events_module 核心模块定义，所有事件模块的加载操作不是由 Nginx 框架完成的，而是由 ngx_event_core_module 模块负责的。同样， HTTP 模块是由它的“代言人”——ngx_http_module 核心模块定义的，与事件模块不同的是，这个核心模块还会负责加载所有的 HTTP 模块，但业务的核心逻辑以及对于具体的请求该选用哪一个 HTTP 模块处理这样的工作，则是由 ngx_http_core_module 模块决定的。至于 mail 模块， 因与 HTTP 模块基本相似，不再赘述。

图 8-2 Nginx 常用模块及其之间的关系

在这 5 种模块中，配置模块与核心模块都是与 Nginx 框架密切相关的，是其他模块的基础。而事件模块则是 HTTP 模块和 mail 模块的基础，原因参见 8.2.2 节。HTTP 模块和 mail 模块的“地位”相似，它们都更关注于应用层面。在事件模块中，ngx_event_core_module 事件模块是其他所有事件模块的基础；在 HTTP 模块中，ngx_http_core_module 模块是其他所有 HTTP 模块的基础；在 mail 模块中，ngx_mail_core_module 模块是其他所有 mail 模块的基础。

#### 8.2.2 事件驱动架构

所谓事件驱动架构，简单来说，就是由一些事件发生源来产生事件，由一个或者多个事件收集器来收集、分发事件，然后许多事件处理器会注册自己感兴趣的事件，同时会“消费”这些事件。

对于 Nginx 这个 Web 服务器而言，一般会由网卡、磁盘产生事件，而 8.2.1 节中提到的事件模块将负责事件的收集、分发操作，而所有的模块都可能是事件消费者，它们首先需要向事件模块注册感兴趣的事件类型，这样，在有事件产生时，事件模块会把事件分发到相应的模块中进行处理。

Nginx 采用完全的事件驱动架构来处理业务，这与传统的 Web 服务器（如 Apache）是不同的。对于传统 Web 服务器而言，采用的所谓事件驱动往往局限在 TCP 连接建立、关闭事件上，一个连接建立以后，在其关闭之前的所有操作都不再是事件驱动，这时会退化成按序执行每个操作的批处理模式，这样每个请求在连接建立后都将始终占用着系统资源，直到连接关闭才会释放资源。要知道，这段时间可能会非常长，从 1 毫秒到 1 分钟都有可能，而且这段时间内占用着内存、CPU 等资源也许并没有意义，整个事件消费进程只是在等待某个条件而已，造成了服务器资源的极大浪费，影响了系统可以处理的并发连接数。如图 8-3 所示，这种传统 Web 服务器往往把一个进程或线程作为事件消费者，当一个请求产生的事件被该进程处理时，直到这个请求处理结束时进程资源都将被这一个请求所占用。

图 8-3 传统 Web 服务器处理事件的简单模型（椭圆代表数据结构，矩形代表进程） Nginx 则不然，它不会使用进程或线程来作为事件消费者，所谓的事件消费者只能是某个模块（在这里没有进程的概念）。只有事件收集、分发器才有资格占用进程资源，它们会在分发某个事件时调用事件消费模块使用当前占用的进程资源，如图 8-4 所示。

图 8-4 中列出了 5 个不同的事件，在事件收集、分发者进程的一次处理过程中，这 5 个事件按照顺序被收集后，将开始使用当前进程分发事件，从而调用相应的事件消费者模块来处理事件。当然，这种分发、调用也是有序的。

从上面的内容可以看出传统 Web 服务器与 Nginx 间的重要差别：前者是每个事件消费者独占一个进程资源，后者的事件消费者只是被事件分发者进程短期调用而已。这种设计使得网络性能、用户感知的请求时延（延时性）都得到了提升，每个用户的请求所产生的事件会及时响应，整个服务器的网络吞吐量都会由于事件的及时响应而增大。但这也会带来一个重要的弊端，即每个事件消费者都不能有阻塞行为，否则将会由于长时间占用事件分发者进程而导致其他事件得不到及时响应。尤其是每个事件消费者不可以让进程转变为休眠状态或等待状态，如在等待一个信号量条件的满足时会使进程进入休眠状态。这加大了事件消费程序的开发者的编程难度，因此，这也导致了 Nginx 的模块开发相对于 Apache 来说复杂不少（上文已经提到过）。

图 8-4 Nginx 处理事件的简单模型

#### 8.2.3 请求的多阶段异步处理

这里所讲的多阶段异步处理请求与事件驱动架构是密切相关的，换句话说，请求的多阶段异步处理只能基于事件驱动架构实现。什么意思呢？就是把一个请求的处理过程按照事件的触发方式划分为多个阶段，每个阶段都可以由事件收集、分发器来触发。

例如，处理一个获取静态文件的 HTTP 请求可以分为以下几个阶段（见表 8-1）。

表 8-1 处理获取静态文件的 HTTP 请求时切分的阶段及各阶段的触发事件这个例子中大致分为 7 个阶段，这些阶段是可以重复发生的，因此，一个下载静态资源请求可能会由于请求数据过大、网速不稳定等因素而被分解为成百上千个表 8-1 中所列出的阶段。

异步处理和多阶段是相辅相成的，只有把请求分为多个阶段，才有所谓的异步处理。也就是说，当一个事件被分发到事件消费者中进行处理时，事件消费者处理完这个事件只相当于处理完 1 个请求的某个阶段。什么时候可以处理下一个阶段呢？这只能等待内核的通知， 即当下一次事件出现时，epoll 等事件分发器将会获取到通知，再继续调用事件消费者处理请求。这样，每个阶段中的事件消费者都不清楚本次完整的操作究竟什么时候会完成，只能异步被动地等待下一次事件的通知。

请求的多阶段异步处理优势在哪里？这种设计配合事件驱动架构，将会极大地提高网络性能，同时使得每个进程都能全力运转，不会或者尽量少地出现进程休眠状况。因为一旦出现进程休眠，必然减少并发处理事件的数目，一定会降低网络性能，同时会增加请求处理时间的平均时延！这时，如果网络性能无法满足业务需求将只能增加进程数目，进程数目过多就会增加操作系统内核的额外操作：进程间切换，可是频繁地进行进程间切换仍会消耗 CPU 等资源，从而降低网络性能。同时，休眠的进程会使进程占用的内存得不到有效释放，这最终必然导致系统可用内存的下降，从而影响系统能够处理的最大并发连接数。

根据什么原则来划分请求的阶段呢？一般是找到请求处理流程中的阻塞方法（或者造成阻塞的代码段），在阻塞代码段上按照下面 4 种方式来划分阶段：

（1）将阻塞进程的方法按照相关的触发事件分解为两个阶段一个本身可能导致进程休眠的方法或系统调用，一般都能够分解为多个更小的方法或者系统调用，这些调用间可以通过事件触发关联起来。大部分情况下，一个阻塞进程的方法调用时可以划分为两个阶段：阻塞方法改为非阻塞方法调用，这个调用非阻塞方法并将进程归还给事件分发器的阶段就是第一阶段；增加新的处理阶段（第二阶段）用于处理非阻塞方法最终返回的结果，这里的结果返回事件就是第二阶段的触发事件。

例如，在使用 send 调用发送数据给用户时，如果使用阻塞 socket 句柄，那么 send 调用在向操作系统内核发出数据包后就必须把当前进程休眠，直到成功发出数据才能“醒来”。这时的 send 调用发送数据并等待结果。我们需要把 send 调用分解为两个阶段：发送且不等待结果阶段、send 结果返回阶段。因此，可以使用非阻塞 socket 句柄，这样调用 send 发送数据后，进程是不会进入休眠的，这就是发送且不等待结果阶段；再把 socket 句柄加入到事件收集器中就可以等待相应的事件触发下一个阶段，send 发送的数据被对方收到后这个事件就会触发 send 结果返回阶段。这个 send 调用就是请求的划分阶段点。

（2）将阻塞方法调用按照时间分解为多个阶段的方法调用
注意，系统中的事件收集、分发者并非可以处理任何事件。如果按照前一种方式试图划分某个方法时，那么可能会发现找出的触发事件不能够被事件收集、分发器所处理，这时只能按照执行时间来拆分这个方法了。

例如读取文件的调用（非异步 I/O），如果我们读取 10MB 的文件，这些文件在磁盘中的块未必是连续的，这意味着当这 10MB 文件内容不在操作系统的缓存中时，可能需要多次驱动硬盘寻址。在寻址过程中，进程多半会休眠或者等待。我们可能会希望像上文所说的那样把读取文件调用分解成两个阶段：发送读取命令且不等待结果阶段、读取结果返回阶段。这样当然很好，可惜的是，如果我们的事件收集、分发者不支持这么做，该怎么办？例如，在 Linux 上 Nginx 的事件模块在没打开异步 I/O 时就不支持这种方法，像 ngx_epoll_module 模块主要是针对网络事件的，而主机的磁盘事件目前还不支持（必须通过内核异步 I/O）。这时，我们可以这样来分解读取文件调用：把 10MB 均分成 1000 份，每次只读取 10KB。这样，读取 10KB 的时间就是可控的，意味着这个事件接收器占用进程的时间不会太久，整个系统可以及时地处理其他请求。

那么，在读取 0KB~10KB 的阶段完成后，怎样进入 10KB~20KB 阶段呢？这有很多种方式，如读取完 10KB 文件后，可能需要使用网络来发送它们，这时可以由网络事件来触发。

或者，如果没有网络事件，也可以设置一个简单的定时器，在某个时间点后再次调用下一个阶段。

（3）在“无所事事”且必须等待系统的响应，从而导致进程空转时，使用定时器划分阶段有时阻塞的代码段可能是这样的：进行某个无阻塞的系统调用后，必须通过持续的检查标志位来确定是否继续向下执行，当标志位没有获得满足时就循环地检查下去。这样的代码段本身没有阻塞方法调用，可实际上是阻塞进程的。这时，应该使用定时器来代替循环检查标志，这样定时器事件发生时就会先检查标志，如果标志位不满足，就立刻归还进程控制权，同时继续加入期望的下一个定时器事件。

（4）如果阻塞方法完全无法继续划分，则必须使用独立的进程执行这个阻塞方法如果某个方法调用时可能导致进程休眠，或者占用进程时间过长，可是又无法将该方法分解为不阻塞的方法，那么这种情况是与事件驱动架构相违背的。通常是由于这个方法的实现者没有开放非阻塞接口所导致，这时必须通过产生新的进程或者指定某个非事件分发者进程来执行阻塞方法，并在阻塞方法执行完毕时向事件收集、分发者进程发送事件通知继续执行。因此，至少要拆分为两个阶段：阻塞方法执行前阶段、阻塞方法执行后阶段，而阻塞方法的执行要使用单独的进程去调度，并在方法返回后发送事件通知。一旦出现上面这种设计，我们必须审视这样的事件消费者是否足够合理，有没有必要用这种违反事件驱动架构的方式来解决阻塞问题。

请求的多阶段异步处理将会提高网络性能、降低请求的时延，在与事件驱动架构配合工作后，可以使得 Web 服务器同时处理十万甚至百万级别的并发连接，我们在开发 Nginx 模块时必须遵循这一原则。

#### 8.2.4 管理进程、多工作进程设计

Nginx 采用一个 master 管理进程、多个 worker 工作进程的设计方式，如图 8-5 所示。

图 8-5 Nginx 采用的一个 master 管理进程、多个工作进程的设计方式

在图 8-5 中，包括完全相同的 worker 进程、1 个可选的 cache manager 进程以及 1 个可选的 cache loader 进程。

这种设计带来以下优点：
（1）利用多核系统的并发处理能力

现代操作系统已经支持多核 CPU 架构，这使得多个进程可以占用不同的 CPU 核心来工作。如果只有一个进程在处理请求，则必然会造成 CPU 资源的浪费！如果多个进程间的地位不平等，则必然会有某一级同一地位的进程成为瓶颈，因此，Nginx 中所有的 worker 工作进程都是完全平等的。这提高了网络性能、降低了请求的时延。

（2）负载均衡

多个 worker 工作进程间通过进程间通信来实现负载均衡，也就是说，一个请求到来时更容易被分配到负载较轻的 worker 工作进程中处理。这将降低请求的时延，并在一定程度上提高网络性能。

（3）管理进程会负责监控工作进程的状态，并负责管理其行为

管理进程不会占用多少系统资源，它只是用来启动、停止、监控或使用其他行为来控制工作进程。首先，这提高了系统的可靠性，当工作进程出现问题时，管理进程可以启动新的工作进程来避免系统性能的下降。其次，管理进程支持 Nginx 服务运行中的程序升级、配置项的修改等操作，这种设计使得动态可扩展性、动态定制性、动态可进化性较容易实现。

#### 8.2.5 平台无关的代码实现

在使用 C 语言实现 Nginx 时，尽量减少使用与操作系统平台相关的代码，如某个操作系统上的第三方库。Nginx 重新封装了日志、各种基本数据结构（如第 7 章中介绍的容器）、常用算法等工具软件，在核心代码都使用了与操作系统无关的代码实现，在与操作系统相关的系统调用上则分别针对各个操作系统都有独立的实现，这最终造就了 Nginx 的可移植性，实现了对主流操作系统的支持。

#### 8.2.6 内存池的设计

为了避免出现内存碎片、减少向操作系统申请内存的次数、降低各个模块的开发复杂度，Nginx 设计了简单的内存池。这个内存池没有很复杂的功能：通常它不负责回收内存池中已经分配出的内存。这种内存池最大的优点在于：把多次向系统申请内存的操作整合成一次，这大大减少了 CPU 资源的消耗，同时减少了内存碎片。

因此，通常每一个请求都有一个这种简易的独立内存池（在第 9 章中会看到，Nginx 为每一个 TCP 连接都分配了 1 个内存池，而在第 10 章和第 11 章，HTTP 框架为每一个 HTTP 请求又分配了 1 个内存池），而在请求结束时则会销毁整个内存池，把曾经分配的内存一次性归还给操作系统。这种设计大大提高了模块开发的简单性（如在前几章中开发 HTTP 模块时，申请内存后都不用关心它释放的问题），而且因为分配内存次数的减少使得请求执行的时延得到了降低，同时，通过减少内存碎片，提高了内存的有效利用率和系统可处理的并发连接数， 从而增强了网络性能。

#### 8.2.7 使用统一管道过滤器模式的 HTTP 过滤模块

有一类 HTTP 模块被命名为 HTTP 过滤模块，其中每一个过滤模块都有输入端和输出端， 这些输入端和输出端都具有统一的接口。这些过滤模块将按照 configure 执行时决定的顺序组成一个流水线式的加工 HTTP 响应的中心，每一个过滤模块都是完全独立的，它处理着输入端接收到的数据，并由输出端传递给下一个过滤模块。每一个过滤模块都必须可以增量地处理数据，也就是说能够正确处理完整数据流的一部分。

这种统一管理过滤器的设计方式的好处非常明显：首先它允许把整个 HTTP 过滤系统的输入/输出简化为一个个过滤模块的简单组合，这大大提高了简单性；其次，它提供了很好的可重用性，任意两个 HTTP 过滤模块都可以连接在一起（在可允许的范围内）；再次，整个过滤系统非常容易维护、增强。例如，开发了一个新的过滤模块后，可以非常方便地添加到过滤系统中，这是一种高可扩展性。又如，旧的过滤模块可以很容易地被升级版的过滤模块所替代，这是一种高可进化性；接着，它在可验证性和可测试性上非常友好，我们可以灵活地变动这个过滤模块流水线来验证功能；最后，这样的系统完全支持并发执行。

#### 8.2.8 其他一些用户模块

Nginx 还有许多特定的用户模块都会改进 8.1 节中提到的约束属性。例如， ngx_http_stub_status_module 模块提供对所有 HTTP 连接状态的监控，这就提高了系统可见性。

而 ngx_http_gzip_filter_module 过滤模块和 ngx_http_gzip_static_module 模块使得相同的吞吐量传送了更多的信息，自然也就提高了网络效率。我们也可以开发这样的模块，让 Nginx 变得更好。

### 8.3 Nginx 框架中的核心结构体 ngx_cycle_t

Nginx 核心的框架代码一直在围绕着一个结构体展开，它就是 ngx_cycle_t。无论是 master 管理进程、worker 工作进程还是 cache manager（loader）进程，每一个进程都毫无例外地拥有唯一一个 ngx_cycle_t 结构体。服务在初始化时就以 ngx_cycle_t 对象为中心来提供服务，在正常运行时仍然会以 ngx_cycle_t 对象为中心。本节将围绕着 ngx_cycle_t 结构体的定义、 ngx_cycle_t 结构体所支持的方法来介绍 Nginx 框架代码，其中 8.4 节中的 Nginx 的启动流程、8.5 节和 8.6 节中 Nginx 各进程的主要工作流程都是以 ngx_cycle_t 结构体作为基础的。下面我们来看一下 ngx_cycle_t 究竟有哪些成员维持了 Nginx 的基本框架。

#### 8.3.1 ngx_listening_t 结构体

作为一个 Web 服务器，Nginx 首先需要监听端口并处理其中的网络事件。这本来应该属于第 9 章所介绍的事件模块要处理的内容，但由于监听端口这项工作是在 Nginx 的启动框架代码中完成的，所以暂时把它放到本章中介绍。ngx_cycle_t 对象中有一个动态数组成员叫做 listening，它的每个数组元素都是 ngx_listening_t 结构体，而每个 ngx_listening_t 结构体又代表着 Nginx 服务器监听的一个端口。在 8.3.2 节中的一些方法会使用 ngx_listening_t 结构体来处理要监听的端口，在 8.4 节中我们也会看到 master 进程、worker 进程等许多进程如何监听同一个 TCP 端口（fork 出的子进程自然共享打开的端口）。更多关于 ngx_listening_t 的介绍将在第 9 章中介绍。本节我们仅仅介绍 ngx_listening_t 的成员，对于它会引用到的其他对象，如 ngx_connection_t 等，将在第 9 章中介绍。下面来看一下 ngx_listening_t 的成员，代码如下所示。

```C
typedef struct ngx_listening_s ngx_listening_t;
struct ngx_listening_s
{
    // socket 套接字句柄
    ngx_socket_t fd;
    // 监听 sockaddr 地址
    struct sockaddr *sockaddr;
    // sockaddr 地址长度
    socklen_t socklen;
    /*存储 IP 地址的字符串 addr_text 最大长度，即它指定了 addr_text 所分配的内存大小 */
    size_t addr_text_max_len;
    // 以字符串形式存储 IP 地址
    ngx_str_t addr_text;
    // 套接字类型。例如，当 type 是 SOCK_STREAM 时，表示 TCP
    int type;
    /*TCP 实现监听时的 backlog 队列，它表示允许正在通过三次握手建立 TCP 连接但还没有任何进程开始处理的连接最大个数 */
    int backlog;
    // 内核中对于这个套接字的接收缓冲区大小
    int rcvbuf;
    // 内核中对于这个套接字的发送缓冲区大小
    int sndbuf;
    // 当新的 TCP 连接成功建立后的处理方法
    ngx_connection_handler_pt handler;
    /*实际上框架并不使用 servers 指针，它更多是作为一个保留指针，目前主要用于 HTTP 或者 mail 等模块，用于保存当前监听端口对应着的所有主机名 */
    void *servers;
    // log 和 logp 都是可用的日志对象的指针
    ngx_log_t log;
    ngx_log_t *logp;
    // 如果为新的 TCP 连接创建内存池，则内存池的初始大小应该是 pool_size
    size_t pool_size;
    /*TCP_DEFER_ACCEPT 选项将在建立 TCP 连接成功且接收到用户的请求数据后，才向对监听套接字感兴趣的进程发送事件通知，而连接建立成功后，如果 post_accept_timeout 秒后仍然没有收到的用户数据，则内核直接丢弃连接 */

    ngx_msec_t post_accept_timeout;
    /*前一个 ngx_listening_t 结构，多个 ngx_listening_t 结构体之间由 previous 指针组成单链表 */
    ngx_listening_t *previous;
    // 当前监听句柄对应着的 ngx_connection_t 结构体
    ngx_connection_t *connection;
    /*标志位，为 1 则表示在当前监听句柄有效，且执行 ngx_init_cycle 时不关闭监听端口，为 0 时则正常关闭。该标志位框架代码会自动设置 */
    unsigned open : 1;
    /*标志位，为 1 表示使用已有的 ngx_cycle_t 来初始化新的 ngx_cycle_t 结构体时，不关闭原先打开的监听端口，这对运行中升级程序很有用， remain 为 0 时，表示正常关闭曾经打开的监听端口。该标志位框架代码会自动设置，参见 ngx_init_cycle 方法 */
    unsigned remain : 1;
    /*标志位，为 1 时表示跳过设置当前 ngx_listening_t 结构体中的套接字，为 0 时正常初始化套接字。该标志位框架代码会自动设置 */
    unsigned ignore : 1;
    // 表示是否已经绑定。实际上目前该标志位没有使用
    unsigned bound : 1;
    /*已经绑定 */
    /*表示当前监听句柄是否来自前一个进程（如升级 Nginx 程序），如果为 1，则表示来自前一个进程。一般会保留之前已经设置好的套接字，不做改变 */
    unsigned inherited : 1;
    /*来自前一个进程 */
    // 目前未使用
    unsigned nonblocking_accept : 1;
    // 标志位，为 1 时表示当前结构体对应的套接字已经监听
    unsigned listen : 1;
    // 表示套接字是否阻塞，目前该标志位没有意义
    unsigned nonblocking : 1;
    // 目前该标志位没有意义
    unsigned shared : 1;
    // 标志位，为 1 时表示 Nginx 会将网络地址转变为字符串形式的地址
    unsigned addr_ntop : 1;
};
```

ngx_connection_handler_pt 类型的 handler 成员表示在这个监听端口上成功建立新的 TCP 连接后，就会回调 handler 方法，它的定义很简单，如下所示。

```c
typedef void (*ngx_connection_handler_pt)(ngx_connection_t *c);
```

它接收一个 ngx_connection_t 连接参数。许多事件消费模块（如 HTTP 框架、mail 框架）都会自定义上面的 handler 方法。

#### 8.3.2 ngx_cycle_t 结构体

Nginx 框架是围绕着 ngx_cycle_t 结构体来控制进程运行的。ngx_cycle_t 结构体的 prefix、 conf_prefix、conf_file 等字符串类型成员保存着 Nginx 配置文件的路径，从 8.2 节已经知道， Nginx 的可配置性完全依赖于 nginx.conf 配置文件，Nginx 所有模块的可定制性、可伸缩性等诸多特性也是依赖于 nginx.conf 配置文件的，可以想见，这个配置文件路径必然是保存在 ngx_cycle_t 结构体中的。

有了配置文件后，Nginx 框架就开始根据配置项来加载所有的模块了，这一步骤会在 ngx_init_cycle 方法中进行（见 8.3.3 节）。ngx_init_cycle 方法，顾名思义，就是用来构造 ngx_cycle_t 结构体中成员的，首先来介绍一下 ngx_cycle_t 中的成员（对于下面提到的 connections、read_events、write_events、files、free_connections 等成员，它们是与事件模块强相关的，本章将不做详细介绍，在第 9 章中会详述这些成员的意义）。

```C
typedef struct ngx_cycle_s ngx_cycle_t;
struct ngx_cycle_s
{
    /*保存着所有模块存储配置项的结构体的指针，它首先是一个数组，每个数组成员又是一个指针，这个指针指向另一个存储着指针的数组，因此会看到 void\*\*\*\* \*/
    void ****conf_ctx;
    // 内存池
    ngx_pool_t *pool;
    /*日志模块中提供了生成基本 ngx*log_t 日志对象的功能，这里的 log 实际上是在还没有执行 ngx_init_cycle 方法前，也就是还没有解析配置前，如果有信息需要输出到日志，就会暂时使用 log 对象，它会输出到屏幕。在 ngx_init_cycle 方法执行后，将会根据 nginx.conf 配置文件中的配置项，构造出正确的日志文件，此时会对 log 重新赋值 */
    ngx_log_t *log;
    /*由 nginx.conf 配置文件读取到日志文件路径后，将开始初始化 error_log 日志文件，由于 log 对象还在用于输出日志到屏幕，这时会用 new_log 对象暂时性地替代 log 日志，待初始化成功后，会用 new_log 的地址覆盖上面的 log 指针 */
    ngx_log_t new_log;
    // 与下面的 files 成员配合使用，指出 files 数组里元素的总数
    ngx_uint_t files_n;
    /*对于 poll、 rtsig 这样的事件模块，会以有效文件句柄数来预先建立这些 ngx_connection_t 结构体，以加速事件的收集、分发。这时 files 就会保存所有 ngx_connection_t 的指针组成的数组， files_n 就是指针的总数，而文件句柄的值用来访问 files 数组成员 */
    ngx_connection_t **files;
    // 可用连接池，与 free_connection_n 配合使用
    ngx_connection_t *free_connections;
    // 可用连接池中连接的总数
    ngx_uint_t free_connection_n;
    /*双向链表容器，元素类型是 ngx_connection_t 结构体，表示可重复使用连接队列 */
    ngx_queue_t reusable_connections_queue;
    /*动态数组，每个数组元素存储着 ngx_listening_t 成员，表示监听端口及相关的参数 */
    ngx_array_t listening;
    /*动态数组容器，它保存着 Nginx 所有要操作的目录。如果有目录不存在，则会试图创建，而创建目录失败将会导致 Nginx 启动失败。例如，上传文件的临时目录也在 pathes 中，如果没有权限创建，则会导致 Nginx 无法启动 */
    ngx_array_t pathes;
    /*单链表容器，元素类型是 ngx_open_file_t 结构体，它表示 Nginx 已经打开的所有文件。事实上， Nginx 框架不会向 open_files 链表中添加文件，而是由对此感兴趣的模块向其中添加文件路径名， Nginx 框架会在 ngx_init_cycle 方法中打开这些文件 */
    ngx_list_t open_files;
    /*单链表容器，元素的类型是 ngx_shm_zone_t 结构体，每个元素表示一块共享内存，共享内存将在第 14 章介绍 */
    ngx_list_t shared_memory;
    // 当前进程中所有连接对象的总数，与下面的 connections 成员配合使用
    ngx_uint_t connection_n;
    // 指向当前进程中的所有连接对象，与 connection_n 配合使用
    ngx_connection_t *connections;
    // 指向当前进程中的所有读事件对象， connection_n 同时表示所有读事件的总数
    ngx_event_t *read_events;
    // 指向当前进程中的所有写事件对象， connection_n 同时表示所有写事件的总数
    ngx_event_t *write_events;
    /*旧的 ngx*cycle_t 对象用于引用上一个 ngx_cycle_t 对象中的成员。例如 ngx_init_cycle 方法，在启动初期，需要建立一个临时的 ngx_cycle_t 对象保存一些变量，再调用 ngx_init_cycle 方法时就可以把旧的 ngx_cycle_t 对象传进去，而这时 old_cycle 对象就会保存这个前期的 ngx_cycle_t 对象 */
    ngx_cycle_t *old_cycle;
    // 配置文件相对于安装目录的路径名称
    ngx_str_t conf_file;
    /*Nginx 处理配置文件时需要特殊处理的在命令行携带的参数，一般是 -g 选项携带的参数 */
    ngx_str_t conf_param;
    // Nginx 配置文件所在目录的路径
    ngx_str_t conf_prefix;
    // Nginx 安装目录的路径
    ngx_str_t prefix;
    // 用于进程间同步的文件锁名称
    ngx_str_t lock_file;
    // 使用 gethostname 系统调用得到的主机名
    ngx_str_t hostname;
};
```

在构造 ngx_cycle_t 结构体成员的 ngx_init_cycle 方法中，上面所列出的 pool 内存池成员、 hostname 主机名、日志文件 new_log 和 log、存储所有路径的 pathes 数组、共享内存、监听端口等都会在该方法中初始化。本章后续提到的流程、方法中可以随处见到 ngx_cycle_t 结构体成员的身影。

#### 8.3.3 ngx_cycle_t 支持的方法

与 ngx_cycle_t 核心结构体相关的方法实际上是非常多的。例如，每个模块都可以通过 init_module、init_process、exit_process、exit_master 等方法操作进程中独有的 ngx_cycle_t 结构体。然而，Nginx 的框架代码中关于 ngx_cycle_t 结构体的方法并不是太多，表 8-2 中列出了与 ngx_cycle_t 相关的主要方法，我们先做一个初步的介绍，在后面的章节中将会提到这些方法的意义。

表 8-2 中列出的许多方法都可以在下面各节中找到。例如，ngx_init_cycle 方法的流程可参照图 8-6 中的第 3 步（调用所有核心模块的 create_conf 方法）~第 8 步（调用所有模块的 init_module 方法）之间的内容；ngx_worker_process_cycle 方法可部分参照图 8-7（图 8-7 中缺少调用 ngx_worker_process_init 方法）；ngx_master_process_cycle 监控、管理子进程的流程可参照图 8-8。

表 8-2 ngx_cycle_t 结构体支持的主要方法

### 8.4 Nginx 启动时框架的处理流程

通过阅读 8.3 节，读者应该对 ngx_cycle_t 结构体有了基本的了解，下面继续介绍 Nginx 在启动时框架做了些什么。注意，本节描述的 Nginx 启动流程基本上不包含 Nginx 模块在启动流程中所做的工作，仅仅是展示框架代码如何使服务运行起来，这里的框架主要就是调用表 8-2 中列出的方法。

如图 8-6 所示，这里包括 Nginx 框架在启动阶段执行的所有基本流程，零碎的工作这里不涉及，对一些复杂的业务也仅做简单说明（如图 8-6 中的第 2 步涉及的平滑升级的问题），本节关注的重点只是 Nginx 的正常启动流程。

图 8-6 Nginx 启动过程的流程图

下面简要介绍一下图 8-6 中的主要步骤：

1）在 Nginx 启动时，首先会解析命令行，处理各种参数。因为 Nginx 是以配置文件作为核心提供服务的，所以最主要的就是确定配置文件 nginx.conf 的路径。这里会预先创建一个临时的 ngx_cycle_t 类型变量，用它的成员存储配置文件路径（实际上还会使用这个临时 ngx_cycle_t 结构体的其他成员，如 log 成员会指向屏幕输出日志），最后调用表 8-2 中的 ngx_process_options 方法来设置配置文件路径等参数。

2）图 8-6 中的第 2 步实际上就是在调用表 8-2 中的 ngx_add_inherited_sockets 方法。Nginx 在不重启服务升级时，也就是我们说过的平滑升级（参见 1.9 节）时，它会不重启 master 进程而启动新版本的 Nginx 程序。这样，旧版本的 master 进程会通过 execve 系统调用来启动新版本的 master 进程（先 fork 出子进程再调用 exec 来运行新程序），这时旧版本的 master 进程必须要通过一种方式告诉新版本的 master 进程这是在平滑升级，并且传递一些必要的信息。Nginx 是通过环境变量来传递这些信息的，新版本的 master 进程通过 ngx_add_inherited_sockets 方法由环境变量里读取平滑升级信息，并对旧版本 Nginx 服务监听的句柄做继承处理。

3）第 3 步~第 8 步，都是在 ngx_init_cycle 方法中执行的。在初始化 ngx_cycle_t 中的所有容器后，会为读取、解析配置文件做准备工作。因为每个模块都必须有相应的数据结构来存储配置文件中的各配置项，创建这些数据结构的工作都需要在这一步进行。Nginx 框架只关心 NGX_CORE_MODULE 核心模块，这也是为了降低框架的复杂度。这里将会调用所有核心模块的 create_conf 方法（也只有核心模块才有这个方法），这意味着需要所有的核心模块开始构造用于存储配置项的结构体。其他非核心模块怎么办呢？其实很简单。这些模块大都从属于一个核心模块，如每个 HTTP 模块都由 ngx_http_module 管理（如图 8-2 所示），这样 ngx_http_module 在解析自己感兴趣的“http”配置项时，将会调用所有 HTTP 模块约定的方法来创建存储配置项的结构体（如第 4 章中介绍过的 xxx_create_main_conf、xxx_create_srv_conf、xxx_create_loc_conf 方法）。

4）调用配置模块提供的解析配置项方法。遍历 nginx.conf 中的所有配置项，对于任一个配置项，将会检查所有核心模块以找出对它感兴趣的模块，并调用该模块在 ngx_command_t 结构体中定义的配置项处理方法。这个流程可以参考图 4-1。

5）调用所有 NGX_CORE_MODULE 核心模块的 init_conf 方法。这一步骤的目的在于让所有核心模块在解析完配置项后可以做综合性处理。

6）在之前核心模块的 init_conf 或者 create_conf 方法中，可能已经有些模块（如缓存模块）在 ngx_cycle_t 结构体中的 pathes 动态数组和 open_files 链表中添加了需要打开的文件或者目录，本步骤将会创建不存在的目录，并把相应的文件打开。同时，ngx_cycle_t 结构体的 shared_memory 链表中将会开始初始化用于进程间通信的共享内存。

7）之前第 4 步在解析配置项时，所有的模块都已经解析出自己需要监听的端口，如 HTTP 模块已经在解析 http{...}配置项时得到它要监听的端口，并添加到 listening 数组中了。这一步骤就是按照 listening 数组中的每一个 ngx_listening_t 元素设置 socket 句柄并监听端口（实际上，这一步骤的主要工作就是调用表 8-2 中的 ngx_open_listening_sockets 方法）。

8）在这个阶段将会调用所有模块的 init_module 方法。接下来将会根据配置的 Nginx 运行模式决定如何工作。

9）如果 nginx.conf 中配置为单进程工作模式，这时将会调用 ngx_single_process_cycle 方法进入单进程工作模式。

10）调用所有模块的 init_process 方法。单进程工作模式的启动工作至此全部完成，将进入正常的工作模式，也就是 8.5 节和 8.6 节分别介绍的 worker 进程工作循环、master 进程工作循环的结合体。

11）如果进入 master、worker 工作模式，在启动 worker 子进程、cache manage 子进程、 cache loader 子进程后，就开始进入 8.6 节提到的工作状态，至此，master 进程启动流程执行完毕。

12）由 master 进程按照配置文件中 worker 进程的数目，启动这些子进程（也就是调用表 8-2 中的 ngx_start_worker_processes 方法）。

13）调用所有模块的 init_process 方法。worker 进程的启动工作至此全部完成，接下来将进入正常的循环处理事件流程，也就是 8.5 节中介绍的 worker 进程工作循环的 ngx_worker_process_cycle 方法。

14）在这一步骤中，由 master 进程根据之前各模块的初始化情况来决定是否启动 cache manage 子进程，也就是根据 ngx_cycle_t 中存储路径的动态数组 pathes 中是否有某个路径的 manage 标志位打开来决定是否启动 cache manage 子进程。如果有任何 1 个路径的 manage 标志位为 1，则启动 cache manage 子进程。

15）与第 14 步相同，如果有任何 1 个路径的 loader 标志位为 1，则启动 cache loader 子进程。对于第 14 步和第 15 步而言，都是与文件缓存模块密切相关的，但本章不会详述。

16）关闭只有 worker 进程才需要监听的端口。

在以上 16 个步骤中，简要地列举出了 Nginx 在单进程模式和 master 工作方式下的启动流程，这里仅列举出与 Nginx 框架密切相关的步骤，并未涉及具体的模块。

### 8.5 worker 进程是如何工作的

本节的内容不会涉及事件模块的处理工作，只是探讨在 worker 进程中循环执行的 ngx_worker_process_cycle 方法是如何控制进程运行的。

master 进程如何通知 worker 进程停止服务或更换日志文件呢？对于这样控制进程运行的 进程间通信方式，Nginx 采用的是信号（详见 14.5 节）。因此，worker 进程中会有一个方法来处理信号，它就是 ngx_signal_handler 方法。

void ngx_signal_handler(int signo) 对于 worker 进程的工作方法 ngx_worker_process_cycle 来说，它会关注以下 4 个全局标志位。

```C
sig_atomic_t ngx_terminate;
sig_atomic_t ngx_quit;
ngx_uint_t ngx_exiting;
sig_atomic_t ngx_reopen;
```

其中的 ngx_terminate、ngx_quit、ngx_reopen 都将由 ngx_signal_handler 方法根据接收到的信号来设置。例如，当接收到 QUIT 信号时，ngx_quit 标志位会设为 1，这是在告诉 worker 进程需要优雅地关闭进程；当接收到 TERM 信号时，ngx_terminate 标志位会设为 1，这是在告诉 worker 进程需要强制关闭进程；当接收到 USR1 信号时，ngx_reopen 标志位会设为 1，这是在告诉 Nginx 需要重新打开文件（如切换日志文件时），见表 8-3。

表 8-3 worker 进程接收到的信号对框架的意义

ngx_exiting 标志位仅由 ngx_worker_process_cycle 方法在退出时作为标志位使用，如图 8-7 所示。

图 8-7 worker 进程正常工作、退出时的流程图

在 ngx_worker_process_cycle 方法中，通过检查 ngx_exiting、ngx_terminate、ngx_quit、ngx_reopen 这 4 个标志位来决定后续动作。

如果 ngx_exiting 为 1，则开始准备关闭 worker 进程。首先，根据当前 ngx_cycle_t 中所有正在处理的连接，调用它们对应的关闭连接处理方法（就是将连接中的 close 标志位置为 1，再调用读事件的处理方法，在第 9 章中会详细讲解 Nginx 连接）。调用所有活动连接的读事件处理方法处理连接关闭事件后，将检查 ngx_event_timer_rbtree 红黑树（保存所有事件的定时器，在第 9 章中会介绍它）是否为空，如果不为空，表示还有事件需要处理，将继续向下执行，调用 ngx_process_events_and_timers 方法处理事件；如果为空，表示已经处理完所有的事件，这时将调用所有模块的 exit_process 方法，最后销毁内存池，退出整个 worker 进程。

注意 ngx_exiting 标志位只有唯一一段代码会设置它，也就是下面接收到 QUIT 信号。ngx_quit 只有在首次设置为 1 时，才会将 ngx_exiting 置为 1。

如果 ngx_exiting 不为 1，那么调用 ngx_process_events_and_timers 方法处理事件。这个方法是事件模块的核心方法，将会在第 9 章介绍它。

接下来检查 ngx_terminate 标志位，如果 ngx_terminate 不为 1，则继续向下检查，否则开始准备退出 worker 进程。与上一步 ngx_exiting 为 1 的退出流程不同，这里不会调用所有活动连接的处理方法去处理关闭连接事件，也不会检查是否已经处理完所有的事件，而是立刻调用所有模块的 exit_process 方法，销毁内存池，退出 worker 进程。

接下来再检查 ngx_quit 标志位，如果标志位为 1，则表示需要优雅地关闭连接。这时，Nginx 首先会将所在进程的名字修改为“worker process is shutting down”，然后调用 ngx_close_listening_sockets 方法来关闭监听的端口，接着设置 ngx_exiting 标志位为 1，继续向下执行（检查 ngx_reopen_files 标志位）。

最后检查 ngx_reopen 标志位，如果为 1，则表示需要重新打开所有文件。这时，调用 ngx_reopen_files 方法重新打开所有文件。之后继续下一个循环，再去检查 ngx_exiting 标志位。

### 8.6 master 进程是如何工作的

master 进程不需要处理网络事件，它不负责业务的执行，只会通过管理 worker 等子进程来实现重启服务、平滑升级、更换日志文件、配置文件实时生效等功能。与 8.5 节类似的是，它会通过检查以下 7 个标志位来决定 ngx_master_process_cycle 方法的运行。

```C
sig_atomic_t ngx_reap;
sig_atomic_t ngx_terminate;
sig_atomic_t ngx_quit;
sig_atomic_t ngx_reconfigure;
sig_atomic_t ngx_reopen;
sig_atomic_t ngx_change_binary;
sig_atomic_t ngx_noaccept;
```

ngx_signal_handler 方法会根据接收到的信号设置 ngx_reap、ngx_quit、ngx_terminate、ngx_reconfigure、ngx_reopen、ngx_change_binary、ngx_noaccept 这些标志位，见表 8-4。

表 8-4 进程中接收到的信号对 Nginx 框架的意义

表 8-4 列出了 master 工作流程中的 7 个全局标志位变量。除此之外，还有一个标志位也会用到，它仅仅是在 master 工作流程中作为标志位使用的，与信号无关。

ngx_uint_t ngx_restart;

在解释 master 工作流程前，还需要对 master 进程管理子进程的数据结构有个初步了解。

下面定义了 ngx_processes 全局数组，虽然子进程中也会有 ngx_processes 数组，但这个数组仅仅是给 master 进程使用的。下面看一下 ngx_processes 全局数组的定义，代码如下。

```C
// 定义 1024 个元素的 ngx_processes 数组，也就是最多只能有 1024 个子进程
define NGX_MAX_PROCESSES 1024
// 当前操作的进程在 ngx_processes 数组中的下标
ngx_int_t ngx_process_slot;
// ngx_processes 数组中有意义的 ngx_process_t 元素中最大的下标
ngx_int_t ngx_last_process;
// 存储所有子进程的数组
ngx_process_t ngx_processes[NGX_MAX_PROCESSES];
```

master 进程中所有子进程相关的状态信息都保存在 ngx_processes 数组中。再来看一下数
组元素的类型 ngx_process_t 结构体的定义，代码如下。

```C
typedef struct {
// 进程 ID
ngx_pid_t pid;
// 由 waitpid 系统调用获取到的进程状态
int status;
/*这是由 socketpair 系统调用产生出的用于进程间通信的 socket 句柄，这一对 socket 句柄可以互相通信，目前用于 master 父进程与 worker 子进程间的通信，详见 14.4 节 */
ngx_socket_t channel[2];
// 子进程的循环执行方法，当父进程调用 ngx_spawn_process 生成子进程时使用
ngx_spawn_proc_pt proc;
/*上面的 ngx_spawn_proc_pt 方法中第 2 个参数需要传递 1 个指针，它是可选的。例如， worker 子进程就不需要，而 cache manage 进程就需要 ngx_cache_manager_ctx 上下文成员。这时， data 一般与 ngx_spawn_proc_pt 方法中第 2 个参数是等价的 */
void data;
// 进程名称。操作系统中显示的进程名称与 name 相同
char *name;
// 标志位，为 1 时表示在重新生成子进程
unsigned respawn:1;
// 标志位，为 1 时表示正在生成子进程
unsigned just_spawn:1;
// 标志位，为 1 时表示在进行父、子进程分离
unsigned detached:1;
// 标志位，为 1 时表示进程正在退出
unsigned exiting:1;
// 标志位，为 1 时表示进程已经退出
unsigned exited:1;
} ngx_process_t;
```

master 进程怎样启动一个子进程呢？其实很简单，fork 系统调用即可以完成。

ngx_spawn_process 方法封装了 fork 系统调用，并且会从 ngx_processes 数组中选择一个还未使
用的 ngx_process_t 元素存储这个子进程的相关信息。如果所有 1024 个数组元素中已经没有空
余的元素，也就是说，子进程个数超过了最大值 1024，那么将会返回 NGX_INVALID_PID。

因此，ngx_processes 数组中元素的初始化将在 ngx_spawn_process 方法中进行。

下面对启动子进程的方法做一个简单说明，它的定义如下。

ngx_pid_t ngx_spawn_process(ngx_cycle_t \*cycle, ngx_spawn_proc_pt proc, void data, char name, ngx_int_t respawn)
这里的 proc 函数指针就是子进程中将要执行的工作循环。下面看一下 ngx_spawn_proc_pt
的定义，代码如下。

typedef void (\*ngx_spawn_proc_pt) (ngx_cycle_t cycle, void data);
因此，worker 进程的工作循环 ngx_worker_process_cycle 方法也是依照 ngx_spawn_proc_pt
来定义的，代码如下。

static void ngx_worker_process_cycle(ngx_cycle_t cycle, void data);
cache manage 进程或者 cache loader 进程的工作循环 ngx_cache_manager_process_cycle 方法
也是如此，代码如下。

static void ngx_cache_manager_process_cycle(ngx_cycle_t cycle, void data);
那么，ngx_processes 数组中这些进程的状态是怎么改变的呢？依靠信号！当每个子进程
意外退出时，master 父进程会接收到 Linux 内核发来的 CHLD 信号，而处理信号的
ngx_signal_handler 方法这时将会做以下处理：将 sig_reap 标志位置为 1，调用
ngx_process_get_status 方法修改 ngx_processes 数组中所有子进程的状态（通过 waitpid 系统调用
得到意外结束的子进程 ID，然后遍历 ngx_processes 数组找到该子进程 ID 对应的 ngx_process_t
结构体，将其 exited 标志位置为 1）。那么，一个子进程意外结束后，如何启动新的子进程
呢？这可以在图 8-8 所示的 master 进程的工作循环中找到答案。

图 8-8 master 进程的工作循环
下面简要介绍一下图 8-8 中列出的流程。实际上，根据以下 8 个标志位：ngx_reap、
ngx_terminate、ngx_quit、ngx_reconfigure、ngx_restart、ngx_reopen、ngx_change_binary、
ngx_noaccept，决定执行不同的分支流程，并循环执行（注意，每次一个循环执行完毕后进
程会被挂起，直到有新的信号才会激活继续执行）。

1）如果 ngx_reap 标志位为 0，则继续向下执行第 2 步；如果 ngx_reap 标志位为 1，则表示
需要监控所有的子进程，同时调用表 8-2 中的 ngx_reap_children 方法来管理子进程。这时，
ngx_reap_children 方法将会遍历 ngx_processes 数组，检查每个子进程的状态，对于非正常退出
的子进程会重新拉起。最后，ngx_processes 方法会返回一个 live 标志位，如果所有的子进程
都已经正常退出，那么 live 将为 0，除此之外，live 会为 1。

2）当 live 标志位为 0（所有子进程已经退出）、ngx_terminate 标志位为 1 或者 ngx_quit 标志
位为 1 时，都将调用 ngx_master_process_exit 方法开始退出 master 进程，否则继续向下执行第 6
步。在 ngx_master_process_exit 方法中，首先会删除存储进程号的 pid 文件。

3）继续之前的 ngx_master_process_exit 方法，调用所有模块的 exit_master 方法。

4）调用 ngx_close_listening_sockets 方法关闭进程中打开的监听端口。

5）销毁内存池，退出 master 进程。

6）如果 ngx_terminate 标志位为 1，则向所有子进程发送信号 TERM，通知子进程强制退
出进程，接下来直接跳到第 1 步并挂起进程，等待信号激活进程。如果 ngx_terminate 标志位为
0，则继续执行第 7 步。

7）如果 ngx_quit 标志位为 0，跳到第 9 步，否则表示需要优雅地退出服务，这时会向所有
子进程发送 QUIT 信号，通知它们退出进程。

8）继续 ngx_quit 为 1 的分支流程。关闭所有的监听端口，接下来直接跳到第 1 步并挂起
master 进程，等待信号激活进程。

9）如果 ngx_reconfigure 标志位为 0，则跳到第 13 步检查 ngx_restart 标志位。如果
ngx_reconfigure 为 1，则表示需要重新读取配置文件。Nginx 不会再让原先的 worker 等子进程再
重新读取配置文件，它的策略是重新初始化 ngx_cycle_t 结构体，用它来读取新的配置文件，
再拉起新的 worker 进程，销毁旧的 worker 进程。本步中将会调用 ngx_init_cycle 方法重新初始
化 ngx_cycle_t 结构体。

10）接第 9 步，调用 ngx_start_worker_processes 方法再拉起一批 worker 进程，这些 worker
进程将使用新 ngx_cycle_t 结构体。

11）接第 10 步，调用 ngx_start_cache_manager_processes 方法，按照缓存模块的加载情况
决定是否拉起 cache manage 或者 cache loader 进程。在这两个方法调用后，肯定是存在子进程
了，这时会把 live 标志位置为 1（第 2 步中曾用到此标志）。

12）接第 11 步，向原先的（并非刚刚拉起的）所有子进程发送 QUIT 信号，要求它们优
雅地退出自己的进程。

13）检查 ngx_restart 标志位，如果为 0，则继续第 15 步，检查 ngx_reopen 标志位。如果
ngx_restart 为 1，则调用 ngx_start_worker_processes 方法拉起 worker 进程，同时将 ngx_restart 置
为 0。

14）接 13 步，调用 ngx_start_cache_manager_processes 方法根据缓存模块的情况选择是否
启动 cache manage 进程或者 cache loader 进程，同时将 live 标志位置为 1。

15）检查 ngx_reopen 标志位，如果为 0，则继续第 17 步，检查 ngx_change_binary 标志位。

如果 ngx_reopen 为 1，则调用 ngx_reopen_files 方法重新打开所有文件，同时将 ngx_reopen 标志
位置为 0。

16）向所有子进程发送 USR1 信号，要求子进程都得重新打开所有文件。

17）检查 ngx_change_binary 标志位，如果 ngx_change_binary 为 1，则表示需要平滑升级
Nginx，这时将调用 ngx_exec_new_binary 方法用新的子进程启动新版本的 Nginx 程序，同时将
ngx_change_binary 标志位置为 0。

18）检查 ngx_noaccept 标志位，如果 ngx_noaccept 为 0，则继续第 1 步进行下一个循环；如
果 ngx_noaccept 为 1，则向所有的子进程发送 QUIT 信号，要求它们优雅地关闭服务，同时将
ngx_noaccept 置为 0，并将 ngx_noaccepting 置为 1，表示正在停止接受新的连接。

注意，在以上 18 个步骤组成的循环中，并不是不停地在循环执行以上步骤，而是会通过
sigsuspend 调用使 master 进程休眠，等待 master 进程收到信号后激活 master 进程继续由上面的第
1 步执行循环。

8.7 ngx_pool_t 内存池
在说明其设计前先来看看与 ngx_pool_t 内存池相关的 15 个方法，如表 8-5 所示。

表 8-5 内存池操作方法
Nginx 已经提供封装了 malloc、free 的 ngx_alloc、ngx_free 方法，为什么还需要一个挺复杂
的内存池呢？对于没有垃圾回收机制的 C 语言编写的应用来说，最容易犯的错就是内存泄
露。当分配内存与释放内存的逻辑相距遥远时，还很容易发生同一块内存被释放两次。内存
池就是为了降低程序员犯错几率的：模块开发者只需要关心内存的分配，而释放则交由内存
池来负责。

那么，ngx_pool_t 内存池什么时候会释放内存呢？一般地，内存池销毁时才会将内存释
放回操作系统（例外就是表 8-5 中的 ngx_pfree 方法）。在一个内存池上，可以任意次的申请
内存，不用释放它们，唯一要做的就是记得销毁内存池。这一策略在降低程序员们出错概率
的同时，引入了另一问题：如果这个内存池的生命周期很长，而每一块内存的生命周期很
短，早期申请的内存会一直无谓地占用着珍贵的内存资源，这不是造成严重的内存浪费吗？
比如生成内存池后 1 天后销毁它，这 1 天中每秒申请 1K 的内存，而申请到的每块内存在这一
秒中就已经使用完毕，这样 1 天结束时这个内存池已经占用了 86MB 的内存！没错，如果内存
与内存池的生命周期是如此差异，那么这个问题是存在的。所以，一般性的应用中没有见过
这样的内存池设计。但是 ngx_pool_t 内存池却可以应用在 Nginx 上，这是因为 Nginx 是一个很纯
粹的 web 服务器，与客户端的每一个 TCP 连接有明确的生命周期，TCP 连接上的每一个 HTTP
请求有非常短暂的生命周期，如果每个请求、连接都有各自的内存池，而模块开发者们评估
待申请内存的使用周期，如果隶属于一个 HTTP 请求，则在请求的内存池上分配内存，如果
隶属于一个连接，则在连接的内存池上分配内存，如果一直伴随着模块，则可以在
ngx_conf_t 的内存池上分配内存。似乎我们得到了不用释放内存的好处，却增加了关心内存
生命周期的额外工作？事实不是这样的，绝大多数模块都在单纯的处理请求，只需要使用
ngx_http_request_t 中的内存池即可。

ngx_pool_t 内存池的设计上还考虑到了小块内存的频繁分配在效率上有提升空间，以及
内存碎片还可以再减少些。在讨论其实现前，先定义什么叫小块内存，
NGX_MAX_ALLOC_FROM_POOL 宏是一个很重要的标准：
define NGX_MAX_ALLOC_FROM_POOL (ngx_pagesize - 1)
可见，在 X86 架构上就是 4095 字节。通常，小于等于 NGX_MAX_ALLOC_FROM_POOL
就意味着小块内存。这并不是绝对的，当调用 ngx_create_pool 创建内存池时，如果传递的 size
参数小于 NGX_MAX_ALLOC_FROM_POOL+sizeof(ngx_pool_t)，则对于这个内存池来说，
size-sizeof(ngx_pool_t)字节就是小块内存的标准。大块内存与小块内存的处理很不一样，看
看 ngx_pool_t 的定义就知道了：
typedef struct ngx_pool_s ngx_pool_t;
struct ngx_pool_s {
// 描述小块内存池。当分配小块内存时，剩余的预分配空间不足时，会再分配
1 个
ngx_pool_t，
// 它们会通过
d 中的
next 成员构成单链表
ngx_pool_data_t d;
// 评估申请内存属于小块还是大块的标准
size_t max;
// 多个小块内存池构成链表时，
current 指向分配内存时遍历的第
1 个小块内存池
ngx_pool_t *current;
// 用于
ngx_output_chain，与内存池关系不大，略过
ngx_chain_t *chain;
// 大块内存都直接从进程的堆中分配，为了能够在销毁内存池时同时释放大块内存，
// 就把每一次分配的大块内存通过
ngx_pool_large_t 组成单链表挂在
large 成员上
ngx_pool_large_t *large;
// 所有待清理资源（例如需要关闭或者删除的文件）以
ngx_pool_cleanup_t 对象构成单链表，
// 挂在
cleanup 成员上
ngx_pool_cleanup_t *cleanup;
// 内存池执行中输出日志的对象
ngx_log_t *log;
};
从上面代码的注释中可知，当申请的内存算是大块内存时（大于 ngx_pool_t 的 max 成
员），是直接调用 ngx_alloc 从进程的堆中分配的，同时会再分配一个 ngx_pool_large_t 结构体
挂在 large 链表中，其定义如下：
typedef struct ngx_pool_large_s ngx_pool_large_t;
struct ngx_pool_large_s {
// 所有大块内存通过
next 指针联在一起
ngx_pool_large_t *next;
// alloc 指向
ngx_alloc 分配出的大块内存。调用
ngx_pfree 后
alloc 可能是
NULL
void \*alloc;
};
对于非常大的内存，如果它的生命周期远远的短于所属的内存池，那么在内存池销毁前
提前的释放它就变得有意义了。而 ngx_pfree 方法就是提前释放大块内存的，需要注意，它的
实现是遍历 large 链表，找到 alloc 等于待释放地址的 ngx_pool_large_t 后，调用 ngx_free 释放大
块内存，但不释放 ngx_pool_large_t 结构体，而是把 alloc 置为 NULL。如此实现的意义在于：
下次分配大块内存时，会期望复用这个 ngx_pool_large_t 结构体。从这里可以想见，如果 large
链表中的元素很多，那么 ngx_free 的遍历损耗的性能是不小的，如果不能确定内存确实非常
大，最好不要调用 ngx_pfree。

再来看看小块内存，通过从进程的堆中预分配更多的内存（ngx_create_pool 的 size 参数决
定预分配大小），而后直接使用这块内存的一部分作为小块内存返回给申请者，以此实现减
少碎片和调用 malloc 的次数。它们是放在成员 d 中维护管理的，看看 ngx_pool_data_t 是如何定
义的：
typedef struct {
// 指向未分配的空闲内存的首地址
u_char *last;
// 指向当前小块内存池的尾部
u_char *end;
// 同属于一个
pool 的多个小块内存池间，通过
next 相连
ngx_pool_t \*next;
// 每当剩余空间不足以分配出小块内存时，
failed 成员就会加
1。

failed 成员大于
4 后
// （
Nginx1.4.4 版本），
ngx_pool_t 的
current 将移向下一个小块内存池
ngx_uint_t failed;
} ngx_pool_data_t;
当内存池预分配的 size 不足使用时，就会再接着分配一个小块内存池，预分配大小与原
内存池相等，且仍然使用 ngx_pool_t 表示这个纯粹的小块内存池，用 ngx_pool_data_t 的 next 成
员相连。这样，这个新增的 ngx_pool_t 结构体中与小块内存无关的其他成员此时是无意义
的，例如 max 不会赋值、large 链表为空等。

ngx_pool_t 不只希望程序员不用释放内存，而且还能不需要释放如文件等资源。例如第
12 章介绍的 upstream 实现的反向代理，其存放 http 协议包体的文件就希望它可以随着
ngx_pool_t 内存池的销毁被自动关闭并删除掉。怎么实现呢？表 8-5 中的 ngx_pool_cleanup_add
方法就用来提供这一功能，它会返回 ngx_pool_cleanup_t 结构体，其定义如下所示：
// 实现这个回调方法时，
data 参数将是
ngx_pool_cleanup_pt 的
data 成员
typedef void (*ngx_pool_cleanup_pt)(void *data);
typedef struct ngx_pool_cleanup_s ngx_pool_cleanup_t;
struct ngx_pool_cleanup_s {
// handler 初始为
NULL，需要设置为清理方法
ngx_pool_cleanup_pt handler;
// ngx_pool_cleanup_add 方法的
size\>0 时
data 不为
NULL，此时可改写
data 指向的内存，
// 用于为
handler 指向的方法传递必要的参数
void *data;
// 由
ngx_pool_cleanup_add 方法设置
next 成员，用于将当前
ngx_pool_cleanup_t
// 添加到
ngx_pool_t 的
cleanup 链表中
ngx_pool_cleanup_t *next;
};
3.8.2 节就是一个很好的资源释放例子，当我们将 handler 设为表 8-5 中的
ngx_pool_delete_file 方法时可以删除文件。

图 8-9 完整地展示了 ngx_pool_t 内存池中小块内存、大块内存、资源清理链表间的关系。

图中，内存池预分配的小块内存区域剩余空闲空间不足以分配某些内存，导致又分配出 2 个
小块内存池。其中原内存池的 failed 成员已经大于 4，所以 current 指向了第 2 个小块内存池，这
样再次分配小块内存时将会忽略第 1 个小块内存池。（从这里可以看到，分配内存的行为可
能导致每个内存池最大 NGX_MAX_ALLOC_FROM_POOL-1 字节的内存浪费。）图中共分配 3
个大块内存，其中第 2 个大块内存调用过 ngx_pfree 方法释放了。图中还挂载了两个资源清理
方法。

图 8-10 以分配地址对齐的内存为例，列出了主要步骤的流程图，可以给读者朋友们更直
观的印象，下面详细解释各步骤：
1）将申请的内存大小 size 与 ngx_pool_t 的 max 成员比较，以决定申请的是小块内存还是大
块内存。如果 size\<=max，则继续执行第 2 步开始分配小块内存；否则，跳到第 10 步分配大块
内存。

2）取到 ngx_pool_t 的 current 指针，它表示应当首先尝试从这个小块内存池里分配，因为
current 之前的 pool 已经屡次分配失败（大于 4 次），其剩余的空间多半无法满足 size。这当然
是一种存在浪费的预估，但性能不坏。

图 8-9 ngx_pool_t 资源池示意图
3）从当前小块内存池的 ngx_pool_data_t 的 last 指针入手，先调用 ngx_align_ptr 找到 last 后
最近的对齐地址。（可参考第 16 章的 slab 共享内存，那里处处需要地址对齐。）
define ngx_align_ptr(p, a) \
(u_char *) (((uintptr_t) (p) + ((uintptr_t) a - 1)) & ~((uintptr_t) a - 1))
define NGX_ALIGNMENT sizeof(unsigned long)
ngx_pool_t *p = …
;
// 取得
last 的
NGX_ALIGNMENT 字节对齐地址
u_char\* m = ngx_align_ptr(p-\>d.last, NGX_ALIGNMENT);
4）比较对齐地址与 ngx_pool_data_t 的 end 指针间是否可以容纳 size 字节。如果 endm\>=size，那么继续执行第 5 步准备返回地址 m；否则，再检查 ngx_pool_data_t 的 next 指针是否
为 NULL，如果是空指针，那么跳到第 6 步准备再申请新的小块内存池，不为空则跳到第 3 步
继续遍历小块内存池构成的链表。

5）先将 ngx_pool_data_t 的 last 指针置为下次空闲内存的首地址，例如：
p-\>d.last = m + size;
再返回地址 m，分配内存流程结束。

6）分配一个大小与上一个 ngx_pool_t 一致的内存池专用于小块内存的分配。内存池大小
获取很简单，如下：
(size_t) ( pool-\>d.end - (u_char \*) pool)
7）将新内存池的空闲地址的首地址对齐，作为返回给申请的内存，再设 last 到空闲内存
的首地址。

8）从 current 指向的小块内存池开始遍历到当前的新内存池，依次将各 failed 成员加 1，并
把 current 指向首个 failed\<=4 的小块内存池，用于下一次的小块内存分配。

9）返回第 7 步对齐的地址，分配流程结束。

10）调用 ngx_alloc 方法从进程的堆内存中分配 size 大小的内存。

11）遍历 ngx_pool_t 的 large 链表，看看有没有 ngx_pool_large_t 的 alloc 成员值为 NULL（这
个 alloc 指向的大块内存执行过 ngx_pfree 方法）。如果找到了这个 ngx_pool_large_t，继续执行
第 12 步；否则，跳到第 13 步执行。需要注意的是，为了防止 large 链表过大，遍历次数是有限
制的，例如最多 4 次还未找到 alloc==NULL 的元素，也会跳出这个遍历循环执行第 13 步。

12）把 ngx_pool_large_t 的 alloc 成员置为第 10 步分配的内存地址，返回地址，分配流程结
束。

13）从内存池中分配出 ngx_pool_large_t 结构体，alloc 成员置为第 10 步分配的内存地址，
将 ngx_pool_large_t 添加到 ngx_pool_t 的 large 链表首部，返回地址，分配流程结束。

图 8-10 分配地址对齐内存的流程图
8.8 小结
本章主要理清了 Nginx 的设计思路，知道它是如何达到高性能、高可靠性、高可伸缩
性、高可修改性等要求的。在此基础上，我们以 ngx_cycle_t 数据结构为核心，介绍了 Nginx 框
架如何启动、初始化、加载各 Nginx 模块的代码，以及 master 进程、worker 进程如何在工作循
环中运行。对于 worker 进程来说，它的工作流程更多地体现在具体的模块上。例如，对于
HTTP 请求来说，worker 进程大都是由 HTTP 模块所占用的，特别是 8.5 节中提到的
ngx_process_events_and_timers 方法，这是第 9 章中事件模块将要讲述的内容，因此，对于
worker 进程的工作循环，本章并没有做详细的说明。对于 master 进程，8.6 节内容基本上涉及
了它在工作循环中执行的所有流程。而对于 cache manage 和 cache loader 进程，它们是与文件
缓存模块密切相关的，在不使用文件缓存时，这两个进程也不会启动，它们与框架代码没有
多少关联，本章只是进行了简单说明。

ngx_pool_t 内存池是一个很基础的设计，本章通过分析其实现可以帮助读者朋友们正确
地使用 ngx_pool_t 内存池，方便阅读后续章节。

通过阅读本章的内容，读者应该对 Nginx 的设计结构有了大致的了解，这样在修改 Nginx
的源码或者开发一些异常强大且深入的 Nginx 模块时就可以得心应手了，因为只有在不违反
Nginx 本身设计原则的前提下才会保留 8.2 节中所述的优点。同时，本章内容是后续章节的基
础，在了解事件模块、HTTP 模块、mail 模块前，必须对 Nginx 整个的模块分布、事件驱动、
请求的多阶段划分等特点有清晰的认识，这样在阅读后续章节时可以做到事半功倍。
