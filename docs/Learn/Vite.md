# Vite Learn

## 开箱即用

不需要做任何额外的配置就可以使用 vite。

## 基础语法

### 模板语法

#### 文本插值

最基本的数据绑定形式是文本插值，它使用的是“Mustache”语法 (即双大括号)：

```HTML
<span>Message: {{ msg }}</span>

```

双大括号标签会被替换为相应组件实例中 msg 属性的值。同时每次 msg 属性更改时它也会同步更新。

#### 原始 HTML

```HTML
<p>Using text interpolation: {{ rawHtml }}</p>
<p>Using v-html directive: <span v-html="rawHtml"></span></p>
```

这里我们遇到了一个新的概念。这里看到的 `v-html` attribute 被称为一个指令。指令由 `v-` 作为前缀，表明它们是一些由 Vue 提供的特殊 attribute，你可能已经猜到了，它们将为渲染的 DOM 应用特殊的响应式行为。这里我们做的事情简单来说就是：在当前组件实例上，将此元素的 innerHTML 与 rawHtml 属性保持同步。

`span` 的内容将会被替换为 rawHtml 属性的值，插值为纯 HTML——数据绑定将会被忽略。注意，你不能使用 v-html 来拼接组合模板，因为 Vue 不是一个基于字符串的模板引擎。在使用 Vue 时，应当使用组件作为 UI 重用和组合的基本单元。

:::warning 安全警告
在网站上动态渲染任意 HTML 是非常危险的，因为这非常容易造成 XSS 漏洞。请仅在内容安全可信时再使用 v-html，并且永远不要使用用户提供的 HTML 内容。
:::

#### Attribute 绑定 ​

双大括号不能在 HTML attributes 中使用。想要响应式地绑定一个 attribute，应该使用 v-bind 指令`：`

```html
<div v-bind:id="dynamicId"></div>
```

v-bind 指令指示 Vue 将元素的 id attribute 与组件的 dynamicId 属性保持一致。如果绑定的值是 null 或者 undefined，那么该 attribute 将会从渲染的元素上移除。

```Vue
<template>
    <div v-bind:id="dynamicId"></div>
</template>

<script setup>
    const dynamicId = "testID"
</script>

```

渲染为

```html
<template>
  <div id="testID"></div>
</template>
```

#### 简写

因为 v-bind 非常常用，我们提供了特定的简写语法`：`

```html
<div :id="dynamicId"></div>
```

开头为`:`的 attribute 可能和一般的 HTML attribute 看起来不太一样，但它的确是合法的 attribute 名称字符，并且所有支持 Vue 的浏览器都能正确解析它。此外，他们不会出现在最终渲染的 DOM 中。简写语法是可选的，但相信在你了解了它更多的用处后，你应该会更喜欢它。

#### 同名简写

如果 attribute 的名称与绑定的 JavaScript 值的名称相同，那么可以进一步简化语法，省略 attribute 值：

```html
<!-- 与 :id="id" 相同 -->
<div :id></div>

<!-- 这也同样有效 -->
<div v-bind:id></div>
```

#### 布尔型 Attribute​

布尔型 attribute 依据 true / false 值来决定 attribute 是否应该存在于该元素上。disabled 就是最常见的例子之一。

```html
<button :disabled="isButtonDisabled">Button</button>
```

当 isButtonDisabled 为真值或一个空字符串 (即 `<button disabled="">`) 时，元素会包含这个 disabled attribute。而当其为其他假值时 attribute 将被忽略。

#### 动态绑定多个值

如果你有像这样的一个包含多个 attribute 的 JavaScript 对象：

```js
const objectOfAttrs = {
  id: "container",
  class: "wrapper",
};
```

通过不带参数的 v-bind，你可以将它们绑定到单个元素上：

```html
<div v-bind="objectOfAttrs"></div>
```

#### 使用 JavaScript 表达式

至此，我们仅在模板中绑定了一些简单的属性名。但是 Vue 实际上在所有的数据绑定中都支持完整的 JavaScript 表达式：

```html
{{ number + 1 }} {{ ok ? 'YES' : 'NO' }} {{ message.split('').reverse().join('')
}}

<div :id="`list-${id}`"></div>
```

这些表达式都会被作为 JavaScript ，以当前组件实例为作用域解析执行。

在 Vue 模板内，JavaScript 表达式可以被使用在如下场景上：

1. 在文本插值中 (双大括号)
2. 在任何 Vue 指令 (以 v- 开头的特殊 attribute) attribute 的值中

#### 仅支持表达式 ​

每个绑定仅支持单一表达式，也就是一段能够被求值的 JavaScript 代码。一个简单的判断方法是是否可以合法地写在 return 后面。

因此，下面的例子都是无效的：

```Vue
<!-- 这是一个语句，而非表达式 -->
{{ var a = 1 }}

<!-- 条件控制也不支持，请使用三元表达式 -->
{{ if (ok) { return message } }}
```

#### 调用函数

可以在绑定的表达式中使用一个组件暴露的方法：

```html
<time :title="toTitleDate(date)" :datetime="date">
  {{ formatDate(date) }}
</time>
```

:::tip 提示
绑定在表达式中的方法在组件每次更新时都会被重新调用，因此不应该产生任何副作用，比如改变数据或触发异步操作。
:::

#### 受限的全局访问

模板中的表达式将被沙盒化，仅能够访问到有限的全局对象列表。该列表中会暴露常用的内置全局对象，比如 Math 和 Date。

没有显式包含在列表中的全局对象将不能在模板内表达式中访问，例如用户附加在 window 上的属性。然而，你也可以自行在 app.config.globalProperties 上显式地添加它们，供所有的 Vue 表达式使用。

#### 指令 Directives

指令是带有 v- 前缀的特殊 attribute。Vue 提供了许多内置指令，包括上面我们所介绍的 `v-bind` 和 `v-html`。

指令 attribute 的期望值为一个 JavaScript 表达式 (除了少数几个例外，即之后要讨论到的 `v-for`、`v-on` 和 `v-slot`)。一个指令的任务是在其表达式的值变化时响应式地更新 DOM。以 v-if 为例：

```html
<p v-if="seen">Now you see me</p>
```

这里，v-if 指令会基于表达式 seen 的值的真假来移除/插入该 `<p>` 元素。

#### 参数 Arguments

某些指令会需要一个“参数”，在指令名后通过一个冒号隔开做标识。例如用 v-bind 指令来响应式地更新一个 HTML attribute：

```html
<a v-bind:href="url"> ... </a>

<!-- 简写 -->
<a :href="url"> ... </a>
```

这里 href 就是一个参数，它告诉 v-bind 指令将表达式 url 的值绑定到元素的 href attribute 上。在简写中，参数前的一切 (例如 v-bind:) 都会被缩略为一个 `:` 字符。

另一个例子是 v-on 指令，它将监听 DOM 事件：

```html
<a v-on:click="doSomething"> ... </a>

<!-- 简写 -->
<a @click="doSomething"> ... </a>
```

这里的参数是要监听的事件名称：click。v-on 有一个相应的缩写，即 @ 字符。我们之后也会讨论关于事件处理的更多细节。

#### 动态参数 ​

同样在指令参数上也可以使用一个 JavaScript 表达式，需要包含在一对方括号内：

```html
<!--
注意，参数表达式有一些约束，
参见下面“动态参数值的限制”与“动态参数语法的限制”章节的解释
-->
<a v-bind:[attributeName]="url"> ... </a>

<!-- 简写 -->
<a :[attributeName]="url"> ... </a>
```

这里的 attributeName 会作为一个 JavaScript 表达式被动态执行，计算得到的值会被用作最终的参数。举例来说，如果你的组件实例有一个数据属性 attributeName，其值为 "href"，那么这个绑定就等价于 v-bind:href。

相似地，你还可以将一个函数绑定到动态的事件名称上：

```html
<a v-on:[eventName]="doSomething"> ... </a>

<!-- 简写 -->
<a @[eventName]="doSomething"> ... </a>
```

在此示例中，当 `eventName` 的值是 `"focus"` 时，`v-on:[eventName]` 就等价于 `v-on:focus`。

#### 动态参数值的限制 ​

动态参数中表达式的值应当是一个字符串，或者是 null。特殊值 null 意为显式移除该绑定。其他非字符串的值会触发警告。

#### 动态参数语法的限制 ​

动态参数表达式因为某些字符的缘故有一些语法限制，比如空格和引号，在 HTML attribute 名称中都是不合法的。例如下面的示例：

```html
<!-- 这会触发一个编译器警告 -->
<a :['foo' + bar]="value"> ... </a>
```

如果你需要传入一个复杂的动态参数，我们推荐使用[计算属性](#计算属性)替换复杂的表达式，也是 Vue 最基础的概念之一，我们很快就会讲到。

当使用 DOM 内嵌模板 (直接写在 HTML 文件里的模板) 时，我们需要避免在名称中使用大写字母，因为浏览器会强制将其转换为小写：

```html
<a :[someAttr]="value"> ... </a>
```

上面的例子将会在 DOM 内嵌模板中被转换为 `:[someattr]`。如果你的组件拥有 “someAttr” 属性而非 “someattr”，这段代码将不会工作。单文件组件内的模板不受此限制。

#### 修饰符 Modifiers

修饰符是以点开头的特殊后缀，表明指令需要以一些特殊的方式被绑定。例如 .prevent 修饰符会告知 v-on 指令对触发的事件调用 event.preventDefault()：

```html
<form @submit.prevent="onSubmit">...</form>
```

之后在讲到 v-on 和 v-model 的功能时，你将会看到其他修饰符的例子。

### 响应式

#### 声明响应式状态

**ref()**

在组合式 API 中，推荐使用 `ref()` 函数来声明响应式状态：

```ts
import { ref } from "vue";

const count = ref(0);
```

ref() 接收参数，并将其包裹在一个带有 .value 属性的 ref 对象中返回：

```ts
const count = ref(0);

console.log(count); // { value: 0 }
console.log(count.value); // 0

count.value++;
console.log(count.value); // 1
```

要在组件模板中访问 ref，请从组件的 setup() 函数中声明并返回它们：

```ts
import { ref } from "vue";

export default {
  // `setup` 是一个特殊的钩子，专门用于组合式 API。
  setup() {
    const count = ref(0);

    // 将 ref 暴露给模板
    return {
      count,
    };
  },
};
```

```html
<div>{{ count }}</div>
```

注意，在模板中使用 ref 时，我们不需要附加 .value。为了方便起见，当在模板中使用时，ref 会自动解包 (有一些注意事项)。

你也可以直接在事件监听器中改变一个 ref：

```html
<button @click="count++">{{ count }}</button>
```

对于更复杂的逻辑，我们可以在同一作用域内声明更改 ref 的函数，并将它们作为方法与状态一起公开：

```ts
import { ref } from "vue";

export default {
  setup() {
    const count = ref(0);

    function increment() {
      // 在 JavaScript 中需要 .value
      count.value++;
    }

    // 不要忘记同时暴露 increment 函数
    return {
      count,
      increment,
    };
  },
};
```

然后，暴露的方法可以被用作事件监听器：

```html
<button @click="increment">{{ count }}</button>
```

这里是 Codepen 上的例子，没有使用任何构建工具。

**\<script setup\>**

在 setup() 函数中手动暴露大量的状态和方法非常繁琐。幸运的是，我们可以通过使用单文件组件 (SFC) 来避免这种情况。我们可以使用 `<script setup>` 来大幅度地简化代码：

```Vue
<script setup>
import { ref } from 'vue'

const count = ref(0)

function increment() {
  count.value++
}
</script>

<template>
  <button @click="increment">
    {{ count }}
  </button>
</template>
```

`<script setup>` 中的顶层的导入、声明的变量和函数可在同一组件的模板中直接使用。你可以理解为模板是在同一作用域内声明的一个 JavaScript 函数——它自然可以访问与它一起声明的所有内容。

#### 为什么要使用 ref？​

你可能会好奇：为什么我们需要使用带有 .value 的 ref，而不是普通的变量？为了解释这一点，我们需要简单地讨论一下 Vue 的响应式系统是如何工作的。

当你在模板中使用了一个 ref，然后改变了这个 ref 的值时，Vue 会自动检测到这个变化，并且相应地更新 DOM。这是通过一个基于依赖追踪的响应式系统实现的。当一个组件首次渲染时，Vue 会追踪在渲染过程中使用的每一个 ref。然后，当一个 ref 被修改时，它会触发追踪它的组件的一次重新渲染。

在标准的 JavaScript 中，检测普通变量的访问或修改是行不通的。然而，我们可以通过 getter 和 setter 方法来拦截对象属性的 get 和 set 操作。

该 .value 属性给予了 Vue 一个机会来检测 ref 何时被访问或修改。在其内部，Vue 在它的 getter 中执行追踪，在它的 setter 中执行触发。从概念上讲，你可以将 ref 看作是一个像这样的对象：

```ts
// 伪代码，不是真正的实现
const myRef = {
  _value: 0,
  get value() {
    track();
    return this._value;
  },
  set value(newValue) {
    this._value = newValue;
    trigger();
  },
};
```

另一个 ref 的好处是，与普通变量不同，你可以将 ref 传递给函数，同时保留对最新值和响应式连接的访问。当将复杂的逻辑重构为可重用的代码时，这将非常有用。

该响应性系统在深入响应式原理章节中有更详细的讨论。

#### 深层响应性 ​

Ref 可以持有任何类型的值，包括深层嵌套的对象、数组或者 JavaScript 内置的数据结构，比如 Map。

Ref 会使它的值具有`深层响应性`。这意味着即使改变嵌套对象或数组时，变化也会被检测到：

```js
import { ref } from "vue";

const obj = ref({
  nested: { count: 0 },
  arr: ["foo", "bar"],
});

function mutateDeeply() {
  // 以下都会按照期望工作
  obj.value.nested.count++;
  obj.value.arr.push("baz");
}
```

非原始值将通过 reactive() 转换为响应式代理，该函数将在后面讨论。

也可以通过 shallow ref 来放弃深层响应性。对于浅层 ref，只有 .value 的访问会被追踪。浅层 ref 可以用于避免对大型数据的响应性开销来优化性能、或者有外部库管理其内部状态的情况。

#### DOM 更新时机

当你修改了响应式状态时，DOM 会被自动更新。但是需要注意的是，DOM 更新不是同步的。Vue 会在“next tick”更新周期中缓冲所有状态的修改，以确保不管你进行了多少次状态修改，每个组件都只会被更新一次。

要等待 DOM 更新完成后再执行额外的代码，可以使用 nextTick() 全局 API：

```js
import { nextTick } from "vue";

async function increment() {
  count.value++;
  await nextTick();
  // 现在 DOM 已经更新了
}
```

**reactive()**

还有另一种声明响应式状态的方式，即使用 reactive() API。与将内部值包装在特殊对象中的 ref 不同，reactive() 将使对象本身具有响应性：

```ts
import { reactive } from "vue";

const state = reactive({ count: 0 });
```

```html
<button @click="state.count++">{{ state.count }}</button>
```

响应式对象是 JavaScript 代理，其行为就和普通对象一样。不同的是，Vue 能够拦截对响应式对象所有属性的访问和修改，以便进行依赖追踪和触发更新。

reactive() 将深层地转换对象：当访问嵌套对象时，它们也会被 reactive() 包装。当 ref 的值是一个对象时，ref() 也会在内部调用它。与浅层 ref 类似，这里也有一个 shallowReactive() API 可以选择退出深层响应性。

**Reactive Proxy vs. Original**

值得注意的是，reactive() 返回的是一个原始对象的 Proxy，它和原始对象是不相等的：

```js
const raw = {};
const proxy = reactive(raw);

// 代理对象和原始对象不是全等的
console.log(proxy === raw); // false
```

只有代理对象是响应式的，更改原始对象不会触发更新。因此，使用 Vue 的响应式系统的最佳实践是仅使用你声明对象的代理版本。

为保证访问代理的一致性，对同一个原始对象调用 reactive() 会总是返回同样的代理对象，而对一个已存在的代理对象调用 reactive() 会返回其本身：

#### v-on

<input type="text" v-on:click="add"/>

#### v-show

<p>当前状态：{{ web.show }}</p><hr>
<p v-show="web.show">显示</p>
<button @:click="toggle">切换{{ status }}</button>

<script setup>
    import {reactive, ref} from 'vue'
    const web = reactive({
      show:true
    })
    const status = ref("隐藏")   
    const count = ref(0)
    function add(){
        add++
    }
    function toggle(){
        web.show = !web.show
        status.value=web.show?"隐藏":"显示"
    }
</script>
