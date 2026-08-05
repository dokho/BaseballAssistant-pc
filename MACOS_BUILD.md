# macOS 版本构建说明

本项目的记录端、比分牌窗口、OBS / 抖音直播伴侣 / 视频号的窗口采集方式，以及本地比赛数据格式，均与 Windows 版本共用同一套代码。

## 构建环境

- 一台 macOS 电脑（建议分别构建 Apple 芯片和 Intel 版本）
- Node.js 22 或更高版本
- 已安装项目依赖

## 构建命令

```bash
npm ci
npm test
npm run dist:mac
```

构建完成后会在 `release` 目录生成以下四类文件：

- `BaseballAssistant-<版本>-mac-arm64.dmg`：适用于 Apple 芯片（M 系列）
- `BaseballAssistant-<版本>-mac-x64.dmg`：适用于 Intel 芯片
- 同名 `.zip` 文件：适用于免安装分发

## 首次测试

未使用 Apple Developer ID 签名和公证的测试包，macOS 可能会提示来源无法验证。测试时可在 Finder 中按住 Control 点击应用，选择“打开”。正式发布前应在 macOS 构建机配置 Apple Developer ID 证书并完成公证。

## 直播采集

启动后会同时打开记录端和 680 × 280 的比分牌窗口。关闭“鼠标穿透”后，可拖动比分牌顶部比赛名称区域；在 OBS 等直播软件中以“窗口采集”选择“棒球比分牌输出”即可。
