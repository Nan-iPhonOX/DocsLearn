# WSL linux 子系统
## 配置windows系统

### 配置hosts文件

```bash
https://www.ipaddress.com/website/github.com/
XXX.XXX.XXX.XXX Github.com

https://www.ipaddress.com/website/raw.githubusercontent.com/
XXX.XXX.XXX.XXX raw.githubusercontent.com
```

## 安装Debian

```bash
wsl --install -d Debian
```

### 导出默认系统到目录

```bash
 wsl --export Debian "X:\WSL\Debian.tar"
```

### 移动 WSL 系统

1. 确保 WSL 实例已停止运行：
    ```bash
    wsl --shutdown
    ```

2. 导出当前 WSL 实例（假设实例名称为 `Debian`）：
    ```bash
    wsl --export Debian "X:\WSL\Debian.tar"
    ```

3. 注销当前 WSL 实例：
    ```bash
    wsl --unregister Debian
    ```

4. 导入 WSL 实例到新的位置：
    ```bash
    wsl --import Debian "X:\WSL\Debian" "X:\WSL\Debian.tar"
    ```

5. 删除导出的 tar 文件（可选）：
    ```bash
    del "X:\WSL\Debian.tar"
    ```

### 配置默认登录用户

1. 打开命令提示符或 PowerShell。
2. 使用以下命令修改注册表项：
    ```bash
    reg add "HKEY_USERS\S-1-5-21-3598036005-1865312191-1344301846-1001\Software\Microsoft\Windows\CurrentVersion\Lxss\{24ad3913-ccaa-4f82-adfc-9d20b511487f}" /v DefaultUid /t REG_DWORD /d 1000 /f
    ```

### 使用netselect-apt配置更新源

```bash
sudo apt install netselect-apt

sudo netselect-apt -c CN bookworm && sudo mv sources.list /etc/apt/sources.list
```