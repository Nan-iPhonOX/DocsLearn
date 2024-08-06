# Markdown插件示例 

展示以下vitepress使用markdown的插件示例。

## 高亮语法 

VitePress提供由[Shiki](https://github.com/shikijs/shiki)驱动的语法高亮功能, 和附加的特征如行高亮:

**输入**

````md
```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```
````

**输出**

```js{4}
export default {
  data () {
    return {
      msg: 'Highlighted!'
    }
  }
}
```

## 自定义容器

**输入**

```md
::: info
这是一个info块。
:::

::: tip
这是一个提示。
:::

::: warning
这是一个警告。
:::

::: danger
这是一个危险的提示。
:::

::: details
这是详细信息块。
:::
```

**输出**

::: info
这是一个info块。
:::

::: tip
这是一个提示。
:::

::: warning
这是一个警告。
:::

::: danger
这是一个危险的提示。
:::

::: details
这是详细信息块。
:::

## 更多

查看Markdown插件文档[所有列表](https://vitepress.dev/guide/markdown)。
