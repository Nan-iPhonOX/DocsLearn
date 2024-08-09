# 编译过程中遇到的问题

## ./configure：找不到命令

### 报错内容

```zsh
─ ./configure --help
zsh: 权限不够: ./configure

─ sudo ./configure --help
sudo: ./configure：找不到命令
```

### 处理方法

zsh 未把 `./configure` 看作可执行程序。
使用chmod 解决

```zsh
chmod +x ./configure
```