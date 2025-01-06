---
outline: [2, 3]
---

# 第 6 章 开发一个简单的 HTTP 过滤模块

本章开始介绍如何开发 HTTP 过滤模块。顾名思义，HTTP 过滤模块也是一种 HTTP 模块，所以第 3 章中讨论过的如何定义一个 HTTP 模块以及第 4 章中讨论的使用配置文件、上下文、日志的方法对它来说都是适用的。事实上，开发 HTTP 过滤模块用到的大部分知识在第 3 章和第 4 章中都已经介绍过了，只不过，HTTP 过滤模块的地位、作用与正常的 HTTP 处理模块是不同的，它所做的工作是对发送给用户的 HTTP 响应包做一些加工。在 6.1 节和 6.2 节中将会介绍默认编译进 Nginx 的官方 HTTP 过滤模块，从这些模块的功能上就可以对比出 HTTP 过滤模块与 HTTP 处理模块的不同之处。HTTP 过滤模块不会去访问第三方服务，所以第 5 章中介绍的 upstream 和 subrequest 机制在本章中都不会使用到。

实际上，在阅读完第 3 章和第 4 章内容后再来学习本章内容，相信读者会发现开发 HTTP 过滤模块是一件非常简单的事情。在 6.4 节中，我们通过一个简单的例子来演示如何开发 HTTP 过滤模块。

## 6.1 过滤模块的意义

HTTP 过滤模块与普通 HTTP 模块的功能是完全不同的，下面先来回顾一下普通的 HTTP 模块有何种功能。

HTTP 框架为 HTTP 请求的处理过程定义了 11 个阶段，相关代码如下所示：

```C
typedef enum {
    NGX_HTTP_POST_READ_PHASE = 0,
    NGX_HTTP_SERVER_REWRITE_PHASE,
    NGX_HTTP_FIND_CONFIG_PHASE,
    NGX_HTTP_REWRITE_PHASE,
    NGX_HTTP_POST_REWRITE_PHASE,
    NGX_HTTP_PREACCESS_PHASE,
    NGX_HTTP_ACCESS_PHASE,
    NGX_HTTP_POST_ACCESS_PHASE,
    NGX_HTTP_TRY_FILES_PHASE,
    NGX_HTTP_CONTENT_PHASE,
    NGX_HTTP_LOG_PHASE
} ngx_http_phases;
```

HTTP 框架允许普通的 HTTP 处理模块介入其中的 7 个阶段处理请求，但是通常大部分 HTTP 模块（官方模块或者第三方模块）都只在 NGX_HTTP_CONTENT_PHASE 阶段处理请求。在这一阶段处理请求有一个特点，即 HTTP 模块有两种介入方法，第一种方法是，任一个 HTTP 模块会对所有的用户请求产生作用，第二种方法是，只对请求的 URI 匹配了 nginx.conf 中某些 location 表达式下的 HTTP 模块起作用。就像第 3 章中定义的 mytest 模块一样，大部分模块都使用上述的第二种方法处理请求，这种方法的特点是一种请求仅由一个 HTTP 模块（在 NGX_HTTP_CONTENT_PHASE 阶段）处理。如果希望多个 HTTP 模块共同处理一个请求，则多半是由 subrequest 功能来完成，即将原始请求分为多个子请求，每个子请求再由一个 HTTP 模块在 NGX_HTTP_CONTENT_PHASE 阶段处理。

然而，HTTP 过滤模块则不同于此，一个请求可以被任意个 HTTP 过滤模块处理。因此，普通的 HTTP 模块更倾向于完成请求的核心功能，如 static 模块负责静态文件的处理。HTTP 过滤模块则处理一些附加的功能，如 gzip 过滤模块可以把发送给用户的静态文件进行 gzip 压缩处理后再发出去，image_filter 这个第三方过滤模块可以将图片类的静态文件制作成缩略图。

而且，这些过滤模块的效果是可以根据需要叠加的，比如先由 not_modify 过滤模块处理请求中的浏览器缓存信息，再交给 range 过滤模块处理 HTTP range 协议（支持断点续传），然后交由 gzip 过滤模块进行压缩，可以看到，一个请求经由各 HTTP 过滤模块流水线般地依次进行处理了。

HTTP 过滤模块的另一个特性是，在普通 HTTP 模块处理请求完毕，并调用 ngx_http_send_header 发送 HTTP 头部，或者调用 ngx_http_output_filter 发送 HTTP 包体时，才会由这两个方法依次调用所有的 HTTP 过滤模块来处理这个请求。因此，HTTP 过滤模块仅处理服务器发往客户端的 HTTP 响应，而不处理客户端发往服务器的 HTTP 请求。

Nginx 明确地将 HTTP 响应分为两个部分：HTTP 头部和 HTTP 包体。因此，对应的 HTTP 过滤模块可以选择性地只处理 HTTP 头部或者 HTTP 包体，当然也可以二者皆处理。例如， not_modify 过滤模块只处理 HTTP 头部，完全不关心 http 包体；而 gzip 过滤模块首先会处理 HTTP 头部，如检查浏览器请求中是否支持 gzip 解压，然后检查响应中 HTTP 头部里的 Content_Type 是否属于 nginx.conf 中指定的 gzip 压缩类型，接着才处理 HTTP 包体，针对每一块 buffer 缓冲区都进行 gzip 压缩，这样再交给下一个 HTTP 过滤模块处理。

## 6.2 过滤模块的调用顺序

既然一个请求会被所有的 HTTP 过滤模块依次处理，那么下面来看一下这些 HTTP 过滤模块是如何组织到一起的，以及它们的调用顺序是如何确定的。

### 6.2.1 过滤链表是如何构成的

在编译 Nginx 源代码时，已经定义了一个由所有 HTTP 过滤模块组成的单链表，这个单链表与一般的链表是不一样的，它有另类的风格：链表的每一个元素都是一个独立的 C 源代码文件，而这个 C 源代码文件会通过两个 static 静态指针（分别用于处理 HTTP 头部和 HTTP 包体）再指向下一个文件中的过滤方法。在 HTTP 框架中定义了两个指针，指向整个链表的第一个元素，也就是第一个处理 HTTP 头部、HTTP 包体的方法。

这两个处理 HTTP 头部和 HTTP 包体的方法是什么样的呢？HTTP 框架进行了如下定义：

```C
typedef ngx_int_t (*ngx_http_output_header_filter_pt)
(ngx_http_request_t r);
typedef ngx_int_t (ngx_http_output_body_filter_pt)
(ngx_http_request_t r, ngx_chain_t chain);
```

如上所示，ngx_http_output_header_filter_pt 是每个过滤模块处理 HTTP 头部的方法原型，它仅接收 1 个参数 r，也就是当前的请求，其返回值一般是与 3.6.1 节中介绍的返回码通用的，如 NGX_ERROR 表示失败，而 NGX_OK 表示成功。

ngx_http_output_body_filter_pt 是每个过滤模块处理 HTTP 包体的方法原型，它接收两个参数—r 和 chain，其中 r 是当前的请求，chain 是要发送的 HTTP 包体，其返回值与 ngx_http_output_header_filter_pt 相同。

所有的 HTTP 过滤模块需要实现这两个方法（或者仅实现其中的一个也是可以的）。因此，这个单向链表是围绕着每个文件（也就是 HTTP 过滤模块）中的这两个处理方法来建立的，也就是说，链表中的元素实际上就是处理方法。

先来看一下 HTTP 框架中定义的链表入口：

```C
extern ngx_http_output_header_filter_pt ngx_http_top_header_filter;
extern ngx_http_output_body_filter_pt ngx_http_top_body_filter;
```

当执行 ngx_http_send_header 发送 HTTP 头部时，就从 ngx_http_top_header_filter 指针开始遍历所有的 HTTP 头部过滤模块，而在执行 ngx_http_output_filter 发送 HTTP 包体时，就从 ngx_http_top_body_filter 指针开始遍历所有的 HTTP 包体过滤模块。下面来看一下在 Nginx 源代码中是如何做的：

```C
ngx_int_t
ngx_http_send_header(ngx_http_request_t *r)
{
    if (r->err_status)
    {
        r->headers_out.status = r->err_status;
        r->headers_out.status_line.len = 0;
    }
    return ngx_http_top_header_filter(r);
}
```

在发送 HTTP 头部时，从 ngx_http_top_header_filter 指针指向的过滤模块开始执行。而发送 HTTP 包体时都是调用 ngx_http_output_filter 方法，如下所示：

```C
ngx_int_t
ngx_http_output_filter(ngx_http_request_t *r, ngx_chain_t *in)
{
    ngx_int_t rc;
    ngx_connection_t *c;
    c = r->connection;
    rc = ngx_http_top_body_filter(r, in);
    if (rc == NGX_ERROR)
    {
        /* NGX*ERROR 可能由任何过滤模块返回 */
        c->error = 1;
    }
    return rc;
}
```

遍历访问所有的 HTTP 过滤模块时，这个单链表中的元素是怎么用 next 指针连接起来的呢？很简单，每个 HTTP 过滤模块在初始化时，会先找到链表的首元素 ngx_http_top_header_filter 指针和 ngx_http_top_body_filter 指针，再使用 static 静态类型的 ngx_http_next_header_filter 和 ngx_http_next_body_filter 指针将自己插入到链表的首部，这样就行了。下面来看一下在每个过滤模块中 ngx_http_next_header_filter 和 ngx_http_next_body_filter 指针的定义：

```C
static ngx_http_output_header_filter_pt ngx_http_next_header_filter;
static ngx_http_output_body_filter_pt ngx_http_next_body_filter;
```

注意，ngx_http_next_header_filter 和 ngx_http_next_body_filter 都必须是 static 静态变量，为什么呢？因为 static 类型可以让上面两个变量仅在当前文件中生效，这就允许所有的 HTTP 过滤模块都有各自的 ngx_http_next_header_filter 和 ngx_http_next_body_filter 指针。这样，在每个 HTTP 过滤模块初始化时，就可以用上面这两个指针指向下一个 HTTP 过滤模块了。例如，可以像下列代码一样将当前 HTTP 过滤模块的处理方法添加到链表首部。

```C
ngx_http_next_header_filter = ngx_http_top_header_filter;
ngx_http_top_header_filter = ngx_http_myfilter_header_filter;
ngx_http_next_body_filter = ngx_http_top_body_filter;
ngx_http_top_body_filter = ngx_http_myfilter_body_filter;
```

这样，在初始化到本模块时，自定义的 ngx_http_myfilter_header_filter 与 ngx_http_myfilter_body_filter 方法就暂时加入到了链表的首部，而且本模块所在文件中 static 类型的 ngx_http_next_header_filter 指针和 ngx_http_next_body_filter 指针也指向了链表中原来的首部。在实际使用中，如果需要调用下一个 HTTP 过滤模块，只需要调用 ngx_http_next_header_filter(r)或者 ngx_http_next_body_filter(r,chain)就可以了。

### 6.2.2 过滤链表的顺序

HTTP 过滤模块之间的调用顺序是非常重要的。如果两个 HTTP 过滤模块按照相反的顺序执行，完全可能生成两个不同的 HTTP 响应包。例如，如果现在有一个图片缩略图过滤模块，还有一个图片裁剪过滤模块，当返回一张图片给用户时，这两个模块的执行顺序不同的话就会导致用户接收到不一样的图片。

在上文中提到过，Nginx 在编译过程中就会决定 HTTP 过滤模块的顺序。这件事情到底是怎样发生的呢？这其实与 3.3 节中所说的普通 HTTP 模块的顺序是一样的，也是由 configure 生成的 ngx_modules 数组中各模块的顺序决定的。

由于每个 HTTP 过滤模块的初始化方法都会把自己加入到单链表的首部，所以，什么时候、以何种顺序调用这些 HTTP 过滤模块的初始化方法，将会决定这些 HTTP 过滤模块在单链表中的位置。

什么时候开始调用各个 HTTP 模块的初始化方法呢？这主要取决于我们把类似 ngx_http_myfilter_init 这样的初始化方法放到 ngx_http_module_t 结构体的哪个回调方法成员中。

例如，大多数官方 HTTP 过滤模块都会把初始化方法放到 postconfiguration 指针中，那么它就会在图 4-1 的第 6 步将当前模块加入到过滤链表中。不建议把初始化方法放到 ngx_http_module_t 的其他成员中，那样会导致 HTTP 过滤模块的顺序不可控。

初始化时的顺序又是如何决定的呢？首先回顾一下第 1 章的相关内容，在 1.7 节中，介绍了 configure 命令生成的 ngx_modules.c 文件，这个文件中的 ngx_modules 数组会保存所有的 Nginx 模块，包括 HTTP 普通模块和 HTTP 过滤模块，而初始化 Nginx 模块的顺序就是 ngx_modules 数组成员的顺序。因此，只需要查看 configure 命令生成的 ngx_modules.c 文件就可以知道所有 HTTP 过滤模块的顺序了。

由此可知，HTTP 过滤模块的顺序是由 configure 命令生成的。当然，如果用户对 configure 命令生成的模块顺序不满意，完全可以在 configure 命令执行后、make 编译命令执行前修改 ngx_modules.c 文件的内容，对 ngx_modules 数组中的成员进行顺序上的调整。

注意对于 HTTP 过滤模块来说，在 ngx_modules 数组中的位置越靠后，在实际执行请求时就越优先执行。因为在初始化 HTTP 过滤模块时，每一个 http 过滤模块都是将自己插入到整个单链表的首部的。

configure 执行时是怎样确定 Nginx 模块间的顺序的呢？当我们下载官方提供的 Nginx 源代码包时，官方提供的 HTTP 过滤模块顺序已经写在 auto 目录下的 modules 脚本中了。图 6-1 描述了这个顺序。

如果在执行 configure 命令时使用--add-module 选项新加入第三方的 HTTP 过滤模块，那么第三方过滤模块会处于 ngx_modules 数组中的哪个位置呢？答案也可以在图 6-1 中找到。

如图 6-1 所示，在执行 configure 命令时仅使用--add-module 参数添加了第三方 HTTP 过滤模块。这里没有把默认未编译进 Nginx 的官方 HTTP 过滤模块考虑进去。这样，在 configure 执行完毕后，Nginx 各 HTTP 过滤模块的执行顺序就确定了。默认 HTTP 过滤模块间的顺序必须如图 6-1 所示，因为它们是“写死”在 auto/modules 脚本中的。读者可以通过阅读这个 modules 脚本的源代码了解 Nginx 是如何根据各官方过滤模块功能的不同来决定它们的顺序的。对于图 6-1 中所列的这些过滤模块，将在下面进行简单的介绍。

图 6-1 默认即编译进 Nginx 的官方 HTTP 过滤模块与第三方 HTTP 过滤模块间的顺序 6.2.3 官方默认 HTTP 过滤模块的功能简介本节介绍默认即编译进 Nginx 的 HTTP 过滤模块的功能（见表 6-1），通过对它们的了解， 读者就会明白图 6-1 列出的 HTTP 过滤模块间的排序依据是什么。如果用户对 configure 命令执行后的模块间顺序不满意，就可以正确地修改这些过滤模块间的顺序。

表 6-1 默认即编译进 Nginx 的 HTTP 过滤模块

从表 6-1 中可以了解到这些默认的 HTTP 过滤模块为什么要以图 6-1 的顺序排列，同样可以弄清楚第三方过滤模块为何要在 ngx_http_headers_filter_module 模块之后、 ngx_http_userid_filter_module 模块之前。

在开发 HTTP 过滤模块时，如果对 configure 执行后的过滤模块顺序不满意，那么在修改 ngx_modules.c 文件时先要对照表 6-1 看一下每个模块的功能是否符合它的位置。

## 6.3 HTTP 过滤模块的开发步骤

HTTP 过滤模块的开发步骤与第 3 章中所述的普通 HTTP 模块的开发步骤基本一致，这里再简要地概括一下，即如下 8 个步骤：
1）确定源代码文件名称。通常，HTTP 过滤模块的功能都比较单一，因此，一般 1 个 C 源文件就可以实现 1 个 HTTP 过滤模块。由于需要将源文件加入到 Makefile 中，因此这时就要确定好源文件名称。当然，用多个 C 源文件甚至 C++源文件实现 1 个 HTTP 过滤模块也是可以的，可参考 3.3 节和 3.9 节，这里不再赘述。

2）在源代码所在目录创建 config 脚本文件，当执行 configure 时将该目录添加进去。config 文件的编写方法与 3.3.1 节中开发普通 HTTP 模块时介绍的编写方法基本一致，唯一需要改变的是，把 HTTP_MODULES 变量改为 HTTP_FILTER_MODULES 变量，这样才会把我们的模块作为 HTTP 过滤模块，并把它放置到正确的位置（图 6-1 所示的第三方过滤模块位置）上。

在执行 configure 命令时，其编译方法与 3.3.2 节中介绍的是一样的。在执行 configure--add_module=PATH 时，PATH 就是 HTTP 过滤模块源文件所在的路径。当多个源代码文件实现 1 个 HTTP 过滤模块时，需在 NGX_ADDON_SRCS 变量中添加其他源代码文件。

3）定义过滤模块。实例化 ngx_module_t 类型的模块结构，这与 3.4 节介绍的内容类似， 同时可以参考 3.5 节中的例子。因为 HTTP 过滤模块也是 HTTP 模块，所以在定义 ngx_module_t 结构时，其中的 type 成员也是 NGX_HTTP_MODULE。这一步骤与定义普通的 HTTP 模块是相同的。

4）处理感兴趣的配置项。依照第 4 章中介绍的方法，可通过设置 ngx_module_t 结构中的 ngx_command_t 数组来处理感兴趣的配置项。

5）实现初始化方法。初始化方法就是把本模块中处理 HTTP 头部的 ngx_http_output_header_filter_pt 方法与处理 HTTP 包体的 ngx_http_output_body_filter_pt 方法插入到过滤模块链表的首部，参见 6.2.1 节中的例子。

6）实现处理 HTTP 头部的方法。实现 ngx_http_output_header_filter_pt 原型的方法，用于处理 HTTP 头部，如下所示：

```C
typedef ngx_int_t (*ngx_http_output_header_filter_pt) (ngx_http_request_t *r);
```

一定要在模块初始化方法中将其添加到过滤模块链表中。

7）实现处理 HTTP 包体的方法。实现 ngx_http_output_body_filter_pt 原型的方法，用于处理 HTTP 包体，如下所示：

```C
typedef ngx_int_t (*ngx_http_output_body_filter_pt) (ngx_http_request_t r, ngx_chain_t chain);
```

一定要在模块初始化方法中将其添加到过滤模块链表中。

8）编译安装后，修改 nginx.conf 文件并启动自定义过滤模块。通常，出于灵活性考虑， 在配置文件中都会有配置项决定是否启动模块。因此，执行 make 编译以及 make install 安装后，再修改 nginx.conf 文件中的配置项，自定义过滤模块的功能。

## 6.4 HTTP 过滤模块的简单例子

本节通过一个简单的例子来说明如何开发 HTTP 过滤模块。场景是这样的，用户的请求由 static 静态文件模块进行了处理，它会根据 URI 返回磁盘中的文件给用户。而我们开发的过滤模块就会在返回给用户的响应包体前加一段字符串："[my filter prefix]"。需要实现的功能就是这么简单，当然，可以在配置文件中决定是否开启此功能。

图 6-2 简单地描绘了处理 HTTP 头部的方法将会执行的操作，而图 6-3 则是处理 HTTP 包体的方法将会执行的操作。

图 6-2 过滤模块例子中，HTTP 头部处理方法的执行活动图与图 6-2 相关的代码可参见 6.4.5 节。

图 6-3 过滤模块例子中，HTTP 包体处理方法的执行活动图与图 6-3 相关的代码可参见 6.4.6 节。

由于 HTTP 过滤模块也是一种 HTTP 模块，所以大家会发现本章 myfilter 过滤模块的代码与第 3 章介绍的例子中的代码很相似。

### 6.4.1 如何编写 config 文件

可以仅用 1 个源文件实现上述 HTTP 过滤模块，源文件名为 ngx_http_myfilter_module.c。在该文件所在目录中添加 config 文件，其内容如下：

```ini
ngx_addon_name=ngx_http_myfilter_module
HTTP_FILTER_MODULES="$HTTP_FILTER_MODULES ngx_http_myfilter_module"
NGX_ADDON_SRCS="$NGX_ADDON_SRCS $ngx_addon_dir/ngx_http_myfilter_module.c"
```

将模块名添加到 HTTP_FILTER_MODULES 变量后，auto/modules 脚本就会按照 6.2.2 节中定义的顺序那样，将 ngx_http_myfilter_module 过滤模块添加到 ngx_modules 数组的合适位置上。其中，NGX_ADDON_SRCS 定义的是待编译的 C 源文件。

### 6.4.2 配置项和上下文

首先希望在 nginx.conf 中有一个控制当前 HTTP 过滤模块是否生效的配置项，它的参数值为 on 或者 off，分别表示开启或者关闭。因此，按照第 4 章介绍的用法，需要建立 ngx\*http_myfilter_conf_t 结构体来存储配置项，其中使用 ngx_flag_t 类型的 enable 变量来存储这个参数值，如下所示：

```C
typedef struct
{
    ngx_flag_t enable;
} ngx_http_myfilter_conf_t;
```

同样，下面实现的 ngx_http_myfilter_create_conf 用于分配存储配置项的结构体 ngx_http_myfilter_conf_t：

```C
static void *ngx_http_myfilter_create_conf(ngx_conf_t *cf)
{
    ngx_http_myfilter_conf_t *mycf;
    // 创建存储配置项的结构体
    mycf = (ngx_http_myfilter_conf_t *)ngx_pcalloc(cf->pool, sizeof(ngx_http_myfilter_conf_t));
    if (mycf == NULL)
    {
        return NULL;
    }
    // ngx_flat_t 类型的变量。如果使用预设函数 ngx_conf_set_flag_slot 解析配置项参数，那么必须初始化为 NGX_CONF_UNSET
    mycf->enable = NGX_CONF_UNSET;
    return mycf;
}
```

就像 gzip 等其他 HTTP 过滤模块的配置项一样，我们往往会允许配置项不只出现在 location{...}配置块中，还可以出现在 server{...}或者 http{...}配置块中，因此，还需要实现一个配置项值的合并方法——ngx_http_myfilter_merge_conf，代码如下所示：

```C
static char *ngx_http_myfilter_merge_conf(ngx_conf_t *cf, void *parent, void *child)
{
    ngx_http_myfilter_conf_t *prev = (ngx_http_myfilter_conf_t *)parent;
    ngx_http_myfilter_conf_t *conf = (ngx_http_myfilter_conf_t *)child;
    // ngx_flat_t 类型的配置项 enable
    ngx_conf_merge_value(conf->enable, prev->enable, 0);
    return NGX_CONF_OK;
}
```

根据 6.4.3 节中介绍的配置项名称可知，在 nginx.conf 配置文件中需要有“add_prefix on;”字样的配置项。

再建立一个 HTTP 上下文结构体 ngx_http_myfilter_ctx_t，其中包括 add_prefix 整型成员，在处理 HTTP 头部时用这个 add_prefix 表示在处理 HTTP 包体时是否添加前缀。

```C
typedef struct {
ngx_int_t add_prefix;
} ngx_http_myfilter_ctx_t;
```

当 add_prefix 为 0 时，表示不需要在返回的包体前加前缀；当 add_prefix 为 1 时，表示应当在包体前加前缀；当 add_prefix 为 2 时，表示已经添加过前缀了。为什么 add_prefix 有 3 个值呢？因为 HTTP 头部处理方法在 1 个请求中只会被调用 1 次，但包体处理方法在 1 个请求中是有可能被多次调用的，而实际上我们只希望在包头加 1 次前缀，因此 add_prefix 制定了 3 个值。

### 6.4.3 定义 HTTP 过滤模块

定义 ngx_module_t 模块前，需要先定义好它的两个关键成员：ngx_command_t 类型的 commands 数组和 ngx_http_module_t 类型的 ctx 成员。

下面定义了 ngx_http_myfilter_commands 数组，它会处理 add_prefix 配置项，将配置项参数解析到 ngx_http_myfilter_conf_t 上下文结构体的 enable 成员中。

```C
static ngx_command_t ngx_http_myfilter_commands[] = {
    {ngx_string("add_prefix"),
     NGX_HTTP_MAIN_CONF | NGX_HTTP_SRV_CONF | NGX_HTTP_LOC_CONF | NGX_HTTP_LMT_CONF | NGX_CONF_FLAG,
     ngx_conf_set_flag_slot,
     NGX_HTTP_LOC_CONF_OFFSET,
     offsetof(ngx_http_myfilter_conf_t, enable),
     NULL},
    ngx_null_command};
```

在定义 ngx_http_module_t 类型的 ngx_http_myfilter_module_ctx 时，需要将 6.4.2 节中定义的 ngx_http_myfilter_create_conf 回调方法放到 create_loc_conf 成员中，而 ngx_http_myfilter_merge_conf 回调方法则要放到 merge_loc_conf 成员中。另外，在 6.4.4 节中定义的 ngx_http_myfilter_init 模块初始化方法也要放到 postconfiguration 成员中，表示当读取完所有的配置项后就会回调 ngx_http_myfilter_init 方法，代码如下所示：

```C
static ngx_http_module_t ngx_http_myfilter_module_ctx = {
    NULL,                         /* preconfiguration 方法*/
    ngx_http_myfilter_init,       /* postconfiguration 方法*/
    NULL,                         /* create_main_conf 方法*/
    NULL,                         /* init_main_conf 方法 */
    NULL,                         /* create_srv_conf 方法 */
    NULL,                         /* merge_srv_conf 方法 */
    ngx_http_myfilter_create_conf,/* create*loc_conf 方法 */
    ngx_http_myfilter_merge_conf  /* merge*loc_conf 方法 */
};
```

有了 ngx_command_t 类型的 commands 数组和 ngx_http_module_t 类型的 ctx 成员后，下面就可以定义 ngx_http_myfilter_module 过滤模块了。

```C
ngx*module_t ngx_http_myfilter_module = {
NGX_MODULE_V1,
&ngx_http_myfilter_module_ctx,  /* 模块上下文 */
ngx_http_myfilter_commands,     /* 模块指令 */
NGX_HTTP_MODULE,                /* 模块类型 */
NULL,                           /* 初始化主机 */
NULL,                           /* init 模块 */
NULL,                           /* 初始化进程 */
NULL,                           /* init thread */
NULL,                           /* exit thread */
NULL,                           /* exit process */
NULL,                           /* exit master */
NGX_MODULE_V1_PADDING
};
```

它的类型仍然是 NGX_HTTP_MODULE。

### 6.4.4 初始化 HTTP 过滤模块

在定义 ngx_http_myfilter_init 方法时，首先需要定义静态指针 ngx_http_next_header_filter， 用于指向下一个过滤模块的 HTTP 头部处理方法，然后要定义静态指针 ngx_http_next_body_filter，用于指向下一个过滤模块的 HTTP 包体处理方法，代码如下所示。

```C
static ngx_http_output_header_filter_pt ngx_http_next_header_filter;
static ngx_http_output_body_filter_pt ngx_http_next_body_filter;
static ngx_int_t ngx_http_myfilter_init(ngx_conf_t *cf)
{
    // 插入到头部处理方法链表的首部
    ngx_http_next_header_filter = ngx_http_top_header_filter;
    ngx_http_top_header_filter = ngx_http_myfilter_header_filter;
    ngx_http_next_body_filter = ngx_http_top_body_filter;
    ngx_http_top_body_filter = ngx_http_myfilter_body_filter;
    return NGX_OK;
}
```

### 6.4.5 处理请求中的 HTTP 头部

我们需要把在 HTTP 响应包体前加的字符串前缀硬编码为 filter_prefix 变量，如下所示。

```C
static ngx_str_t filter_prefix = ngx_string("[my filter prefix]");
```

根据图 6-2 中描述的处理流程，ngx_http_myfilter_header_filter 回调方法的实现应如下所
示。

```C
static ngx_int_t
ngx_http_myfilter_header_filter(ngx_http_request_t *r)
{
    ngx *http_myfilter_ctx_t *ctx;
    ngx_http_myfilter_conf_t *conf;
    /*如果不是返回成功，那么这时是不需要理会是否加前缀的，直接交由下一个过滤模块处理响应码非 200 的情况 */
    if (r->headers_out.status != NGX_HTTP_OK)
    {
        return ngx_http_next_header_filter(r);
    }
    // 获取 HTTP 上下文
    ctx = ngx_http_get_module_ctx(r, ngx_http_myfilter_module);
    if (ctx)
    {
        /*该请求的上下文已经存在，这说明 ngx_http_myfilter_header_filter 已经被调用过 1 次，直接交由下一个过滤模块处理 */
        return ngx_http_next_header_filter(r);
    }
    // 获取存储配置项的 ngx_http_myfilter_conf_t 结构体
    conf = ngx_http_get_module_loc_conf(r, ngx_http_myfilter_module);

    /*如果 enable 成员为 0，也就是配置文件中没有配置 add*prefix 配置项，或者 add_prefix 配置项的参数值是 off，那么这时直接交由下一个过滤模块处理 */
    if (conf->enable == 0)
    {
        return ngx * http_next_header_filter(r);
    }
    // 构造 HTTP 上下文结构体 ngx_http_myfilter_ctx_t
    ctx = ngx_pcalloc(r->pool, sizeof(ngx_http_myfilter_ctx_t));
    if (ctx == NULL)
    {
        return NGX_ERROR;
    }
    // add_prefix 为 0 表示不加前缀

    ctx->add_prefix = 0;

    // 将构造的上下文设置到当前请求中
    ngx_http_set_ctx(r, ctx, ngx_http_myfilter_module);

    // myfilter 过滤模块只处理 Content-Type 是“ text/plain”类型的 HTTP 响应
    if (r->headers_out.content_type.len >= sizeof("text/plain") - 1 && ngx_strncasecmp(r->headers_out.content_type.data, (u_char *)"text/plain", sizeof("text/plain") - 1) == 0)
    {
        // 设置为 1 表示需要在 HTTP 包体前加入前缀
        ctx->add_prefix = 1;
        /*当处理模块已经在 Content-Length 中写入了 HTTP 包体的长度时，由于我们加入了前缀字符串，所以需要把这个字符串的长度也加入到 Content-Length 中 */
        if (r->headers_out.content_length_n > 0)
            r->headers_out.content_length_n += filter_prefix.len;
    }
    // 交由下一个过滤模块继续处理
    return ngx_http_next_header_filter(r);
}
```

注意，除非出现了严重的错误，一般情况下都需要交由下一个过滤模块继续处理。究竟是在 ngx_http_myfilter_header_filter 函数中直接返回 NGX_ERROR，还是调用 ngx_http_next_header_filter(r)继续处理，读者可以参考 6.2.3 节中介绍的一些必需的过滤模块具备的功能来决定。

### 6.4.6 处理请求中的 HTTP 包体

根据图 6-3 中描述的处理流程看，ngx_http_myfilter_body_filter 回调方法的实现应如下所示。

```C
static ngx_int_t ngx_http_myfilter_body_filter(ngx_http_request_t *r, ngx_chain_t *in)
{
    ngx_http_myfilter_ctx_t *ctx;
    ctx = ngx_http_get_module_ctx(r, ngx_http_myfilter_module);
    /*如果获取不到上下文，或者上下文结构体中的 add*prefix 为 0 或者 2 时，都不会添加前缀，这时直接交给下一个 HTTP 过滤模块处理 */
    if (ctx == NULL || ctx->add_prefix != 1)
    {
        return ngx_http_next_body_filter(r, in);
    }
    /*将 add*prefix 设置为 2，这样即使 ngx_http_myfilter_body_filter 再次回调时，也不会重复添加前缀 */
    ctx->add_prefix = 2;
    // 从请求的内存池中分配内存，用于存储字符串前缀
    ngx_buf_t *b = ngx_create_temp_buf(r->pool, filter_prefix.len);
    // 将 ngx_buf_t 中的指针正确地指向 filter_prefix 字符串
    b->start = b->pos = filter_prefix.data;
    b->last = b->pos + filter_prefix.len;
    /*从请求的内存池中生成 ngx*chain_t 链表，将刚分配的 ngx_buf_t 设置到 buf 成员中，并将它添加到原先待发送的 HTTP 包体前面 */
    ngx_chain_t *cl = ngx_alloc_chain_link(r->pool);
    cl->buf = b;
    cl->next = in;
    // 调用下一个模块的 HTTP 包体处理方法，注意，这时传入的是新生成的 cl 链表
    return ngx_http_next_body_filter(r, cl);
}
```

到此，一个简单的 HTTP 过滤模块就开发完成了。无论功能多么复杂的 HTTP 过滤模块，
一样可以从这个例子中衍生出来。

## 6.5 小结

通过本章的学习，读者应该已经掌握如何编写 HTTP 过滤模块了。相比普通的 HTTP 处理模块，编写 HTTP 过滤模块要简单许多，因为它不可能去访问第三方服务，也不负责发送响应到客户端。HTTP 过滤模块的优势在于叠加，即 1 个请求可以被许多 HTTP 过滤模块处理， 这种设计带来了很大的灵活性。读者在开发 HTTP 过滤模块时，也要把模块功能分解得更单一一些，即在功能过于复杂时应该分成多个 HTTP 过滤模块来实现。
