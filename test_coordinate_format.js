const Blucap = require('./blucap.js');

// 创建Blucap实例
const blucap = new Blucap({ apiKey: 'dummy-key' });

console.log('测试坐标格式问题');
console.log('='.repeat(50));

// 上海的坐标
const shanghai1 = [121.4737, 31.2304]; // [lng, lat]
const shanghai2 = [121.5, 31.25];      // [lng, lat]

console.log('点1 (上海):', shanghai1);
console.log('点2 (上海附近):', shanghai2);
console.log();

// 测试距离计算
const distance = blucap._calculateDistance(shanghai1, shanghai2);
console.log('两点间距离:', distance.toFixed(2), '米');
console.log('预期距离: 约3000-4000米 (上海市内)');
console.log();

// 测试方位角计算
const bearing = blucap._calculateBearing(shanghai1, shanghai2);
console.log('方位角:', bearing.toFixed(2), '度');
console.log();

// 测试_calculatePointAtDistance函数
console.log('测试 _calculatePointAtDistance 函数:');
const testPoint = [31.2304, 121.4737]; // [lat, lng] 格式
const testDistance = 5000; // 5公里
const testBearing = 45; // 东北方向

console.log('输入点 (lat, lng):', testPoint);
console.log('距离:', testDistance, '米');
console.log('方位角:', testBearing, '度');

const newPoint = blucap._calculatePointAtDistance(testPoint, testDistance, testBearing);
console.log('计算出的新点 (lat, lng):', newPoint);

// 验证新点是否合理
if (newPoint[0] >= 30 && newPoint[0] <= 32 && newPoint[1] >= 120 && newPoint[1] <= 122) {
    console.log('✅ 新点坐标看起来正常 (在上海地区)');
} else {
    console.log('❌ 新点坐标异常');
}

// 计算实际距离验证
const actualDistance = blucap._calculateDistance(
    [testPoint[1], testPoint[0]], // 转换为 [lng, lat]
    [newPoint[1], newPoint[0]]    // 转换为 [lng, lat]
);
console.log('实际距离:', actualDistance.toFixed(2), '米');
console.log('目标距离:', testDistance, '米');
console.log('误差:', Math.abs(actualDistance - testDistance).toFixed(2), '米');