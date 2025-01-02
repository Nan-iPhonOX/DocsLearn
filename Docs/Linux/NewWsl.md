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
## 系统备份和还原

### 安装btrfs

```bash
sudo apt-get update
sudo apt-get install btrfs-progs
```

### 备份和还原脚本

```bash
#!/bin/bash

# 默认不还原
RESTORE=false

# 检查是否提供了时间参数
if [ "$1" ]; then
    RESTORE=true
    RESTORE_TIME="$1"
fi

# 备份源目录
SOURCE_DIR="/"

# VHDX 文件路径
VHDX_FILE="/mnt/x/WSL/backup/backup.vhdx"

# 挂载点
MOUNT_POINT="/mnt/backup"

# 检查 VHDX 文件是否存在
if [ ! -f "$VHDX_FILE" ]; then
    echo "VHDX 文件不存在: $VHDX_FILE"
    echo "创建新的 VHDX 文件..."
    dd if=/dev/zero of=$VHDX_FILE bs=1M count=10240
    mkfs.btrfs $VHDX_FILE
fi

# 挂载 VHDX 文件
mkdir -p $MOUNT_POINT
mount -o loop $VHDX_FILE $MOUNT_POINT

if [ "$RESTORE" = true ]; then
    # 还原系统到指定时间
    RESTORE_DIR="$MOUNT_POINT/$RESTORE_TIME"
    if [ ! -d "$RESTORE_DIR" ]; then
        echo "指定的还原时间目录不存在: $RESTORE_DIR"
        umount $MOUNT_POINT
        exit 1
    fi
    btrfs subvolume snapshot $RESTORE_DIR $SOURCE_DIR
    echo "系统已还原到: $RESTORE_TIME"
else
    # 备份目标目录
    DEST_DIR="$MOUNT_POINT/$(date +\%Y-\%m-\%d)"

    # 创建快照
    btrfs subvolume snapshot $SOURCE_DIR $DEST_DIR
    echo "系统已备份到: $DEST_DIR"
fi

# 卸载 VHDX 文件
umount $MOUNT_POINT
```