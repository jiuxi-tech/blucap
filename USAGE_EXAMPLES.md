# 🚀 Blucap 使用示例

本文档提供了详细的使用示例，帮助你快速上手 Blucap 库。

## 📦 安装和引入

### Node.js 环境

```bash
# 安装库（发布到 NPM 后）
npm install blucap

# 或者本地安装
npm install ./path/to/blucap
```

```javascript
// CommonJS
const Blucap = require('blucap');

// ES6 模块
import Blucap from 'blucap';
```

### 浏览器环境

```html
<!-- 引入依赖 -->
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/blucap/dist/blucap.min.js"></script>

<script>
    // 库会自动注册为全局变量 Blucap
    const generator = new Blucap({ apiKey: 'your_key' });
</script>
```

## 🔧 基础配置

```javascript
const generator = new FunRouteGenerator({
    apiKey: 'your_graphhopper_api_key',  // 必需
    locale: 'zh',                        // 可选，默认 'en'
    debug: true,                         // 可选，默认 false
    timeout: 10000,                      // 可选，默认 10000ms
    host: 'https://graphhopper.com/api/1' // 可选，自定义 API 端点
});
```

## 🔄 环形路线生成

### 基础用法

```javascript
async function generateBasicRoundTrip() {
    try {
        const route = await generator.generateRoundTrip({
            startPoint: [39.9042, 116.4074], // 北京天安门 [纬度, 经度]
            distance: 100,                    // 目标距离 100km
            curveLevel: 'medium'              // 弯道等级：low/medium/high
        });
        
        console.log('路线生成成功:', route);
        
        // 获取路线信息
        const path = route.paths[0];
        console.log(`总距离: ${(path.distance / 1000).toFixed(1)} km`);
        console.log(`预计时间: ${(path.time / 60000).toFixed(0)} 分钟`);
        console.log(`导航指令数: ${path.instructions.length}`);
        
    } catch (error) {
        console.error('路线生成失败:', error.message);
    }
}
```

### 高级配置

```javascript
async function generateAdvancedRoundTrip() {
    const route = await generator.generateRoundTrip({
        startPoint: [31.2304, 121.4737],  // 上海外滩
        distance: 150,                     // 150km 路线
        curveLevel: 'high',               // 高弯道等级（风景路线）
        startBearing: 90,                 // 向东出发（0=北, 90=东, 180=南, 270=西）
        profile: 'car',                   // 交通工具：car/bike/foot
        avoidHighways: true,              // 避开高速公路
        locale: 'zh'                      // 中文导航指令
    });
    
    return route;
}
```

## 🎯 点对点路线生成

### 基础用法

```javascript
async function generateBasicPointToPoint() {
    const route = await generator.generatePointToPoint({
        startPoint: [39.9042, 116.4074], // 北京
        endPoint: [31.2304, 121.4737],   // 上海
        curveLevel: 'low'                 // 最快路线
    });
    
    return route;
}
```

### 风景绕行路线

```javascript
async function generateScenicRoute() {
    const route = await generator.generatePointToPoint({
        startPoint: [22.3193, 114.1694], // 香港
        endPoint: [22.1987, 113.5439],   // 澳门
        curveLevel: 'high',               // 风景路线
        targetDistance: 200,              // 目标距离 200km（比直线距离长）
        profile: 'car',
        avoidHighways: false              // 允许使用高速公路
    });
    
    return route;
}
```

## 🚴 不同交通工具

### 自行车路线

```javascript
async function generateBikeRoute() {
    const route = await generator.generateRoundTrip({
        startPoint: [25.0330, 121.5654], // 台北
        distance: 50,                     // 50km 适合骑行
        curveLevel: 'medium',
        profile: 'bike',                  // 自行车模式
        avoidHighways: true               // 避开高速公路
    });
    
    return route;
}
```

### 步行路线

```javascript
async function generateWalkingRoute() {
    const route = await generator.generateRoundTrip({
        startPoint: [39.9163, 116.3972], // 北京颐和园
        distance: 10,                     // 10km 步行距离
        curveLevel: 'high',               // 风景路线
        profile: 'foot'                   // 步行模式
    });
    
    return route;
}
```

## 🎨 弯道等级详解

```javascript
// 低弯道等级 - 最快路线
const fastRoute = await generator.generateRoundTrip({
    startPoint: [39.9042, 116.4074],
    distance: 100,
    curveLevel: 'low'     // 优先主干道，最短时间
});

// 中等弯道等级 - 平衡路线
const balancedRoute = await generator.generateRoundTrip({
    startPoint: [39.9042, 116.4074],
    distance: 100,
    curveLevel: 'medium'  // 平衡速度和趣味性
});

// 高弯道等级 - 风景路线
const scenicRoute = await generator.generateRoundTrip({
    startPoint: [39.9042, 116.4074],
    distance: 100,
    curveLevel: 'high'    // 优先风景道路，更多弯道
});
```

## 🔄 批量生成路线

```javascript
async function generateMultipleRoutes() {
    const startPoint = [39.9042, 116.4074];
    const distances = [50, 100, 150];
    const curveLevels = ['low', 'medium', 'high'];
    
    const routes = [];
    
    // 串行生成（避免 API 限制）
    for (const distance of distances) {
        for (const curveLevel of curveLevels) {
            try {
                const route = await generator.generateRoundTrip({
                    startPoint,
                    distance,
                    curveLevel
                });
                
                routes.push({
                    distance,
                    curveLevel,
                    route,
                    actualDistance: route.paths[0].distance / 1000,
                    time: route.paths[0].time / 60000
                });
                
                // 添加延迟避免请求过快
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                console.error(`生成失败 ${distance}km ${curveLevel}:`, error.message);
            }
        }
    }
    
    return routes;
}
```

## 📊 路线数据处理

### 提取关键信息

```javascript
function extractRouteInfo(route) {
    const path = route.paths[0];
    
    return {
        // 基础信息
        distance: Math.round(path.distance / 1000 * 10) / 10, // km，保留1位小数
        time: Math.round(path.time / 60000),                   // 分钟
        instructions: path.instructions.length,
        
        // 坐标点
        startPoint: path.points.coordinates[0],
        endPoint: path.points.coordinates[path.points.coordinates.length - 1],
        
        // 边界框
        bbox: path.bbox,
        
        // 详细指令
        navigationSteps: path.instructions.map(instruction => ({
            text: instruction.text,
            distance: instruction.distance,
            time: instruction.time,
            sign: instruction.sign
        }))
    };
}

// 使用示例
const route = await generator.generateRoundTrip({
    startPoint: [39.9042, 116.4074],
    distance: 100,
    curveLevel: 'medium'
});

const info = extractRouteInfo(route);
console.log('路线信息:', info);
```

### 导出 GPX 格式

```javascript
function exportToGPX(route, routeName = 'Fun Route') {
    const path = route.paths[0];
    const coordinates = path.points.coordinates;
    
    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Fun Route Generator">
  <trk>
    <name>${routeName}</name>
    <trkseg>
`;
    
    coordinates.forEach(([lng, lat]) => {
        gpx += `      <trkpt lat="${lat}" lon="${lng}"></trkpt>
`;
    });
    
    gpx += `    </trkseg>
  </trk>
</gpx>`;
    
    return gpx;
}

// 使用示例
const route = await generator.generateRoundTrip({
    startPoint: [39.9042, 116.4074],
    distance: 100,
    curveLevel: 'medium'
});

const gpxData = exportToGPX(route, '北京100公里环形路线');
console.log(gpxData);

// 在浏览器中下载 GPX 文件
function downloadGPX(gpxData, filename) {
    const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
```

## 🗺️ 地图集成

### Leaflet 地图显示

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
</head>
<body>
    <div id="map" style="height: 500px;"></div>
    
    <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="./dist/fun-route-generator.min.js"></script>
    
    <script>
        // 初始化地图
        const map = L.map('map').setView([39.9042, 116.4074], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        // 生成并显示路线
        async function showRoute() {
            const generator = new FunRouteGenerator({
                apiKey: 'your_api_key_here'
            });
            
            const route = await generator.generateRoundTrip({
                startPoint: [39.9042, 116.4074],
                distance: 100,
                curveLevel: 'medium'
            });
            
            // 转换坐标格式（GraphHopper 返回 [lng, lat]，Leaflet 需要 [lat, lng]）
            const coordinates = route.paths[0].points.coordinates.map(([lng, lat]) => [lat, lng]);
            
            // 在地图上显示路线
            const polyline = L.polyline(coordinates, { color: 'red', weight: 4 }).addTo(map);
            
            // 调整地图视图以显示整个路线
            map.fitBounds(polyline.getBounds());
            
            // 添加起点标记
            L.marker(coordinates[0])
                .addTo(map)
                .bindPopup('起点')
                .openPopup();
        }
        
        showRoute();
    </script>
</body>
</html>
```

## 🚨 错误处理最佳实践

```javascript
class RouteService {
    constructor(apiKey) {
        this.generator = new FunRouteGenerator({ apiKey });
        this.retryCount = 3;
        this.retryDelay = 1000;
    }
    
    async generateRouteWithRetry(options, retries = this.retryCount) {
        try {
            return await this.generator.generateRoundTrip(options);
        } catch (error) {
            console.error(`路线生成失败 (剩余重试: ${retries}):`, error.message);
            
            if (retries > 0 && this.isRetryableError(error)) {
                await this.delay(this.retryDelay);
                return this.generateRouteWithRetry(options, retries - 1);
            }
            
            throw error;
        }
    }
    
    isRetryableError(error) {
        // 网络错误或服务器错误可以重试
        return error.message.includes('timeout') || 
               error.message.includes('network') ||
               error.message.includes('500');
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// 使用示例
const routeService = new RouteService('your_api_key');

try {
    const route = await routeService.generateRouteWithRetry({
        startPoint: [39.9042, 116.4074],
        distance: 100,
        curveLevel: 'medium'
    });
    
    console.log('路线生成成功:', route);
} catch (error) {
    console.error('最终失败:', error.message);
}
```

## 📈 性能监控

```javascript
class PerformanceMonitor {
    constructor() {
        this.metrics = [];
    }
    
    async measureRoute(generator, options) {
        const startTime = performance.now();
        const startMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
        
        try {
            const route = await generator.generateRoundTrip(options);
            const endTime = performance.now();
            const endMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
            
            const metric = {
                timestamp: new Date().toISOString(),
                duration: endTime - startTime,
                memoryUsed: endMemory - startMemory,
                distance: options.distance,
                curveLevel: options.curveLevel,
                success: true,
                routeDistance: route.paths[0].distance / 1000
            };
            
            this.metrics.push(metric);
            console.log('性能指标:', metric);
            
            return route;
            
        } catch (error) {
            const endTime = performance.now();
            
            this.metrics.push({
                timestamp: new Date().toISOString(),
                duration: endTime - startTime,
                distance: options.distance,
                curveLevel: options.curveLevel,
                success: false,
                error: error.message
            });
            
            throw error;
        }
    }
    
    getAveragePerformance() {
        const successfulMetrics = this.metrics.filter(m => m.success);
        
        if (successfulMetrics.length === 0) return null;
        
        const avgDuration = successfulMetrics.reduce((sum, m) => sum + m.duration, 0) / successfulMetrics.length;
        const avgMemory = successfulMetrics.reduce((sum, m) => sum + m.memoryUsed, 0) / successfulMetrics.length;
        
        return {
            averageDuration: Math.round(avgDuration),
            averageMemoryUsage: Math.round(avgMemory),
            successRate: (successfulMetrics.length / this.metrics.length * 100).toFixed(1),
            totalRequests: this.metrics.length
        };
    }
}

// 使用示例
const monitor = new PerformanceMonitor();
const generator = new FunRouteGenerator({ apiKey: 'your_key' });

// 监控路线生成
const route = await monitor.measureRoute(generator, {
    startPoint: [39.9042, 116.4074],
    distance: 100,
    curveLevel: 'medium'
});

// 查看性能统计
console.log('性能统计:', monitor.getAveragePerformance());
```

---

💡 **提示**: 更多示例和最新文档请查看 [GitHub 仓库](https://github.com/your-repo) 和 [API 文档](./README.md)。