# 在 Windows 上试用 Jiffoo Core

这套试用运行真正的 Docker Compose 商店，不是开发服务器。暂不合并主分支，也不发布。

## 准备

安装并启动 Docker Desktop，选择 Linux 容器；安装 Node.js 24 和 pnpm 9。
在 PowerShell 中进入本工作区根目录。确保 8443 端口空闲，并先提交代码改动。
首次启动需要下载镜像和构建商店，可能需要较长时间。

```powershell
pnpm trial:up
```

打开命令打印的地址：`https://shop.localhost:8443` 是商店，
`https://admin.localhost:8443` 是管理后台。首次进入后台，按安装向导创建管理员。
不需要修改 hosts 文件。浏览器会提示证书不受信任，因为这是本机自签名证书。
确认地址确实是上述 localhost 地址，再展开“高级”并选择继续访问；不要关闭整个浏览器的证书检查。

随机密码、证书、版本记录和备份保存在 `%LOCALAPPDATA%\JiffooTrial`，不写入代码仓库。
Docker 的试用专属命名卷保存商店数据和主机工具状态。两者都要保留；不要手动清理这些卷。
所有操作只针对 `jiffoo-trial`，不使用已有的开发数据库或 Redis 容器。

## 查看和停止

```powershell
pnpm trial:status
pnpm trial:logs
pnpm trial:down
pnpm trial:up
```

`status` 查看运行状态，`logs` 查看近期日志。`down` 停止试用，但保留数据。
重启电脑后再次运行 `up` 即可恢复。已经运行时不需要重复启动。

## 更新

拿到新的 Core 提交后，确保工作区没有未提交的改动，再运行：

```powershell
pnpm trial:update
```

更新会先构建新版本并打印计划。若有数据库迁移，请阅读计划，
把打印的 `PLAN_SHA256` 完整复制到确认提示中；不一致就不会更新。
真正更新前会停止商店并备份。更新结束后会等待服务健康。
后台“系统健康”显示版本和短提交号，可用于确认更新。
如果版本已经变旧，`trial:up` 会提示改用 `trial:update`。

如果更新失败，请保存输出、备份和更新记录。没有迁移提交时，工具可恢复旧应用；
一旦迁移提交或结果不明确，就不能只换回旧应用，需要恢复更新前备份。
不要自行修改数据库或强行启动旧版本。

## 备份和恢复

```powershell
pnpm trial:backup
pnpm trial:restore backup-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

备份期间商店会暂时停止，结束后重新启动。备份命令会打印本机备份目录。
恢复时把示例名称换成该目录的最后一段；更新自动备份的名称以 `update-` 开头。
恢复会提示备份哈希，必须完整复制确认。恢复会创建新数据卷，旧数据卷仍保留。
Redis 不备份，恢复后从空状态开始。
备份包含商店数据、密码和证书，请把它当作敏感文件，另存一份到安全的外部位置。
它不含 Docker 镜像，恢复时需要对应版本的镜像仍然可用。

## 删除整个试用

```powershell
pnpm trial:destroy
```

警告：这会永久删除全部试用数据、保留的旧数据卷、本机备份和试用设置。
必须手动输入准确的 `jiffoo-trial` 才会执行。仅仅停止试用请使用 `trial:down`。
