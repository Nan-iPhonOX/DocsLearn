# SVG 简介

SVG 是一种 XML 语言，类似 XHTML，可以用来绘制矢量图形

## 基本要素

SVG 提供了一些元素，用于定义圆形、矩形、简单或复杂的曲线。一个简单的 SVG 文档由 `<svg>` 根元素和基本的形状元素构成。另外还有一个 g 元素，它用来把若干个基本形状编成一个组。SVG 支持渐变、旋转、动画、滤镜效果、与 JavaScript 交互等等功能。

## 入门

### 一个简单的示例

```XML:line-numbers
<svg baseProfile="full" width="300" height="200">
  <rect width="100%" height="100%" fill="red" />
  <circle cx="150" cy="100" r="80" fill="green" />
  <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG</text>
</svg>
```

<svg width="300" height="200">
  <rect width="100%" height="100%" fill="red" />
  <circle cx="150" cy="100" r="80" fill="green" />
  <text x="150" y="125" font-size="60" text-anchor="middle" fill="white">SVG</text>
</svg>

1. 绘制一个完全覆盖图像区域的矩形 `<rect>`，把背景颜色设为红色。
1. 一个半径 80px 的绿色圆圈 `<circle>` 绘制在红色矩形的正中央（向右偏移 150px，向下偏移 100px）。
1. 绘制文字“SVG”。文字被填充为白色，通过设置居中的锚点把文字定位到期望的位置：在这种情况下，中心点应该对应于绿色圆圈的中点。还可以精细调整字体大小和垂直位置，1. 确保最后的样式是美观的。

### 基本属性

- 最值得注意的一点是元素的渲染顺序。SVG 文件全局有效的规则是“后来居上”，越后面的元素越可见。
- web 上的 SVG 文件可以直接在浏览器上展示，或者通过以下几种方法嵌入到 HTML 文件中：
  - 如果 HTML 是 XHTML 并且声明类型为 application/xhtml+xml，可以直接把 SVG 嵌入到 XML 源码中。
  - SVG 可以直接被嵌入到 HTML 中。
  - 可以使用 img 元素。
  - 可以通过 object 元素引用 SVG 文件：
  ```HTML
  <object data="image.svg" type="image/svg+xml"></object>
  ```
  - 类似的也可以使用 iframe 元素引用 SVG 文件：
  ```HTML
  <iframe src="image.svg"></iframe>
  ```
  - 最后，SVG 可以通过 JavaScript 动态创建并注入到 HTML DOM 中。

## 坐标定位

### 网格

对于所有元素，SVG 使用的坐标系统或者说网格系统（所有计算机绘图都差不多）。这种坐标系统是：以页面的左上角为 (0,0) 坐标点，坐标以像素为单位，x 轴正方向是向右，y 轴正方向是向下。

<svg width="60%" viewBox="0 0 100 100" stroke-width="0.3">
    <rect x="5" y="5" width="90" height="90" stroke="gray" fill="none" rx="2" />
    <rect x="10" y="10" width="80"height="80" stroke="gray" fill="gray" rx="2"  fill-opacity="0.2"/>
    <g stroke-linecap="square" stroke="gray" opacity="0.7" stroke-width="0.1">
        <line x1="25" y1="20" x2="25" y2="80"/>
        <line x1="30" y1="20" x2="30" y2="80"/>
        <line x1="35" y1="20" x2="35" y2="80"/>
        <line x1="40" y1="20" x2="40" y2="80"/>
        <line x1="45" y1="20" x2="45" y2="80"/>
        <line x1="50" y1="20" x2="50" y2="80"/>
        <line x1="55" y1="20" x2="55" y2="80"/>
        <line x1="60" y1="20" x2="60" y2="80"/>
        <line x1="65" y1="20" x2="65" y2="80"/>
        <line x1="70" y1="20" x2="70" y2="80"/>
        <line x1="75" y1="20" x2="75" y2="80"/>
        <line x1="80" y1="20" x2="80" y2="80" stroke="black" stroke-opacity="1" stroke-width="0.2"/>
        <line y1="25" x1="20" y2="25" x2="80"/>
        <line y1="30" x1="20" y2="30" x2="80"/>
        <line y1="35" x1="20" y2="35" x2="80"/>
        <line y1="40" x1="20" y2="40" x2="80"/>
        <line y1="45" x1="20" y2="45" x2="80"/>
        <line y1="50" x1="20" y2="50" x2="80"/>
        <line y1="55" x1="20" y2="55" x2="80"/>
        <line y1="60" x1="20" y2="60" x2="80"/>
        <line y1="65" x1="20" y2="65" x2="80"/>
        <line y1="70" x1="20" y2="70" x2="80"/>
        <line y1="75" x1="20" y2="75" x2="80"/>
        <line y1="80" x1="20" y2="80" x2="80" stroke="black" stroke-opacity="1" stroke-width="0.2"/>
    </g>
    <g stroke-linecap="round" stroke="black">
        <line x1="19" y1="20" x2="83" y2="20"/>
        <line x1="83" y1="20" x2="82" y2="19"/>
        <line x1="83" y1="20" x2="82" y2="21"/>
        <line y1="19" x1="20" y2="83" x2="20"/>
        <line y1="83" x1="20" y2="82" x2="19"/>
        <line y1="83" x1="20" y2="82" x2="21"/>
        <text x="19" y="18" font-size="4">0</text>
        <text x="16" y="21" font-size="4">0</text>
        <line x1="38" y1="20" x2="38.0" y2="38"/>
        <line x1="38" y1="20" x2="37.5" y2="21"/>
        <line x1="38" y1="20" x2="38.5" y2="21"/>
        <line x1="38" y1="38" x2="37.5" y2="37"/>
        <line x1="38" y1="38" x2="38.5" y2="37"/>
        <text x="38.5" y="30" font-size="4">x</text>
        <line y1="38" x1="20" y2="38.0" x2="38"/>
        <line y1="38" x1="20" y2="37.5" x2="21"/>
        <line y1="38" x1="20" y2="38.5" x2="21"/>
        <line y1="38" x1="38" y2="37.5" x2="37"/>
        <line y1="38" x1="38" y2="38.5" x2="37"/>
        <text y="41" x="28" font-size="4">y</text>
        <text x="45" y="84" font-size="4">width</text>
        <text x="84" y="55" font-size="4" transform="rotate(270,84,55)
">height</text>
    </g>
    <rect x="38" y="38" width="24" height="24" fill="blue"/>
</svg>

:::tip 注意
注意，这和你小时候所教的绘图方式是相反的。但是在 HTML 文档中，元素都是用这种方式定位的。
:::

### 示例

```xml
<rect x="0" y="0" width="100" height="100"/>
```

上面的元素定义了一个 100\*100px 的 SVG 画布，这里 1 用户单位等同于 1 屏幕单位。

```HTML
<svg width="200" height="200" viewBox="0 0 100 100">…</svg>
```

这里定义的画布尺寸是 `200*200px`。但是，viewBox 属性定义了画布上可以显示的区域：从 (0,0) 点开始，`100 宽*100 高`的区域。这个 `100*100` 的区域，会放到 `200*200` 的画布上显示。于是就形成了放大两倍的效果。

用户单位和屏幕单位的映射关系被称为**用户坐标系统**。除了缩放之外，坐标系统还可以旋转、倾斜、翻转。默认的用户坐标系统 1 用户像素等于设备上的 1 像素（但是设备上可能会自己定义 1 像素到底是多大）。在定义了具体尺寸单位的 SVG 中，比如单位是“cm”或“in”，最终图形会以实际大小的 1 比 1 比例呈现。

:::details 展开详解
[…] 假设在用户的设备环境里，1px 等于 0.2822222 毫米（即分辨率是 90dpi），那么所有的 SVG 内容都会按照这种比例处理： […] "1cm" 等于 "35.43307px"（即 35.43307 用户单位）；
:::

## 基本形状

要想插入一个形状，你可以在文档中创建一个元素。不同的元素对应着不同的形状，并且使用不同的属性来定义图形的大小和位置。有一些形状因为可以由其他的形状创建而略显冗余，但是它们用起来方便，可让我们的 SVG 文档简洁易懂。下面的代码展示了所有的基本形状：

```XML
<?xml version="1.0" standalone="no"?>
<svg width="200" height="250" version="1.1" xmlns="http://www.w3.org/2000/svg">

  <rect x="10" y="10" width="30" height="30" stroke="black" fill="transparent" stroke-width="5"/>
  <rect x="60" y="10" rx="10" ry="10" width="30" height="30" stroke="black" fill="transparent" stroke-width="5"/>

  <circle cx="25" cy="75" r="20" stroke="red" fill="transparent" stroke-width="5"/>
  <ellipse cx="75" cy="75" rx="20" ry="5" stroke="red" fill="transparent" stroke-width="5"/>

  <line x1="10" x2="50" y1="110" y2="150" stroke="orange" stroke-width="5"/>
  <polyline points="60 110 65 120 70 115 75 130 80 125 85 140 90 135 95 150 100 145"
      stroke="orange" fill="transparent" stroke-width="5"/>

  <polygon points="50 160 55 180 70 180 60 190 65 205 50 195 35 205 40 190 30 180 45 180"
      stroke="green" fill="transparent" stroke-width="5"/>

  <path d="M20,230 Q40,205 50,230 T90,230" fill="none" stroke="blue" stroke-width="5"/>
</svg>
```

<svg width="200" height="250" version="1.1" xmlns="http://www.w3.org/2000/svg">

  <rect x="10" y="10" width="30" height="30" stroke="black" fill="transparent" stroke-width="5"/>
  <rect x="60" y="10" rx="10" ry="10" width="30" height="30" stroke="black" fill="transparent" stroke-width="5"/>

  <circle cx="25" cy="75" r="20" stroke="red" fill="transparent" stroke-width="5"/>
  <ellipse cx="75" cy="75" rx="20" ry="5" stroke="red" fill="transparent" stroke-width="5"/>

  <line x1="10" x2="50" y1="110" y2="150" stroke="orange" stroke-width="5"/>
  <polyline points="60 110 65 120 70 115 75 130 80 125 85 140 90 135 95 150 100 145"
      stroke="orange" fill="transparent" stroke-width="5"/>

<polygon points="50 160 55 180 70 180 60 190 65 205 50 195 35 205 40 190 30 180 45 180"
      stroke="green" fill="transparent" stroke-width="5"/>

  <path d="M20,230 Q40,205 50,230 T90,230" fill="none" stroke="blue" stroke-width="5"/>
</svg>

:::info 备注
stroke、stroke-width 和 fill 等属性在后面的章节中解释。
:::

### 矩形

就像你能联想到的，rect 元素会在屏幕上绘制一个矩形。其实只要 6 个基本属性就可以控制它在屏幕上的位置和形状。上面的图例中最先展示了 2 个矩形，虽然这有点冗余了。右边的那个图形设置了 rx 和 ry 属性用来控制圆角。如果没有设置圆角，则默认为 0。

```XML
<rect x="10" y="10" width="30" height="30"/>
<rect x="60" y="10" rx="10" ry="10" width="30" height="30"/>
```

> x
>
> > 矩形左上角的 x 位置
>
> y
>
> > 矩形左上角的 y 位置
>
> width
>
> > 矩形的宽度
>
> height
>
> > 矩形的高度
>
> rx
>
> > 圆角的 x 方位的半径
>
> ry
>
> > 圆角的 y 方位的半径

### 圆形

正如你猜到的，circle 元素会在屏幕上绘制一个圆形。它只有 3 个属性用来设置圆形。

```XML
<circle cx="25" cy="75" r="20"/>
```

> r
>
> > 圆的半径
>
> cx
>
> > 圆心的 x 位置
>
> cy
>
> > 圆心的 y 位置

### 椭圆

Ellipse 是 circle 元素更通用的形式，你可以分别缩放圆的 x 半径和 y 半径（通常数学家称之为长轴半径和短轴半径）

```XML
<ellipse cx="75" cy="75" rx="20" ry="5"/>
```

> rx
>
> > 椭圆的 x 半径
>
> ry
>
> > 椭圆的 y 半径
>
> cx
>
> > 椭圆中心的 x 位置
>
> cy
>
> > 椭圆中心的 y 位置

### 线条

Line 绘制直线。它取两个点的位置作为属性，指定这条线的起点和终点位置。

```XML
<line x1="10" x2="50" y1="110" y2="150" stroke="black" stroke-width="5"/>
```

> x1
>
> > 起点的 x 位置
>
> y1
>
> > 起点的 y 位置
>
> x2
>
> > 终点的 x 位置
>
> y2
>
> > 终点的 y 位置

### 折线

Polyline 是一组连接在一起的直线。因为它可以有很多的点，折线的所有点位置都放在一个 points 属性中：

```XML
<polyline points="60, 110 65, 120 70, 115 75, 130 80, 125 85, 140 90, 135 95, 150 100, 145"/>
```

> points
>
> > 点集数列。每个数字用空白、逗号、终止命令符或者换行符分隔开。每个点必须包含 2 个数字，一个是 x 坐标，一个是 y 坐标。所以点列表 (0,0), (1,1) 和 (2,2) 可以写成这样：“0 0, 1 1, 2 2”。

### 多边形

polygon 和折线很像，它们都是由连接一组点集的直线构成。不同的是，polygon 的路径在最后一个点处自动回到第一个点。需要注意的是，矩形也是一种多边形，如果需要更多灵活性的话，你也可以用多边形创建一个矩形。

```XML
<polygon points="50, 160 55, 180 70, 180 60, 190 65, 205 50, 195 35, 205 40, 190 30, 180 45, 180"/>
```

> points
>
> > 点集数列。每个数字用空白符、逗号、终止命令或者换行符分隔开。每个点必须包含 2 个数字，一个是 x 坐标，一个是 y 坐标。所以点列表 (0,0), (1,1) 和 (2,2) 可以写成这样：“0 0, 1 1, 2 2”。路径绘制完后闭合图形，所以最终的直线将从位置 (2,2) 连接到位置 (0,0)。

### 路径

path 可能是 SVG 中最常见的形状。你可以用 path 元素绘制矩形（直角矩形或者圆角矩形）、圆形、椭圆、折线形、多边形，以及一些其他的形状，例如贝塞尔曲线、2 次曲线等曲线。因为 path 很强大也很复杂，所以会在下一章进行详细介绍。这里只介绍一个定义路径形状的属性。

```XML
<path d="M20,230 Q40,205 50,230 T90,230" fill="none" stroke="blue" stroke-width="5"/>
```

> d
>
> > 一个点集数列以及其他关于如何绘制路径的信息。请阅读路径章节以了解更多信息。

## 路径

`<path>`元素是 SVG 基本形状中最强大的一个。只需要设定很少的点，就可以创建平滑流畅的线条（比如曲线）。虽然 polyline 元素也能实现类似的效果，但是必须设置大量的点（点越密集，越接近连续，看起来越平滑流畅），并且这种做法不能够放大（放大后，点的离散更明显）。所以在绘制 SVG 时，对路径的良好理解很重要。虽然不建议使用 XML 编辑器或文本编辑器创建复杂的路径，但了解它们的工作方式将有助于识别和修复 SVG 中的显示问题。

每一个命令都用一个关键字母来表示，比如，字母“M”表示的是“Move to”命令，当解析器读到这个命令时，它就知道你是打算移动到某个点。跟在命令字母后面的，是你需要移动到的那个点的 x 和 y 轴坐标。比如移动到 (10,10) 这个点的命令，应该写成“M 10 10”。这一段字符结束后，解析器就会去读下一段命令。每一个命令都有两种表示方式，一种是用`大写字母`，表示采用`绝对定位`。另一种是用`小写字母`，表示采用`相对定位`（例如：从上一个点开始，向上移动 10px，向左移动 7px）。

因为属性 d 采用的是`用户坐标系统`，所以`不需标明单位`。在后面的教程中，我们会学到如何让变换路径，以满足更多需求。

### 直线命令

`<path>`元素里有 5 个画直线的命令，顾名思义，直线命令就是在两个点之间画直线。首先是“`Move to`”命令，M，前面已经提到过，它需要两个参数，分别是需要移动到的点的 x 轴和 y 轴的坐标。假设，你的画笔当前位于一个点，在使用 M 命令移动画笔后，只会移动画笔，但不会在两点之间画线。因为 `M 命令仅仅是移动画笔，但不画线`。所以 M 命令经常出现在路径的开始处，用来指明从何处开始画。

:::tip 例：
M x y 

m dx dy
:::

这有一个比较好的例子，不过我们没画任何东西，只是将画笔移动到路径的起点，所以我们不会看到任何图案。但是，我把我们移动到的点标注出来了，所以在下面的例子里会看到 (10,10) 坐标上有一个点。注意，如果只画 path，这里什么都不会显示。（这段不太好理解，说明一下：为了更好地展示路径，下面的所有例子里，在用 path 绘制路径的同时，也会用 circle 标注路径上的点。）

<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M10 10"/>
  <circle cx="10" cy="10" r="2" fill="red"/>
</svg>

```XML
<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">

  <path d="M10 10"/>

  <!-- Points -->
  <circle cx="10" cy="10" r="2" fill="red"/>

</svg>
```
能够真正画出线的命令有三个（M 命令是移动画笔位置，但是不画线），最常用的是“Line to”命令，L，L需要两个参数，分别是一个点的 x 轴和 y 轴坐标，L 命令将会在当前位置和新位置（L 前面画笔所在的点）之间画一条线段。

:::tip 例：
L x y 或者 l dx dy
:::

另外还有两个简写命令，用来绘制水平线和垂直线。H，绘制水平线。V，绘制垂直线。这两个命令都只带一个参数，标明在 x 轴或 y 轴移动到的位置，因为它们都只在坐标轴的一个方向上移动。
:::tip 例：
H x 或 h dx

V y 或 v dy
:::

现在我们已经掌握了一些命令，可以开始画一些东西了。先从简单的地方开始，画一个简单的矩形（同样的效果用`<rect/>`元素可以更简单的实现），矩形是由水平线和垂直线组成的，所以这个例子可以很好地展现前面讲的画线的方法。

<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
<rect width="200" height="200" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 10 H 90 V 90 H 10 L 10 10"/>

  <!-- Points -->
  <circle cx="10" cy="10" r="2" fill="red"/>
  <circle cx="90" cy="90" r="2" fill="red"/>
  <circle cx="90" cy="10" r="2" fill="red"/>
  <circle cx="10" cy="90" r="2" fill="red"/>

</svg>

```XML
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">

  <path d="M 10 10 H 90 V 90 H 10 L 10 10"/>

  <!-- Points -->
  <circle cx="10" cy="10" r="2" fill="red"/>
  <circle cx="90" cy="90" r="2" fill="red"/>
  <circle cx="90" cy="10" r="2" fill="red"/>
  <circle cx="10" cy="90" r="2" fill="red"/>

</svg>
```

最后，我们可以通过一个“闭合路径命令”Z 来简化上面的 path，Z命令会从当前点画一条直线到路径的起点，尽管我们不总是需要闭合路径，但是它还是经常被放到路径的最后。另外，Z 命令不用区分大小写。

:::tip 例：
Z or z
:::

所以上面例子里用到的路径，可以简化成这样：

```XML
 <path d="M 10 10 H 90 V 90 H 10 Z" fill="transparent" stroke="black"/>
```
你也可以使用这些命令的相对坐标形式来绘制相同的图形，如之前所述，相对命令使用的是小写字母，它们的参数不是指定一个明确的坐标，而是表示相对于它前面的点需要移动多少距离。例如前面的示例，画的是一个 80*80 的正方形，用相对命令可以这样描述：

```XML
 <path d="M 10 10 h 80 v 80 h -80 Z" fill="transparent" stroke="black"/>
```

上述路径是：画笔移动到 (10,10) 点，由此开始，向右移动 80 像素构成一条水平线，然后向下移动 80 像素，然后向左移动 80 像素，然后再回到起点。

你可能会问这些命令有什么用，因为` <polygon> `和 `<polyline>` 可以做到画出一样的图形。答案是，`这些命令可以做得更多`。如果你只是画直线，那么其他元素可能会更好用，但是，path 却是众多开发者在 SVG 绘制中经常用到的。据我所知，`它们之间不存在性能上的优劣`。但是通过脚本生成 path 可能有所不同，因为另外两种方法只需要指明点，而 path 在这方面的语法会更复杂一些。

### 曲线命令

绘制平滑曲线的命令有三个，其中`两个用来绘制贝塞尔曲线`，另外`一个用来绘制弧形或者说是圆的一部分`。如果你在 Inkscape、Illustrator 或者 Photoshop 中用过路径工具，可能对贝塞尔曲线有一定程度的了解。欲了解贝塞尔曲线的完整数学讲解，请阅读这份 [Wikipedia](https://zh.wikipedia.org/wiki/%E8%B2%9D%E8%8C%B2%E6%9B%B2%E7%B7%9A) 的文档。在这里不用讲得太多。贝塞尔曲线的类型有很多，但是在 path 元素里，只存在两种贝塞尔曲线：`三次贝塞尔曲线 C`，和`二次贝塞尔曲线 Q`。

贝塞尔曲线
我们从稍微复杂一点的三次贝塞尔曲线 C 入手，三次贝塞尔曲线需要定义一个点和两个控制点，所以用 C 命令创建三次贝塞尔曲线，需要设置三组坐标参数：

:::tip 例：
C x1 y1, x2 y2, x y

c dx1 dy1, dx2 dy2, dx dy
:::

这里的最后一个坐标 (x,y) 表示的是曲线的终点，另外两个坐标是控制点，(x1,y1) 是起点的控制点，(x2,y2) 是终点的控制点。如果你熟悉代数或者微积分的话，会更容易理解控制点，控制点描述的是`曲线起始点的斜率`，曲线上各个点的斜率，是从起点斜率到终点斜率的渐变过程。

<svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 10 C 20 20, 40 20, 50 10" stroke="black" fill="transparent"/>
  <circle cx="10" cy="10" r="2" fill="red"/>
  <circle cx="20" cy="20" r="2" fill="red"/>
  <line x1="10" y1="10" x2="20" y2="20" stroke="red"/>
  <circle cx="40" cy="20" r="2" fill="red"/>
  <circle cx="50" cy="10" r="2" fill="red"/>
  <line x1="40" y1="20" x2="50" y2="10" stroke="red"/>
  <path d="M 70 10 C 70 20, 110 20, 110 10" stroke="black" fill="transparent"/>
  <circle cx="70" cy="10" r="2" fill="red"/>
  <circle cx="70" cy="20" r="2" fill="red"/>
  <line x1="70" y1="10" x2="70" y2="20" stroke="red"/>
  <circle cx="110" cy="20" r="2" fill="red"/>
  <circle cx="110" cy="10" r="2" fill="red"/>
  <line x1="110" y1="20" x2="110" y2="10" stroke="red"/>
  <path d="M 130 10 C 120 20, 180 20, 170 10" stroke="black" fill="transparent"/>
  <path d="M 10 60 C 20 80, 40 80, 50 60" stroke="black" fill="transparent"/>
  <path d="M 70 60 C 70 80, 110 80, 110 60" stroke="black" fill="transparent"/>
  <path d="M 130 60 C 120 80, 180 80, 170 60" stroke="black" fill="transparent"/>
  <path d="M 10 110 C 20 140, 40 140, 50 110" stroke="black" fill="transparent"/>
  <path d="M 70 110 C 70 140, 110 140, 110 110" stroke="black" fill="transparent"/>
  <path d="M 130 110 C 120 140, 180 140, 170 110" stroke="black" fill="transparent"/>
</svg>

```XML
<svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 10 C 20 20, 40 20, 50 10" stroke="black" fill="transparent"/>
  <circle cx="10" cy="10" r="2" fill="red"/>
  <circle cx="20" cy="20" r="2" fill="red"/>
  <line x1="10" y1="10" x2="20" y2="20" stroke="red"/>
  <circle cx="40" cy="20" r="2" fill="red"/>
  <circle cx="50" cy="10" r="2" fill="red"/>
  <line x1="40" y1="20" x2="50" y2="10" stroke="red"/>
  <path d="M 70 10 C 70 20, 110 20, 110 10" stroke="black" fill="transparent"/>
  <circle cx="70" cy="10" r="2" fill="red"/>
  <circle cx="70" cy="20" r="2" fill="red"/>
  <line x1="70" y1="10" x2="70" y2="20" stroke="red"/>
  <circle cx="110" cy="20" r="2" fill="red"/>
  <circle cx="110" cy="10" r="2" fill="red"/>
  <line x1="110" y1="20" x2="110" y2="10" stroke="red"/>
  <path d="M 130 10 C 120 20, 180 20, 170 10" stroke="black" fill="transparent"/>
  <path d="M 10 60 C 20 80, 40 80, 50 60" stroke="black" fill="transparent"/>
  <path d="M 70 60 C 70 80, 110 80, 110 60" stroke="black" fill="transparent"/>
  <path d="M 130 60 C 120 80, 180 80, 170 60" stroke="black" fill="transparent"/>
  <path d="M 10 110 C 20 140, 40 140, 50 110" stroke="black" fill="transparent"/>
  <path d="M 70 110 C 70 140, 110 140, 110 110" stroke="black" fill="transparent"/>
  <path d="M 130 110 C 120 140, 180 140, 170 110" stroke="black" fill="transparent"/>
</svg>
```

上面的例子里，创建了 9 个三次贝塞尔曲线。有一点比较遗憾，标记控制点的代码会比较庞大，所以在这里舍弃了。（之前所有点都用 circle 标记，此处一样，只不过没把全部代码列出来）。如果你想更准确地控制它们，可以自己动手把他们画出来。图例上的曲线从左往右看，控制点在水平方向上逐渐分开，图例上的曲线从上往下看，控制点和曲线坐标之间离得越来越远。这里要注意观察，曲线沿着起点到第一控制点的方向伸出，逐渐弯曲，然后沿着第二控制点到终点的方向结束。

你可以将若干个贝塞尔曲线连起来，从而创建出一条很长的平滑曲线。通常情况下，一个点某一侧的控制点是它另一侧的控制点的对称（以保持斜率不变）。这样，你可以使用一个简写的贝塞尔曲线命令 S，如下所示：

:::tip 例：
S x2 y2, x y

s dx2 dy2, dx dy
:::

S 命令可以用来创建与前面一样的贝塞尔曲线，但是，如果 S 命令跟在一个 C 或 S 命令后面，则它的第一个控制点会被假设成前一个命令曲线的第二个控制点的中心对称点。如果 S 命令单独使用，前面没有 C 或 S 命令，那当前点将作为第一个控制点。下面是 S 命令的语法示例，图中左侧红色标记的点对应的控制点即为蓝色标记点。

<svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" stroke="black" fill="transparent"/>
  <circle cx="10" cy="80" r="2" fill="red"/>
  <circle cx="40" cy="10" r="2" fill="red"/>
  <circle cx="65" cy="10" r="2" fill="red"/>
  <circle cx="95" cy="80" r="2" fill="red"/>
  <circle cx="125" cy="150" r="2" fill="blue"/>
  <circle cx="150" cy="150" r="2" fill="red"/>
  <circle cx="180" cy="80" r="2" fill="red"/>
</svg>

```XML
<svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
  <path d="M 10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" stroke="black" fill="transparent"/>
  <circle cx="10" cy="80" r="2" fill="red"/>
  <circle cx="40" cy="10" r="2" fill="red"/>
  <circle cx="65" cy="10" r="2" fill="red"/>
  <circle cx="95" cy="80" r="2" fill="red"/>
  <!-- 蓝色是S简写的对称点 -->
  <circle cx="125" cy="150" r="2" fill="blue"/>
  <circle cx="150" cy="150" r="2" fill="red"/>
  <circle cx="180" cy="80" r="2" fill="red"/>
</svg>
```

另一种可用的贝塞尔曲线是二次贝塞尔曲线 Q，它比三次贝塞尔曲线简单，只需要一个控制点，用来确定起点和终点的曲线斜率。因此它需要两组参数，控制点和终点坐标。

:::tip 例：
Q x1 y1, x y

q dx1 dy1, dx dy
:::

<svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 80 Q 95 10 180 80" stroke="black" fill="transparent"/>
  <circle cx="95" cy="10" r="2" fill="red"/>
  <circle cx="10" cy="80" r="2" fill="black"/>
  <circle cx="180" cy="80" r="2" fill="black"/>
  <line x1="10" y1="80" x2="95" y2="10" stroke="red"/>
  <line x1="180" y1="80" x2="95" y2="10" stroke="red"/>
  <circle cx="95" cy="164" r="118" fill="green" opacity="0.5"/>
</svg>

```XML
<svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 80 Q 95 10 180 80" stroke="black" fill="transparent"/>
  <circle cx="95" cy="10" r="2" fill="red"/>
  <circle cx="10" cy="80" r="2" fill="black"/>
  <circle cx="180" cy="80" r="2" fill="black"/>
  <line x1="10" y1="80" x2="95" y2="10" stroke="red"/>
  <line x1="180" y1="80" x2="95" y2="10" stroke="red"/>
</svg>
```

就像三次贝塞尔曲线有一个 S 命令，二次贝塞尔曲线有一个差不多的 T 命令，可以通过更简短的参数，延长二次贝塞尔曲线。

:::tip 例：
T x y

t dx dy
:::

和之前一样，快捷命令 T 会通过前一个控制点，推断出一个新的控制点。这意味着，在你的第一个控制点后面，可以只定义终点，就创建出一个相当复杂的曲线。需要注意的是，T 命令前面必须是一个 Q 命令，或者是另一个 T 命令，才能达到这种效果。如果 T 单独使用，那么控制点就会被认为和终点是同一个点，所以画出来的将是一条直线。

<svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 80 Q 52.5 10, 95 80 T 180 80" stroke="black" fill="transparent"/>
</svg>

```XML
<svg width="190" height="160" xmlns="http://www.w3.org/2000/svg">
  <path d="M 10 80 Q 52.5 10, 95 80 T 180 80" stroke="black" fill="transparent"/>
</svg>
```

### 弧形

弧形命令 A 是另一个创建 SVG 曲线的命令。基本上，弧形可以视为圆形或椭圆形的一部分。假设，已知椭圆形的长轴半径和短轴半径，并且已知两个点（在椭圆上），根据半径和两点，可以画出两个椭圆，在每个椭圆上根据两点都可以画出两种弧形。所以，仅仅根据半径和两点，可以画出四种弧形。为了保证创建的弧形唯一，A 命令需要用到比较多的参数：

:::tip 例：
A rx ry x-axis-rotation large-arc-flag sweep-flag x y

a rx ry x-axis-rotation large-arc-flag sweep-flag dx dy
:::

弧形命令 A 的前两个参数分别是 x 轴半径和 y 轴半径，它们的作用很明显，不用多做解释，如果你不是很清楚它们的作用，可以参考一下椭圆 [ellipse](#椭圆)命令中的相同参数。弧形命令 A 的第三个参数`x-axis-rotation`表示弧形的旋转情况，下面的例子可以很好地解释它：

<svg width="320" height="320" xmlns="http://www.w3.org/2000/svg">
<rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 315
           L 110 215
           A 30 50 0 0 1 162.55 162.45
           L 172.55 152.45
           A 30 50 -45 0 1 215.1 109.9
           L 315 10" stroke="black" fill="green" stroke-width="2" fill-opacity="0.5"/>
  <ellipse rx="30" ry="50" cx="135.55" cy="186.45" fill="blue" fill-opacity="0.3"/>
  <circle cx="110" cy="215" r="2" fill="red"/>
  <circle cx="162.55" cy="162.45" r="2" fill="red"/>
</svg>

```XML
<svg width="320" height="320" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 315
           L 110 215
           A 30 50 0 0 1 162.55 162.45
           L 172.55 152.45
           A 30 50 -45 0 1 215.1 109.9
           L 315 10" stroke="black" fill="green" stroke-width="2" fill-opacity="0.5"/>
    <!-- 与中心位置无关 -->
  <ellipse rx="30" ry="50" cx="135.55" cy="186.45" fill="blue" fill-opacity="0.3"/>
  <circle cx="110" cy="215" r="2" fill="red"/>
  <circle cx="162.55" cy="162.45" r="2" fill="red"/>
</svg>
```

如图例所示，画布上有一条对角线，中间有两个椭圆弧被对角线切开 (x radius = 30, y radius = 50)。第一个椭圆弧的 x-axis-rotation（x 轴旋转角度）是 0，所以弧形所在的椭圆是正置的（没有倾斜）。在第二个椭圆弧中，x-axis-rotation 设置为 -45，所以这是一个旋转了 45 度的椭圆，并以短轴为分割线，形成了两个对称的弧形。参看图示中的第二个椭圆形。

对于上图没有旋转的椭圆，只有 2 种弧形可以选择，不是 4 种，因为两点连线（也就是对角线）`正好穿过了椭圆的中心`。像下面这张图，就是普通的情况，可以画出两个椭圆，四种弧。

<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
  <rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <path d="M 10 315
           L 110 215
           A 36 60 0 0 1 150.71 170.29
           L 172.55 152.45
           A 30 50 -45 0 1 215.1 109.9
           L 315 10" stroke="black" fill="green" stroke-width="2" fill-opacity="0.5"/>
  <circle cx="150.71" cy="170.29" r="2" fill="red"/>
  <circle cx="110" cy="215" r="2" fill="red"/>
  <ellipse cx="144.931" cy="229.512" rx="36" ry="60" fill="transparent" stroke="blue"/>
  <ellipse cx="115.779" cy="155.778" rx="36" ry="60" fill="transparent" stroke="blue"/>
</svg>

```XML
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">
  <path d="M 10 315
           L 110 215
           A 36 60 0 0 1 150.71 170.29
           L 172.55 152.45
           A 30 50 -45 0 1 215.1 109.9
           L 315 10" stroke="black" fill="green" stroke-width="2" fill-opacity="0.5"/>
  <circle cx="150.71" cy="170.29" r="2" fill="red"/>
  <circle cx="110" cy="215" r="2" fill="red"/>
  <ellipse cx="144.931" cy="229.512" rx="36" ry="60" fill="transparent" stroke="blue"/>
  <ellipse cx="115.779" cy="155.778" rx="36" ry="60" fill="transparent" stroke="blue"/>
</svg>
```

上面提到的四种不同路径将由接下来的两个参数决定。如前所讲，还有两种可能的椭圆用来形成路径，它们给出的四种可能的路径中，有两种不同的路径。这里要讲的参数是 large-arc-flag（角度大小）和 sweep-flag（弧线方向），large-arc-flag 决定弧线是大于还是小于 180 度，0 表示小角度弧，1 表示大角度弧。sweep-flag 表示弧线的方向，0 表示从起点到终点沿逆时针画弧，1 表示从起点到终点沿顺时针画弧。下面的例子展示了这四种情况。

<svg width="325" height="325" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <g stroke="gray" fill="none">
    <circle cx="125" cy="80" r="45"/>
    <circle cy="125" cx="80" r="45"/>
    <circle cx="275" cy="80" r="45"/>
    <circle cx="230" cy="125" r="45"/>
    <circle cx="125" cy="230" r="45"/>
    <circle cx="80" cy="275" r="45"/>
    <circle cx="275" cy="230" r="45"/>
    <circle cx="230" cy="275" r="45"/>
  </g>
  <g stroke="black" stroke-linecap="round">
    <line x1="15" y1="15" x2="325" y2="15" />
    <line x1="15" y1="30" x2="325" y2="30" />
    <line x1="15" y1="177.5" x2="325" y2="177.5" />
    <text x="100" y="11" font-size="15">Large Arc Sweep Flag</text>
    <text x="100" y="28" font-size="15">0</text>
    <text x="250" y="28" font-size="15">1</text>
    <line y1="15" x1="15" y2="325" x2="15" />
    <line y1="15" x1="30" y2="325" x2="30" />
    <line y1="15" x1="177.5" y2="325" x2="177.5" />
    <text y="200" x="11" font-size="15" transform="rotate(270,11,200)">Sweep Flag</text>
    <text y="100" x="18" font-size="15">0</text>
    <text y="250" x="18" font-size="15">1</text>
  </g>
  <g stroke="black" stroke-width="2" fill-opacity="0.5">
  <path d="M 80 80
           A 45 45, 0, 0, 0, 125 125
           L 125 80 Z" fill="green"/>
  <path d="M 230 80
           A 45 45, 0, 1, 0, 275 125
           L 275 80 Z" fill="red"/>
  <path d="M 80 230
           A 45 45, 0, 0, 1, 125 275
           L 125 230 Z" fill="purple"/>
  <path d="M 230 230
           A 45 45, 0, 1, 1, 275 275
           L 275 230 Z" fill="blue"/>
  </g>
</svg>

```XML
<svg width="325" height="325" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" stroke="gray" fill="rgb(230,230,230)" rx="5"/>
  <g stroke="gray" fill="none">
    <circle cx="125" cy="80" r="45"/>
    <circle cy="125" cx="80" r="45"/>
    <circle cx="275" cy="80" r="45"/>
    <circle cx="230" cy="125" r="45"/>
    <circle cx="125" cy="230" r="45"/>
    <circle cx="80" cy="275" r="45"/>
    <circle cx="275" cy="230" r="45"/>
    <circle cx="230" cy="275" r="45"/>
  </g>
  <g stroke="black" stroke-linecap="round">
    <line x1="15" y1="15" x2="325" y2="15" />
    <line x1="15" y1="30" x2="325" y2="30" />
    <line x1="15" y1="177.5" x2="325" y2="177.5" />
    <text x="100" y="11" font-size="15">Large Arc Sweep Flag</text>
    <text x="100" y="28" font-size="15">0</text>
    <text x="250" y="28" font-size="15">1</text>
    <line y1="15" x1="15" y2="325" x2="15" />
    <line y1="15" x1="30" y2="325" x2="30" />
    <line y1="15" x1="177.5" y2="325" x2="177.5" />
    <text y="200" x="11" font-size="15" transform="rotate(270,11,200)">Sweep Flag</text>
    <text y="100" x="18" font-size="15">0</text>
    <text y="250" x="18" font-size="15">1</text>
  </g>
  <g stroke="black" stroke-width="2" fill-opacity="0.5">
  <path d="M 80 80
           A 45 45, 0, 0, 0, 125 125
           L 125 80 Z" fill="green"/>
  <path d="M 230 80
           A 45 45, 0, 1, 0, 275 125
           L 275 80 Z" fill="red"/>
  <path d="M 80 230
           A 45 45, 0, 0, 1, 125 275
           L 125 230 Z" fill="purple"/>
  <path d="M 230 230
           A 45 45, 0, 1, 1, 275 275
           L 275 230 Z" fill="blue"/>
  </g>
</svg>
```

你应该已经猜到了，最后两个参数是指定弧形的终点，弧形可以简单地创建圆形或椭圆形图标，比如你可以创建若干片弧形，组成一个饼图。

如果你是从 `<canvas>` 过渡到 SVG，那么弧形会比较难以掌握，但它也是非常强大的。用路径来绘制完整的圆或者椭圆是比较困难的，因为圆上的任意点都可以是起点同时也是终点，无数种方案可以选择，真正的路径无法定义。通过绘制连续的路径段落，也可以达到近似的效果，但使用真正的 circle 或者 ellipse 元素会更容易一些。


