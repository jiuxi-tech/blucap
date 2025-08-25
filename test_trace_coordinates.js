const Blucap = require('./blucap.js');

// 追踪异常坐标的来源
function testTraceCoordinates() {
    console.log('追踪异常坐标的来源...');
    
    const blucap = new Blucap({ apiKey: 'test-api-key-for-internal-testing' });
    const startPoint = [31.2304, 121.4737]; // 上海
    const targetDistance = 50000; // 50公里
    const curveLevel = 'medium';
    const startBearing = 45;
    
    console.log(`起始点: [${startPoint[0]}, ${startPoint[1]}]`);
    console.log(`目标距离: ${targetDistance}米`);
    console.log(`弯道等级: ${curveLevel}`);
    console.log(`起始方位角: ${startBearing}度`);
    console.log('');
    
    try {
        // 直接调用主要的中间点生成函数
        console.log('调用 _generateIntermediatePoints...');
        const intermediatePoints = blucap._generateIntermediatePoints(startPoint, targetDistance, curveLevel, startBearing);
        
        console.log(`生成的中间点数量: ${intermediatePoints.length}`);
        
        // 检查每个中间点
        intermediatePoints.forEach((point, index) => {
            const distance = blucap._calculateDistance(startPoint, point);
            console.log(`中间点 ${index + 1}: [${point[0].toFixed(6)}, ${point[1].toFixed(6)}], 距起点: ${distance.toFixed(2)}米`);
            
            // 检查坐标是否异常
            if (point[0] < 20 || point[0] > 50 || point[1] < 70 || point[1] > 140) {
                console.log(`  ⚠️ 异常坐标检测到！`);
                console.log(`  纬度: ${point[0]} (正常范围: 20-50)`);
                console.log(`  经度: ${point[1]} (正常范围: 70-140)`);
            }
        });
        
        console.log('');
        
        // 现在测试完整的路线生成过程
        console.log('测试完整路线生成过程...');
        const allPoints = [startPoint, ...intermediatePoints, startPoint];
        
        console.log(`完整路线点数量: ${allPoints.length}`);
        allPoints.forEach((point, index) => {
            console.log(`路线点 ${index + 1}: [${point[0].toFixed(6)}, ${point[1].toFixed(6)}]`);
            
            // 检查坐标是否异常
            if (point[0] < 20 || point[0] > 50 || point[1] < 70 || point[1] > 140) {
                console.log(`  ⚠️ 异常坐标检测到！这个点不在中国范围内`);
            }
        });
        
    } catch (error) {
        console.error('测试失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

testTraceCoordinates();