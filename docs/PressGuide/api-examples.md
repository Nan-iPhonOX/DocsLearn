---
outline: deep
---

# 运行接口示例

这篇文章展示一些VitePress接口(API)的用法。

主useData()API 可用于访问当前页面的网站、主题和页面数据。它适用于以下两个文件：.md.vue

```md
<script setup>
import { useData } from 'vitepress'

const { theme, page, frontmatter } = useData()
</script>

## 结果

### 主题数据
<pre>{{ theme }}</pre>

### 页面数据
<pre>{{ page }}</pre>

### 页面页首
<pre>{{ frontmatter }}</pre>
```

<script setup>
import { useData } from 'vitepress'

const { site, theme, page, frontmatter } = useData()
</script>

## 结果

### 主题数据
<pre>{{ theme }}</pre>

### 页面数据
<pre>{{ page }}</pre>

### 页面页首
<pre>{{ frontmatter }}</pre>

## More

有关[运行时 API 的完整列表](https://vitepress.dev/reference/runtime-api#usedata)，请查看文档。
