const Blucap = require('./blucap.js');

// 创建Blucap实例
const blucap = new Blucap({
    apiKey: 'fake-api-key'
});

console.log('=== 测试_calculatePointAtDistance函数修复 ===');

// 测试上海地区的坐标
const startPoint = [31.2304, 121.4737]; // [lat, lng]格式
const bearing = 90; // 正东方向
const distance = 5000; // 5公里

console.log('起点坐标 [lat, lng]:', startPoint);
console.log('方位角:', bearing, '度');
console.log('目标距离:', distance, '米');

// 手动实现正确的_calculatePointAtDistance函数
function calculatePointAtDistanceCorrect(point, distance, bearing) {
    const R = 6371000; // 地球半径(米)
    const lat1Rad = point[0] * Math.PI / 180;
    const lng1Rad = point[1] * Math.PI / 180;
    const bearingRad = bearing * Math.PI / 180;
    
    // 计算新纬度
    const lat2Rad = Math.asin(
        Math.sin(lat1Rad) * Math.cos(distance / R) +
        Math.cos(lat1Rad) * Math.sin(distance / R) * Math.cos(bearingRad)
    );
    
    // 计算新经度
    const lng2Rad = lng1Rad + Math.atan2(
        Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1Rad),
        Math.cos(distance / R) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );
    
    const lat2 = lat2Rad * 180 / Math.PI;
    const lng2 = lng2Rad * 180 / Math.PI;
    
    return [lat2, lng2];
}

// 测试原始函数
try {
    const originalResult = blucap._calculatePointAtDistance(startPoint, distance, bearing);
    console.log('\n原始函数结果:', originalResult);
    
    // 验证距离
    const originalDistance = blucap._calculateDistance(
        [originalResult[1], originalResult[0]], // 转换为[lng, lat]
        [startPoint[1], startPoint[0]] // 转换为[lng, lat]
    );
    console.log('原始函数计算的实际距离:', originalDistance.toFixed(2), '米');
    
} catch (error) {
    console.error('原始函数出错:', error.message);
}

// 测试修正后的函数
const correctedResult = calculatePointAtDistanceCorrect(startPoint, distance, bearing);
console.log('\n修正函数结果:', correctedResult);

// 验证修正后的距离
const correctedDistance = blucap._calculateDistance(
    [correctedResult[1], correctedResult[0]], // 转换为[lng, lat]
    [startPoint[1], startPoint[0]] // 转换为[lng, lat]
);
console.log('修正函数计算的实际距离:', correctedDistance.toFixed(2), '米');
console.log('误差:', Math.abs(correctedDistance - distance).toFixed(2), '米');

// 测试不同方向
console.log('\n=== 测试不同方向 ===');
const directions = [
    { name: '北', bearing: 0 },
    { name: '东', bearing: 90 },
    { name: '南', bearing: 180 },
    { name: '西', bearing: 270 }
];

directions.forEach(dir => {
    const result = calculatePointAtDistanceCorrect(startPoint, 1000, dir.bearing);
    const actualDistance = blucap._calculateDistance(
        [result[1], result[0]], // 转换为[lng, lat]
        [startPoint[1], startPoint[0]] // 转换为[lng, lat]
    );
    console.log(`${dir.name}方向 (${dir.bearing}°): 实际距离 ${actualDistance.toFixed(2)}米`);
});