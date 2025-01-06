import { defineConfig, type DefaultTheme } from 'vitepress'
import GenerateSideBar from "./Utils/AutoSideBar"
export default defineConfig({
  head: [["link", { rel: "icon", href: "/DocsLearn/favicon.ico" }]],
  lang: "zh-Hans",
  title: "图书馆",
  base: "/DocsLearn/",
  description: "由 Vite 和 Vue 驱动的静态站点生成器",
  themeConfig: {
    nav: nav(),
    search: {
      provider: "local",
    },
    sidebar: {
      Learn: GenerateSideBar(`Learn`),
      Linux: GenerateSideBar(`Linux`),
      Nginx: GenerateSideBar(`Nginx`),
      PressGuide: { base: "/PressGuide/", items: sidebarGuide() },
      "/PressReference/": {
        base: "/PressReference/",
        items: sidebarReference(),
      },
    },

    editLink: {
      pattern:
        "https://github.com/Nan-iPhonOX/DocsLearn/edit/main/docs/:path",
      text: "编辑此页面",
    },

    footer: {
      message: "For Miss Li.",
      copyright: `教资2019-${new Date().getFullYear()}`,
    },

    docFooter: {
      prev: "上一页",
      next: "下一页",
    },

    outline: {
      label: "目录",
    },

    lastUpdated: {
      text: "最后更新于",
      formatOptions: {
        dateStyle: "short",
        timeStyle: "medium",
      },
    },

    langMenuLabel: "多语言",
    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
  }
})

function nav(): DefaultTheme.NavItem[] {
  return [
    {
      text: "📘Learn",
      link: "/Learn/2024年业务学习/2024年05月",
      activeMatch: "/Learn/",
    },
    {
      text: "🐧Linux",
      link: "/Linux/NewWsl"
    },
    {
      text: "🆖Nginx",
      link: "/Nginx/0-01前序"
    },
    {
      text: `<img src="/DocsLearn/favicon.ico" alt="Logo" style="height: 20px; vertical-align: middle;">`,
      link: "/Learn/2024年业务学习/2024年05月"
    }
  ];
}

function sidebarGuide(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "简介",
      collapsed: false,
      items: [
        { text: "什么是 VitePress？", link: "what-is-vitepress" },
        { text: "快速开始", link: "getting-started" },
        { text: "路由", link: "routing" },
        { text: "部署", link: "deploy" },
      ],
    },
    {
      text: "写作",
      collapsed: false,
      items: [
        { text: "Markdown 扩展", link: "markdown" },
        { text: "资源处理", link: "asset-handling" },
        { text: "frontmatter", link: "frontmatter" },
        { text: "在 Markdown 使用 Vue", link: "using-vue" },
        { text: "国际化", link: "i18n" },
      ],
    },
    {
      text: "自定义",
      collapsed: false,
      items: [
        { text: "自定义主题", link: "custom-theme" },
        { text: "扩展默认主题", link: "extending-default-theme" },
        { text: "构建时数据加载", link: "data-loading" },
        { text: "SSR 兼容性", link: "ssr-compat" },
        { text: "连接 CMS", link: "cms" },
      ],
    },
    {
      text: "实验性功能",
      collapsed: false,
      items: [
        { text: "MPA 模式", link: "mpa-mode" },
        { text: "sitemap 生成", link: "sitemap-generation" },
      ],
    },
    { text: "配置和 API 参考", base: "/PressReference/", link: "site-config" },
  ];
}

function sidebarLearn(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "学习",
      items: [
        { text: "业务学习", link: "Expertise" },
        { text: "SVG", link: "SVG" },
      ],
    },
  ];
}

function sidebarReference(): DefaultTheme.SidebarItem[] {
  return [
    {
      text: "参考",
      items: [
        { text: "站点配置", link: "site-config" },
        { text: "frontmatter 配置", link: "frontmatter-config" },
        { text: "运行时 API", link: "runtime-api" },
        { text: "CLI", link: "cli" },
        {
          text: "默认主题",
          base: "/PressReference/default-theme-",
          items: [
            { text: "概览", link: "config" },
            { text: "导航栏", link: "nav" },
            { text: "侧边栏", link: "sidebar" },
            { text: "主页", link: "home-page" },
            { text: "页脚", link: "footer" },
            { text: "布局", link: "layout" },
            { text: "徽章", link: "badge" },
            { text: "团队页", link: "team-page" },
            { text: "上下页链接", link: "prev-next-links" },
            { text: "编辑链接", link: "edit-link" },
            { text: "最后更新时间戳", link: "last-updated" },
            { text: "搜索", link: "search" },
            { text: "Carbon Ads", link: "carbon-ads" },
          ],
        },
      ],
    },
  ];
}
