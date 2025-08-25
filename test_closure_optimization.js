const Blucap = require('./blucap.js');

// 创建Blucap实例（提供虚拟API密钥用于测试）
const blucap = new Blucap({
    apiKey: 'test-key-for-internal-function-testing'
});

// 测试起点（上海）- 注意：_calculateClosureOptimizedPoint期望[lat, lng]格式
const startPoint = [31.2304, 121.4737]; // 上海 [lat, lng]

// 模拟一个最后的中间点
const lastIntermediatePoint = [31.25, 121.5]; // 最后一个中间点 [lat, lng]

// 测试参数
const targetDistanceKm = 10; // 10公里
const targetDistance = targetDistanceKm * 1000; // 转换为米
const curveLevel = 'medium';

console.log('测试 _calculateClosureOptimizedPoint 函数');
console.log('起点:', startPoint);
console.log('最后中间点:', lastIntermediatePoint);
console.log('目标距离:', targetDistanceKm, 'km');
console.log('弯道等级:', curveLevel);
console.log('\n开始测试...');

try {
    // 调用闭合优化函数
    const optimizedPoint = blucap._calculateClosureOptimizedPoint(
        startPoint,
        lastIntermediatePoint,
        targetDistance, // 使用米为单位
        curveLevel
    );
    
    console.log('\n优化后的闭合点:', optimizedPoint);
    
    // 验证坐标是否合理
    const [lng, lat] = optimizedPoint;
    console.log('\n坐标验证:');
    console.log('经度:', lng, '(应该在120-122之间)');
    console.log('纬度:', lat, '(应该在30-32之间)');
    
    // 检查是否为有效数值
    if (isNaN(lng) || isNaN(lat)) {
        console.log('❌ 错误：坐标包含NaN值');
    } else if (lng < 120 || lng > 122 || lat < 30 || lat > 32) {
        console.log('❌ 警告：坐标超出上海地区范围');
    } else {
        console.log('✅ 坐标看起来正常');
    }
    
    // 计算距离验证
    const distanceToStart = blucap._calculateDistance(optimizedPoint, startPoint);
    const distanceFromLast = blucap._calculateDistance(lastIntermediatePoint, optimizedPoint);
    
    console.log('\n距离验证:');
    console.log('优化点到起点距离:', distanceToStart.toFixed(2), '米');
    console.log('最后中间点到优化点距离:', distanceFromLast.toFixed(2), '米');
    
    // 测试内部计算过程
    console.log('\n内部计算过程验证:');
    const bearingToStart = blucap._calculateBearing(lastIntermediatePoint, startPoint);
    const currentDistance = blucap._calculateDistance(lastIntermediatePoint, startPoint);
    
    console.log('最后中间点到起点的方位角:', bearingToStart.toFixed(2), '度');
    console.log('最后中间点到起点的距离:', currentDistance.toFixed(2), '米');
    
    // 使用与实际函数相同的计算逻辑
    const curveFactors = {
        'low': { closureRatio: 1.2, offsetAngle: 15 },
        'medium': { closureRatio: 1.5, offsetAngle: 25 },
        'high': { closureRatio: 2.0, offsetAngle: 35 }
    };
    const factor = curveFactors[curveLevel];
    const maxDistance = Math.min(15000, targetDistance * 0.8);
    const baseDistance = Math.max(currentDistance * factor.closureRatio, targetDistance * 0.3);
    const optimalDistance = Math.min(baseDistance, maxDistance);
    const adjustedBearing = (bearingToStart + factor.offsetAngle) % 360;
    
    console.log('闭合比例:', factor.closureRatio);
    console.log('角度偏移:', factor.offsetAngle, '度');
    console.log('计算的优化距离:', optimalDistance.toFixed(2), '米');
    console.log('调整后的方位角:', adjustedBearing.toFixed(2), '度');
    
} catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error(error.stack);
}

console.log('\n测试完成');