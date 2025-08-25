const Blucap = require('./blucap.js');

// 创建一个测试实例，不需要API key
const blucap = new Blucap({
    apiKey: 'test-key' // 使用测试key
});

// 测试50km路线的中间点生成
const startPoint = [31.2304, 121.4737];
const targetDistance = 50000; // 50km
const curveLevel = 'medium';

console.log('测试50km路线中间点生成...');
console.log('起点:', startPoint);
console.log('目标距离:', targetDistance, '米');
console.log('弯道等级:', curveLevel);

try {
    // 测试中间点生成
    const intermediatePoints = blucap._generateIntermediatePoints(startPoint, targetDistance, curveLevel, 0);
    console.log('\n生成的中间点数量:', intermediatePoints.length);
    console.log('中间点坐标:');
    intermediatePoints.forEach((point, index) => {
        console.log(`  点${index + 1}: [${point[0].toFixed(6)}, ${point[1].toFixed(6)}]`);
        
        // 计算与起点的距离
        const distance = blucap._calculateDistance(point, startPoint);
        console.log(`    距离起点: ${distance.toFixed(0)}米`);
    });
    
    // 测试点数计算
    const optimalPointCount = blucap._calculateOptimalPointCount(targetDistance, curveLevel);
    console.log('\n计算的最优点数:', optimalPointCount);
    
    // 测试半径计算
    const baseRadius = blucap._calculateBaseRadius(targetDistance, curveLevel);
    console.log('基础半径:', baseRadius.toFixed(0), '米');
    
    console.log('\n✅ 50km路线中间点生成测试成功！');
    
} catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误堆栈:', error.stack);
}