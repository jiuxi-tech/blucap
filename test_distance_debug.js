const Blucap = require('./blucap.js');

// 创建Blucap实例
const blucap = new Blucap({
    apiKey: 'fake-api-key'
});

// 测试上海地区的坐标
const startPoint = [121.4737, 31.2304]; // 上海人民广场 [lng, lat]
const endPoint = [121.5074, 31.2397]; // 上海外滩 [lng, lat]

console.log('=== 距离计算调试测试 ===');
console.log('起点坐标 (人民广场):', startPoint);
console.log('终点坐标 (外滩):', endPoint);

// 测试_calculateDistance函数
const distance = blucap._calculateDistance(startPoint, endPoint);
console.log('\n计算距离:', distance, '米');
console.log('计算距离:', (distance / 1000).toFixed(2), '公里');

// 测试_calculateBearing函数
const bearing = blucap._calculateBearing(startPoint, endPoint);
console.log('\n方位角:', bearing, '度');

// 测试_calculatePointAtDistance函数
const testDistance = 5000; // 5公里
const testBearing = 90; // 使用固定的90度方位角
const newPoint = blucap._calculatePointAtDistance([31.2304, 121.4737], testDistance, testBearing); // [lat, lng]格式
console.log('\n从起点沿方位角', testBearing, '度移动', testDistance, '米后的新点:');
console.log('新点坐标 [lat, lng]:', newPoint);
console.log('新点坐标 [lng, lat]:', [newPoint[1], newPoint[0]]);

// 验证新点到起点的距离
const verifyDistance = blucap._calculateDistance(startPoint, [newPoint[1], newPoint[0]]);
console.log('\n验证：新点到起点的实际距离:', verifyDistance.toFixed(2), '米');
console.log('目标距离:', testDistance, '米');
console.log('误差:', Math.abs(verifyDistance - testDistance).toFixed(2), '米');

// 同时测试原来的bearing值
console.log('\n=== 使用原来的bearing值测试 ===');
const newPoint2 = blucap._calculatePointAtDistance([31.2304, 121.4737], testDistance, bearing);
console.log('使用bearing', bearing.toFixed(2), '度的结果:', newPoint2);
const verifyDistance2 = blucap._calculateDistance(startPoint, [newPoint2[1], newPoint2[0]]);
console.log('实际距离:', verifyDistance2.toFixed(2), '米');

// 测试_calculateClosureOptimizedPoint函数的输入
console.log('\n=== 测试_calculateClosureOptimizedPoint函数 ===');
const closureStartPoint = [31.2304, 121.4737]; // 上海 [lat, lng]
const lastIntermediatePoint = [31.245, 121.5]; // 最后一个中间点 [lat, lng]最后中间点 [lng, lat]
const targetDistance = 10000; // 10公里
const curveLevel = 'medium'; // 弯道等级

console.log('起点:', closureStartPoint);
console.log('最后中间点:', lastIntermediatePoint);
console.log('目标距离:', targetDistance, '米');
console.log('弯道等级:', curveLevel);

// 计算最后中间点到起点的距离
const lastToStartDistance = blucap._calculateDistance(lastIntermediatePoint, closureStartPoint);
console.log('\n最后中间点到起点的距离:', lastToStartDistance.toFixed(2), '米');

try {
    const optimizedPoint = blucap._calculateClosureOptimizedPoint(closureStartPoint, lastIntermediatePoint, targetDistance, curveLevel);
    console.log('优化后的闭合点:', optimizedPoint);
    
    if (optimizedPoint && optimizedPoint[0] !== null && optimizedPoint[1] !== null) {
        const optimizedDistance = blucap._calculateDistance(optimizedPoint, closureStartPoint);
        console.log('优化点到起点的距离:', optimizedDistance.toFixed(2), '米');
        
        const lastToOptimizedDistance = blucap._calculateDistance(lastIntermediatePoint, optimizedPoint);
        console.log('最后中间点到优化点的距离:', lastToOptimizedDistance.toFixed(2), '米');
    }
} catch (error) {
    console.error('调用_calculateClosureOptimizedPoint时出错:', error.message);
}