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

if [ "$EUID" -ne 0 ]; then
    echo "Please run as root or sudo"
    exit
fi

# 系统备份脚本

# 设置忽略备份的目录
EXCLUDE_DIR=(
# System paths
/proc/*
/sys/*
/tmp/*
/run/*
/mnt/*
/media/*
/dev/*
/lost+found

# Backup and cache directories
/backup/*
/var/log/*
/var/cache/*
/var/tmp/*
/home/*/.cache/*
/root/.cache/*

# Custom excludes
/home/**/dist/*
/home/**/node_modules/*
/home/**/vendor/*
/home/**/cache/*
/home/**/tmp/*
/home/**/temp/*
/home/**/.vscode-server/*
/home/**/.git/*
)

# status
RESTORE=false
MOUNTED=false
RC=0
# 设置颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# 如果未安装curl则安装
if ! command -v curl &> /dev/null; then
    sudo apt install -y curl
fi

# 如果未安装btrfs-progs则安装
if ! command -v btrfs &> /dev/null; then
    sudo apt install -y btrfs-progs
fi

# 如果未安装rsync则安装
if ! command -v rsync &> /dev/null; then
    sudo apt install -y rsync
fi

# 检查是否提供了时间参数
if [ "$1" ]; then
    RESTORE=true
    RESTORE_TIME="$1"
fi

# 备份Debian
SOURCE_DIR="/"

# VHDX 文件路径
VHDX_FILE="/mnt/x/WSL/backup/backup.vhdx"
# 挂载目录
MOUNT_POINT="/mnt/backup"
# 快照目录
SNAPSHAOT_DIR="/mnt/backup/snapshot"
# 系统备份目录
BACKUP_DIR="/mnt/backup/Debian"

# 检查 VHDX 文件是否存在 大小100g
if [ ! -f "$VHDX_FILE" ]; then
    echo -e "${RED}VHDX 文件不存在: $VHDX_FILE${NC}"
    echo "创建新的 VHDX 文件..."
    dd if=/dev/zero of=$VHDX_FILE bs=1M count=102400
    mkfs.btrfs $VHDX_FILE
fi

# 挂载 VHDX 文件
mkdir -p $MOUNT_POINT
mount -o loop $VHDX_FILE $MOUNT_POINT

# 检查挂载是否成功
RC=$?  # 获取 mount 命令的返回值
case $RC in
    0)
        echo -e "${GREEN}已成功挂载: $VHDX_FILE${NC}"
        ;;
    32)
        echo -e "${RED}挂载失败:权限不足 $VHDX_FILE${NC}"
        exit 1
        ;;
    *)
        if [ -d $SNAPSHAOT_DIR ]; then
            echo -e "${GREEN}已经挂载: $VHDX_FILE${NC}"
        else
            echo -e "${RED}挂载失败: $VHDX_FILE${NC}"
            exit 1
        fi
        ;;
esac

# 如果子卷Debain不存在则创建
if [ ! -d "$BACKUP_DIR" ]; then
    echo "创建子卷: $BACKUP_DIR"
    btrfs subvolume create $BACKUP_DIR
fi

# 如果快照目录不存在则创建
if [ ! -d "$SNAPSHAOT_DIR" ]; then
    echo "创建快照目录: $SNAPSHAOT_DIR"
    btrfs subvolume create $SNAPSHAOT_DIR
fi

# 构建 rsync 排除参数
EXCLUDES="--exclude=$(readlink -f "$0") "
for EXCLUDE in "${EXCLUDE_DIR[@]}"; do
    if [ -n "$EXCLUDE" ] && [ "${EXCLUDE:0:1}" != "#" ]; then
        EXCLUDES="$EXCLUDES--exclude=$EXCLUDE "
    fi
done

if [ "$RESTORE" = true ]; then
    # 还原系统到指定时间
    RESTORE_DIR="$SNAPSHAOT_DIR/$RESTORE_TIME"
    if [ ! -d "$RESTORE_DIR" ]; then
        echo -e "${RED}指定的还原时间不存在: $RESTORE_TIME${NC}"
        echo "可用的还原时间列表:"
        ls $SNAPSHAOT_DIR
        exit 1
    fi
    rsync -avxHAX --numeric-ids --delete --checksum $EXCLUDES $RESTORE_DIR/ $SOURCE_DIR
    echo -e "${GREEN}系统已还原到: $RESTORE_TIME${NC}"
else
    rsync -avxHAX --numeric-ids --delete --checksum $EXCLUDES $SOURCE_DIR $BACKUP_DIR/

    DEST_DIR="$SNAPSHAOT_DIR/$(date +%Y%m%d)"
    # 创建快照
    if [ -d "$DEST_DIR" ]; then
        btrfs subvolume delete $DEST_DIR
        rm -rf $DEST_DIR
    fi
    btrfs subvolume snapshot $BACKUP_DIR $DEST_DIR
    echo -e "${GREEN}系统已备份到: $DEST_DIR${NC}"
fi

# 卸载 VHDX 文件
umount $MOUNT_POINT

cd $(dirname $(readlink -f $0))

git add .
git commit -m "Backup Debian $(date +%Y%m%d)" 
```