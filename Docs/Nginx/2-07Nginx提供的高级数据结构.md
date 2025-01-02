## 第 7 章 Nginx 提供的高级数据结构

任何复杂的程序都需要用到数组、链表、树等数据结构，这些容器可以让用户忽略底层细节，快速开发出各种高级数据结构、实现复杂的业务功能。在开发 Nginx 模块时，同样也需要这样的高级通用容器。然而，Nginx 有两个特点：跨平台、使用 C 语言实现，这两个特点导致 Nginx 不宜使用一些第三方中间件提供的容器和算法。跨平台意味着 Nginx 必须可以运行在 Windows、Linux 等许多主流操作系统上，因此，Nginx 的所有代码都必须可以跨平台编译、运行。另外，Nginx 是由 C 语言开发的。虽然所有的操作系统都支持 C 语言，但是 C 语言与每一个操作系统都是强相关的，且 C 库对操作系统的某些系统调用封装的方法并不是跨平台的。

对于这种情况，Nginx 的解决方法很简单，在这些必须特殊化处理的地方，对每个操作系统都给一份特异化的实现，因此，用户在下载 Nginx 源码包时会发现有 Windows 版本和 UNIX 版本。而对于基础的数据结构和算法，Nginx 则完全从头实现了一遍，如动态数组、链表、二叉排序树、散列表等。当开发功能复杂的模块时，如果需要使用这些数据结构，不妨使用它们来加快开发速度，这些数据结构的好处是完全使用 C 语言从头实现，运行效率非常高，而且它们是可以跨平台使用的，在主流操作系统上都可以正常的工作。

当然，由于这些基础数据结构的跨平台特性、C 语言面向过程的特点、不统一的使用风格以及几乎没有注释的 Nginx 源代码，造成了它们并不容易使用，本章将会详细阐述它们的设计目的、思想、使用方法，并通过例子形象地展示这些容器的使用方式。

### 7.1 Nginx 提供的高级数据结构概述

本章将介绍 Nginx 实现的 6 个基本容器，熟练使用这 6 个基本容器，将会大大提高开发 Nginx 模块的效率，也可以更加方便地实现复杂的功能。

ngx_queue_t 双向链表是 Nginx 提供的轻量级链表容器，它与 Nginx 的内存池无关，因此， 这个链表将不会负责分配内存来存放链表元素。这意味着，任何链表元素都需要通过其他方式来分配它所需要的内存空间，不要指望 ngx_queue_t 帮助存储元素。ngx_queue_t 只是把这些已经分配好内存的元素用双向链表连接起来。ngx_queue_t 的功能虽然很简单，但它非常轻量级，对每个用户数据而言，只需要增加两个指针的空间即可，消耗的内存很少。同时， ngx_queue_t 还提供了一个非常简易的插入排序法，虽然不太适合超大规模数据的排序，但它胜在简单实用。ngx_queue_t 作为 C 语言提供的通用双向链表，其设计思路值得用户参考。

ngx_array_t 动态数组类似于 C++语言 STL 库的 vector 容器，它用连续的内存存放着大小相同的元素（就像数组），这使得它按照下标检索数据的效率非常高，可以用 O(1)的时间来访问随机元素。相比数组，它的优势在于，数组通常是固定大小的，而 ngx_array_t 可以在达到容量最大值时自动扩容（扩容算法与常见的 vector 容器不同）。ngx_array_t 与 ngx_queue_t 的一个显著不同点在于，ngx_queue_t 并不负责为容器元素分配内存，而 ngx_array_t 是负责容器元素的内存分配的。ngx_array_t 也是 Nginx 中应用非常广泛的数据结构，本章介绍的支持通配符的散列表中就有使用它的例子。

ngx_list_t 单向链表与 ngx_queue_t 双向链表是完全不同的，它是负责容器内元素内存分配的，因此，这两个容器在通用性的设计思路上是完全不同的。同时它与 ngx_array_t 也不一样，它不是用完全连续的内存来存储元素，而是用单链表将多段内存块连接起来，每段内存块也存储了多个元素，有点像“数组+单链表”。在 3.2.3 节中已经详细介绍过 ngx_list_t 单向链表，本章不再赘述。

ngx_rbtree_t（红黑树）是一种非常有效的高级数据结构，它在许多系统中都作为核心数据结构存在。它在检索特定关键字时不再需要像以上容器那样遍历容器，同时，ngx_rbtree_t 容器在检索、插入、删除元素方面非常高效，且其针对各种类型的数据的平均时间都很优异。与散列表相比，ngx_rbtree_t 还支持范围查询，也支持高效地遍历所有元素，因此， Nginx 的核心模块是离不开 ngx_rbtree_t 容器的。同时，一些较复杂的 Nginx 模块也都用到了 ngx_rbtree_t 容器。用户在需要用到快速检索的容器时，应该首先考虑是不是使用 ngx_rbtree_t。

ngx_radix_tree_t 基数树与 ngx_rbtree_t 红黑树一样都是二叉查找树，ngx_rbtree_t 红黑树具备的优点，ngx_radix_tree_t 基数树同样也有，但 ngx_radix_tree_t 基数树的应用范围要比 ngx_rbtree_t 红黑树小，因为 ngx_radix_tree_t 要求元素必须以整型数据作为关键字，所以大大减少了它的应用场景。然而，由于 ngx_radix_tree_t 基数树在插入、删除元素时不需要做旋转操作，因此它的插入、删除效率一般要比 ngx_rbtree_t 红黑树高。选择使用哪种二叉查找树取决于实际的应用场景。不过，ngx_radix_tree_t 基数树的用法要比 ngx_rbtree_t 红黑树简单许多。

支持通配符的散列表是 Nginx 独创的。Nginx 首先实现了基础的常用散列表，在这个基础上，它又根据 Web 服务器的特点，对于 URI 域名这种场景设计了支持通配符的散列表，当然，只支持前置通配符和后置通配符，如www.test.\*和\*.test.com。Nginx对于这种散列表做了非常多的优化设计，它的实现较为复杂。在 7.7 节中，将会非常详细地描述它的实现，当然，如果只是使用这种散列表，并不需要完全看懂 7.7 节，可以只看一下 7.7.3 节的例子，这将会简单许多。不过，要想能够灵活地修改 Nginx 的各种使用散列表的代码，还是建议读者仔细阅读一下 7.7 节的内容。

### 7.2 ngx_queue_t 双向链表

ngx_queue_t 是 Nginx 提供的一个基础顺序容器，它以双向链表的方式将数据组织在一起。在 Nginx 中，ngx_queue_t 数据结构被大量使用，下面将详细介绍它的特点、用法。

#### 7.2.1 为什么设计 ngx_queue_t 双向链表

链表作为顺序容器的优势在于，它可以高效地执行插入、删除、合并等操作，在移动链表中的元素时只需要修改指针的指向，因此，它很适合频繁修改容器的场合。在 Nginx 中， 链表是必不可少的，而 ngx_queue_t 双向链表就被设计用于达成以上目的。

相对于 Nginx 其他顺序容器，ngx_queue_t 容器的优势在于：

-   实现了排序功能。
-   它非常轻量级，是一个纯粹的双向链表。它不负责链表元素所占内存的分配，与 Nginx 封装的 ngx_pool_t 内存池完全无关。
-   支持两个链表间的合并。

ngx_queue_t 容器的实现只用了一个数据结构 ngx_queue_t，它仅有两个成员：prev、 next，如下所示：

```C
typedef struct ngx_queue_s ngx_queue_t;
struct ngx_queue_s {
ngx_queue_t prev;
ngx_queue_t next;
};
```

因此，对于链表中的每个元素来说，空间上只会增加两个指针的内存消耗。

使用 ngx_queue_t 时可能会遇到有些让人费解的情况，因为链表容器自身是使用 ngx_queue_t 来标识的，而链表中的每个元素同样使用 ngx_queue_t 结构来标识自己，并以 ngx_queue_t 结构维持其与相邻元素的关系。下面开始介绍 ngx_queue_t 的使用方法。

#### 7.2.2 双向链表的使用方法

Nginx 在设计这个双向链表时，由于容器与元素共用了 ngx_queue_t 结构体，为了避免 ngx_queue_t 结构体成员的意义混乱，Nginx 封装了链表容器与元素的所有方法，这种情况非常少见，而且从接下来的几节中可以看到，其他容器都需要直接使用成员变量来访问，唯有 ngx_queue_t 双向链表只能使用图 7-1 中列出的方法访问容器。

图 7-1 ngx_queue_t 容器提供的操作方法

使用双向链表容器时，需要用一个 ngx_queue_t 结构体表示容器本身，而这个结构体共有 12 个方法可供使用，表 7-1 中列出了这 12 个方法的意义。

表 7-1 ngx_queue_t 双向链表容器所支持的方法

对于链表中的每一个元素，其类型可以是任意的 struct 结构体，但这个结构体中必须要有一个 ngx_queue_t 类型的成员，在向链表容器中添加、删除元素时都是使用的结构体中 ngx_queue_t 类型成员的指针。当 ngx_queue_t 作为链表的元素成员使用时，它具有表 7-2 中列出的 4 种方法。

表 7-2 ngx_queue_t 双向链表中的元素所支持的方法

在表 7-1 和表 7-2 中，已经列出了链表支持的所有方法，下面将以一个简单的例子来说明如何使用 ngx_queue_t 双向链表。

#### 7.2.3 使用双向链表排序的例子

本节定义一个简单的链表，并使用 ngx_queue_sort 方法对所有元素排序。在这个例子中， 可以看到如何定义、初始化 ngx_queue_t 容器，如何定义任意类型的链表元素，如何遍历链表，如何自定义排序方法并执行排序。

首先，定义链表元素的结构体，如下面的 TestNode 结构体：

```C
typedef struct {
u_char* str;
ngx_queue_t qEle;
int num;
} TestNode;
```

链表元素结构体中必须包含 ngx_queue_t 类型的成员，当然它可以在任意的位置上。本例中它的上面有一个 char\*指针，下面有一个整型成员 num，这样是允许的。

排序方法需要自定义。下面以 TestNode 结构体中的 num 成员作为排序依据，实现 compTestNode 方法作为排序过程中任意两元素间的比较方法。

```C
ngx_int_t compTestNode(const ngx_queue_t *a, const ngx_queue_t *b)
{
  /*首先使用 ngx*queue_data 方法由 ngx_queue_t 变量获取元素结构体 TestNode 的地址 */
  TestNode aNode = ngx_queue_data(a, TestNode, qEle);
  TestNode* bNode = ngx_queue_data(b, TestNode, qEle);
  // 返回 num 成员的比较结果
  return aNode-\>num \> bNode-\>num;
}
```

这个比较方法结合 ngx_queue_sort 方法可以把链表中的元素按照 num 的大小以升序排列。

在此例中，可以看到 ngx_queue_data 的用法，即可以根据链表元素结构体 TestNode 中的 qEle 成员地址换算出 TestNode 结构体变量的地址，这是面向过程的 C 语言编写的 ngx_queue_t 链表之所以能够通用化的关键。下面来看一下 ngx_queue_data 的定义：

```C
define ngx_queue_data(q,type,link) \
(type ) ((u_char ) q - offsetof(type, link))
```

在 4.2.2 节中曾经提到过 offsetof 函数是如何实现的，即它会返回 link 成员在 type 结构体中的偏移量。例如，在上例中，可以通过 ngx_queue_t 类型的指针减去 qEle 相对于 TestNode 的地址偏移量，得到 TestNode 结构体的地址。

下面开始定义双向链表容器 queueContainer，并将其初始化为空链表，如下所示。

```C
ngx_queue_t queueContainer;
ngx_queue_init(&queueContainer);
```

链表容器以 ngx_queue_t 定义即可。注意，对于表示链表容器的 ngx_queue_t 结构体，必须调用 ngx_queue_init 进行初始化。

ngx_queue_t 双向链表是完全不负责分配内存的，每一个链表元素必须自己管理自己所占用的内存。因此，本例在进程栈中定义了 5 个 TestNode 结构体作为链表元素，并把它们的 num 成员初始化为 0、1、2、3、4，如下所示。

```C
int i = 0;
TestNode node[5];
for (; i < 5; i++)
{
  node[i].num = i;
}
```

下面把这 5 个 TestNode 结构体添加到 queueContainer 链表中，注意，这里同时使用了 ngx_queue_insert_tail、ngx_queue_insert_head、ngx_queue_insert_after 3 个添加方法，读者不妨思考一下链表中元素的顺序是什么样的。

```C
ngx_queue_insert_tail(&queueContainer, &node[0].qEle);
ngx_queue_insert_head(&queueContainer, &node[1].qEle);
ngx_queue_insert_tail(&queueContainer, &node[2].qEle);
ngx_queue_insert_after(&queueContainer, &node[3].qEle);
ngx_queue_insert_tail(&queueContainer, &node[4].qEle);
```

根据表 7-1 中介绍的方法可以得出，如果此时的链表元素顺序以 num 成员标识，那么应该是这样的：3、1、0、2、4。如果有疑问，不妨写个遍历链表的程序检验一下顺序是否如此。下面就根据表 7-1 中的方法说明编写一段简单的遍历链表的程序。

```C
ngx_queue_t* q;
for (q = ngx_queue_head(&queueContainer);
q != ngx_queue_sentinel(&queueContainer);
q = ngx_queue_next(q))
{
    TestNode* eleNode = ngx_queue_data(q, TestNode, qEle);
    // 处理当前的链表元素
    eleNode
    …
}
```

上面这段程序将会依次从链表头部遍历到尾部。反向遍历也很简单。读者可以尝试使用 ngx_queue_last 和 ngx_queue_prev 方法编写相关代码。

下面开始执行排序，代码如下所示。

```C
ngx_queue_sort(&queueContainer, compTestNode);
```

这样，链表中的元素就会以 0、1、2、3、4（num 成员的值）的升序排列了。

表 7-1 中列出的其他方法就不在这里一一举例了，使用方法非常相似。

#### 7.2.4 双向链表是如何实现的

本节将说明 ngx_queue_t 链表容器以及元素中 prev 成员、next 成员的意义，整个链表就是通过这两个指针成员实现的。

下面先来看一下 ngx_queue_t 结构体作为容器时其 prev 成员、next 成员的意义。当容器为空时，prev 和 next 都将指向容器本身，如图 7-2 所示。

如图 7-2 所示，如果在某个结构体中定义了 ngx_queue_t 容器，其 prev 指针和 next 指针都会指向 ngx_queue_t 成员的地址。

图 7-2 空容器时 ngx_queue_t 结构体成员的值当容器不为空时，ngx_queue_t 容器的 next 指针会指向链表的第 1 个元素，而 prev 指针会指向链表的最后 1 个元素。如图 7-3 所示，这时链表中只有 1 个链表元素，容器的 next 指针和 prev 指针都将指向这个唯一的链表元素。

图 7-3 当仅含 1 个元素时，容器、元素中的 ngx_queue_t 结构体成员的值对于每个链表元素来说，其 prev 成员都指向前一个元素（不存在时指向链表容器），而 next 成员则指向下一个元素（不存在时指向链表容器），这在图 7-3 中可以看到。

当容器中有两个元素时，prev 和 next 的指向如图 7-4 所示。

图 7-4 当含有两个或多个元素时，容器、元素中的 ngx_queue_t 结构体中 prev、next 成员的值图 7-4 很好地诠释了前面的定义，容器中的 prev 成员指向最后 1 个也就是第 2 个元素，next 成员指向第 1 个元素。第 1 个元素的 prev 成员指向容器本身，而其 next 成员指向第 2 个元素。第 2 个元素的 prev 成员指向第 1 个元素，其 next 成员则指向容器本身。

ngx_queue_t 的实现就是这么简单，但它的排序算法 ngx_queue_sort 使用的插入排序，并不适合为庞大的数据排序。

### 7.3 ngx_array_t 动态数组

ngx_array_t 是一个顺序容器，它在 Nginx 中大量使用。ngx_array_t 容器以数组的形式存储元素，并支持在达到数组容量的上限时动态改变数组的大小。

#### 7.3.1 为什么设计 ngx_array_t 动态数组

数组的优势是它的访问速度。由于它使用一块完整的内存，并按照固定大小存储每一个元素，所以在访问数组的任意一个元素时，都可以根据下标直接寻址找到它，另外，数组的访问速度是常量级的，在所有的数据结构中它的速度都是最快的。然而，正是由于数组使用一块连续的内存存储所有的元素，所以它的大小直接决定了所消耗的内存。可见，如果预分配的数组过大，肯定会浪费宝贵的内存资源。那么，数组的大小究竟应该分配多少才是够用的呢？当数组大小无法确定时，动态数组就“登场”了。

C++语言的 STL 中的 vector 容器就像 ngx_array_t 一样是一个动态数组。它们在数组的大小达到已经分配内存的上限时，会自动扩充数组的大小。具备了这个特点之后，ngx_array_t 动态数组的用处就大多了，而且它内置了 Nginx 封装的内存池，因此，它分配的内存也是在内存池中申请得到。ngx_array_t 容器具备以下 3 个优点：

-   访问速度快。
-   允许元素个数具备不确定性。
-   负责元素占用内存的分配，这些内存将由内存池统一管理。

#### 7.3.2 动态数组的使用方法

ngx_array_t 动态数组的实现仅使用 1 个结构体，如下所示。

```C
typedef struct ngx_array_s ngx_array_t;
struct ngx_array_s {
// elts 指向数组的首地址
void *elts;
// nelts 是数组中已经使用的元素个数
ngx_uint_t nelts;
// 每个数组元素占用的内存大小
size_t size;
// 当前数组中能够容纳元素个数的总大小
ngx_uint_t nalloc;
// 内存池对象
ngx_pool_t *pool;
};
```

在上面这段代码中已经简单描述了 ngx_array_t 结构体中各成员的意义，通过图 7-5，读者可以有更直观的理解。

图 7-5 ngx_array_t 动态数组结构体中的成员及其提供的方法

从图 7-5 中可以看出，ngx_array_t 动态数组还提供了 5 个基本方法，它们的意义见表 7-3。

表 7-3 ngx_array_t 动态数组提供的方法

如果使用已经定义过的 ngx_array_t 结构体，那么可以先调用 ngx_array_init 方法初始化动态数组。如果要重新在内存池上定义 ngx_array_t 结构体，则可以调用 ngx_array_create 方法创建动态数组。这两个方法都会预分配一定容量的数组元素。

在向动态数组中添加新元素时，最好调用 ngx_array_push 或者 ngx_array_push_n 方法，这两个方法会在达到数组预分配容量上限时自动扩容，这比直接操作 ngx_array_t 结构体中的成员要好得多，具体将在 7.3.3 节的例子中详细说明。

注意因为 ngx_array_destroy 是在内存池中销毁动态数组及其分配的元素内存的（如果动态数组的 ngx_array_t 结构体内存是利用栈等非内存池方式分配，那么调用 ngx_array_destroy 会导致不可预估的错误），所以它必须与 ngx_array_create 配对使用。

#### 7.3.3 使用动态数组的例子

本节以一个简单的例子说明如何使用动态数组。这里仍然以 7.2.3 中介绍的 TestNode 作为数组中的元素类型。首先，调用 ngx_array_create 方法创建动态数组，代码如下。

```C
ngx_array_t *dynamicArray = ngx_array_create(cf->pool, 1, sizeof(TestNode));
```

这里创建的动态数组只预分配了 1 个元素的空间，每个元素占用的内存字节数为 sizeof(TestNode)，也就是 TestNode 结构体占用的空间大小。

然后，调用 ngx_array_push 方法向 dynamicArray 数组中添加两个元素，代码如下。

```C
TestNode* a = ngx_array_push(dynamicArray);
a->num = 1;
a = ngx_array_push(dynamicArray);
a->num = 2;
```

这两个元素的 num 值分别为 1 和 2。注意，在添加第 2 个元素时，实际已经发生过一次扩容了，因为调用 ngx_array_create 方法时只预分配了 1 个元素的空间。下面尝试用 ngx_array_push_n 方法一次性添加 3 个元素，代码如下。

```C
TestNode* b = ngx_array_push_n(dynamicArray, 3);
b->num = 3;
(b+1)->num = 4;
(b+2)->num = 5;
```

这 3 个元素的 num 值分别为 3、4、5。下面来看一下是如何遍历 dynamicArray 动态数组的，代码如下。

```C
TestNode* nodeArray = dynamicArray->elts;
ngx_uint_t arraySeq = 0;
for (; arraySeq < dynamicArray->nelts; arraySeq++)
{
    a = nodeArray + arraySeq;
    // 下面处理数组中的元素 a
…
}
```

了解了遍历 dynamicArray 动态数组的方法后，再来看一下销毁动态数组的方法，这就非常简单了，如下所示：

```C
ngx_array_destroy(dynamicArray);
```

#### 7.3.4 动态数组的扩容方式

本节将介绍当动态数组达到容量上限时是如何进行扩容的。ngx_array_push 和 ngx_array_push_n 方法都可能引发扩容操作。

当已经使用的元素个数达到动态数组预分配元素的个数时，再次调用 ngx_array_push 或者 ngx_array_push_n 方法将引发扩容操作。ngx_array_push 方法会申请 ngx_array_t 结构体中 size 字节大小的内存，而 ngx_array_push_n 方法将会申请 n（n 是 ngx_array_push_n 的参数，表示需要添加 n 个元素）个 size 字节大小的内存。每次扩容的大小将受制于内存池的以下两种情形：

-   如果当前内存池中剩余的空间大于或者等于本次需要新增的空间，那么本次扩容将只扩充新增的空间。例如，对于 ngx_array_push 方法来说，就是扩充 1 个元素，而对于 ngx_array_push_n 方法来说，就是扩充 n 个元素。

-   如果当前内存池中剩余的空间小于本次需要新增的空间，那么对 ngx_array_push 方法来说，会将原先动态数组的容量扩容一倍，而对于 ngx_array_push_n 来说，情况更复杂一些，如果参数 n 小于原先动态数组的容量，将会扩容一倍；如果参数 n 大于原先动态数组的容量，这时会分配 2×n 大小的空间，扩容会超过一倍。这体现了 Nginx 预估用户行为的设计思想。

在以上两种情形下扩容的字节数都与每个元素的大小相关。

注意上述第 2 种情形涉及数据的复制。新扩容一倍以上的动态数组将在全新的内存块上，这时将有一个步骤将原动态数组中的元素复制到新的动态数组中，当数组非常大时， 这个步骤可能会耗时较长。

### 7.4 ngx_list_t 单向链表

ngx_list_t 也是一个顺序容器，它实际上相当于 7.3 节中介绍的动态数组与单向链表的结合体，只是扩容起来比动态数组简单得多，它可以一次性扩容 1 个数组。在图 3-2 中描述了 ngx_list_t 容器中各成员的意义，而且在 3.2.3 节中详细介绍过它的用法，这里不再赘述。

### 7.5 ngx_rbtree_t 红黑树

ngx_rbtree_t 是使用红黑树实现的一种关联容器，Nginx 的核心模块（如定时器管理、文件缓存模块等）在需要快速检索、查找的场合下都使用了 ngx_rbtree_t 容器，本节将系统地讨论 ngx_rbtree_t 的用法，并以一个贯穿本节始终的例子对它进行说明。在这个例子中，将有 10 个元素需要存储到红黑树窗口中，每个元素的关键字是简单的整型，分别为 1、6、8、11、13、15、17、22、25、27，以下的例子中都会使用到这 10 个节点数据。

#### 7.5.1 为什么设计 ngx_rbtree_t 红黑树

上文介绍的容器都是顺序容器，它们的检索效率通常情况下都比较差，一般只能遍历检索指定元素。当需要容器的检索速度很快，或者需要支持范围查询时，ngx_rbtree_t 红黑树容器是一个非常好的选择。

红黑树实际上是一种自平衡二叉查找树，但什么是二叉树呢？二叉树是每个节点最多有两个子树的树结构，每个节点都可以用于存储数据，可以由任 1 个节点访问它的左右子树或者父节点。

那么，什么是二叉查找树呢？二叉查找树或者是一棵空树，或者是具有下列性质的二叉树。

-   每个节点都有一个作为查找依据的关键码（key），所有节点的关键码互不相同。
-   左子树（如果存在）上所有节点的关键码都小于根节点的关键码。
-   右子树（如果存在）上所有节点的关键码都大于根节点的关键码。
-   左子树和右子树也是二叉查找树。

这样，一棵二叉查找树的所有元素节点都是有序的。在二叉树的形态比较平衡的情况下，它的检索效率很高，有点类似于二分法检索有序数组的效率。一般情况下，查询复杂度是与目标节点到根节点的距离（即深度）有关的。然而，不断地添加、删除节点，可能造成二叉查找树形态非常不平衡，在极端情形下它会变成单链表，检索效率也就会变得低下。例如，在本节的例子中，依次将这 10 个数据 1、6、8、11、13、15、17、22、25、27 添加到一棵普通的空二叉查找树中，它的形态如图 7-6 所示。

第 1 个元素 1 添加到空二叉树后自动成为根节点，而后陆续添加的元素正好以升序递增， 最终的形态必然如图 7-6 所示，也就是相当于单链表了，由于树的深度太大，因此各种操作的效率都会很低下。

图 7-6 普通的二叉查找树可能非常不平衡

什么是自平衡二叉查找树？在不断地向二叉查找树中添加、删除节点时，二叉查找树自身通过形态的变换，始终保持着一定程度上的平衡，即为自平衡二叉查找树。自平衡二叉查找树只是一个概念，它有许多种不同的实现方式，如 AVL 树和红黑树。红黑树是一种自平衡性较好的二叉查找树，它在 Linux 内核、C++的 STL 库等许多场合下都作为核心数据结构使用。本节讲述的 ngx_rbtree_t 容器就是一种由红黑树实现的自平衡二叉查找树。

ngx_rbtree_t 红黑树容器中的元素都是有序的，它支持快速的检索、插入、删除操作，也支持范围查询、遍历等操作，是一种应用场景非常广泛的高级数据结构。

#### 7.5.2 红黑树的特性

本节讲述红黑树的特性，对于只想了解如何使用 ngx_rbtree_t 容器的读者，可以跳过本节。

红黑树是指每个节点都带有颜色属性的二叉查找树，其中颜色为红色或黑色。除了二叉查找树的一般要求以外，对于红黑树还有如下的额外的特性。

特性 1：节点是红色或黑色。
特性 2：根节点是黑色。
特性 3：所有叶子节点都是黑色（叶子是 NIL 节点，也叫“哨兵”）。
特性 4：每个红色节点的两个子节点都是黑色（每个叶子节点到根节点的所有路径上不能有两个连续的红色节点）。
特性 5：从任一节点到其每个叶子节点的所有简单路径都包含相同数目的黑色节点。

这些约束加强了红黑树的关键性质：从根节点到叶子节点的最长可能路径长度不大于最短可能路径的两倍，这样这个树大致上就是平衡的了。因为二叉树的操作（比如插入、删除和查找某个值的最慢时间）都是与树的高度成比例的，以上的 5 个特性保证了树的高度（最长路径），所以它完全不同于普通的二叉查找树。

这些特性为什么可以导致上述结果呢？因为特性 4 实际上决定了 1 个路径不能有两个毗连的红色节点，这一点就足够了。最短的可能路径都是黑色节点，最长的可能路径有交替的红色节点和黑色节点。根据特性 5 可知，所有最长的路径都有相同数目的黑色节点，这就表明了没有路径能大于其他路径长度的两倍。

在本节的例子中，仍然按照顺序将这 10 个升序递增的元素添加到空的 ngx_rbtree_t 红黑树容器中，此时，我们会发现根节点不是第 1 个添加的元素 1，而是元素 11。实际上，依次添加元素 1、6、8、11、13、15、17、22、25、27 后，红黑树的形态如图 7-7 所示。

图 7-7 ngx_rbtree_t 红黑树的典型图示（其中无底纹节点表示红色，有底纹节点表示黑色）

如图 7-7 所示的是一棵相对平衡的树，它满足红黑树的 5 个特性，最长路径长度不大于最短路径的 2 倍。在 ngx_rbtree_t 红黑树在发现自身满足不了上述 5 个红黑树特性时，将会通过旋转（向左旋转或者向右旋转）子树来使树达到平衡。这里不再讲述红黑树的旋转功能，实际上它非常简单，读者可以通过 ngx_rbtree_left_rotate 和 ngx_rbtree_right_rotate 方法来了解旋转功能的实现。

#### 7.5.3 红黑树的使用方法

红黑树容器由 ngx_rbtree_t 结构体承载，ngx_rbtree_t 的成员和它相关的方法在图 7-7 中可以看到，下面进行详细介绍。首先，需要了解一下红黑树的节点结构，如图 7-8 所示。

图 7-8 红黑树节点的结构体及其提供的方法

ngx_rbtree_node_t 结构体用来表示红黑树中的一个节点，它还提供了 7 个方法用来操作节点。下面了解一下 ngx_rbtree_node_t 结构体的定义，代码如下。

```C
typedef ngx_uint_t ngx_rbtree_key_t;
typedef struct ngx_rbtree_node_s ngx_rbtree_node_t;
struct ngx_rbtree_node_s {
// 无符号整型的关键字
ngx_rbtree_key_t key;
// 左子节点
ngx_rbtree_node_t *left;
// 右子节点
ngx_rbtree_node_t *right;
// 父节点
ngx_rbtree_node_t *parent;
// 节点的颜色， 0 表示黑色， 1 表示红色
u_char color;
// 仅 1 个字节的节点数据。由于表示的空间太小，所以一般很少使用
u_char data;
};
```

ngx_rbtree_node_t 是红黑树实现中必须用到的数据结构，一般我们把它放到结构体中的第 1 个成员中，这样方便把自定义的结构体强制转换成 ngx_rbtree_node_t 类型。例如：

```C
typedef struct {
/*一般都将 ngx_rbtree_node_t 节点结构体放在自定义数据类型的第 1 位，以方便类型的强制转换 */
ngx_rbtree_node_t node;
ngx_uint_t num;
} TestRBTreeNode;
```

如果这里希望容器中元素的数据类型是 TestRBTreeNode，那么只需要在第 1 个成员中放上 ngx_rbtree_node_t 类型的 node 即可。在调用图 7-7 中 ngx_rbtree_t 容器所提供的方法时，需要的参数都是 ngx_rbtree_node_t 类型，这时将 TestRBTreeNode 类型的指针强制转换成 ngx_rbtree_node_t 即可。

ngx_rbtree_node_t 结构体中的 key 成员是每个红黑树节点的关键字，它必须是整型。红黑树的排序主要依据 key 成员（当然，自定义 ngx_rbtree_insert_pt 方法后，节点的其他成员也可以在 key 排序的基础上影响红黑树的形态）。在图 7-7 所示例子中，1、6、8、11、13、15、17、22、25、27 这些数字都是每个节点的 key 关键字。

下面看一下表示红黑树的 ngx_rbtree_t 结构体是如何定义的，代码如下。

```C
typedef struct ngx_rbtree_s ngx_rbtree_t;
/*为解决不同节点含有相同关键字的元素冲突问题，红黑树设置了 ngx_rbtree_insert_pt 指针，这样可灵活地添加冲突元素 */
typedef void (ngx_rbtree_insert_pt) (ngx_rbtree_node_t root,
ngx_rbtree_node_t node, ngx_rbtree_node_t *sentinel);
struct ngx_rbtree_s {
// 指向树的根节点。注意，根节点也是数据元素
ngx_rbtree_node_t *root;
// 指向 NIL 哨兵节点
ngx_rbtree_node_t *sentinel;
// 表示红黑树添加元素的函数指针，它决定在添加新节点时的行为究竟是替换还是新增
ngx_rbtree_insert_pt insert;
};
```

在上段代码中，ngx_rbtree_t 结构体的 root 成员指向根节点，而 sentinel 成员指向哨兵节点，这很清晰。然而，insert 成员作为一个 ngx_rbtree_insert_pt 类型的函数指针，它的意义在哪里呢？

红黑树是一个通用的数据结构，它的节点（或者称为容器的元素）可以是包含基本红黑树节点的任意结构体。对于不同的结构体，很多场合下是允许不同的节点拥有相同的关键字的（参见图 7-8 中的 key 成员，它作为无符号整型数时表示树节点的关键字）。例如，不同的字符串可能会散列出相同的关键字，这时它们在红黑树中的关键字是相同的，然而它们又是不同的节点，这样在添加时就不可以覆盖原有同名关键字节点，而是作为新插入的节点存在。因此，在添加元素时，需要考虑到这种情况。将添加元素的方法抽象出 ngx_rbtree_insert_pt 函数指针可以很好地实现这一思想，用户也可以灵活地定义自己的行为。

Nginx 帮助用户实现了 3 种简单行为的添加节点方法，见表 7-4。

表 7-4 Nginx 为红黑树已经实现好的 3 种数据添加方法

表 7-4 中 ngx_str_rbtree_insert_value 函数的应用场景为：节点的标识符是字符串，红黑树的第一排序依据仍然是节点的 key 关键字，第二排序依据则是节点的字符串。因此，使用 ngx_str_rbtree_insert_value 时表示红黑树节点的结构体必须是 ngx_str_node_t，如下所示。

```C
typedef struct {
ngx_rbtree_node_t node;
ngx_str_t str;
} ngx_str_node_t;
```

同时，对于 ngx_str_node_t 节点，Nginx 还提供了 ngx_str_rbtree_lookup 方法用于检索红黑树节点，下面来看一下它的定义，代码如下。

```C
ngx_str_node_t *ngx_str_rbtree_lookup(ngx_rbtree_t rbtree, ngx_str_t name, uint32_t hash);
```

其中，hash 参数是要查询节点的 key 关键字，而 name 是要查询的字符串（解决不同字符串对应相同 key 关键字的问题），返回的是查询到的红黑树节点结构体。

关于红黑树操作的方法见表 7-5。

表 7-5 红黑树容器提供的方法

在初始化红黑树时，需要先分配好保存红黑树的 ngx_rbtree_t 结构体，以及 ngx_rbtree_node_t 类型的哨兵节点，并选择或者自定义 ngx_rbtree_insert_pt 类型的节点添加函数。

对于红黑树的每个节点来说，它们都具备表 7-6 所列的 7 个方法，如果只是想了解如何使用红黑树，那么只需要了解 ngx_rbtree_min 方法。

表 7-6 红黑树节点提供的方法

表 7-5 中的方法大部分用于实现或者扩展红黑树的功能，如果只是使用红黑树，那么一般情况下只会使用 ngx_rbtree_min 方法。

本节介绍的方法或者结构体的简单用法的实现可参见 7.5.4 节的相关示例。

#### 7.5.4 使用红黑树的简单例子

本节以一个简单的例子来说明如何使用红黑树容器。首先在栈中分配 rbtree 红黑树容器结构体以及哨兵节点 sentinel（当然，也可以使用内存池或者从进程堆中分配），本例中的节点完全以 key 关键字作为每个节点的唯一标识，这样就可以采用预设的 ngx_rbtree_insert_value 方法了。最后可调用 ngx_rbtree_init 方法初始化红黑树，代码如下所示。

```C
ngx_rbtree_t rbtree;
ngx_rbtree_node_t sentinel;
ngx_rbtree_init(&rbtree, &sentinel, ngx_rbtree_insert_value);
```

本例中树节点的结构体将使用 7.5.3 节中介绍的 TestRBTreeNode 结构体，树中的所有节点都取自图 7-7，每个元素的 key 关键字按照 1、6、8、11、13、15、17、22、25、27 的顺序一一向红黑树中添加，代码如下所示。

```C
TestRBTreeNode rbTreeNode[10];
rbTreeNode[0].num = 1;
rbTreeNode[1].num = 6;
rbTreeNode[2].num = 8;
rbTreeNode[3].num = 11;
rbTreeNode[4].num = 13;
rbTreeNode[5].num = 15;
rbTreeNode[6].num = 17;
rbTreeNode[7].num = 22;
rbTreeNode[8].num = 25;
rbTreeNode[9].num = 27;
for (i = 0; i \< 10; i++)
{
rbTreeNode[i].node.key = rbTreeNode[i].num;
ngx_rbtree_insert(&rbtree,&rbTreeNode[i].node);
}
```

以这种顺序添加完的红黑树形态如图 7-7 所示。如果需要找出当前红黑树中最小的节点，可以调用 ngx_rbtree_min 方法获取。

```C
ngx_rbtree_node_t \*tmpnode = ngx_rbtree_min(rbtree.root, &sentinel);
```

当然，参数中如果不使用根节点而是使用任一个节点也是可以的。下面来看一下如何检索 1 个节点，虽然 Nginx 对此并没有提供预设的方法（仅对字符串类型提供了 ngx_str_rbtree_lookup 检索方法），但实际上检索是非常简单的。下面以寻找 key 关键字为 13 的节点为例来加以说明。

```C
ngx*uint_t lookupkey = 13;
tmpnode = rbtree.root;
TestRBTreeNode *lookupNode;
while (tmpnode != &sentinel) {
if (lookupkey != tmpnode->key) {
// 根据 key 关键字与当前节点的大小比较，决定是检索左子树还是右子树
tmpnode = (lookupkey < tmpnode->key) tmpnode->left : tmpnode->right;
continue;
}
// 找到了值为 13 的树节点
lookupNode = (TestRBTreeNode *) tmpnode;
break;
}
```

从红黑树中删除 1 个节点也是非常简单的，如把刚刚找到的值为 13 的节点从 rbtree 中删除，只需调用 ngx_rbtree_delete 方法。

```C
ngx_rbtree_delete(&rbtree,&lookupNode-\>node);
```

#### 7.5.5 如何自定义添加成员方法

由于节点的 key 关键字必须是整型，这导致很多情况下不同的节点会具有相同的 key 关键字。如果不希望出现具有相同 key 关键字的不同节点在向红黑树添加时出现覆盖原节点的情况，就需要实现自有的 ngx_rbtree_insert_pt 方法。

许多 Nginx 模块在使用红黑树时都自定义了 ngx_rbtree_insert_pt 方法（如 geo、filecache 模块等），本节以 7.5.3 节中介绍过的 ngx_str_rbtree_insert_value 为例，来说明如何定义这样的方法。先看一下 ngx_str_rbtree_insert_value 的实现。代码如下。

```C
void ngx_str_rbtree_insert_value(ngx_rbtree_node_t *temp,
                                 ngx_rbtree_node_t *node, ngx_rbtree_node_t *sentinel)
{
    ngx_str_node_t *n, *t;
    ngx_rbtree_node_t **p;
    for (;;)
    {
        n = (ngx_str_node_t *)node;
        t = (ngx_str_node_t *)temp;
        // 首先比较 key 关键字，红黑树中以 key 作为第一索引关键字
        if (node->key != temp->key)
        {
            // 左子树节点的关键节小于右子树
            p = (node->key < temp->key) ? &temp->left : &temp->right;
        }
        // 当 key 关键字相同时，以字符串长度为第二索引关键字
        else if (n->str.len != t->str.len)
        {
            // 左子树节点字符串的长度小于右子树
            p = (n->str.len < t->str.len) ? &temp->left : &temp->right;
        }
        else
        {
            // key 关键字相同且字符串长度相同时，再继续比较字符串内容
            p = (ngx_memcmp(n->str.data, t->str.data, n->str.len) < 0) ? &temp->left : &temp->right;
        }
        // 如果当前节点 p 是哨兵节点，那么跳出循环准备插入节点
        if (*p == sentinel)
        {
            break;
        }
        // p 节点与要插入的节点具有相同的标识符时，必须覆盖内容
        temp = p;
    }
    p = node;
    // 置插入节点的父节点
    node->parent = temp;
    // 左右子节点都是哨兵节点
    node->left = sentinel;
    node->right = sentinel;
    /*将节点颜色置为红色。注意，红黑树的 ngx*rbtree_insert 方法会在可能的旋转操作后重置该节点的颜色 */
    ngx_rbt_red(node);
}
```

可以看到，该代码与 7.5.4 节中介绍过的检索节点代码很相似。它所要处理的主要问题就是当 key 关键字相同时，继续以何种数据结构作为标准来确定红黑树节点的唯一性。Nginx 中已经实现的诸多 ngx_rbtree_insert_pt 方法都是非常相似的，读者完全可以参照 ngx_str_rbtree_insert_value 方法来自定义红黑树节点添加方法。

### 7.6 ngx_radix_tree_t 基数树

基数树也是一种二叉查找树，然而它却不像红黑树一样应用广泛（目前官方模块中仅 geo 模块使用了基数树）。这是因为 ngx_radix_tree_t 基数树要求存储的每个节点都必须以 32 位整型作为区别任意两个节点的唯一标识，而红黑树则没有此要求。ngx_radix_tree_t 基数树与红黑树不同的另一个地方：ngx_radix_tree_t 基数树会负责分配每个节点占用的内存。因此， 每个基数树节点也不再像红黑树中那么灵活——可以是任意包含 ngx_rbtree_node_t 成员的结构体。基数树的每个节点中可以存储的值只是 1 个指针，它指向实际的数据。

本节将以一棵完整的 ngx_radix_tree_t 基数树来说明基数树的原理和用法，这棵树的深度为 3，它包括以下 4 个节点：0X20000000、0X40000000、0X80000000、0Xc0000000。这里书写成十六进制是为了便于理解，因为基数树实际是按二进制位来建立树的，上面 4 个节点如果转换为十进制无符号整型（也就是 7.6.3 节例子中的 ngx_uint_t），它们的值分别是 536870912、1073741824、2147483648、2684354560；如果转换为二进制，它们的值分别为：00100000000000000000000000000000、01000000000000000000000000000000、 10000000000000000000000000000000、11000000000000000000000000000000。在图 7-9 中， 可以看到这 4 个节点如何存储到深度为 3 的基数树中。

#### 7.6.1 ngx_radix_tree_t 基数树的原理

基数树具备二叉查找树的所有优点：基本操作速度快（如检索、插入、删除节点）、支持范围查询、支持遍历操作等。但基数树不像红黑树那样会通过自身的旋转来达到平衡，基数树是不管树的形态是否平衡的，因此，它插入节点、删除节点的速度要比红黑树快得多！

那么，基数树为什么可以不管树的形态是否平衡呢？

红黑树是通过不同节点间 key 关键字的比较来决定树的形态，而基数树则不然，它每一个节点的 key 关键字已经决定了这个节点处于树中的位置。决定节点位置的方法很简单，先将这个节点的整型关键字转化为二进制，从左向右数这 32 个位，遇到 0 时进入左子树，遇到 1 时进入右子树。因此，ngx_radix_tree_t 树的最大深度是 32。有时，数据可能仅在全部整型数范围的某一小段中，为了减少树的高度，ngx_radix_tree_t 又加入了掩码的概念，掩码中为 1 的位节点关键字中有效的位数同时也决定了树的有效高度。例如，掩码为 11100000000000000000000000000000（也就是 0Xe0000000）时，表示树的高度为 3。如果 1 个节点的关键字为 0X0fffffff，那么实际上对于这棵基数树而言，它的节点关键字相当于 0X00000000，因为掩码决定了仅前 3 位有效，并且它也只会放在树的第三层节点中。

如图 7-9 所示，0X20000000 这个节点插到基数树后，由于掩码是 0Xe0000000，因此它决定了所有的节点都将放在树的第三层。下面结合掩码看看节点是如何根据关键字来决定其在树中的位置的。掩码中有 3 个 1，将节点的关键字 0X20000000 转化为二进制再取前 3 位为 001，然后分 3 步决定节点的位置。

-   首先找到根节点，取 010 的第 1 位 0，表示选择左子树。
-   第 2 位为 0，表示再选择左子树。
-   第 3 位为 1，表示再选择右子树，此时的节点就是第三层的节点，这时会用它来存储 0X20000000 这个节点。

图 7-9 3 层基数树示意图

ngx_radix_tree_t 基数树的每个节点由 ngx_radix_node_t 结构体表示，代码如下所示。

```C
typedef struct ngx_radix_node_s ngx_radix_node_t;
struct ngx_radix_node_s
{
    // 指向右子树，如果没有右子树，则值为 null 空指针
    ngx_radix_node_t *right;
    // 指向左子树，如果没有左子树，则值为 null 空指针
    ngx_radix_node_t *left;
    // 指向父节点，如果没有父节点，则（如根节点）值为 null 空指针
    ngx_radix_node_t parent;
    /* value 存储的是指针的值，它指向用户定义的数据结构。如果这个节点还未使用， value 的值将是 NGX_RADIX_NO_VALUE */
    uintptr_t value;
};
};
```

如图 7-9 所示，value 字段指向用户自定义的、有意义的数据结构。另外，基数树也不像红黑树一样还有哨兵节点。基数树节点的 left 和 right 都是有可能为 null 空指针的。

与红黑树不同的是，红黑树容器不负责分配每个树节点的内存，而 ngx_radix_tree_t 基数树则会分配 ngx_radix_node_t 结构体，这样使用 ngx_radix_node_t 基数树时就会更简单一些。但 ngx_radix_node_t 基数树是如何管理这些 ngx_radix_node_t 结构体的内存呢？下面来看一下 ngx_radix_node_t 容器的结构，代码如下。

```C
typedef struct
{
    // 指向根节点
    ngx_radix_node_t *root;
    // 内存池，它负责给基数树的节点分配内存
    ngx_pool_t pool;
    /* 管理已经分配但暂时未使用（不在树中）的节点， free 实际上是所有不在树中节点的单链表 */
    ngx_radix_node_t free;
    // 已分配内存中还未使用内存的首地址
    char *start;
    // 已分配内存中还未使用的内存大小
    size_t size;
} ngx_radix_tree_t;
```

上面的 pool 对象用来分配内存。每次删除 1 个节点时，ngx_radix_tree_t 基数树并不会释放这个节点占用的内存，而是把它添加到 free 单链表中。这样，在添加新的节点时，会首先查看 free 中是否还有节点，如果 free 中有未使用的节点，则会优先使用，如果没有，就会再从 pool 内存池中分配新内存存储节点。

对于 ngx_radix_tree_t 结构体来说，仅从使用的角度来看，我们不需要了解 pool、free、 start、size 这些成员的意义，仅了解如何使用 root 根节点即可。

#### 7.6.2 基数树的使用方法

相比于红黑树，ngx_radix_tree_t 基数树的使用方法要简单许多，只需表 7-7 中列出的 4 个方法即可简单地操作基数树。

表 7-7 ngx_radix_tree_t 基数树提供的方法

#### 7.6.3 使用基数树的例子

本节以图 7-9 中的基数树为例来构造 radixTree 这棵基数树。首先，使用 ngx_radix_tree_create 方法创建基数树，代码如下。

```c
ngx_radix_tree_t * radixTree = ngx_radix_tree_create(cf->pool, -1);
```

将预分配节点简单地设置为–1，这样 pool 内存池中就会只使用 1 个页面来尽可能地分配基数树节点。接下来，按照图 7-9 构造 4 个节点数据，这里将它们所使用的数据结构简单地用无符号整型表示，当然，实际使用时可以是任意的数据结构。

```C
ngx_uint_t testRadixValue1 = 0x20000000;
ngx_uint_t testRadixValue2 = 0x40000000;
ngx_uint_t testRadixValue3 = 0x80000000;
ngx_uint_t testRadixValue4 = 0xa0000000;
```

接下来将上述节点添加到 radixTree 基数树中，注意，掩码是 0xe0000000。

```C
int rc;
rc = ngx_radix32tree_insert(radixTree,
                            0x20000000, 0xe0000000, (uintptr_t)&testRadixValue1);
rc = ngx_radix32tree_insert(radixTree,
                            0x40000000, 0xe0000000, (uintptr_t)&testRadixValue2);
rc = ngx_radix32tree_insert(radixTree,
                            0x80000000, 0xe0000000, (uintptr_t)&testRadixValue3);
rc = ngx_radix32tree_insert(radixTree,
                            0xa0000000, 0xe0000000, (uintptr_t)&testRadixValue4);
```

下面来试着调用 ngx_radix32tree_find 查询节点，代码如下。

```C
ngx_uint_t* pRadixValue = (ngx_uint_t *) ngx_radix32tree_find( radixTree, 0x80000000);
```

注意，如果没有查询到，那么返回的 pRadixValue 将会是 NGX_RADIX_NO_VALUE。

下面调用 ngx_radix32tree_delete 删除 1 个节点，代码如下。

```C
rc = ngx_radix32tree_delete(radixTree, 0xa0000000, 0xe0000000);
```

### 7.7 支持通配符的散列表

散列表（也叫哈希表）是典型的以空间换时间的数据结构，在一些合理的假设下，对任意元素的检索、插入速度的期望时间为 O(1)，这种高效的方式非常适合频繁读取、插入、删除元素，以及对速度敏感的场合。因此，散列表在以效率、性能著称的 Nginx 服务器中得到了广泛的应用。

注意，Nginx 不只提供了基本的散列表。Nginx 作为一个 Web 服务器，它的各种散列表中的关键字多以字符串为主，特别是 URI 域名，如www.test.com 。这时一个基本的要求就出现了，如何让散列表支持通配符呢？前面在 2.4.1 节中介绍了 nginx.conf 中主机名称的配置，这里的主机域名是允许以\*作为通配符的，包括前置通配符，如\*.test.com，或者后置通配符，如 www.test.\*。Nginx封装了ngx_hash_combined_t容器，专门针对URI域名支持前置或者后置的通
配符（不支持通配符在域名的中间）。

本节会以一个完整的通配符散列表为例来说明这个容器的用法。

#### 7.7.1 ngx_hash_t 基本散列表

散列表是根据元素的关键码值而直接进行访问的数据结构。也就是说，它通过把关键码值映射到表中一个位置来访问记录，以加快查找的速度。这个映射函数 f 叫作散列方法，存放记录的数组叫做散列表。

若结构中存在关键字和 K 相等的记录，则必定在 f(K)的存储位置上。由此，不需要比较便可直接取得所查记录。我们称这个对应关系 f 为散列方法，按这个思想建立的表则为散列表。

对于不同的关键字，可能得到同一散列地址，即关键码 key1≠key2，而 f(key1)=f(key2)， 这种现象称为碰撞。对该散列方法来说，具有相同函数值的关键字称作同义词。综上所述， 根据散列方法 H(key)和处理碰撞的方法将一组关键字映象到一个有限的连续的地址集（区间）上，并以关键字在地址集中的“象”作为记录在表中的存储位置，这种表便称为散列表， 这一映象过程称为散列造表或散列，所得的存储位置称为散列地址。

若对于关键字集合中的任一个关键字，经散列方法映象到地址集合中任何一个地址的概率是相等的，则称此类散列方法为均匀散列方法，这就使关键字经过散列方法得到了一个“随机的地址”，从而减少了碰撞。

1. 如何解决碰撞问题
   如果得知散列表中的所有元素，那么可以设计出“完美”的散列方法，使得所有的元素经过 f(K)散列方法运算后得出的值都不同，这样就避免了碰撞问题。然而，通用的散列表是不可能预知散列表中的所有元素的，这样，通用的散列表都需要解决碰撞问题。

当散列表出现碰撞时要如何解决呢？一般有两个简单的解决方法：分离链接法和开放寻址法。

分离链接法，就是把散列到同一个槽中的所有元素都放在散列表外的一个链表中，这样查询元素时，在找到这个槽后，还得遍历链表才能找到正确的元素，以此来解决碰撞问题。

开放寻址法，即所有元素都存放在散列表中，当查找一个元素时，要检查规则内的所有的表项（例如，连续的非空槽或者整个空间内符合散列方法的所有槽），直到找到所需的元素，或者最终发现元素不在表中。开放寻址法中没有链表，也没有元素存放在散列表外。

Nginx 的散列表使用的是开放寻址法。

开放寻址法有许多种实现方式，Nginx 使用的是连续非空槽存储碰撞元素的方法。例如，当插入一个元素时，可以按照散列方法找到指定槽，如果该槽非空且其存储的元素与待插入元素并非同一元素，则依次检查其后连续的槽，直到找到一个空槽来放置这个元素为止。查询元素时也是使用类似的方法，即从散列方法指定的位置起检查连续的非空槽中的元素。

2.ngx_hash_t 散列表的实现
对于散列表中的元素，Nginx 使用 ngx_hash_elt_t 结构体来存储。下面看一下 ngx_hash_elt_t 的成员，代码如下。

```C
typedef struct
{
    /*指向用户自定义元素数据的指针，如果当前 ngx_hash_elt_t 槽为空，则 value 的值为 0 */
    void *value;
    // 元素关键字的长度
    u_short len;
    // 元素关键字的首地址
    u_char name[1];
} ngx_hash_elt_t;
```

每一个散列表槽都由 1 个 ngx_hash_elt_t 结构体表示，当然，这个槽的大小与 ngx_hash_elt_t 结构体的大小（也就是 sizeof(ngx_hash_elt_t)）是不相等的，这是因为 name 成员只用于指出关键字的首地址，而关键字的长度是可变长度。那么，一个槽究竟占用多大的空间呢？其实这是在初始化散列表时决定的。基本的散列表由 ngx_hash_t 结构体表示，如下所示。

```C
typedef struct
{
    // 指向散列表的首地址，也是第 1 个槽的地址
    ngx_hash_elt_t **buckets;
    // 散列表中槽的总数
    ngx_uint_t size;
} ngx_hash_t;
```

因此，在分配 buckets 成员时就决定了每个槽的长度（限制了每个元素关键字的最大长度），以及整个散列表所占用的空间。在 7.7.2 节中将会介绍 Nginx 提供的散列表初始化方法。

如图 7-10 所示，散列表的每个槽的首地址都是 ngx_hash_elt_t 结构体，value 成员指向用户有意义的结构体，而 len 是当前这个槽中 name（也就是元素的关键字）的有效长度。

ngx_hash_t 散列表的 buckets 指向了散列表的起始地址，而 size 指出散列表中槽的总数。

图 7-10 ngx_hash_t 基本散列表的结构示意图

ngx_hash_t 散列表还提供了 ngx_hash_find 方法用于查询元素，下面先来看一下它的定义。

```C
void ngx_hash_find(ngx_hash_t hash, ngx_uint_t key, u_char *name, size_t len)
```

其中，参数 hash 是散列表结构体的指针，而 key 则是根据散列方法算出来的散列关键字， name 和 len 则表示实际关键字的地址与长度。ngx_hash_find 的执行结果就是返回散列表中关键字与 name、len 指定关键字完全相同的槽中，ngx_hash_elt_t 结构体中 value 成员所指向的用户数据。如果 ngx_hash_find 没有查询到这个元素，就会返回 NULL。

3.ngx_hash_t 的散列方法
Nginx 设计了 ngx_hash_key_pt 散列方法指针，也就是说，完全可以按照 ngx_hash_key_pt 的函数原型自定义散列方法，如下所示。

```C
typedef ngx_uint_t (*ngx_hash_key_pt) (u_char *data, size_t len);
```

其中，传入的 data 是元素关键字的首地址，而 len 是元素关键字的长度。可以把任意的数据结构强制转换为 u_char\*并传给 ngx_hash_key_pt 散列方法，从而决定返回什么样的散列整型关键码来使碰撞率降低。

当然，Nginx 也提供了两种基本的散列方法，它会假定关键字是字符串。如果关键字确实是字符串，那么可以使用表 7-8 提供的散列方法。

表 7-8 Nginx 提供的两种散列方法
这两种散列方法的区别仅仅在于 ngx_hash_key_lc 将关键字字符串全小写后再调用 ngx_hash_key 来计算关键码。

#### 7.7.2 支持通配符的散列表
如果散列表元素的关键字是 URI 域名，Nginx 设计了支持简单通配符的散列表 ngx_hash_combined_t，那么它可以支持简单的前置通配符或者后置通配符。

1.原理
所谓支持通配符的散列表，就是把基本散列表中元素的关键字，用去除通配符以后的字符作为关键字加入，原理其实很简单。例如，对于关键字为“www.test.\*”这样带通配符的情况，直接建立一个专用的后置通配符散列表，存储元素的关键字为 www.test。这样，如果要检索www.test.cn是否匹配www.test.\*，可用Nginx提供的专用方法ngx_hash_find_wc_tail检索， ngx_hash_find_wc_tail 方法会把要查询的www.test.cn转化为www.test字符串再开始查询。

同样，对于关键字为“.test.com”这样带前置通配符的情况，也直接建立了一个专用的前置通配符散列表，存储元素的关键字为 com.test.。如果我们要检索 smtp.test.com 是否匹配.test.com，可用 Nginx 提供的专用方法 ngx_hash_find_wc_head 检索，ngx_hash_find_wc_head 方法会把要查询的 smtp.test.com 转化为 com.test.字符串再开始查询（如图 7-11 所示）。

图 7-11 ngx_hash_wildcard_t 基本通配符散列表
Nginx 封装了 ngx_hash_wildcard_t 结构体，专用于表示前置或者后置通配符的散列表。

```C
typedef struct
{
    // 基本散列表
    ngx_hash_t hash;
    /*当使用这个 ngx_hash_wildcard_t 通配符散列表作为某容器的元素时，可以使用这个 value 指针指向用户数据 */
    void *value;
} ngx_hash_wildcard_t;
```

实际上，ngx_hash_wildcard_t 只是对 ngx_hash_t 进行了简单的封装，所加的 value 指针其用途也是多样化的。ngx_hash_wildcard_t 同时提供了两种方法，分别用于查询前置或者后置通配符的元素，见表 7-9。

表 7-9 ngx_hash_wildcard_t 提供的方法

下面回顾一下 Nginx 对于 server_name 主机名通配符的支持规则。

-   首先，选择所有字符串完全匹配的 server_name，如www.testweb.com 。
-   其次，选择通配符在前面的 server_name，如\*.testweb.com。
-   再次，选择通配符在后面的 server_name，如www.testweb.*。

实际上，上面介绍的这个规则就是 Nginx 实现的 ngx_hash_combined_t 通配符散列表的规则。下面先来看一下 ngx_hash_combined_t 的结构，代码如下。

```C
typedef struct
{
    // 用于精确匹配的基本散列表
    ngx_hash_t hash;
    // 用于查询前置通配符的散列表
    ngx_hash_wildcard_t *wc_head;
    // 用于查询后置通配符的散列表
    ngx_hash_wildcard_t *wc_tail;
} ngx_hash_combined_t;
```

如图 7-12 所示，ngx_hash_combined_t 是由 3 个散列表所组成：第 1 个散列表 hash 是普通的基本散列表，第 2 个散列表 wc_head 所包含的都是带前置通配符的元素，第 3 个散列表 wc_tail 所包含的都是带后置通配符的元素。

图 7-12 ngx_hash_combined_t 通配符散列表的结构示意图

注意前置通配符散列表中元素的关键字，在把\*通配符去掉后，会按照“.”符号分隔，并以倒序的方式作为关键字来存储元素。相应的，在查询元素时也是做相同处理。

在查询元素时，可以使用 ngx_hash_combined_t 提供的方法 ngx_hash_find_combined，下面先来看看它的定义（它的参数、返回值含义与 ngx_hash_find_wc_head 或者 ngx_hash_find_wc_tail 方法相同）。

```C
void ngx_hash_find_combined(ngx_hash_combined_t hash, ngx_uint_t key, u_char *name,size_t len);
```

在实际向 ngx_hash_combined_t 通配符散列表查询元素时，ngx_hash_find_combined 方法的活动图如图 7-13 所示，这是有严格顺序的，即当 1 个查询关键字同时匹配 3 个散列表时，一定是返回普通的完全匹配散列表的相应元素。

图 7-13 通配符散列表 ngx_hash_find_combined 方法查询元素的活动图 2.如何初始化上文中对于普通的散列表和通配符散列表的原理和查询方法做了详细的解释，实际上， Nginx 也封装了完善的初始化方法，以用于这些散列表，并且 Nginx 还具备在初始化时添加通配符元素的能力。鉴于此，如果功能较多，初始化方法的使用就会有些复杂。下面介绍一下初始化方法的使用。

Nginx 专门提供了 ngx_hash_init_t 结构体用于初始化散列表，代码如下。

```C
typedef struct
{
    // 指向普通的完全匹配散列表
    ngx_hash_t *hash;
    // 用于初始化预添加元素的散列方法
    ngx_hash_key_pt key;
    // 散列表中槽的最大数目
    ngx_uint_t max_size;
    // 散列表中一个槽的空间大小，它限制了每个散列表元素关键字的最大长度
    ngx_uint_t bucket_size;
    // 散列表的名称
    char name;
    /* 内存池，它分配散列表（最多 3 个，包括 1 个普通散列表、 1 个前置通配符散列表、 1 个后置通配符散列表）中的所有槽 */
    ngx_pool_t pool;
    /*临时内存池，它仅存在于初始化散列表之前。它主要用于分配一些临时的动态数组，带通配符的元素在初始化时需要用到这些数组 */
    ngx_pool_t temp_pool;
} ngx_hash_init_t;
```

ngx_hash_init_t 结构体的用途只在于初始化散列表，到底初始化散列表时会预分配多少个槽呢？这并不完全由 max_size 成员决定的，而是由在做初始化准备时预先加入到散列表的所有元素决定的，包括这些元素的总数、每个元素关键字的长度等，还包括操作系统一个页面的大小。这个算法较复杂，可以在 ngx_hash_init_t 函数中得到。我们在使用它时只需要了解在初始化后每个 ngx_hash_t 结构体中的 size 成员不由 ngx_hash_init_t 完全决定即可。图 7-14 显示了 ngx_hash_init_t 结构体及其支持的方法。

图 7-14 ngx_hash_init_t 的结构及其提供的方法

ngx_hash_init_t 的这两个方法负责将 ngx_hash_keys_arrays_t 中的相应元素初始化到散列表中，表 7-10 描述了这两个初始化方法的用法。

表 7-10 ngx_hash_init_t 提供的两个初始化方法

表 7-10 的两个方法都用到了 ngx_hash_key_t 结构，下面简单地介绍一下它的成员。实际上，如果只是使用散列表，完全可以不用关心 ngx_hash_key_t 的结构，但为了更深入地理解和应用还是简要介绍一下它。

```C
typedef struct
{
    // 元素关键字
    ngx_str_t key;
    // 由散列方法算出来的关键码
    ngx_uint_t key_hash;
    // 指向实际的用户数据
    void *value;
} ngx_hash_key_t;
```

ngx_hash_keys_arrays_t 对应的 ngx_hash_add_key 方法负责构造 ngx_hash_key_t 结构。下面来看一下 ngx_hash_keys_arrays_t 结构体，它不负责构造散列表，然而它却是使用 ngx_hash_init 或者 ngx_hash_wildcard_init 方法的前提条件，换句话说，如果先构造好了 ngx_hash_keys_arrays_t 结构体，就可以非常简单地调用 ngx_hash_init 或者 ngx_hash_wildcard_init 方法来创建支持通配符的散列表了。

```C
typedef struct
{
    /* 下面的 keys_hash、 dns_wc_head_hash、 dns_wc_tail_hash 都是简易散列表，而 hsize 指明了散列表的槽个数，其简易散列方法也需要对 hsize 求余 */
    ngx_uint_t hsize;
    // 内存池，用于分配永久性内存，到目前的 Nginx 版本为止，该 pool 成员没有任何意义
    ngx_pool_t pool;
    // 临时内存池，下面的动态数组需要的内存都由 temp_pool 内存池分配
    ngx_pool_t *temp_pool;
    // 用动态数组以 ngx_hash_key_t 结构体保存着不含有通配符关键字的元素
    ngx_array_t keys;
    /*一个极其简易的散列表，它以数组的形式保存着 hsize 个元素，每个元素都是 ngx_array_t 动态数组。在用户添加的元素过程中，会根据关键码将用户的 ngx_str_t 类型的关键字添加到 ngx_array_t 动态数组中。这里所有的用户元素的关键字都不可以带通配符，表示精确匹配 */
    ngx_array_t keys_hash;
    /*用动态数组以 ngx_hash_key_t 结构体保存着含有前置通配符关键字的元素生成的中间关键字 */
    ngx_array_t dns_wc_head;
    // 一个极其简易的散列表，它以数组的形式保存着 hsize 个元素，每个元素都是 ngx_array_t 动态数组。在用户添加元素过程中，会根据关键码将用户的 ngx_str_t 类型的关键字添加到 ngx_array_t 动态数组中。这里所有的用户元素的关键字都带前置通配符
    ngx_array_t dns_wc_head_hash;
    /* 用动态数组以 ngx_hash_key_t 结构体保存着含有后置通配符关键字的元素生成的中间关键字 */
    ngx_array_t dns_wc_tail;
    // 一个极其简易的散列表，它以数组的形式保存着 hsize 个元素，每个元素都是 ngx_array_t 动态数组。在用户添加元素过程中，会根据关键码将用户的 ngx_str_t 类型的关键字添加到 ngx_array_t 动态数组中。这里所有的用户元素的关键字都带后置通配符
    ngx_array_t dns_wc_tail_hash;
} ngx_hash_keys_arrays_t;
```

如图 7-15 所示，ngx_hash_keys_arrays_t 中的 3 个动态数组容器 keys、dns_wc_head、 dns_wc_tail 会以 ngx_hash_key_t 结构体作为元素类型，分别保存完全匹配关键字、带前置通配符的关键字、带后置通配符的关键字。同时，ngx_hash_keys_arrays_t 建立了 3 个简易的散列表 keys_hash、dns_wc_head_hash、dns_wc_tail_hash，这 3 个散列表用于快速向上述 3 个动态数组容器中插入元素。

图 7-15 ngx_hash_keys_arrays_t 中动态数组、散列表成员的简易示意图

为什么要设立这 3 个简易散列表呢？如果没有这 3 个散列表，在向 keys、dns_wc_head、 dns_wc_tail 动态数组添加元素时，为了避免出现相同关键字的元素，每添加一个关键字元素都需要遍历整个数组。有了 keys_hash、dns_wc_head_hash、dns_wc_tail_hash 这 3 个简易散列表后，每向 keys、dns_wc_head、dns_wc_tail 动态数组添加 1 个元素时，就用这个元素的关键字计算出散列码，然后按照散列码在 keys_hash、dns_wc_head_hash、dns_wc_tail_hash 散列表中的相应位置建立 ngx_array_t 动态数组，动态数组中的每个元素是 ngx_str_t，它指向关键字字符串。这样，再次添加同名关键字时，就可以由散列码立刻获得曾经添加的关键字，以此来判定是否合法或者进行元素合并操作。

ngx_hash_keys_arrays_t 之所以设计得比较复杂，是为了让 keys、dns_wc_head、 dns_wc_tail 这 3 个动态数组中存放的都是有效的元素。表 7-11 介绍了 ngx_hash_keys_arrays_t 提供的两个方法。

表 7-11 ngx_hash_keys_arrays_t 提供的两个方法

ngx_hash_keys_array_init 方法的 type 参数将会决定 ngx_hash_keys_arrays_t 中 3 个简易散列表的大小。当 type 为 NGX_HASH_SMALL 时，这 3 个散列表中槽的数目为 107 个；当 type 为 NGX_HASH_LARGE 时，这 3 个散列表中槽的数目为 10007 个。

在使用 ngx_hash_keys_array_init 初始化 ngx_hash_keys_arrays_t 结构体后，就可以调用 ngx_hash_add_key 方法向其加入散列表元素了。当添加元素成功后，再调用 ngx_hash_init_t 提供的两个初始化方法来创建散列表，这样得到的散列表就是完全可用的容器了。

7.7.3 带通配符散列表的使用例子

散列表元素 ngx_hash_elt_t 中 value 指针指向的数据结构为下面定义的 TestWildcardHash_Node 结构体，代码如下。

```C
typedef struct
{
    // 用于散列表中的关键字
    ngx_str_t servername;
    // 这个成员仅是为了方便区别而已
    ngx_int_t seq;
} TestWildcardHashNode;
```

每个散列表元素的关键字是 servername 字符串。下面先定义 ngx_hash_init_t 和 ngx_hash_keys_arrays_t 变量，为初始化散列表做准备，代码如下。

```C
// 定义用于初始化散列表的结构体
ngx_hash_init_t hash;
/* ngx*hash_keys_arrays_t 用于预先向散列表中添加元素，这里的元素支持带通配符 */
ngx_hash_keys_arrays_t ha;
// 支持通配符的散列表
ngx_hash_combined_t combinedHash;
ngx_memzero(&ha, sizeof(ngx_hash_keys_arrays_t));
```

combinedHash 是我们定义的用于指向散列表的变量，它包括指向 3 个散列表的指针，下面会依次给这 3 个散列表指针赋值。
临时内存池只是用于初始化通配符散列表，在初始化完成后就可以销毁掉

```C
ha.temp_pool = ngx_create_pool(16384, cf->log);
if (ha.temp_pool == NULL)
{
    return NGX_ERROR;
}
/*由于这个例子是在 ngx_http_mytest_postconf 函数中的，所以就用了 ngx_conf_t 类型的 cf 下的内存池作为散列表的内存池 */
ha.pool = cf->pool;
// 调用 ngx_hash_keys_array_init 方法来初始化 ha，为下一步向 ha 中加入散列表元素做好准备，代码如下。
if (ngx_hash_keys_array_init(&ha, NGX_HASH_LARGE) != NGX_OK)
{
    return NGX_ERROR;
}
```

本节按照图 7-12 和图 7-15 中的例子建立 3 个数据，并且会覆盖 7.7 节中介绍的散列表内 容。我们建立的 testHashNode[3]这 3 个 TestWildcardHashNode 类型的结构体，分别表示可以用 前置通配符匹配的散列表元素、可以用后置通配符匹配的散列表元素、需要完全匹配的散列 表元素。

```C
TestWildcardHashNode testHashNode[3];
testHashNode[0].servername.len = ngx_strlen(".test.com");
testHashNode[0].servername.data = ngx_pcalloc(cf -> pool, ngx_strlen(".test.com"));
ngx_memcpy(testHashNode[0].servername.data, ".test.com", ngx_strlen(".test.com"));
testHashNode[1].servername.len = ngx_strlen("www.test.*");
testHashNode[1].servername.data = ngx_pcalloc(cf -> pool, ngx_strlen("www.test.*"));
ngx_memcpy(testHashNode[1].servername.data, "www.test.*", ngx_strlen("www.test.*"));
testHashNode[2].servername.len = ngx_strlen("www.test.com");
testHashNode[2].servername.data = ngx_pcalloc(cf -> pool, ngx_strlen("www.test.com"));
ngx_memcpy(testHashNode[2].servername.data, "www.test.com", ngx_strlen("www.test.com"));

```

下面通过调用 ngx_hash_add_key 方法将 testHashNode[3]这 3 个成员添加到 ha 中。

```C
for (i = 0; i < 3; i++)
{
    testHashNode[i].seq = i;
    ngx_hash_add_key(&ha, &testHashNode[i].servername,
                     &testHashNode[i], NGX_HASH_WILDCARD_KEY);
}
```

注意，在上面添加散列表元素时，flag 设置为 NGX_HASH_WILDCARD_KEY，这样才会 处理带通配符的关键字。

在调用 ngx_hash_init_t 的初始化函数前，先得设置好 ngx_hash_init_t 中的成员，如槽的大 小、散列方法等，如下所示。

```C
hash.key = ngx_hash_key_lc;
hash.max_size = 100;
hash.bucket_size = 48;
hash.name = "test_server_name_hash";
hash.pool = cf -> pool;
```

ha 的 keys 动态数组中存放的是需要完全匹配的关键字，如果 keys 数组不为空，那么开始 初始化第 1 个散列表，代码如下。

```C
if (ha.keys.nelts)
{
    /*需要显式地把 ngx_hash_init_t 中的 hash 指针指向 combinedHash 中的完全匹配散列表 */
    hash.hash = &combinedHash.hash;
    // 初始化完全匹配散列表时不会使用到临时内存池
    hash.temp *pool = NULL;
    /*将 keys 动态数组直接传给 ngx*hash_init 方法即可， ngx_hash_init_t 中的 hash 指针就是初始化成功的散列表 */
    if (ngx_hash_init(&hash, ha.keys.elts, ha.keys.nelts) != NGX_OK)
    {
        return NGX_ERROR;
    }
}
```

下面继续初始化前置通配符散列表，代码如下。

```C
if (ha.dns_wc_head.nelts)
{
    hash.hash = NULL;
    // 注意， ngx_hash_wildcard_init 方法需要使用临时内存池
    hash.temp_pool = ha.temp_pool;
    if (ngx_hash_wildcard_init(&hash, ha.dns_wc_head.elts,
                               ha.dns_wc_head.nelts) != NGX_OK)
    {
        return NGX_ERROR;
    }
    /* ngx_hash_init_t 中的 hash 指针是 ngx_hash_wildcard_init 初始化成功的散列表，需要将它赋到 combinedHash.wc_head 前置通配符散列表指针中 */
    combinedHash.wc_head = (ngx_hash_wildcard_t)hash.hash;
}
```

下面继续初始化后置通配符散列表，代码如下。

```C
if (ha.dns_wc_tail.nelts)
{
    hash.hash = NULL;
    // 注意， ngx_hash_wildcard_init 方法需要使用临时内存池
    hash.temp_pool = ha.temp_pool;
    if (ngx_hash_wildcard_init(&hash, ha.dns_wc_tail.elts,
                               ha.dns_wc_tail.nelts) != NGX_OK)
    {
        return NGX_ERROR;
    }
    /* ngx_hash_init_t 中的
    hash 指针是
    ngx_hash_wildcard_init 初始化成功的散列表，需要将它赋到
    combinedHash.wc_tail 后置通配符散列表指针中
    */
    combinedHash.wc_tail = (ngx_hash_wildcard_t)hash.hash;
}
```

到此，临时内存池已经没有存在的意义了，也就是说，ngx_hash_keys_arrays_t 中的这些 数组、简易散列表都可以销毁了。这时，只需要简单地把 temp_pool 内存池销毁就可以了， 代码如下。

```C
ngx_destroy_pool(ha.temp_pool);
```

下面检查一下散列表是否工作正常。首先，查询关键字www.test.org，实际上，它应该 匹配后置通配符散列表中的元素www.test.*，代码如下。

```C
// 首先定义待查询的关键字字符串 findServer
ngx_str_t findServer;
findServer.len = ngx_strlen("www.test.org");
// 为什么必须要在内存池中分配空间以保存关键字呢？因为我们使用的散列方法是 ngx_hash_key_lc，它会试着把关键字全小写
findServer.data = ngx_pcalloc(cf->pool, ngx_strlen("www.test.org"));
ngx_memcpy(findServer.data, "www.test.org", ngx_strlen("www.test.org"));
/* ngx_hash_find_combined 方法会查找出 www.test.*对应的散列表元素，返回其指向的用户数据 ngx_hash_find_combined，也就是 testHashNode[1] */
TestWildcardHashNode *findHashNode = ngx_hash_find_combined(&combinedHash, ngx_hash_key_lc(findServer.data, findServer.len),
                                                            findServer.data, findServer.len);
```

如果没有查询到的话，那么 findHashNode 值为 NULL 空指针。

下面试着查询www.test.com，实际上，testHashNode[0]、testHashNode[1]、 testHashNode[2]这 3 个节点都是匹配的，因为*.test.com、www.test.*、www.test.com明显都是 匹配的。但按照完全匹配最优先的规则，ngx_hash_find_combined 方法会返回 testHashNode[2] 的地址，也就是www.test.com对应的元素。

```C
findServer.len = ngx_strlen("www.test.com");
findServer.data = ngx_pcalloc(cf-\>pool, ngx_strlen("www.test.com"));
ngx_memcpy(findServer.data,"www.test.com",ngx_strlen("www.test.com"));
findHashNode = ngx_hash_find_combined(&combinedHash,
ngx_hash_key_lc(findServer.data, findServer.len),
findServer.data, findServer.len);
```

下面测试一下后置通配符散列表。如果查询的关键字是“smtp.test.com”，那么查询到的 应该是关键字为\*.test.com 的元素 testHashNode[0]。

```C
findServer.len = ngx_strlen("smtp.test.com");
findServer.data = ngx_pcalloc(cf-\>pool, ngx_strlen("smtp.test.com"));
ngx_memcpy(findServer.data,"smtp.test.com",ngx_strlen("smtp.test.com"));
findHashNode = ngx_hash_find_combined(&combinedHash,
ngx_hash_key_lc(findServer.data, findServer.len),
findServer.data, findServer.len);
```

### 7.8 小结

本章介绍了 Nginx 的常用容器，这对我们开发复杂的 Nginx 模块非常有意义。当我们需要 用到高级的数据结构时，选择手段是非常少的，因为 makefile 都是由 Nginx 的 configure 脚本生 成的，如果想加入第三方中间件将会带来许多风险，而自己重新实现容器的代价又非常高， 这时使用 Nginx 提供的通用容器就很有意义了。然而，Nginx 封装的这几种容器在使用上各不相同，有些令人头疼，而且代码注释几乎没有，就造成了使用这几个容器很困难，还容易出错。通过阅读本章内容，相信读者不再会为这些容器的使用而烦恼了，而且也应该具备轻松修改、升级这些容器的能力了。了解本章介绍的容器是今后深入开发 Nginx 的基础。