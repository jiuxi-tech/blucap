const Blucap = require('./blucap.js');

// 创建 Blucap 实例
const blucap = new Blucap({
    apiKey: 'test-key'
});

// 模拟测试数据
const testCoordinates = [
    [116.3974, 39.9093],  // 起点
    [116.4074, 39.9193],  // 中间点1
    [116.4174, 39.9093],  // 中间点2
    [116.4074, 39.8993],  // 中间点3
    [116.3974, 39.9093]   // 终点（与起点相同）
];

const startPoint = [116.3974, 39.9093];
const targetDistance = 5000; // 5km
const curveLevel = 'medium';

console.log('=== 质量评分调试测试 ===');
console.log('起点:', startPoint);
console.log('目标距离:', targetDistance, 'meters');
console.log('弯道等级:', curveLevel);
console.log('测试坐标点数:', testCoordinates.length);

// 模拟路线结果
const mockResult = {
    coordinates: testCoordinates,
    distance: 4800 // 模拟实际距离
};

try {
    console.log('\n=== 步骤1: 测试几何分析 ===');
    const geometryAnalysis = blucap._analyzeRouteGeometry(testCoordinates, startPoint, targetDistance);
    console.log('几何分析结果:', JSON.stringify(geometryAnalysis, null, 2));
    
    console.log('\n=== 步骤2: 测试高级闭合指标 ===');
    const BlucapClass = require('./blucap.js');
    const utils = BlucapClass.utils || (BlucapClass.prototype && BlucapClass.prototype.constructor.utils);
    if (utils && utils._calculateAdvancedClosureMetrics) {
        const routeStart = testCoordinates[0];
        const routeEnd = testCoordinates[testCoordinates.length - 1];
        const closureDistance = blucap._calculateDistance(startPoint, routeEnd);
        const startPointDistance = blucap._calculateDistance(startPoint, routeStart);
        
        const advancedMetrics = utils._calculateAdvancedClosureMetrics({
            routeStart,
            routeEnd,
            startPoint,
            coordinates: testCoordinates,
            targetDistance,
            closureDistance,
            startPointDistance
        });
        console.log('高级闭合指标:', JSON.stringify(advancedMetrics, null, 2));
        
        console.log('\n=== 步骤3: 测试闭合指标评分 ===');
        if (utils._scoreClosureMetrics) {
            const closureScore = utils._scoreClosureMetrics(advancedMetrics);
            console.log('闭合指标评分:', closureScore);
        } else {
            console.log('未找到 _scoreClosureMetrics 函数');
        }
    } else {
        console.log('未找到 utils 或 _calculateAdvancedClosureMetrics 函数');
    }
    
    console.log('\n=== 步骤4: 测试迭代质量评估 ===');
    const qualityScore = blucap._assessIterationQuality(mockResult, startPoint, targetDistance, curveLevel);
    console.log('迭代质量评分:', qualityScore);
    
    console.log('\n=== 步骤5: 测试质量等级计算 ===');
    if (utils && utils._calculateQualityGrade) {
        const qualityGrade = utils._calculateQualityGrade(qualityScore * 100);
        console.log('质量等级:', qualityGrade);
    } else {
        // 直接调用函数
        const qualityGrade = blucap._calculateQualityGrade ? blucap._calculateQualityGrade(qualityScore * 100) : 'N/A';
        console.log('质量等级:', qualityGrade);
    }
    
} catch (error) {
    console.error('测试过程中出现错误:', error);
    console.error('错误堆栈:', error.stack);
}

console.log('\n=== 调试测试完成 ===');