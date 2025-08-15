# 🧪 Blucap 调试指南

本指南将帮助你了解如何调试和调用 Blucap 库。

## 📋 目录

1. [快速开始](#快速开始)
2. [本地测试](#本地测试)
3. [浏览器测试](#浏览器测试)
4. [调试技巧](#调试技巧)
5. [常见问题](#常见问题)
6. [性能优化](#性能优化)

## 🚀 快速开始

### 1. 构建库

```bash
# 进入库目录
cd lib

# 安装依赖
npm install

# 构建生产版本
npm run build

# 或构建开发版本（包含 source map）
npm run build:dev

这将生成 `dist/blucap.min.js` 文件。
```

### 2. 获取 API 密钥

1. 访问 [GraphHopper Dashboard](https://www.graphhopper.com/dashboard/)
2. 注册账户并获取免费 API 密钥
3. 每天有 1000 次免费请求额度

## 🧪 本地测试

### Node.js 环境测试

我们提供了一个完整的测试文件 `test-local.js`：

```bash
# 设置环境变量（推荐）
set GRAPHHOPPER_API_KEY=your_api_key_here

# 运行测试
node test-local.js
```

或者直接编辑 `test-local.js` 文件中的 API 密钥：

```javascript
const config = {
    apiKey: 'your_actual_api_key_here', // 替换这里
    locale: 'zh',
    debug: true
};
```

### 测试内容包括：

- ✅ 环形路线生成（北京天安门 50km）
- ✅ 点对点路线生成（上海到杭州）
- ✅ 错误处理测试
- ✅ 参数验证

## 🌐 浏览器测试

### 使用测试页面

1. 打开 `test-browser.html` 文件
2. 输入你的 GraphHopper API 密钥
3. 点击各种测试按钮

### 在你的网页中集成

```html
<!DOCTYPE html>
<html>
<head>
    <title>我的路线应用</title>
</head>
<body>
    <!-- 引入依赖 -->
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="./lib/dist/blucap.min.js"></script>
    
    <script>
        // 创建生成器实例
        const generator = new Blucap({
            apiKey: 'your_api_key_here'
        });
        
        // 生成路线
        async function generateRoute() {
            try {
                const route = await generator.generateRoundTrip({
                    startPoint: [39.9042, 116.4074],
                    distance: 100,
                    curveLevel: 'medium'
                });
                
                console.log('路线生成成功:', route);
            } catch (error) {
                console.error('路线生成失败:', error);
            }
        }
    </script>
</body>
</html>
```

## 🔧 调试技巧

### 1. 启用调试模式

```javascript
const generator = new Blucap({
    apiKey: 'your_key',
    debug: true  // 启用调试输出
});
```

### 2. 检查网络请求

在浏览器开发者工具的 Network 标签中，你可以看到：
- GraphHopper API 请求
- 请求参数
- 响应数据
- 错误信息

### 3. 使用 try-catch 处理错误

```javascript
try {
    const route = await generator.generateRoundTrip(options);
    console.log('成功:', route);
} catch (error) {
    console.error('错误类型:', error.name);
    console.error('错误信息:', error.message);
    console.error('完整错误:', error);
}
```

### 4. 验证输入参数

```javascript
// 检查坐标格式
function validatePoint(point) {
    if (!Array.isArray(point) || point.length !== 2) {
        throw new Error('坐标必须是 [纬度, 经度] 格式');
    }
    
    const [lat, lng] = point;
    if (lat < -90 || lat > 90) {
        throw new Error('纬度必须在 -90 到 90 之间');
    }
    
    if (lng < -180 || lng > 180) {
        throw new Error('经度必须在 -180 到 180 之间');
    }
}

// 使用前验证
validatePoint([39.9042, 116.4074]);
```

## ❓ 常见问题

### Q1: "API key is missing" 错误

**解决方案：**
- 确保已设置 API 密钥
- 检查密钥是否正确
- 验证密钥是否有效

```javascript
// 检查 API 密钥
if (!config.apiKey || config.apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('请设置有效的 GraphHopper API 密钥');
}
```

### Q2: "No route found" 错误

**可能原因：**
- 起点或终点在海洋中
- 距离设置过小或过大
- 地区不支持路线规划

**解决方案：**
```javascript
// 调整参数
const route = await generator.generateRoundTrip({
    startPoint: [39.9042, 116.4074],
    distance: 50, // 尝试较小的距离
    curveLevel: 'low' // 使用较低的弯道等级
});
```

### Q3: 请求超时

**解决方案：**
```javascript
const generator = new Blucap({
    apiKey: 'your_key',
    timeout: 30000 // 增加超时时间到30秒
});
```

### Q4: CORS 错误（浏览器环境）

**解决方案：**
- 确保从 HTTPS 页面访问
- 或使用本地服务器运行

```bash
# 使用 Python 启动本地服务器
python -m http.server 8000

# 或使用 Node.js
npx http-server
```

## ⚡ 性能优化

### 1. 复用生成器实例

```javascript
// ✅ 好的做法
const generator = new Blucap({ apiKey: 'key' });

// 复用同一个实例
const route1 = await generator.generateRoundTrip(options1);
const route2 = await generator.generateRoundTrip(options2);

// ❌ 避免每次都创建新实例
const route1 = await new Blucap({ apiKey: 'key' }).generateRoundTrip(options1);
const route2 = await new Blucap({ apiKey: 'key' }).generateRoundTrip(options2);
```

### 2. 批量处理

```javascript
// 并行生成多个路线
const routes = await Promise.all([
    generator.generateRoundTrip(options1),
    generator.generateRoundTrip(options2),
    generator.generateRoundTrip(options3)
]);
```

### 3. 缓存结果

```javascript
const routeCache = new Map();

async function getCachedRoute(options) {
    const key = JSON.stringify(options);
    
    if (routeCache.has(key)) {
        return routeCache.get(key);
    }
    
    const route = await generator.generateRoundTrip(options);
    routeCache.set(key, route);
    
    return route;
}
```

## 📊 监控和日志

### 添加请求监控

```javascript
class MonitoredBlucap extends Blucap {
    async generateRoundTrip(options) {
        const startTime = Date.now();
        
        try {
            const result = await super.generateRoundTrip(options);
            const duration = Date.now() - startTime;
            
            console.log(`✅ 路线生成成功，耗时: ${duration}ms`);
            return result;
            
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`❌ 路线生成失败，耗时: ${duration}ms，错误:`, error.message);
            throw error;
        }
    }
}
```

## 🔗 相关资源

- [GraphHopper API 文档](https://docs.graphhopper.com/)
- [库的完整 API 文档](./README.md)
- [示例代码](./examples/)
- [问题反馈](https://github.com/your-repo/issues)

---

💡 **提示**: 如果遇到问题，请先检查 API 密钥是否正确，然后查看浏览器控制台或 Node.js 输出中的详细错误信息。