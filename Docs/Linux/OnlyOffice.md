## 安装依赖项

ONLYOFFICE 文档使用 NGINX 和 PostgreSQL 作为数据库。在系统存储库中找到的依赖项将在 ONLYOFFICE Docs 安装时使用 apt-get install 命令自动安装。

### After PostgreSQL is installed, create the PostgreSQL database and user:

数据库用户必须具有 onlyoffice 名称。您可以指定任何密码。

```bash
sudo -i -u postgres psql -c "CREATE USER onlyoffice WITH PASSWORD 'onlyoffice';"
sudo -i -u postgres psql -c "CREATE DATABASE onlyoffice OWNER onlyoffice;"
```

## 更改默认的 ONLYOFFICE Docs 端口

默认情况下，ONLYOFFICE Docs 使用端口 80 侦听传入连接。从版本 4.3 开始，如果您打算使用 ONLYOFFICE Docs 而不是默认端口，则可以更改它的端口。

如果要更改默认端口，请确保它对传入/传出连接开放。请参阅 ONLYOFFICE Docs 使用的端口的完整列表。

为此，您需要更改 debconf 系统的默认端口，运行以下命令：

```bash
echo onlyoffice-documentserver onlyoffice/ds-port select <PORT_NUMBER> | sudo debconf-set-selections
```

请在上述命令中输入端口号而不是 。<PORT_NUMBER>

:::warning 警告
如果您想将 ONLYOFFICE Docs 协议更改为 HTTPS，请不要将端口更改为 443，而是使用此说明。
:::

还有其他选项可用于 ONLYOFFICE Docs 安装。请阅读本节以获取有关它们的更多信息。

之后，您可以继续安装 ONLYOFFICE Docs。

## 添加 GPG 密钥:

```bash
mkdir -p -m 700 ~/.gnupg
curl -fsSL https://download.onlyoffice.com/GPG-KEY-ONLYOFFICE | gpg --no-default-keyring --keyring gnupg-ring:/tmp/onlyoffice.gpg --import
chmod 644 /tmp/onlyoffice.gpg
sudo chown root:root /tmp/onlyoffice.gpg
sudo mv /tmp/onlyoffice.gpg /usr/share/keyrings/onlyoffice.gpg
```
## 添加 ONLYOFFICE 文档存储库：

```bash
echo "deb [signed-by=/usr/share/keyrings/onlyoffice.gpg] https://download.onlyoffice.com/repo/debian squeeze main" | sudo tee /etc/apt/sources.list.d/onlyoffice.list
```

虽然 APT 软件包是针对 Debian Squeeze 构建的，但它与许多 Debian 衍生产品（包括 Ubuntu）兼容，这意味着您可以在所有这些发行版中使用相同的存储库。

在 Debian 上安装 ONLYOFFICE 文档时，请将 contrib 组件添加到 /etc/apt/sources.list。要了解更多信息，您可以参考 Debian 文档。

Update the package manager cache:

```bash
sudo apt-get update
```

Install mscorefonts:

```bash
sudo apt-get install ttf-mscorefonts-installer
```

Install ONLYOFFICE Docs

```bash
sudo apt-get install onlyoffice-documentserver
```

在安装过程中，系统会要求您提供 onlyoffice PostgreSQL 用户的密码。请输入您在配置 PostgreSQL 时指定的 onlyoffice 密码。

### 其他信息：ONLYOFFICE Docs 安装的更多选项

安装 ONLYOFFICE Docs 允许使用更多的 debconf 选项，如果您计划将其安装到多个服务器或其他一些情况下，这可能非常有用。


These options include:

#### PostgreSQL 数据库选项

Set PostgreSQL database host address (replacing <DB_HOST> with the actual address of the PostgreSQL server installed):

```bash
echo onlyoffice-documentserver onlyoffice/db-host string <DB_HOST> | sudo debconf-set-selections
```

Set PostgreSQL database user name (replacing <DB_USER> with the actual name of the user with the appropriate PostgreSQL database rights):

```bash
echo onlyoffice-documentserver onlyoffice/db-user string <DB_USER> | sudo debconf-set-selections
```

Set PostgreSQL database user password (replacing <DB_PASSWORD> with the actual password of the user with the appropriate PostgreSQL database rights):

```bash
echo onlyoffice-documentserver onlyoffice/db-pwd password <DB_PASSWORD> | debconf-set-selections
```

Set PostgreSQL database name (replacing <DB_NAME> with the actual PostgreSQL database name):

```bash
echo onlyoffice-documentserver onlyoffice/db-name string <DB_NAME> | sudo debconf-set-selections
```

#### RabbitMQ options

Set RabbitMQ host address (replacing <RABBITMQ_HOST> with the actual address of RabbitMQ installed):

```bash
echo onlyoffice-documentserver onlyoffice/rabbitmq-host string <RABBITMQ_HOST> | sudo debconf-set-selections
```

Set RabbitMQ user name (replacing <RABBITMQ_USER> with the actual name of the user with the appropriate RabbitMQ rights):

```bash
echo onlyoffice-documentserver onlyoffice/rabbitmq-user string <RABBITMQ_USER> | sudo debconf-set-selections
```

设置 RabbitMQ 用户密码（<RABBITMQ_PWD>替换为具有相应 RabbitMQ 权限的用户的实际密码）：

```bash
echo onlyoffice-documentserver onlyoffice/rabbitmq-pwd password <RABBITMQ_PWD> | sudo debconf-set-selections
```

#### JWT options

在更新 ONLYOFFICE 文档后，您可以使用 debconf-set-selections 来禁用对 local.json 文件中自定义值的覆盖。

启用 JSON Web 令牌 （JWT）：

```bash
echo onlyoffice-documentserver onlyoffice/jwt-enabled boolean true | sudo debconf-set-selections
```

设置一个 JWT 密钥，替换为<JWT_SECRET>你自己的值：

```bash
echo onlyoffice-documentserver onlyoffice/jwt-secret password <JWT_SECRET> | sudo debconf-set-selections
```