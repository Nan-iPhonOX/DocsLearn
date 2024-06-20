---
layout: home

title: 图书馆
titleTemplate: 努力学习

hero:
  name: 图书馆
  text: 一个给老婆学习提供效率的站点
  tagline: 让学习随时随地
  actions:
    - theme: brand
      text: 每日一学
      link: /Learn/Expertise
    - theme: alt
      text: 使用参考
      link: /PressGuide/getting-started
  image:
      src: /log-large.svg
      alt: 认真学习

features:
  - icon: 📝
    title: 专注内容
    details: 使用markdown编写，github静态部署，随时随地进行学习。
  - icon: 📖
    title: 答案折叠 
    details: 文档对答案进行了折叠，可以先默诵答案，在点开查看要点。
  - icon: 🕓
    title: 学无止境
    details: 唯有学习才能让内心更踏实。
---
<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);

  --vp-home-hero-image-background-image: linear-gradient(-45deg, #bd34fe 50%, #47caff 50%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
</style>
