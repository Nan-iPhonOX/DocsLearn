---
outline: [2, 3]
---

# 第 16 章 slab 共享内存

许多场景下，不同的 Nginx 请求间必须交互后才能执行下去，例如限制一个客户端能够
并发访问的请求数。可是 Nginx 被设计为一个多进程的程序，服务更健壮的另一面就是，
Nginx 请求可能是分布在不同的进程上的，当进程间需要互相配合才能完成请求的处理时，
进程间通信开发困难的特点就会凸显出来。第 14 章介绍过一些进程间的交互方法，例如 14.2
节的共享内存。然而如果进程间需要交互各种不同大小的对象，需要共享一些复杂的数据结
构，如链表、树、图等，那么这些内容将很难支撑这样复杂的语义。Nginx 在 14.2 节共享内存
的基础上，实现了一套高效的 slab 内存管理机制，可以帮助我们快速实现多种对象间的跨
Nginx worker 进程通信。本章除了说明如何使用它以外，同时还会详细介绍实现原理，从中
我们可以发现它的设计初衷及不适用的场景。Slab 实现的源代码非常高效，然而却也有些生
涩，本章会较多地通过源代码说明各种二进制位操作，以帮助读者朋友学习 slab 的编码艺
术。

16.1 操作 slab 共享内存的方法
操作 slab 内存池的方法只有下面 5 个：
// 初始化新创建的共享内存
void ngx_slab_init(ngx_slab_pool_t *pool);
// 加锁保护的内存分配方法
void *ngx_slab_alloc(ngx_slab_pool_t *pool, size_t size); // 不加锁保护的内存分配方法
void *ngx_slab_alloc_locked(ngx_slab_pool_t *pool, size_t size); // 加锁保护的内存释放方法
void ngx_slab_free(ngx_slab_pool_t *pool, void *p); // 不加锁保护的内存释放方法
void ngx_slab_free_locked(ngx_slab_pool_t *pool, void *p);
这 5 个方法是 src/core/ngx_slab.h 里仅有的 5 个方法，其精简程度可见一斑。ngx_slab_init 由
Nginx 框架自动调用，使用 slab 内存池时不需要关注它。通常要用到 slab 的都是要跨进程通信
的场景，所以 ngx_slab_alloc_locked 和 ngx_slab_free_locked 这对不加锁的分配、释放内存方法
较少使用，除非模块中已经有其他的同步锁可以复用。因此，模块开发时分配内存调用
ngx_slab_alloc，参数 size 就是需要分配的内存大小，返回值就是内存块的首地址，共享内存
用尽时这个方法会返回 NULL；释放这块内存时调用 ngx_slab_free，参数 p 就是 ngx_slab_alloc
返回的内存地址。还有一个参数 ngx_slab_pool_t*pool 又是怎么来的呢？
很简单，由下面的 ngx_shared_memory_add 方法即可拿到必须的 ngx_slab_pool_t*pool 参
数：
// 告诉
Nginx 初始化
1 块大小为
size、名称为
name 的
slab 共享内存池
ngx_shm_zone_t ngx_shared_memory_add(ngx_conf_t cf, ngx_str_t name, size_t size, void tag);
ngx_shared_memory_add 需要 4 个参数，从第 1 个参数 ngx_conf_t*cf 的配置文件结构体就可
以推测出，该方法必须在解析配置文件这一步中执行。所以在 ngx_command_t 里定义的配置
项解析方法中可以拿到 ngx_conf_t\*cf，通常，我们都会在配置文件里设置共享内存的大小。

当然，各 http 模块都是在解析 http{}配置项时才会被初始化，定义 http 模块时 ngx_http_module_t
的 8 个回调方法里也可以拿到 ngx_conf_t\*cf。

参数 ngx_str_t\*name 是这块 slab 共享内存池的名字。显而易见，Nginx 进程中可能会有许多
个 slab 内存池，而且，有可能多处代码使用同一块 slab 内存池，这样才有必要用唯一的名字
来标识每一个 slab 内存池。

参数 size_t size 设置了共享内存的大小。

参数 void\*tag 则用于防止两个不相关的 Nginx 模块所定义的内存池恰好具有同样的名字，
从而造成数据错乱。所以，通常可以把 tag 参数传入本模块结构体的地址。tag 参数会存放在
ngx_shm_zone_t 的 tag 成员中。

注意当我们执行-s reload 命令时，Nginx 会重新加载配置文件，此时，会触发再次
初始化 slab 共享内存池。而在该过程中，tag 地址同样将用于区分先后两次的初始化是否对应
于同一块共享内存。所以，tag 中应传入全局变量的地址，以使两次设置 tag 时传入的是相同
地址。

如果前后两次设置的 tag 地址不同，则会导致即使共享内存大小没有变化，旧的共享内存
也会被释放掉，然后再重新分配一块同样大小的共享内存，这是没有必要的。

ngx_shared_memory_add 的返回值就是用来拿到 ngx_slab_pool_t*pool 的，如果返回 NULL
表示获取共享内存失败。如果参数 name 已经存在，ngx_shared_memory_add 会比较前一次 name
对应的共享内存 size 是否与本次 size 参数相等，以及 tag 地址是否相等，如果相等，直接返回
上一次的共享内存对应的 ngx_shm_zone_t，否则会返回 NULL。ngx_shm_zone_t 究竟是怎样帮
助我们拿到 ngx_slab_pool_t*pool 的呢？
先来看看 ngx_shared_memory_add 返回了一个怎样的结构体：
typedef struct ngx_shm_zone_s ngx_shm_zone_t; struct ngx_shm_zone_s {
// 在真正创建好
slab 共享内存池后，就会回调
init 指向的方法
ngx_shm_zone_init_pt init;
// 当
ngx_shm_zone_init_pt 方法回调时，通常在使用
slab 内存池的代码前需要做一些初始化工作，
// 这一工作可能需要用到在解析配置文件时就获取到的一些参数，而
data 主要担当传递参数的职责
void *data;
// 描述共享内存的结构体
ngx_shm_t shm;
// 对应于
ngx_shared_memory_add 的
tag 参数
void *tag;
};
拿到了 ngx_shm_zone_t 结构体后，init 成员是必须要设置的，因为 Nginx 后续创建好 slab 内
存池后，一定会调用 init 指向的方法，这是约定好的。ngx_shm_zone_init_pt 函数指针定义如
下：
typedef ngx_int_t (*ngx_shm_zone_init_pt) (ngx_shm_zone_t zone, void data);
我们需要实现一个这样的方法，然后赋给 ngx_shm_zone_t 的 init 函数指针。这个方法被回
调时，其第 1 个参数就是 ngx_shared_memory_add 返回的，而且是刚刚设置过其 init 函数指针成
员的 ngx_shm_zone_t 结构体。对于 ngx_shm_zone_init_pt 的第 2 个参数 void*data，在理解它之前
先要搞清楚 Nginx 的 reload 重载配置文件流程。重新解析配置文件意味着所有的模块（包括
http 模块）都会重新初始化，然而，之前正处于使用中的共享内存可能是有数据的、可以复
用的，如果丢弃了这些旧数据而重新开辟新的共享内存，是会造成严重错误的。所以如果处
于重读配置文件流程中，会尽可能地使用旧共享内存（如果存在的话），表现在
ngx_shm_zone_init_pt 的第 2 个参数 void\*data 上时，就意味着：如果 Nginx 是首次启动，data 则为
空指针 NULL；若是重读配置文件，由于配置项、http 模块的初始化导致共享内存再次创建，
那么 data 就会指向第一次创建共享内存时，ngx_shared_memory_add 返回的 ngx_shm_zone_t 中的
data 成员。读者朋友在处理 data 参数时请务必考虑以上场景，考虑如何使用老的共享内存，
以避免不必要的错误。

16.2 使用 slab 共享内存池的例子
假定这样一个场景：对于来自于同一个 IP 的请求，如果客户端访问某一个 URL 并且获得
成功，则认为这次访问是重量级的，但需要限制过于频率的访问。因此，设计一个 http 过滤
模块，若访问来自同一个 IP 且 URL 相同，则每 N 秒钟最多只能成功访问一次。例如，设定 10
秒钟内仅能成功访问 1 次，那么某浏览器 0 秒时访问/method/access 成功，在第 1 秒若仍然收到
来自这个 IP 的相同请求，将会返回 403 拒绝访问。直到第 11 秒，这个 IP 访问/method/access 才
会再次成功。

现在来实现这样的模块。首先，产品级的 Nginx 一定会有多个 worker 进程，来自同一个 IP
的多次 TCP 连接有可能会进入不同的 worker 进程处理，所以需要用共享内存来存放用户的访
问记录。为了高效地查找、插入、删除访问记录，可以选择用 Nginx 的红黑树来存放它们，
其中关键字就是 IP+URL 的字符串，而值则记录了上次成功访问的时间。这样请求到来时，
以 IP+URL 组成的字符串为关键字查询红黑树，没有查到或查到后发现上次访问的时间距现
在大于某个阀值，则允许访问，同时将该键值对插下红黑树；反之，若查到了且上次访问的
时间距现在小于某个阀值，则拒绝访问。

考虑到共享内存的大小有限，长期运行时如果不考虑回收不活跃的记录，那么一方面红
黑树会越发巨大从而影响效率，另一方面共享内存会很快用尽，导致分配不出新的结点。所
以，所有的结点将通过一个链表连接起来，其插入顺序按 IP+URL 最后一次访问的时间组
织。这样可以从链表的首部插入新访问的记录，从链表尾部取出最后一行记录，从而检查是
否需要淘汰出共享内存。由于最后一行记录一定是最老的记录，如果它不需要淘汰，也就不
需要继续遍历链表了，因此可以提高执行效率。

下面按照以上设计实现一个 http 过滤模块，以此作为例子说明 slab 共享内存池的用法。

16.2.1 共享内存中的数据结构
对于每一条访问记录，需要包含 3 条数据：IP+URL 的变长字符串（URL 长度变化范围很
大，不能按照最大长度分配等长的内存存放，这样太浪费）、描述红黑树结点的结构体、最
近访问时间。如果为每条记录分配 3 块内存各自独立存放，似乎是很自然的、符合软件工程
的行为。然而，应当考虑到 Slab 内存管理机制因为强调速度而采用了 best-fit 思想，这么做会
产生最大 1 倍内存的浪费，所以，在设计数据存储时应当尽量把 1 条记录的 3 条数据放在 1 块连
续内存上。如何实现呢？
先回顾下 7.5.3 节中给出的 ngx_rbtree_node_t 的定义：
typedef struct ngx_rbtree_node_s ngx_rbtree_node_t; struct ngx_rbtree_node_s {
// 每个结点的
hash 值
ngx_rbtree_key_t key;
// 左子结点，由
Nginx 红黑树自动维护
ngx_rbtree_node_t *left;
// 右子结点，由
Nginx 红黑树自动维护
ngx_rbtree_node_t *right;
// 父节点，由
Nginx 红黑树自动维护
ngx_rbtree_node_t \*parent;
// 红色、黑色，由
Nginx 红黑树自动维护
u_char color;
// 无用
u_char data;
};
红黑树中的每个结点都对应着一个 ngx_rbtree_node_t 结构体，它的 key 成员必须要设置，
因为比较哈希过的整型要比挨个比较字符串中的字符快得多！它的 data 成员目前是无用的，
其他成员由 ngx_rbtree 自行处理。

接着 ngx_rbtree_node_t 的 color 成员之后（覆盖 data 成员），开始定义我们的结构体
ngx_http_testslab_node_t，如下所示：
typedef struct {
// 对应于
ngx_rbtree_node_t 最后一个
data 成员
u_char rbtree_node_data; // 按先后顺序把所有访问结点串起，方便淘汰过期结点
ngx_queue_t queue;
// 上一次成功访问该
URL 的时间，精确到毫秒
ngx_msec_t last;
// 客户端
IP 地址与
URL 组合而成的字符串长度
u_short len;
// 以字符串保存客户端
IP 地址与
URL
u_char data[1]; } ngx_http_testslab_node_t;
ngx_http_testslab_node_t 上接 ngx_rbtree_node_t、下接变长字符串，一条访问记录就是这
样存放在一块连续内存上的，如图 16-1 所示。

图 16-1 用一段连续内存存放红黑树键、值的内存布局
由于多个进程都要操作红黑树，描述红黑树的 ngx_rbtree_t 和哨兵结点 ngx_rbtree_node_t
都必须存放在共享内存中，同理，淘汰链表的表头也需要存放在共享内存中，因此下面来定
义结构体 ngx_http_testslab_shm_t，它会存放在自进程启动起从 slab 共享内存里分配的第 1 块内
存中：
// ngx_http_testslab_shm_t 保存在共享内存中
typedef struct {
// 红黑树用于快速检索
ngx_rbtree_t rbtree; // 使用
Nginx 红黑树必须定义的哨兵结点
ngx_rbtree_node_t sentinel; // 所有操作记录构成的淘汰链表
ngx_queue_t queue; } ngx_http_testslab_shm_t;
我们在哪里存放来自共享内存的 ngx_http_testslab_shm_t 结构体的指针呢？在这个例子
中，由于仅有一个 http{}块下的 main 级别配置项，这意味着对这个模块而言每个 worker 进程
仅含一个 main 配置结构体，因此，可以把 ngx_http_testslab_shm_t 的指针放在这个结构体里。

此外，描述 slab 共享内存的 ngx*slab_pool_t 结构体指针也可以这样放置。所以，我们定
义的配置结构体 ngx_http_testslab_conf_t 就是这样的：
// 注意：
ngx_http_testslab_conf_t 不是放在共享内存中的
typedef struct {
// 共享内存大小
ssize_t shmsize;
// 两次成功访问所必须间隔的时间
ngx_int_t interval;
// 操作共享内存一定需要
ngx_slab_pool_t 结构体
// 这个结构体也在共享内存中
ngx_slab_pool_t \_shpool; // 指向共享内存中的
ngx_http_testslab_shm_t 结构体
ngx_http_testslab_shm_t* sh;
} ngx_http_testslab_conf_t;
shmsize 和 interval 成员仅为 nginx.conf 里的配置项，其中 interval 还用于表示是否通过配置
项开启了模块的功能。

16.2.2 操作共享内存中的红黑树与链表
在 7.2 节中介绍过双向链表，它的操作很简单，在这个例子中当需要删除结点时调用
ngx_queue_remove 方法，淘汰结点时则从链表尾部开始遍历，使用 ngx_queue_last 方法可以获
取到尾部的结点，而插入新结点时用 ngx_queue_insert_head 方法插入链表首部即可。

在 7.5 节中介绍过红黑树，删除结点时调用 ngx_rbtree_delete 方法即可，由于参数中直接
传递的是结点指针，因此这里不需要做任何处理。但是插入、遍历时就稍复杂些，因为每个
结点的真实关键字是一个变长字符串，ngx_rbtree_node_t 中的 key 成员放的是字符串的 hash
值，所以插入函数时不能直接使用预置的 ngx_rbtree_insert_value 方法。我们需要定义一个新
的 insert 方法，并在初始化红黑树时把该方法传递给 ngx_rbtree_init 的第 3 个参数。当然，定义
一个新的 insert 方法没有想象中那么难，只需要参考 ngx_rbtree_insert_value 方法的实现即可，
该方法认为 ngx_rbtree_node_t 中的 key 成员就是关键字，而我们则认为字符串才是真正的关键
字，key 仅用于加速操作红黑树，所以稍微改改就可以用了。

读者朋友在继续阅读前可以先浏览下 src/core/ngx_rbtree.c 中的 ngx_rbtree_insert_value 方法
源码，这里不再列出。

void
ngx*rbtree_insert_value(ngx_rbtree_node_t temp, ngx_rbtree_node_t node, ngx_rbtree_node_t *sentinel)
接着，开始实现针对图 16-1 中这种内存布局记录的红黑树插入方法
ngx*http_testslab_rbtree_insert_value：
static void
ngx_http_testslab_rbtree_insert_value(ngx_rbtree_node_t *temp, ngx*rbtree_node_t node, ngx_rbtree_node_t sentinel) {
ngx_rbtree_node_t \*\_p;
ngx_http_testslab_node_t lrn, lrnt; for ( ;; ) {
// ngx_rbtree_node_t 中的
key 仅为
hash 值
// 先比较整型的
key 可以加快插入速度
if (node-\>key \< temp-\>key) {
p = &temp-\>left;
} else if (node-\>key \> temp-\>key) {
p = &temp-\>right;
} else { /* node-\>key == temp-\>key \_/
// 从
data 成员开始就是
ngx*http_testslab_node_t 结构体
lrn = (ngx_http_testslab_node_t *) &node-\>data; lrnt = (ngx_http_testslab_node_t *) &temp-\>data; p = (ngx_memn2cmp(lrn-\>data, lrnt-\>data, lrn-\>len, lrnt-\>len) \< 0) &temp-\>left : &temp-\>right; }
if (*p == sentinel) {
break;
}
temp = *p;
}
*p = node;
node-\>parent = temp;
node-\>left = sentinel;
node-\>right = sentinel;
ngx_rbt_red(node);
}
在实现了插入方法后，就可以像下面这样初始化红黑树了：
ngx_http_testslab_conf_t \*conf; ...
ngx_rbtree_init(&conf-\>sh-\>rbtree, &conf-\>sh-\>sentinel, ngx_http_testslab_rbtree_insert_value);
下面，我们开始实现含有业务逻辑的 ngx_http_testslab_lookup 和 ngx_http_testslab_expire 方
法，前者含有红黑树的遍历。

ngx*http_testslab_lookup 负责在 http 请求到来时，首先利用红黑树的快速检索特性，看一
看共享内存中是否存在访问记录。查找记录时，首先查找 hash 值，若相同再比较字符串，在
该过程中都按左子树小于右子树的规则进行。如果查找到访问记录，则检查上次访问的时间
距当前的时间差是否超过允许阀值，超过了则更新上次访问的时间，并把这条记录重新放到
双向链表的首部（因为眼下这条记录最不容易被淘汰），同时返回 NGX_DECLINED 表示允
许访问；若没有超过阀值，则返回 NGX_HTTP_FORBIDDEN 表示拒绝访问。如果红黑树中没
有查找到这条记录，则向 slab 共享内存中分配一条记录所需大小的内存块，并设置好相应的
值，同时返回 NGX_DECLINED 表示允许访问。代码如下：
// r 是
http 请求，因为只有请求执行时才会调用
ngx_http_testslab_lookup
// conf 是全局配置结构体
// data 和
len 参数表示
IP+URL 字符串，而
hash 则是该字符串的
hash 值
static ngx_int_t
ngx_http_testslab_lookup(ngx_http_request_t *r, ngx*http_testslab_conf_t *conf,
ngx*uint_t hash,
u_char* data,
size*t len)
{
size_t size;
ngx_int_t rc;
ngx_time_t *tp;
ngx*msec_t now;
ngx_msec_int_t ms;
ngx_rbtree_node_t \_node, \_sentinel; ngx_http_testslab_node_t \_lr;
// 取到当前时间
tp = ngx_timeofday();
now = (ngx_msec_t) (tp-\>sec * 1000 + tp-\>msec); node = conf-\>sh-\>rbtree.root;
sentinel = conf-\>sh-\>rbtree.sentinel; while (node != sentinel) {
// 先由
hash 值快速查找请求
if (hash \< node-\>key) {
node = node-\>left;
continue;
}
if (hash \> node-\>key) {
node = node-\>right;
continue;
}
/* hash == node-\>key \_/
lr = (ngx*http*testslab_node_t *) &node-\>data; // 精确比较
IP+URL 字符串
rc = ngx*memn2cmp(data, lr-\>data, len, (size_t) lr-\>len); if (rc == 0) {
// 找到后先取得当前时间与上次访问时间之差
ms = (ngx_msec_int_t) (now - lr-\>last); // 判断是否超过阀值
if (ms \> conf-\>interval) {
// 允许访问，则更新这个结点的上次访问时间
lr-\>last = now;
// 不需要修改该结点在红黑树中的结构
// 但需要将这个结点移动到链表首部
ngx_queue_remove(&lr-\>queue); ngx_queue_insert_head(&conf-\>sh-\>queue, &lr-\>queue); // 返回
NGX_DECLINED 表示当前
handler 允许访问，继续向下执行，参见
10.6.7 节
return NGX_DECLINED;
} else {
// 向客户端返回
403 拒绝访问，参见
10.6.7 节
return NGX_HTTP_FORBIDDEN; }
}
node = (rc \< 0) node-\>left : node-\>right; }
// 获取到连续内存块的长度
size = offsetof(ngx_rbtree_node_t, data) + offsetof(ngx_http_testslab_node_t, data) + len;
// 首先尝试淘汰过期
node，以释放出更多共享内存
ngx_http_testslab_expire(r, conf);
// 释放完过期访问记录后就有更大机会分配到共享内存
// 由于已经加过锁，所以没有调用
ngx_slab_alloc 方法
node = ngx_slab_alloc_locked(conf-\>shpool, size); if (node == NULL) {
// 共享内存不足时简单返错，这个简单的例子没有做更多的处理
return NGX_ERROR;
}
// key 里存放
ip+url 字符串的
hash 值以加快访问红黑树的速度
node-\>key = hash;
lr = (ngx_http_testslab_node_t *) &node-\>data; // 设置访问时间
lr-\>last = now;
// 将连续内存块中的字符串及其长度设置好
lr-\>len = (u*char) len;
ngx_memcpy(lr-\>data, data, len);
// 插入红黑树
ngx_rbtree_insert(&conf-\>sh-\>rbtree, node); // 插入链表首部
ngx_queue_insert_head(&conf-\>sh-\>queue, &lr-\>queue); // 允许访问，参见
10.6.7 节
return NGX_DECLINED;
}
ngx_http_testslab_expire 方法则负责从双向链表的尾部开始检查访问记录，如果上次访问
的时间距当前已经超出了允许阀值，则可以删除访问记录从而释放共享内存。代码如下：
static void
ngx_http_testslab_expire(ngx_http_request_t *r,ngx*http_testslab_conf_t *conf) {
ngx_time_t _tp;
ngx_msec_t now;
ngx_queue_t \_q;
ngx_msec_int_t ms;
ngx_rbtree_node_t \_node;
ngx_http_testslab_node_t \_lr;
// 取出缓存的当前时间
tp = ngx_timeofday();
now = (ngx_msec_t) (tp-\>sec _ 1000 + tp-\>msec); // 循环的结束条件为，要么链表空了，要么遇到了一个不需要淘汰的结点
while (1) {
// 要先判断链表是否为空
if (ngx*queue_empty(&conf-\>sh-\>queue)) {
// 链表为空则结束循环
return;
}
// 从链表尾部开始淘汰
// 因为最新访问的记录会更新到链表首部，所以尾部是最老的记录
q = ngx_queue_last(&conf-\>sh-\>queue); // ngx_queue_data 可以取出
ngx_queue_t 成员所在结构体的首地址
lr = ngx_queue_data(q, ngx_http_testslab_node_t, queue); // 可以从
lr 地址向前找到
ngx_rbtree_node_t
node = (ngx_rbtree_node_t *)
((u_char \*) lr - offsetof(ngx_rbtree_node_t, data)); // 取当前时间与上次成功访问的时间之差
ms = (ngx_msec_int_t) (now - lr-\>last); if (ms \< conf-\>interval) {
// 若当前结点没有淘汰掉，则后续结点也不需要淘汰
return;
}
// 将淘汰结点移出双向链表
ngx_queue_remove(q);
// 将淘汰结点移出红黑树
ngx_rbtree_delete(&conf-\>sh-\>rbtree, node); // 此时再释放这块共享内存
ngx_slab_free_locked(conf-\>shpool, node); }
}
准备工作就绪，接下来可以开始定义 http 过滤模块了。

16.2.3 解析配置文件
首先定义 ngx*command_t 结构体处理 nginx.conf 配置文件，并在其后接 2 个参数的 test_slab
配置项，它仅能存放在 http{}块中，代码如下：
static ngx_command_t ngx_http_testslab_commands[] = {
{ ngx_string("test_slab"),
// 仅支持在
http 块下配置
test_slab 配置项
// 必须携带
2 个参数，前者为两次成功访问同一
URL 时的最小间隔秒数
// 后者为共享内存的大小
NGX_HTTP_MAIN_CONF|NGX_CONF_TAKE2, ngx_http_testslab_createmem,
0,
0,
NULL },
ngx_null_command
};
下面实现解析配置项的方法 ngx_http_testslab_createmem。只有当发现 test_slab 配置项且其
后跟着的参数都合法时，才会开启模块的限速功能。代码如下：
static char *
ngx*http_testslab_createmem(ngx_conf_t *cf, ngx*command_t cmd, void conf) {
ngx_str_t *value;
ngx*shm_zone_t *shm*zone; // conf 参数为
ngx_http_testslab_create_main_conf 创建的结构体
ngx_http_testslab_conf_t mconf = (ngx_http_testslab_conf_t )conf; // 这块共享内存的名字
ngx_str_t name = ngx_string("test_slab_shm"); // 取到
test_slab 配置项后的参数数组
value = cf-\>args-\>elts;
// 获取两次成功访问的时间间隔，注意时间单位
mconf-\>interval = 1000*ngx*atoi(value[1].data, value[1].len); if (mconf-\>interval == NGX_ERROR || mconf-\>interval == 0) {
// 约定设置为
-1 就关闭模块的限速功能
mconf-\>interval = -1;
return "invalid value";
}
// 获取共享内存大小
mconf-\>shmsize = ngx_parse_size(&value[2]); if (mconf-\>shmsize == (ssize_t) NGX_ERROR || mconf-\>shmsize == 0) {
// 关闭模块的限速功能
mconf-\>interval = -1;
return "invalid value";
}
// 要求
Nginx 准备分配共享内存
shm_zone = ngx_shared_memory_add(cf, &name, mconf-\>shmsize, &ngx_http_testslab_module); if (shm_zone == NULL) {
// 关闭模块的限速功能
mconf-\>interval = -1;
return NGX_CONF_ERROR;
}
// 设置共享内存分配成功后的回调方法
shm_zone-\>init = ngx_http_testslab_shm_init; // 设置
init 回调时可以由
data 中获取
ngx_http_testslab_conf_t 配置结构体
shm_zone-\>data = mconf;
return NGX_CONF_OK;
}
全局 ngx_http_testslab_conf_t 配置结构体的生成由 ngx_http_testslab_create_main_conf 方法负
责，它会设置到 ngx_http_module_t 中。其代码如下：
static void *
ngx*http_testslab_create_main_conf(ngx_conf_t *cf) {
ngx*http_testslab_conf_t *conf;
// 在
worker 内存中分配配置结构体
conf = ngx_pcalloc(cf-\>pool, sizeof(ngx_http_testslab_conf_t)); if (conf == NULL) {
return NULL;
}
// interval 初始化为
-1，同时用于判断是否未开启模块的限速功能
conf-\>interval = -1;
conf-\>shmsize = -1;
return conf;
}
ngx_shared_memory_add 执行成功后，Nginx 将会在所有配置文件解析完毕后开始分配共
享内存，并在名为 test_slab_shm 的 slab 共享内存初始化完毕后回调 ngx_http_testslab_shm_init 方
法，该方法实现如下：
static ngx_int_t
ngx_http_testslab_shm_init(ngx_shm_zone_t *shm_zone, void *data) {
ngx_http_testslab_conf_t *conf;
// data 可能为空，也可能是上次
ngx_http_testslab_shm_init 执行完成后的
shm_zone-\>data
ngx_http_testslab_conf_t *oconf = data; size_t len;
// shm_zone-\>data 存放着本次初始化
cycle 时创建的
ngx_http_testslab_conf_t 配置结构体
conf = (ngx_http_testslab_conf_t *)shm*zone-\>data; // 判断是否为
reload 配置项后导致的初始化共享内存
if (oconf) {
// 本次初始化的共享内存不是新创建的
// 此时，
data 成员里就是上次创建的
ngx_http_testslab_conf_t
// 将
sh 和
shpool 指针指向旧的共享内存即可
conf-\>sh = oconf-\>sh;
conf-\>shpool = oconf-\>shpool; return NGX_OK;
}
// shm.addr 里放着共享内存首地址
:ngx_slab_pool_t 结构体
conf-\>shpool = (ngx_slab_pool_t *) shm*zone-\>shm.addr; // slab 共享内存中每一次分配的内存都用于存放
ngx_http_testslab_shm_t
conf-\>sh = ngx_slab_alloc(conf-\>shpool, sizeof(ngx_http_testslab_shm_t)); if (conf-\>sh == NULL) {
return NGX_ERROR;
}
conf-\>shpool-\>data = conf-\>sh; // 初始化红黑树
ngx_rbtree_init(&conf-\>sh-\>rbtree, &conf-\>sh-\>sentinel, ngx_http_testslab_rbtree_insert_value); // 初始化按访问时间排序的链表
ngx_queue_init(&conf-\>sh-\>queue); // slab 操作共享内存出现错误时，其
log 输出会将
log_ctx 字符串作为后缀，以方便识别
len = sizeof(" in testslab \"\"") + shm_zone-\>shm.name.len; conf-\>shpool-\>log_ctx = ngx_slab_alloc(conf-\>shpool, len); if (conf-\>shpool-\>log_ctx == NULL) {
return NGX_ERROR;
}
ngx_sprintf(conf-\>shpool-\>log_ctx, " in testslab \"%V\"%Z", &shm_zone-\>shm.name); return NGX_OK;
}
16.2.4 定义模块
先定义 http 模块的回调接口 ngx_http_testslab_module_ctx，设置 main 级别配置结构体的生
成方法为 ngx_http_testslab_create_main_conf（因为是 main 级别，所以不需要实现其 merge 合并
配置项方法），再设置 http 配置项解析完毕后的回调方法 ngx_http_testslab_init，用于在 11 个
http 请求处理阶段中选择一个处理请求，如下所示：
static ngx_http_module_t ngx_http_testslab_module_ctx =
{
NULL, /* preconfiguration */
ngx*http_testslab_init, /* postconfiguration */
ngx*http_testslab_create_main_conf, /* create main configuration */
NULL, /* init main configuration */
NULL, /* create server configuration */
NULL, /_ merge server configuration _/
NULL, /_ create location configuration _/
NULL /_ merge location configuration _/
};
ngx*http_testslab_init 方法用于设置本模块在 NGX_HTTP_PREACCESS_PHASE 阶段生
效，代码如下：
static ngx_int_t
ngx_http_testslab_init(ngx_conf_t *cf)
{
ngx*http_handler_pt *h;
ngx*http_core_main_conf_t *cmcf;
cmcf = ngx_http_conf_get_module_main_conf(cf, ngx_http_core_module); // 设置模块在
NGX_HTTP_PREACCESS_PHASE 阶段介入请求的处理
h = ngx_array_push(&cmcf-\>phases[NGX_HTTP_PREACCESS_PHASE].handlers); if (h == NULL) {
return NGX_ERROR;
}
// 设置请求的处理方法
*h = ngx_http_testslab_handler;
return NGX_OK;
}
这里请求的处理方法被设置为 ngx_http_testslab_handler 了，因为在 15.2.2 节中已经准备好
了 ngx_http_testslab_lookup 方法，所以它的实现就变得很简单，如下所示：
static ngx_int_t
ngx_http_testslab_handler(ngx_http_request_t *r) {
size_t len;
uint32_t hash;
ngx_int_t rc;
ngx_http_testslab_conf_t *conf;
conf = ngx_http_get_module_main_conf(r, ngx_http_testslab_module); rc = NGX_DECLINED;
// 如果没有配置
test_slab，或者
test_slab 参数错误，返回
NGX_DECLINED 继续执行下一个
http handler
if (conf-\>interval == -1)
return rc;
// 以客户端
IP 地址（
r-\>connection-\>addr_text 中已经保存了解析出的
IP 字符串）
// 和
url 来识别同一请求
len = r-\>connection-\>addr_text.len + r-\>uri.len; u_char* data = ngx_palloc(r-\>pool, len); ngx_memcpy(data, r-\>uri.data, r-\>uri.len); ngx_memcpy(data+r-\>uri.len, r-\>connection-\>addr_text.data, r-\>connection-\>addr_text.len); //
crc32 算法将
IP+URL 字符串生成
hash 码
// hash 码作为红黑树的关键字来提高效率
hash = ngx_crc32_short(data, len);
// 多进程同时操作同一共享内存，需要加锁
ngx_shmtx_lock(&conf-\>shpool-\>mutex); rc = ngx_http_testslab_lookup(r, conf, hash, data, len); ngx_shmtx_unlock(&conf-\>shpool-\>mutex); return rc;
}
最后，定义 ngx_http_testslab_module 模块：
ngx_module_t ngx_http_testslab_module =
{
NGX_MODULE_V1,
&ngx_http_testslab_module_ctx, /* module context */
ngx*http_testslab_commands, /* module directives */
NGX*HTTP_MODULE, /* module type */
NULL, /_ init master _/
NULL, /_ init module _/
NULL, /_ init process _/
NULL, /_ init thread _/
NULL, /_ exit thread _/
NULL, /_ exit process _/
NULL, /\_ exit master \*/
NGX_MODULE_V1_PADDING
};
这样，一个支持多进程间共享数据、共同限制用户请求访问速度的模块就完成了。

16.3 slab 内存管理的实现原理
怎样动态地管理内存呢？先看看需要面对的两个主要问题：

-   在时间上，使用者会随机地申请分配、释放内存；
-   在空间上，每次申请分配的内存大小也是随机的。

这两个问题将给内存分配算法带来很大的挑战：当多次分配、释放不同大小的内存后，
将不可避免地造成内存碎片，而内存碎片会造成内存浪费、执行速度变慢！常见的算法有 2
个设计方向：first-fit 和 best-fit。用最简单的实现方式来描述这 2 个算法就是：若已使用的内存
之间有许多不等长的空闲内存，那么分配内存时，first-fit 将从头遍历空闲内存块构成的链
表，当找到的第 1 块空间大于请求 size 的内存块时，就把它返回给申请者；best-fit 则不然，它
也会遍历空闲链表，但如果一块空闲内存的空间远大于请求 size，为了避免浪费，它会继续
向后遍历，看看有没有恰好适合申请大小的空闲内存块，这个算法将试图返回最适合（例如
内存块大小等于或者略大于申请 size）的内存块。这样，first-fit 和 best-fit 的优劣仿佛已一目了
然：前者分配的速度更快，但内存浪费得多；后者的分配速度慢一些，内存利用率上却更划
算。而且，前者造成内存碎片的几率似乎要大于后者。

Nginx 的 slab 内存分配方式是基于 best-fit 思路的，即当我们申请一块内存时，它只会返回
恰好符合请求大小的内存块。但是，怎样可以更快速地找到 best-fit 内存块呢？Nginx 首先有一
个假定：所有需要使用 slab 内存的模块请求分配的内存都是比较小的（绝大部分小于
4KB）。有了这个假定，就有了一种快速找到最合适内存块的方法，主要包括 5 个要点：
1）把整块内存按 4KB 分为许多页，这样，如果每一页只存放一种固定大小的内存块，
由于一页上能够分配的内存块数量是很有限的，所以可以在页首上用 bitmap 方式，按二进制
位表示页上对应位置的内存块是否在使用中。只是遍历 bitmap 二进制位去寻找页上的空闲内
存块，使得消耗的时间很有限，例如 bitmap 占用的内存空间小导致 CPU 缓存命中率高，可以
按 32 或 64 位这样的总线长度去寻找空闲位以减少访问次数等。

图 16-2 slab 内存示意图
2）基于空间换时间的思想，slab 内存分配器会把请求分配的内存大小简化为极为有限的
几种（简化的方法有很多，例如可以按照 fibonacci 方法进行），而 Nginx slab 是按 2 的倍数，
将内存块分为 8、16、32、64……字节，当申请的字节数大于 8 小于等于 16 时，就会使用 16 字
节的内存块，以此类推。所以，一种页面若存放的内存块大小为 N 字节，那么，使用者申请
的内存在 N/2+1 与 N 之间时，都将使用这种页面。这样最多会造成一倍内存的浪费，但使得
页种类大大减少了，这会降低碎片的产生，提高内存的利用率。

3）让有限的几种页面构成链表，且各链表按序保存在数组中，这样一来，用直接寻址
法就可以快速找到。在 Nginx slab 中，用 slots 数组来存放链表首页。例如，如果申请的内存大
小为 30 字节，那么根据最小的内存块为 8 字节，可以算出从小到大第 3 种内存块存放的内存大
小为 32 字节，符合要求，从 slots 数组中取第 3 个元素则可以寻找到 32 字节的页面。

4）这些页面中分为空闲页、半满页、全满页。为什么要这么划分呢？因为上述的同种
页面链表不应当包含太多元素，否则分配内存时遍历链表一样非常耗时。所以，全满页应当
脱离链表，分配内存时不应当再访问到它。空闲页应该是超然的，如果这个页面曾经为 32 字
节的内存块服务，在它又成为空闲页时，下次便可以为 128 字节的内存块服务。因此，所有
的空闲页会单独构成一个空闲页链表。这里 slots 数组采用散列表的思想，用快速的直接寻址
方式将半满页展现在使用者面前。

5）虽然大部分情况下申请分配的内存块是小于 4KB 的，但极个别可能会有一些大于
4KB 的内存分配请求，拒绝它则太粗暴了。对于此，可以用遍历空闲页链表寻找地址连续的
空闲页来分配，例如需要分配 11KB 的内存时，则遍历到 3 个地址连续的空闲页即可。

以上 5 点，就是 Nginx slab 内存管理方法的主要思想，如图 16-2 所示。

图 16-2 中，每一页都会有一个 ngx_slab_page_t 结构体描述，object 是申请分配到的内存存
放的对象，阴影方块是已经分配出的内存块，空白方块则是未分配的内存块。下面开始详细
描述 slab 算法。

16.3.1 内存结构布局
每一个 slab 内存池对应着一块共享内存，这是一段线性的连续的地址空间，这里不只是
有将要分配给使用者的应用内存，还包括 slab 管理结构，事实上从这块内存的首地址开始就
是管理结构体 ngx_slab_pool_t，我们看看它的定义：
typedef struct {
// 为下面的互斥锁成员
ngx_shmtx_t mutex 服务，使用信号量作进程同步工具时会用到它
ngx_shmtx_sh_t lock;
// 设定的最小内存块长度
size_t min_size;
// min_size 对应的位偏移，因为
slab 的算法大量采用位操作，从下面章节里可以看出先计算出
// min_shift 很有好处
size_t min_shift;
// 每一页对应一个
ngx_slab_page_t 页描述结构体，所有的
ngx_slab_page_t 存放在连续的
//内存中构成数组，而
pages 就是数组首地址
ngx_slab_page_t *pages;
// 所有的空闲页组成一个链表挂在
free 成员上
ngx_slab_page_t free;
// 所有的实际页面全部连续地放在一起，第
1 页的首地址就是
start
u_char *start;
// 指向这段共享内存的尾部
u_char *end;
// 在
14.8 节中曾介绍过
Nginx 封装的互斥锁，这里就是一个应用范例
ngx_shmtx_t mutex;
// slab 操作失败时会记录日志，为区别是哪个
slab 共享内存出错，可以在
slab 中分配一段内存存
// 放描述的字符串，然后再用
log_ctx 指向这个字符串
u_char *log_ctx;
// 实际就是
'\0'，它为上面的
log_ctx 服务，当
log_ctx 没有赋值时，将直接指向
zero，
// 表示空字符串防止出错
u_char zero;
// 由各个使用
slab 的模块自由使用，
slab 管理内存时不会用到它
void *data;
// 指向所属的
ngx_shm_zone_t 里的
ngx_shm_t 成员的
addr 成员，在
16.3.3 节再详述
void *addr;
} ngx_slab_pool_t;
从图 16-3 中可以看到，这段共享内存由前至后分为 6 个部分：

-   ngx_slab_pool_t 结构体。

-   不同种类页面的半满页链表构成的数组，下文称为 slots 数组，便于大家对照 Nginx 源
    码。将共享内存首地址加上 sizeof(ngx_slab_pool_t)即可得到 slots 数组。

-   所有页描述 ngx_slab_page_t 构成的数组，ngx_slab_pool_t 中的 pages 成员指向这个数组，
    下文简称为 pages 数组。

-   为了让地址对齐、方便对地址进行位操作而“牺牲的”不予使用的内存。

-   真实的页，页中的地址需要对齐以便进行位操作，因此其前后会有内存浪费。

ngx_slab_pool_t 中的 start 成员指向它。

-   为了地址对齐牺牲的内存。

图 16-3 中一个 slab 共享内存与 ngx_shm_zone_t 和 ngx_cycle_t 的关系将在 16.3.5 节中详述。下
面来看看 slots 数组与 pages 数组是如何工作的。

图 16-3 一个 slab 共享内存池中的内存布局
无论是 slots 数组还是 pages 数组，都是以页为单位进行的，页在 slab 管理设计中是很核心
的概念。每一页都有一个描述结构 ngx_slab_page_t 对应，下面来看看 ngx_slab_page_t 的定义
是怎样的。

typedef struct ngx*slab_page_s ngx_slab_page_t; struct ngx_slab_page_s {
// 多用途
uintptr_t slab;
// 指向双向链表中的下一页
ngx_slab_page_t *next;
// 多用途，同时用于指向双向链表中的上一页
uintptr*t prev;
};
从图 16-2 中可以看到，页分为空闲页和已使用页，而已使用页中又分为还有空闲空间可
供分配的半满页和完全分配完毕的全满页。每一页的大小由 ngx_pagesize 变量指定，同时为
方便大量的位操作，还定义了页大小对应的位移变量 ngx_pagesize_shift，如下：
ngx_uint_t ngx_pagesize;
ngx_uint_t ngx_pagesize_shift;
这两个变量可在 ngx_os_init 方法中初始化，如下：
ngx_int_t ngx_os_init(ngx_log_t \_log) {
...
ngx_pagesize = getpagesize();
for (n = ngx_pagesize; n \>\>= 1; ngx_pagesize_shift++) { /* void \_/ }
...
}
全满页和空闲页较为简单。全满页不在任何链表中，它对应的 ngx_slab_page_t 中的 next
和 prev 成员没有任何链表功能。

所有的空闲页构成 1 个双向链表，ngx_slab_pool_t 中的 free 指向这个链表。然而需要注意
的是，并不是每一个空闲页都是该双向链表中的元素，可能存在多个相邻的页面中，仅首页
面在链表中的情况，故而首页面的 slab 成员大于 1 时则表示其后有相邻的页面，这些相邻的多
个页面作为一个链表元素存在。但是，也并不是相邻的页面一定作为一个链表元素存在，如
图 16-4 所示。

在图 16-4 中，有 5 个连续的页面，左边是描述页面的 ngx_slab_page_t 结构体，右边则是真
正的页面，它们是一一对应的。其中，第 1、2、4、5 页面都是空闲页，第 3 页则是全满页。

而 free 链表的第 1 个元素是第 5 页，第 2 个元素是第 4 页，可见，虽然第 4、5 页是连续的，但
是，由于分配页面与回收页面时的时序不同，导致这第 4、5 个页面间出现了相见不相识的现
象，只能作为 2 个链表元素存在，这将会造成未来分配不出占用 2 个页面的大块内存，虽然原
本是可以分配出的。第 3 个元素是第 1 页。第 2 页附在第 1 页上，这还是与分配、回收页面的时
机有关，事实上，当 slab 内存池刚刚初始化完毕时，free 链表中只有 1 个元素，就是第 1 个页
面，该页面的 slab 成员值为总页数。第 3 页是全满页，其 next 指针是为 NULL，而 prev 也没有指
针的含义。

图 16-4 空闲页与全满页的 ngx*slab_page_t 成员意义
对于半满页，存放相同大小内存块的页面会构成双向链表，挂在 slots 数组的相应位置
上，图 16-2 中已经可以看到。那么，页面上究竟会分出多少种不同大小的内存块呢？
ngx_slab_pool_t 中的 min_size 成员已经指定了最小内存块的大小，它在初始化 slab 的方法
ngx_slab_init 中赋值：
void ngx_slab_init(ngx_slab_pool_t *pool) {
...
pool-\>min*size = 1 \<\< pool-\>min_shift; ...
}
而 min_shift 同样是为了位操作而设的，它的初始化则是将在 16.3.3 节介绍的
ngx_init_zone_pool 方法里赋值的：
static ngx_int_t
ngx_init_zone_pool(ngx_cycle_t cycle, ngx_shm_zone_t zn) {
ngx_slab_pool_t \_sp;
...
sp-\>min_shift = 3;
...
}
页面能够存放的最大内存块大小则由变量 ngx_slab_max_size 指定：
// 存放多个内存块的页面中，允许的最大内存块大小为
ngx_slab_max_size
static ngx_uint_t ngx_slab_max_size;
它的大小实际是页面大小的一半（在 ngx_slab_init 方法中设置）：
if (ngx_slab_max_size == 0) {
ngx_slab_max_size = ngx_pagesize / 2;
}
为什么是 ngx_pagesize/2 而不干脆就是 ngx_pagesize 呢？反正一个页面只存放一个内存块
也可以啊！这是因为 slab 中把不等长的内存大小分为了 4 个大类，这样分类后，可以使得
ngx_slab_page_t 的 3 个成员与实际页面的内存管理在时间和空间上更有效率。这 4 大类的定义
还需要 1 个变量 ngx_slab_exact_size 的参与，如下：
static ngx_uint_t ngx_slab_exact_size; static ngx_uint_t ngx_slab_exact_shift;
它的赋值也在 ngx_slab_init 方法中进行：
ngx_slab_exact_size = ngx_pagesize / (8 * sizeof(uintptr*t)); for (n = ngx_slab_exact_size; n \>\>= 1; ngx_slab_exact_shift++) {
/* void */
}
ngx_slab_exact_size 到底想表达什么意思呢？
其实就是，ngx_slab_page_t 的 slab 中是否可以恰好以 bitmap 的方式指明页面中所有内存块
的使用状态。例如，1 个二进制位就可以用 0 和 1 表示内存块是否被使用，slab 成员的类型是
uintptr_t，它有 sizeof(uintptr_t)个字节，每个字节有 8 位，这样按顺序 slab 就可以表示
8*sizeof(uintptr_t)个内存块。如果 1 个页面中正好可以存放这么多内存块，那么 slab 就可以只
当做 bitmap 使用，此时，该页面存放的内存块大小就是 ngx_pagesize/(8\*sizeof(uintptr_t))。以
此作为标准划分，就可以更精确地使用 slab 成员了。表 16-1 就展示了 4 类内存是怎样划分的，
以及 ngx_slab_page_t 各成员的意义。

表 16-1 4 类内存中页面描述 ngx_slab_page_t 的各成员意义
16.3.2 分配内存流程
分配内存时，主要涉及在半满面上分配和从空闲页上分配新页，并初始化这 2 个流程，
而半满页分配又涉及在 bitmap 上查找空闲块，对于小块、中等、大块内存这三种页面而言，
其 bitmap 放置的位置并不相同，图 16-5 主要说明了以上内容，下面详细解释图中的 15 个步
骤。

1）如果用户申请的内存 size 大于前文介绍过的 ngx_slab_max_size 变量，则认为需要按页
面来分配内存，此时跳转到步骤 2；否则，由于一个页面可以存放多个内存块，因此需要考
虑 bitmap，此时跳转到步骤 6 继续执行。

2）判断需要分配多少个页面才能存放 size 字节，不足 1 页时按 1 页算。如下：
ngx_uint_t pages = (size \>\> ngx_pagesize_shift) + ((size % ngx_pagesize) ?1 : 0)

图 16-5 分配 slab 内存的流程
3）遍历 free 空闲页链表，找到能够容纳下 size 的连续页面。如果只需要分配 1 页，那么很
简单，只要遍历到空闲页就可以结束；但如果要分配多页，free 链表中的每个页描述
ngx*slab_page_t 中的 slab 指明了其后连续的空闲页数，所以获取多个连续页面时，只要查找
free 链表中每个元素的 slab 是否大于等于 pages 页面数即可。下面针对分配页面的
ngx_slab_alloc_pages 方法进行说明：
static ngx_slab_page_t *
ngx*slab_alloc_pages(ngx_slab_pool_t \_pool, ngx_uint_t pages) {
ngx_slab_page_t page, p;
// 遍历
free 空闲页链表，参见图
16-4
for (page = pool-\>free.next; page != &pool-\>free; page = page-\>next) {
// 表明连续页面数足以容纳
size 字节
if (page-\>slab \>= pages) {
// 如果链表中的这个页描述指明的连续页面数大于要求的
pages，只取所需即可，
// 将剩余的连续页面数仍然作为一个链表元素放在
free 池中
if (page-\>slab \> pages) {
// page[pages]是这组连续页面中，第
1 个不被使用到的页，所以，
// 将由它的页描述
ngx_slab_page_t 中的
slab 来表明后续的连续页数
page[pages].slab = page-\>slab - pages; // 接下来将剩余的连续空闲页的第
1 个页描述
page[pages]作为
// 链表元素插入到
free 链表中，取代原先所属的
page 页描述
// 将
page[pages]的链表指向当前链表元素的前后元素
page[pages].next = page-\>next; page[pages].prev = page-\>prev; // 将链表的上一个元素指向
page[pages]
p = (ngx_slab_page_t *) page-\>prev; p-\>next = &page[pages]; // 将链表的下一个元素指向
page[pages]
page-\>next-\>prev = (uintptr*t) &page[pages]; } else {
// slab 等于
pages 时，直接将
page 页描述移出
free 链表即可
p = (ngx_slab_page_t *) page-\>prev; p-\>next = page-\>next;
page-\>next-\>prev = page-\>prev; }
// 这段连续页面的首页描述的
slab 里，高
3 位设
NGX_SLAB_PAGE_START
page-\>slab = pages | NGX_SLAB_PAGE_START; // 不在链表中
page-\>next = NULL;
// prev 定义页类型：存放
size\>=ngx_slab_max_size 的页级别内存块
page-\>prev = NGX_SLAB_PAGE;
if (--pages == 0) {
// 如果只分配了
1 页，此时就可以返回
page 了
return page;
}
// 如果分配了连续多个页面，后续的页描述也需要初始化
for (p = page + 1; pages; pages--) {
// 连续页作为一个内在块一起分配出时，非第
1 页的
slab 都置为
NGX_SLAB_PAGE_BUSY
p-\>slab = NGX_SLAB_PAGE_BUSY; p-\>next = NULL;
p-\>prev = NGX_SLAB_PAGE;
p++;
}
// 连续的各个页描述都初始化完成后，返回页
page
return page;
}
}
// 没有找到符合要求的页面，返回
NULL
return NULL;
}
介绍完 ngx_slab_alloc_pages 方法可知，如果找到符合要求的页面，那么跳到第 5 步，返
回页面的首地址即可；没有找到这样的页面，跳到第 4 步返回 NULL。

4）返回 NULL，表明分配不出新内存，OutOfMemory。

5）返回可以使用的内存块首地址。

6）slab 页面上允许存放的内存块以 8 字节起步，若字节数在 ngx_slab_max_size 以内时是
按 2 的倍数递增的，那么这与第 2 步按页分配时是不同的，按页分配时最多浪费 ngx_pagesize-1
字节的内存，例如分配 4097 字节时必须返回 2 个连续页；而按 2 的倍数分配时，则最多会浪费
size-2 字节内存，例如分配 9 字节时应返回 16 字节的内存块，浪费了 7 个字节。

此时 size 小于 ngx_slab_max_size，因此要依据 best-fit 原则找一个恰好能放下 size 的内存块
大小。

7）取出所有半满页链表构成的 slots 数组，由于链表是以内存块从小到大以 2 的整数倍按
序放在数组中的，所以使用直接寻址的方式找到第 6 步指示的内存块所属半满页链表。

8）遍历半满页链表。如果没有找到半满页，则跳到第 12 步去分配新页存放该内存块；
找到一个半满页，则继续执行第 9 步。

9）根据表 16-1 可知，当内存块小于 ngx_slab_max_size 时，每页都必须使用 bitmap 来标识
内存块的使用状况。而依据 bitmap 的存放位置不同，又分为小块、中等、大块内存。此时，
需要根据第 6 步算出的内存块大小，先找到 bitmap 的位置，再遍历它找到第 1 个空闲的内存
块。如果找到空闲内存块，则继续执行第 10 步；否则，这个半满面就名不符实了，它实际上
就是一个全满页，所以可以脱离半满页链表了，继续第 8 步遍历链表。

10）首先将找到的空闲内存块对应的 bitmap 位置为 1，以示内存块在使用中。接着，检
查这是否为当前页的最后一个空闲内存块，如果是，则半满页变为全满页，跳到第 11 步执
行；否则，直接跳到第 5 步，返回这个内存块地址。

11）将页面分离出半满页链表，再跳转到第 5 步。

12）未找到半满页，需要从 free 空闲页链表中申请出新的一页，参见第 3 步介绍过的
ngx_slab_alloc_pages 方法，如果未分配出新页，跳到第 4 步返回 NULL。

13）设置新页面存放的内存块长度为第 6 步指定的值。同时设置它的页描述的 prev 成员
低位，指明它是小块、中等还是大块内存块页面。

14）新页面分配出了第 1 个内存块，对于中等、大块内存页来说，置 bitmap 第 1 位为 1 即
可，但对于小块内存页，由于它的前几个内存块是用于 bitmap 的，因此不能再次被使用，所
以对应的 bit 位需要置为 1，并把下一个表明当前分配出的内存块的 bit 位也置为 1。

15）这个新页面由空闲页变为半满页，因此将页面插入半满页链表的首部。

16.3.3 释放内存流程
释放内存时不需要遍历链表、bitmap，所以速度更快。图 16-6 说明了释放内存的完整流
程。

释放内存的流程如图 16-6 所示。

1）首先判断释放的内存块地址是否合法，依据为是否在 ngx*slab_pool_t 的 start、end 成员
指示的页面区之间。如果不合法，直接结束释放流程，例如：
void ngx_slab_free_locked(ngx_slab_pool_t pool, void p) {
if ((u_char ) p \< pool-\>start || (u_char ) p \> pool-\>end) {
// p 地址非法
...
2）从待释放的内存块地址 p 可以快速得到它所属的页描述结构体，如下：
ngx_uint_t n = ((u_char *) p - pool-\>start) \>\> ngx*pagesize_shift; ngx_slab_page_t * page = &pool-\>pages[n];
page 变量就是页描述结构体，在 16.3.4 节会详细介绍类似地址位运算。

3）根据页描述结构体的 prev 成员，得到该页面是用于小块、中等、大块的内存，或者
按页分配的内存。因为存放小块、中等、大块内存的页面含有 bitmap，这样的页面处理时要
再次核实 bitmap 中 p 对应的 bit 位是否为 1，防止重复释放，此时跳到第 5 步执行；如果 p 当初是
按页分配的，不需要考虑 bitmap，释放起来更简单，继续执行第 4 步。

4）由页描述的 slab 成员可以获得当前使用的内存究竟占用了多少页（参考图 16-5 的第 3
步），如下：
ngx_uint_t pages = slab & ~NGX_SLAB_PAGE_START
接着，跳到第 11 步调用 ngx_slab_free_pages 释放这 pages 个页面。

5）这个页面存放了多个内存块，参考表 16-1 可知，从页描述的 slab 成员可以获取这个页
面存放多大的内存块。

6）用页大小除以内存块大小，可以得到需要多少个 bit 位来存放 bitmap。再根据地址 p 与
页面首地址的相对偏移量，计算出 p 对应的内存块占用了 bitmap 中的哪个 bit 位。

图 16-6 释放 slab 内存的流程
7）检查 bitmap 中该内存块对应的 bit 位是否为 1。如果是 1，那么执行第 8 步继续释放；否
则，可以认为当前是在释放一个已经被释放的内存，结束释放流程。

8）将这个 bit 位由 1 改为 0，这样如果原先这是一个全满页，就会变为半满页，执行第 9
步；否则，直接执行第 10 步。

9）当前页面既然由全满页变为半满页，就必须插入 slots 中的半满页链表，供下次分配
内存时使用。

10）检查 bitmap 中是否还有值为 0 的 bit 位，判断当前页是否变为空闲页，如果变成了空
闲页，则执行第 11 步将它加入到 free 链表中。

11）回收页面，ngx*slab_free_pages 方法负责将这些页面插入到 free 链表中，我们看看它
的实现是怎样的：
static void
ngx_slab_free_pages(ngx_slab_pool_t pool, ngx_slab_page_t page, ngx_uint_t pages)
{
ngx_slab_page_t \_prev;
// page 将会加入到
free 链表中，连续页面数为
pages，所以把
slab 置为
pages
page-\>slab = pages--;
// 除了
page 本身，检查其后是否还有页面
if (pages) {
// 将紧邻的页面描述结构体所有成员置为
0
ngx_memzero(&page[1], pages * sizeof(ngx_slab_page_t)); }
...
// 将释放的首页
page 的页描述插入到
free 链表的首部
page-\>prev = (uintptr_t) &pool-\>free; page-\>next = pool-\>free.next;
page-\>next-\>prev = (uintptr_t) page; pool-\>free.next = page;
}
16.3.4 如何使用位操作
本节以较为复杂的小块内存页为例，介绍如何使用位操作来加速分配、释放内存，方便
读者朋友阅读晦涩的位操作部分源代码。

除了 NGX_SLAB_PAGE 类型的页面，每个页面都可以存放多个内存块。这样，每个页面
都需要有一个 bitmap 来表示每一个内存块究竟是被使用的还是空闲的。然而，如果一个页面
存放的内存块大小小于 ngx_slab_exact_size，那么一个 uintptr_t 是存放不下 bitmap 的。这时，将
会使用页面里的前几个内存块充当 bitmap，如图 16-7 所示。

实际上图 16-7 描述了一种在小块内存半满页上分配内存的场景。下面简要地用源码中用
到的各种位操作来描述这一过程。

图 16-7 小块内存页面的 bitmap 会直接占用页面中的内存
用户在 ngx*slab_alloc 方法中申请 size_t size 大小的内存，而 slab 中是按 2 的幂来决定页面
能够存放的内存块大小的。哪一种大小的内存块恰好能够容纳 size 字节呢？很简单，如下所
示：
ngx_uint_t shift=1;
size_t s;
for (s = size - 1; s \>\>= 1; shift++) { /* void _/ }
这样，我们获得了位操作必需的、恰好容纳 size 字节的内存块的偏移量 shift。除此以
外，还需要拿到 slots 数组，这里放置了半满页构成的链表，从共享首地址数起，加上
sizeof(ngx_slab_pool_t)字节即可拿到，如下所示：
ngx_slab_pool_t \_pool;
...
ngx_slab_page_t slots = (ngx_slab_page_t ) ((u_char _) pool + sizeof(ngx_slab_pool_t));
slots 数组中按照内存块大小的顺序（从小到大），依次存放了各种等长块页面构成的半
满页链表。选用哪一个 slots 数组呢？用 shift 偏移减去表达最小块的 min_shift 成员即可：
ngx_uint_t slot = shift - pool-\>min_shift; ngx_slab_page_t \*page = slots[slot].next;
这样，page 就将是一个半满页。如果 slots 中没有半满页，那么 page 是 NULL。图 16-5 中描
述的场景是含有半满页的，所以下面继续基于这个假定进行说明。

接着，我们发现用户希望分配的内存块大小是小于 ngx_slab_exact_size 的，此时，首先要
找到 bitmap 的初始位置，准备按位来查找到空闲块。bitmap 其实就在页面的首地址上，怎样
用位操作快速找到页面呢？从图 16-5 中可以看到 ngx_slab_pool_t 的 pages 指针和 start 指针，它
们是关键！
上面找到的 page 是半满页的 ngx_slab_page_t 描述结构体的首地址，用它减去 pages 就可以
得到该页面在整个 slab 中是第 N 个页面（这 2 个相减的变量都是 ngx_slab_page_t*类型）。start
是对齐后 slab 第 1 个页面的起始地址，所以，start 加上 N*pagesize 就可以得到该半满页的实际
页面首地址，如下所示：
uintptr_t p = (page - pool-\>pages) \<\< ngx_pagesize_shift; uintptr_t* bitmap = (uintptr_t *) (pool-\>start + p);
这样，bitmap 变量将指向 bitmap 的首地址，同时也指向第 1 个页面。对于小块内存来说，
1 个 uintptr_t 类型是注定存放不下 bitmap 的。到了按位比较找到空闲块的时候了，然而为了加
快运算速度，我们并不能总按照二进制位来循环进行，可以先用 uintptr_t 类型快速与
0xffffffffffffffff（下文的 NGX_SLAB_BUSY 宏）比较，如果相等则说明没有空闲块，而不等时
才有必要按二进制位慢慢地找出那个空闲块。所以，现在我们有必要知道，多少个 uintptr_t
类型可以完整地表达该页面的 bitmap？用页面大小除以块大小可以知道页面能存放多少个
块，除以 8 就可以知道需要多少字节来存放 bitmap，再除以 sizeof(uintptr_t)就可以知道需要多
少个 uintptr_t 来存放 bitmap。实际上，这一系列操作下面这行语句就可以做到：
ngx_uint_t map = (1 \<\< (ngx_pagesize_shift - shift)) / (sizeof(uintptr_t) \* 8);
这里避免了更慢的除法，这就是位操作的优势！map 就是 bitmap 需要的总 uintptr_t 数。下
面我们看看怎样在一个存放小块内存的半满面中，根据 bitmap 的位操作快速找到空闲块。

// 共需要
map 个
uintptr_t 才能表达完整的
bitmap
for (uintptr_t n = 0; n \< map; n++) {
// 通过用
uintptr_t 与
NGX_SLAB_BUSY 比较，快速
pass 掉全满的
uintptr_t
if (bitmap[n] != NGX_SLAB_BUSY) {
// 确认当前
bitmap[n]上有空闲块，再一位一位的查找
for (uintptr_t m = 1, i = 0; m; m \<\<= 1, i++) {
// 这个位如果是
1 则表示内存块已被使用，继续循环遍历
if ((bitmap[n] & m)) {
continue;
}
// 既然找到了空闲位，先把这个位从
0 置为
1
bitmap[n] |= m;
// 那么，当前的这个
bit 到底对应着该页面的第几个内存块呢？从
n 和
i 即可得到，
// n*sizeof(uintptr_t)*8+i。再使用
\<\<shift 即可得到该内存块在页面上的字节偏移量
i = ((n sizeof(uintptr_t) 8) \<\< shift) + (i \<\< shift); // p 就是那个空闲块的首地址，用
bitmap 加上字节偏移
i 得到
p = (uintptr_t) bitmap + i;
// 后续还有操作，例如判断如果页面由半满变为全满，则脱离链表
...
}
}
}
如果没有半满页，则需要从 free 空闲链表中分配出 1 页，再初始化该页中的 bitmap。我们
来看看源码中是怎样用位操作为初始化 bitmap 的。

// page 是从
free 空闲链表中新分配出的页面，用其与
pages 数组相减后即可得到是第几个页面，
// 再左移
ngx*pagesize_shift 即表示从
start 起到实际页面的字节偏移量
p = (page - pool-\>pages) \<\< ngx_pagesize_shift; // bitmap 既是页面的首地址，也是
bitmap 的起始
bitmap = (uintptr_t *) (pool-\>start + p);
// s 为该页存放的块大小
s = 1 \<\< shift;
// n 表示需要多少个内存块才能放得下整个
bitmap
n = (1 \<\< (ngx*pagesize_shift - shift)) 8 s; if (n == 0) {
n = 1;
}
// 因为前
n 个内存块已经用于
bitmap 了，它们不可以再被使用，所以置这些内存块对应的
bit 位为
1。因为
// bitmap 这里占用的内存块数，不可能连
1 个
uintptr_t 都放不下，所以只需要设置第
1 个
uintptr_t 即可
bitmap[0] = (2 \<\< n) - 1;
// map 表示需要多少个
uintptr_t 才能放得下整个
bitmap
map = (1 \<\< (ngx_pagesize_shift - shift)) / (sizeof(uintptr_t) * 8); for (i = 1; i \< map; i++) {
// 设置剩余的
bit 位为
0
bitmap[i] = 0;
}
// 根据前述
s 和
n 的意义，可知
s\*n 就是在这个页面里，第
1 个可以使用的空闲块的偏移字节数。

// 再加上该页面与
start 间的偏移量，
p 就是空闲块与
start 间的偏移量
p = ((page - pool-\>pages) \<\< ngx_pagesize_shift) + s \* n; // 于是得到该空闲块的首地址
p += (uintptr_t) pool-\>start;
而释放内存块时，位操作依然可以大大加速执行时间。

void ngx*slab_free_locked(ngx_slab_pool_t pool, void p) {
// 内存块指针
p 与
start 之间的偏移字节数，除以页面字节数的结果取整，就是
p 所在的页面在所有
// 页面中的序号
ngx_uint_t n = ((u_char *) p - pool-\>start) \>\> ngx*pagesize_shift; // 根据
n 就取到了
p 所在页面的
ngx_slab_page_t 页面描述结构体
ngx_slab_page_t * page = &pool-\>pages[n]; // 找到页面对应的
slab
uintptr_t slab = page-\>slab;
// slab 的低
NGX_SLAB_PAGE_MASK 位存放的是页面类型
ngx_uint_t type = page-\>prev & NGX_SLAB_PAGE_MASK; ...
}
拿到了 type 后，需要对 4 种页面区别对待。仍然以小块内存举例：
// 对于小块内存，
slab 的低
NGX_SLAB_SHIFT_MASK 位存放了内存块大小，
shift 变量取出了块大小的位移量
shift = slab & NGX_SLAB_SHIFT_MASK;
// size 取得的块大小
size = 1 \<\< shift;
// 把内存块的首地址
p 按页大小取余数，就是
p 相对于该页面首地址的偏移字节，再除以块大小，
// 那么
n 就是该内存块在页面中的序号
n = ((uintptr_t) p & (ngx_pagesize - 1)) \>\> shift; // 现在把
n 这个序号应用于
bitmap。

bitmap 可能由多个
uintptr*t 组成，而
n 从属于某一个
uintptr_t，
// 先把
n 求得
uintptr_t 中的余数表明这个内存块对应的
bit 位，在其所属的
uintptr_t 里的序号，
// 并把
1 左移这些位，这样，
m 就是
p 内存块
bit 位所在
uintptr_t 中的位
m = (uintptr_t) 1 \<\< (n & (sizeof(uintptr_t) * 8 - 1)); // n 再除以
uintptr*t 能够表达的
bit 位，此时表示
p 内存块对应的那个
bit 位前还有
n 个表示
bitmap
// 的
uintptr_t
n /= (sizeof(uintptr_t) * 8);
// 把
p 的相当于一页的低位去掉，此时
bitmap 就是该页面的首地址，也是所有
bitmap 的起始地址
bitmap = (uintptr_t \*) ((uintptr_t) p & ~(ngx_pagesize - 1)); // 用
bitmap[n]与
m 相与，可以再次确认
p 相对应的内存块是否是在使用中，如果没有在使用中，
// 就是两次释放了
if (bitmap[n] & m) {
// 释放该内存块，其实就是把
bit 位从
1 置为
0
bitmap[n] &= ~m;
// 下面还要检查当前页面是否完全没有已使用内存块了，如果是这样，需要回收该页
...
}
对于中等内存块、大块内存块页面来说，由于 bitmap 是放在 slab 成员中的，所以位操作
会更简单，这里就略过。

16.3.5 slab 内存池间的管理
Nginx 允许多个模块各自独立地定义 slab 内存池，这意味着可以并存多个 slab 内存池。同
时，Nginx 允许模块 A 定义的内存池被模块 B 使用，这样内存池间必须被管理起来。描述整个
Nginx 的 ngx_cycle_s 结构体中有一个链表，保存着所有的 slab 内存池，如下所示：
struct ngx_cycle_s {
ngx_list_t shared_memory;
}
shared_memory 以链表的方式保存着 ngx_shm_zone_t 结构体。前面在 16.1 节中就介绍过这
个结构体，它对应着 1 个 slab 共享内存池。ngx_shm_zone_t 具有自己的名字，还可以定义自己
仅能够被某个模块使用（tag 成员）。ngx_shared_memory_add 方法就是在向 shared_memory 链
表中添加描述一个 slab 内存池的 ngx_shm_zone_t 结构体，在 ngx_init_cycle 方法中，Nginx 会遍
历 shared_memory 链表，依次地初始化每一个 slab 内存池。

16.4 小结
本章首先介绍使用 slab 内存池的方法，并以一个有代表性的例子介绍使用它的方法，读
者朋友可以结合访问本书网站上可以运行的示例代码来阅读。

接着，我们开始剖析它的实现，slab 也是 Linux 内核中一种优秀的内存管理机制，理解其
设计思想不只有助于开拓思路，更可以改进它。例如，slab 内存池其实对于大于 4KB 的内存
的使用很不友好，在持续的分配释放中，连续着的空闲页会越来越少，尤其是有些空闲页明
明是连续的，但是可能也认为它们是分离的，就像图 16-4 中的例子那样。又比如，假定我们
申请的内存基本都是在 4KB 以上的，这就不能再使用操作系统的页大小作为内存池的页大小
了，可以通过增加页的大小以提高内存的使用率（注意：这可能导致 ngx_slab_page_t 页描述
的 slab 成员中存放的内存块大小位移超出 NGX_SLAB_SHIFT_MASK，需要综合考虑）。

另外，slab 的源码体现了极为优秀的编码艺术，大量的位操作极大地提高了效率，非常
值得 C 程序员们认真学习。
