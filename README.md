# Blucap

🚴‍♂️ 一个基于 GraphHopper API 的智能路线生成库，专为生成有趣、多样化的骑行和步行路线而设计。

## ✨ 特性

- 🔄 **环形路线生成** - 从指定起点生成回到原点的环形路线
- 🎯 **点对点路线** - 生成两点间的风景路线，支持绕行
- 🎛️ **弯道等级控制** - 三种弯道等级（低、中、高）控制路线复杂度
- 🚴‍♀️ **多种交通工具** - 支持骑行、步行等不同出行方式
- 🌐 **浏览器和Node.js** - 同时支持浏览器和服务器端使用
- 📱 **TypeScript支持** - 完整的类型定义
- 🛡️ **错误处理** - 完善的错误处理和调试支持

## 🚀 快速开始

### 1. 项目安装和启动

#### 作为依赖库使用

**NPM 安装**
```bash
npm install blucap
```

**CDN 引入**
```html
<!-- 引入依赖 -->
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<!-- 引入库 -->
<script src="https://cdn.jsdelivr.net/npm/blucap/dist/blucap.min.js"></script>
```

#### 本地开发和测试

如果您想要本地开发或测试项目：

```bash
# 克隆项目
git clone https://github.com/jiuxi-ai/blucap.git
cd blucap

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build          # 生产版本
npm run build:dev      # 开发版本
npm run build:all      # 完整构建

# 4. 运行示例
node examples/node-example.js

# 5. 启动本地服务器测试浏览器示例
npx http-server . -p 8080
# 然后访问 http://localhost:8080/examples/interactive-test.html
```

### 2. 获取 GraphHopper API 密钥

在使用本库之前，您需要获取免费的 GraphHopper API 密钥：

1. 访问 [GraphHopper Dashboard](https://www.graphhopper.com/dashboard/)
2. 注册免费账户（每月可免费调用 2500 次）
3. 在控制台中创建新的 API 密钥
4. 复制密钥用于下面的代码示例

### 3. 基础使用

#### Node.js 环境
```javascript
const Blucap = require('blucap');

// 创建生成器实例
const generator = new Blucap({
    apiKey: 'your-graphhopper-api-key',
    debug: true
});

// 生成环形路线
async function generateRoundTrip() {
    try {
        const route = await generator.generateRoundTrip({
            startPoint: [39.9042, 116.4074], // 北京天安门 [纬度, 经度]
            distance: 50, // 50公里
            curveLevel: 'medium' // 中等弯道
        });
        
        console.log('路线生成成功！');
        console.log(`距离: ${(route.paths[0].distance / 1000).toFixed(1)} km`);
        console.log(`时间: ${(route.paths[0].time / 60000).toFixed(0)} 分钟`);
    } catch (error) {
        console.error('路线生成失败:', error.message);
    }
}

generateRoundTrip();
```

#### 浏览器环境
```html
<!DOCTYPE html>
<html>
<head>
    <title>Blucap 示例</title>
</head>
<body>
    <!-- 引入依赖 -->
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/blucap/dist/blucap.min.js"></script>
    
    <script>
        // 创建生成器实例
        const generator = new Blucap({
            apiKey: 'your-graphhopper-api-key'
        });
        
        // 生成点对点路线
        async function generateRoute() {
            try {
                const route = await generator.generatePointToPoint({
                    startPoint: [31.2304, 121.4737], // 上海
                    endPoint: [30.2741, 120.1551],   // 杭州
                    curveLevel: 'high' // 高弯道，风景路线
                });
                
                console.log('路线生成成功！', route);
            } catch (error) {
                console.error('路线生成失败:', error.message);
            }
        }
        
        generateRoute();
    </script>
</body>
</html>
```

## 📖 API 文档

### 构造函数

```javascript
const generator = new Blucap(options)
```

#### 参数
- `options.apiKey` (string, 必需) - GraphHopper API 密钥
- `options.debug` (boolean, 可选) - 是否启用调试模式，默认 false
- `options.locale` (string, 可选) - 语言设置，默认 'zh'
- `options.vehicle` (string, 可选) - 交通工具，默认 'bike'

### 方法

#### generateRoundTrip(options)

生成环形路线（从起点出发最终回到起点）。

```javascript
const route = await generator.generateRoundTrip({
    startPoint: [39.9042, 116.4074], // [纬度, 经度]
    distance: 50,                     // 目标距离（公里）
    curveLevel: 'medium',            // 弯道等级
    startBearing: 90,                // 起始方向（度，可选）
    vehicle: 'bike'                  // 交通工具（可选）
});
```

**参数说明：**
- `startPoint` (Array, 必需) - 起点坐标 [纬度, 经度]
- `distance` (number, 必需) - 目标距离（公里）
- `curveLevel` (string, 可选) - 弯道等级：'low'、'medium'、'high'
- `startBearing` (number, 可选) - 起始方向（0-360度）
- `vehicle` (string, 可选) - 交通工具类型

#### generatePointToPoint(options)

生成点对点路线（从起点到终点）。

```javascript
const route = await generator.generatePointToPoint({
    startPoint: [31.2304, 121.4737], // 起点 [纬度, 经度]
    endPoint: [30.2741, 120.1551],   // 终点 [纬度, 经度]
    curveLevel: 'high',              // 弯道等级
    targetDistance: 200,             // 目标距离（可选）
    vehicle: 'bike'                  // 交通工具（可选）
});
```

**参数说明：**
- `startPoint` (Array, 必需) - 起点坐标 [纬度, 经度]
- `endPoint` (Array, 必需) - 终点坐标 [纬度, 经度]
- `curveLevel` (string, 可选) - 弯道等级：'low'、'medium'、'high'
- `targetDistance` (number, 可选) - 目标距离（公里），用于绕行
- `vehicle` (string, 可选) - 交通工具类型

### 弯道等级说明

| 等级 | 描述 | 适用场景 |
|------|------|----------|
| `low` | 较直的路线，最短路径 | 通勤、快速到达 |
| `medium` | 适度弯曲，平衡距离和趣味性 | 日常骑行、休闲运动 |
| `high` | 高度弯曲，风景路线 | 观光、探索新路线 |

### 交通工具类型

- `bike` - 自行车（默认）
- `foot` - 步行
- `car` - 汽车
- `motorcycle` - 摩托车

### 返回数据格式

```javascript
{
    "paths": [{
        "distance": 50234.5,        // 距离（米）
        "time": 7234567,            // 时间（毫秒）
        "points": {
            "coordinates": [          // 路线坐标点
                [116.4074, 39.9042],
                [116.4084, 39.9052],
                // ...
            ]
        },
        "instructions": [           // 导航指令
            {
                "text": "向北行驶",
                "distance": 1234.5,
                "time": 123456
            },
            // ...
        ]
    }]
}
```

## 🎯 使用示例

### 示例1：生成北京环形骑行路线

```javascript
const generator = new Blucap({
    apiKey: 'your-api-key'
});

async function beijingRoundTrip() {
    const route = await generator.generateRoundTrip({
        startPoint: [39.9042, 116.4074], // 天安门
        distance: 30,                     // 30公里
        curveLevel: 'medium',            // 中等弯道
        startBearing: 0                  // 向北出发
    });
    
    const path = route.paths[0];
    console.log(`生成了 ${(path.distance/1000).toFixed(1)}km 的环形路线`);
    console.log(`预计用时 ${(path.time/60000).toFixed(0)} 分钟`);
    
    return route;
}
```

### 示例2：上海到杭州风景路线

```javascript
async function shanghaiToHangzhou() {
    const route = await generator.generatePointToPoint({
        startPoint: [31.2304, 121.4737], // 上海外滩
        endPoint: [30.2741, 120.1551],   // 杭州西湖
        curveLevel: 'high',              // 风景路线
        targetDistance: 200              // 目标200公里（绕行）
    });
    
    return route;
}
```

### 示例3：批量生成多条路线

```javascript
async function generateMultipleRoutes() {
    const startPoints = [
        [39.9042, 116.4074], // 北京
        [31.2304, 121.4737], // 上海
        [30.2741, 120.1551]  // 杭州
    ];
    
    const routes = [];
    
    for (const point of startPoints) {
        try {
            const route = await generator.generateRoundTrip({
                startPoint: point,
                distance: 25,
                curveLevel: 'medium'
            });
            routes.push(route);
            
            // 避免API限流
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`生成路线失败 ${point}:`, error.message);
        }
    }
    
    return routes;
}
```

### 示例4：路线数据处理

```javascript
// 提取路线关键信息
function extractRouteInfo(route) {
    const path = route.paths[0];
    return {
        distance: Math.round(path.distance / 1000 * 10) / 10, // 公里，保留1位小数
        duration: Math.round(path.time / 60000),              // 分钟
        points: path.points.coordinates.length,               // 坐标点数量
        instructions: path.instructions.length,               // 指令数量
        startPoint: path.points.coordinates[0],               // 起点
        endPoint: path.points.coordinates[path.points.coordinates.length - 1] // 终点
    };
}

// 导出为GPX格式
function exportToGPX(route, name = 'Blucap Route') {
    const path = route.paths[0];
    const coordinates = path.points.coordinates;
    
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>${name}</name>
    <trkseg>
`;
    
    coordinates.forEach(([lon, lat]) => {
        gpx += `      <trkpt lat="${lat}" lon="${lon}"></trkpt>
`;
    });
    
    gpx += `    </trkseg>
  </trk>
</gpx>`;
    
    return gpx;
}
```

### 示例5：与地图集成

```html
<!-- Leaflet 地图集成示例 -->
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
</head>
<body>
    <div id="map" style="height: 500px;"></div>
    
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/blucap/dist/blucap.min.js"></script>
    
    <script>
        // 初始化地图
        const map = L.map('map').setView([39.9042, 116.4074], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        // 生成并显示路线
        async function showRoute() {
            const generator = new Blucap({
                apiKey: 'your-api-key'
            });
            
            const route = await generator.generateRoundTrip({
                startPoint: [39.9042, 116.4074],
                distance: 20,
                curveLevel: 'medium'
            });
            
            // 在地图上显示路线
            const coordinates = route.paths[0].points.coordinates;
            const latLngs = coordinates.map(([lon, lat]) => [lat, lon]);
            
            L.polyline(latLngs, {color: 'red', weight: 3}).addTo(map);
            L.marker([39.9042, 116.4074]).addTo(map).bindPopup('起点/终点');
        }
        
        showRoute();
    </script>
</body>
</html>
```

## 🔧 错误处理

### 常见错误类型

```javascript
try {
    const route = await generator.generateRoundTrip(options);
} catch (error) {
    switch (error.message) {
        case 'API key is required':
            console.error('请提供有效的 GraphHopper API 密钥');
            break;
        case 'Invalid coordinates':
            console.error('坐标格式错误，请使用 [纬度, 经度] 格式');
            break;
        case 'Distance must be positive':
            console.error('距离必须为正数');
            break;
        case 'API request failed':
            console.error('API 请求失败，请检查网络连接和 API 密钥');
            break;
        default:
            console.error('未知错误:', error.message);
    }
}
```

## 🛠️ 故障排除

### 常见错误及解决方案

#### 1. "No parameters specified, at least 'key' is necessary"
**原因**: API 密钥未正确设置或无效
**解决方案**:
- 确认您已在 [GraphHopper Dashboard](https://www.graphhopper.com/dashboard/) 创建了有效的 API 密钥
- 检查密钥是否正确复制（没有多余的空格或字符）
- 确认密钥没有过期或被禁用

#### 2. "HTTP 401 Unauthorized"
**原因**: API 密钥无效或已过期
**解决方案**:
- 重新生成新的 API 密钥
- 确认账户状态正常

#### 3. "HTTP 429 Too Many Requests"
**原因**: 超出了 API 调用限制
**解决方案**:
- 免费账户每月限制 2500 次调用
- 等待下个月重置或升级到付费计划

#### 4. 路线生成失败
**可能原因**:
- 起点坐标格式错误（应为 [纬度, 经度]）
- 距离参数超出范围（50-500km）
- 网络连接问题

### 调试技巧

1. **检查控制台输出**: 启用详细日志查看具体错误信息
2. **验证坐标**: 确保使用正确的 [纬度, 经度] 格式
3. **测试 API 密钥**: 可以直接访问 GraphHopper API 验证密钥有效性
4. **网络检查**: 确认能够访问 `https://graphhopper.com/api/`

### 最佳实践

1. **API 限流处理**
```javascript
// 批量请求时添加延迟
for (const request of requests) {
    await processRequest(request);
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒延迟
}
```

2. **重试机制**
```javascript
async function generateRouteWithRetry(options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await generator.generateRoundTrip(options);
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
}
```

3. **性能监控**
```javascript
async function monitoredGeneration(options) {
    const startTime = Date.now();
    
    try {
        const route = await generator.generateRoundTrip(options);
        const duration = Date.now() - startTime;
        
        console.log(`路线生成成功，耗时 ${duration}ms`);
        return route;
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`路线生成失败，耗时 ${duration}ms:`, error.message);
        throw error;
    }
}
```

## 📝 开发和测试

### 可用的 NPM 脚本

```bash
npm run build          # 构建生产版本
npm run build:dev      # 构建开发版本（包含 source map）
npm run build:all      # 运行完整构建脚本
npm run publish:dry    # 模拟发布
npm run publish:beta   # 发布 beta 版本
npm run publish:public # 发布公开版本
```

### 测试和示例

项目提供了多种测试和示例文件：

#### Node.js 示例
```bash
# 运行 Node.js 示例（需要先设置 API 密钥）
node examples/node-example.js
```

#### 浏览器示例
```bash
# 启动本地服务器
npx http-server . -p 8080

# 访问不同的示例页面：

# http://localhost:8080/examples/interactive-test.html    # 交互式测试（包含地图）
```

### 项目结构

```
blucap/
├── blucap.js      # 主库文件
├── blucap.d.ts     # TypeScript 类型定义
├── package.json                 # 项目配置
├── webpack.config.js           # 构建配置
├── dist/                       # 构建输出
│   ├── blucap.min.js
│   └── blucap.min.js.map
├── examples/                   # 示例文件
│   ├── node-example.js         # Node.js 示例
│   └── interactive-test.html   # 交互式测试页面
├── scripts/                    # 构建脚本
│   ├── build.js               # 自动化构建
│   └── publish.js             # 发布脚本
└── docs/                       # 文档
    ├── README.md              # 项目说明
    ├── USAGE_EXAMPLES.md      # 详细使用示例
    └── DEBUG_GUIDE.md         # 调试指南
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🔗 相关链接

- [GraphHopper API 文档](https://docs.graphhopper.com/)
- [GraphHopper Dashboard](https://www.graphhopper.com/dashboard/)
- [项目 GitHub](https://github.com/jiuxi-ai/blucap)
- [详细使用示例](./USAGE_EXAMPLES.md)
- [调试指南](./DEBUG_GUIDE.md)

## 📋 快速参考

### 环境要求
- Node.js >= 12.0.0
- 现代浏览器（支持 ES6+）
- GraphHopper API 密钥

### 核心方法
```javascript
// 环形路线
const route = await generator.generateRoundTrip({
    startPoint: [lat, lng],
    distance: 50,
    curveLevel: 'medium'
});

// 点对点路线
const route = await generator.generatePointToPoint({
    startPoint: [lat1, lng1],
    endPoint: [lat2, lng2],
    curveLevel: 'high'
});
```

### 弯道等级
- `low` - 直线路线，快速通行
- `medium` - 平衡路线，适合日常使用
- `high` - 弯曲路线，风景优美

---