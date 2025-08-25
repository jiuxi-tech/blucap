const Blucap = require('./blucap.js');

// 测试_calculatePointAtDistance函数
function testPointCalculation() {
    console.log('测试_calculatePointAtDistance函数...');
    
    const blucap = new Blucap({ apiKey: 'test-api-key-for-internal-testing' });
    const startPoint = [31.2304, 121.4737]; // 上海
    
    console.log(`起始点: [${startPoint[0]}, ${startPoint[1]}]`);
    
    // 测试不同距离和角度
    const testCases = [
        { distance: 5000, bearing: 0 },    // 5km 北
        { distance: 5000, bearing: 90 },   // 5km 东
        { distance: 5000, bearing: 180 },  // 5km 南
        { distance: 5000, bearing: 270 },  // 5km 西
        { distance: 15000, bearing: 45 },  // 15km 东北
        { distance: 25000, bearing: 135 }, // 25km 东南（可能过大）
    ];
    
    testCases.forEach((testCase, index) => {
        try {
            const point = blucap._calculatePointAtDistance(startPoint, testCase.distance, testCase.bearing);
            const actualDistance = blucap._calculateDistance(startPoint, point);
            
            console.log(`测试 ${index + 1}: 距离=${testCase.distance}米, 角度=${testCase.bearing}度`);
            console.log(`  生成点: [${point[0].toFixed(6)}, ${point[1].toFixed(6)}]`);
            console.log(`  实际距离: ${actualDistance.toFixed(2)}米`);
            console.log(`  距离误差: ${Math.abs(actualDistance - testCase.distance).toFixed(2)}米`);
            
            // 检查坐标是否合理（应该在中国附近）
            if (point[0] < 20 || point[0] > 50 || point[1] < 70 || point[1] > 140) {
                console.log(`  ⚠️ 警告: 坐标可能异常，不在中国范围内`);
            } else {
                console.log(`  ✅ 坐标正常`);
            }
            
        } catch (error) {
            console.log(`测试 ${index + 1} 失败: ${error.message}`);
        }
        console.log('');
    });
}

testPointCalculation();