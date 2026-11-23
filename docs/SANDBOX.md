# 用 Windows Sandbox 做：能做什么，不能做什么

## 一、沙箱就绪结论（只读检查 + 实测）

`winapp target snapshot sandbox --json`：

| 检查项 | 结果 |
| --- | --- |
| osVersion | Windows 10.0.26200.0 — passed |
| sandboxFeature (`Containers-DisposableClientVM`) | **enabled** — passed |
| sandboxClient | **installed**（status: Ok）— passed |
| wsb.exe | **v0.8.114.0** — passed |
| host.ready | **true** |
| 实际启动 | **成功**（Starting → guest agent → readiness 全通） |
| desktop.rendered / effectiveInputReady / effectiveCaptureReady | 全部 **true** |
| supportsInteractiveDesktop / supportsRealInput / supportsScreenCapture | 全部 **true** |
| persistentStorage | **false** ← 关键限制 |

隔离基建完全可用，不是我这边缺工具。宿主机 Edge/Chrome 也在，headless Playwright 已跑通
（`PW_EXECUTABLE` 指向系统 Chrome）。

## 二、但沙箱解决的是隔离，不是授权

沙箱内实测（见 `evidence/sandbox-probe.txt`）：

```
winapp target exec sandbox -- curl.exe -s -D - -o NUL -m 25 <TARGET_URL>

HTTP/1.1 302
Location: https://passport2.chaoxing.com/login?...&fid=1840&newversion=true
```

隔离浏览器上下文实测（headless Playwright，全新 context，见 `evidence/probe-report.json`）：

```json
{
  "href": "https://passport2.chaoxing.com/login?...&fid=1840&newversion=true",
  "title": "用户登录",
  "passwordInputCount": 1,
  "textareaCount": 0,
  "hasLoginForm": true,
  "hasCaptchaElement": true,
  "hasQrHint": true,
  "bodyTextHead": "客服 用户登录 忘记密码？ 登录 下次自动登录 新用户注册 验证码登录
                   其他登录方式 我已阅读并同意学习通《隐私政策》和《用户协议》
                   使用学习通APP扫码登录 ..."
}
```

两条通路结论一致：**干净环境 → 落到登录页，且登录页带验证码。**

原因不复杂：Windows Sandbox 的定义就是「每次全新、无历史会话、`persistentStorage: false`」。
登录墙是**授权问题**，不是**环境隔离问题**。沙箱能保证不污染你的宿主机，
但它不会凭空产生「你已登录学习通」这个事实。所以在这件事上，沙箱比「已登录的宿主机浏览器」更差，
不是更好。

按 agent-isolation 路由表，Web 页面的 UI 测试/截图/DOM 抽查本来就走 Headless Playwright
（沙箱是给 Windows 桌面 App 用的）。这次的 Probe 也正是这么跑的。

## 三、沙箱能真正发挥作用的三条路

### 路径 C1（推荐，最省事）：沙箱内你本人登录一次，我只做 A1 勘察

沙箱现在已经起来了、桌面已渲染、输入与截图能力就绪。你可以：

1. 在那个沙箱窗口里打开 Edge，登录学习通（**账号密码和验证码都由你本人操作**，我不代填、不代过）；
2. 告诉我"登好了"，我用 `winapp ui` 读那个 Edge 的页面结构，判断这页**到底有没有对话式 Agent**；
3. 只有确认有 Agent，才谈得上后面的采样。

代价：1 次页面加载，0 条探针。这是当前最便宜的决胜步骤。
注意：沙箱 `persistentStorage: false`，关掉就没了，所以这轮要连续做完。

### 路径 C2：宿主机已登录会话 + dsh-chrome 桥接

打开 `http://127.0.0.1:3080` 里的 **dsh-chrome 侧栏**并保持连接。若你宿主机浏览器里本来就登录着学习通，
我就能直接读页面、做勘察和采样。这条路最干净：不碰凭据、不进沙箱、不导 Cookie。

### 路径 C3：换一个公开可访问的 Agent

如果目标本来是某个对话式 Agent，只是地址给成了课程页，那么给我正确地址即可。
公开可访问的 Agent 我可以**立刻**在隔离环境里跑完整蒸馏（37 条探针 + 留出盲测 + 蒸馏包），
基建已经验证通了。

## 四、我不会做的事（与你的安全约束一致）

- 不代填账号密码，不代替你过验证码；
- 不从你宿主机 Edge 的 profile 里挖 Cookie（那需要 DPAPI 解密，属读取凭据）；
- 不用任何方式绕过登录墙、验证码或访问控制；
- 不因为沙箱跑不通就退回宿主机桌面去「凑」一个测试通过的样子。

## 五、还有一个没解决的问题（比登录更根本）

即便登录成功，`/mooc2-ans/mycourse/stu` 从路径和参数形态看是「我的课程 / 学生学习」页，
不是对话式 Agent。若勘察后确认页面没有对话输入框，那么 37 条探针无对象可发，
蒸馏目标本身不成立 —— 那时正确动作是换目标，而不是硬造一份 behavior_spec。

这一步的判断绝不能靠 URL 猜。**先勘察，后采样。**
