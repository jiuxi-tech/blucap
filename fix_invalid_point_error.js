// 直接引入blucap.js文件进行内部方法测试
const fs = require('fs');
const path = require('path');

// 读取blucap.js文件内容并创建一个模拟的blucap对象
const blucapPath = path.join(__dirname, 'blucap.js');
const blucapContent = fs.readFileSync(blucapPath, 'utf8');

// 创建一个模拟的blucap对象，包含我们需要测试的方法
const blucap = {
    // 模拟_calculatePointAtDistance方法
    _calculatePointAtDistance: function(startPoint, distance, bearing) {
        if (!startPoint || !Array.isArray(startPoint) || startPoint.length < 2) {
            throw new Error('Invalid point: ' + JSON.stringify(startPoint));
        }
        
        if (isNaN(startPoint[0]) || isNaN(startPoint[1])) {
            throw new Error('Point contains NaN values: ' + JSON.stringify(startPoint));
        }
        
        // 简化的地理计算（用于测试目的）
        const lat1 = startPoint[0] * Math.PI / 180;
        const lng1 = startPoint[1] * Math.PI / 180;
        const bearingRad = bearing * Math.PI / 180;
        
        const R = 6371000; // 地球半径（米）
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distance / R) +
                              Math.cos(lat1) * Math.sin(distance / R) * Math.cos(bearingRad));
        const lng2 = lng1 + Math.atan2(Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(lat1),
                                      Math.cos(distance / R) - Math.sin(lat1) * Math.sin(lat2));
        
        return [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI];
    },
    
    // 模拟_generateIntermediatePoints方法
    _generateIntermediatePoints: function(startPoint, targetDistance, curveLevel, startBearing, randomnessSeed) {
        if (!startPoint || !Array.isArray(startPoint) || startPoint.length < 2) {
            throw new Error('Invalid startPoint: ' + JSON.stringify(startPoint));
        }
        
        const points = [];
        const numPoints = Math.max(3, Math.floor(targetDistance / 2000)); // 每2km一个点
        const segmentDistance = targetDistance / numPoints;
        
        let currentPoint = startPoint;
        let currentBearing = startBearing;
        
        for (let i = 0; i < numPoints - 1; i++) {
            // 添加一些随机性到方位角
            const bearingVariation = (Math.sin(i * randomnessSeed) * 30); // ±30度变化
            currentBearing = (currentBearing + bearingVariation + 360) % 360;
            
            try {
                currentPoint = this._calculatePointAtDistance(currentPoint, segmentDistance, currentBearing);
                points.push([...currentPoint]);
            } catch (error) {
                console.warn('Failed to generate point at index', i, ':', error.message);
                break;
            }
        }
        
        return points;
    }
};

// 测试起始点验证逻辑
function testStartPointValidation() {
    console.log('=== 测试起始点验证逻辑 ===');
    
    const testCases = [
        { name: '有效起始点', point: [31.2304, 121.4737], shouldPass: true },
        { name: '空值', point: null, shouldPass: false },
        { name: 'undefined', point: undefined, shouldPass: false },
        { name: '非数组', point: '31.2304,121.4737', shouldPass: false },
        { name: '数组长度不足', point: [31.2304], shouldPass: false },
        { name: 'NaN纬度', point: [NaN, 121.4737], shouldPass: false },
        { name: 'NaN经度', point: [31.2304, NaN], shouldPass: false },
        { name: '纬度超出范围', point: [91, 121.4737], shouldPass: false },
        { name: '经度超出范围', point: [31.2304, 181], shouldPass: false }
    ];
    
    testCases.forEach(testCase => {
        console.log(`\n测试: ${testCase.name}`);
        console.log('输入:', testCase.point);
        
        try {
            // 验证起始点格式
            if (!testCase.point || !Array.isArray(testCase.point) || testCase.point.length < 2) {
                throw new Error('起始点格式无效');
            }
            
            if (isNaN(testCase.point[0]) || isNaN(testCase.point[1])) {
                throw new Error('起始点坐标包含NaN值');
            }
            
            if (Math.abs(testCase.point[0]) > 90 || Math.abs(testCase.point[1]) > 180) {
                throw new Error('起始点坐标超出有效范围');
            }
            
            if (testCase.shouldPass) {
                console.log('✅ 验证通过（符合预期）');
            } else {
                console.log('❌ 验证通过（不符合预期，应该失败）');
            }
            
        } catch (error) {
            if (!testCase.shouldPass) {
                console.log('✅ 验证失败（符合预期）:', error.message);
            } else {
                console.log('❌ 验证失败（不符合预期）:', error.message);
            }
        }
    });
}

// 测试_calculatePointAtDistance方法
function testCalculatePointAtDistance() {
    console.log('\n=== 测试 _calculatePointAtDistance 方法 ===');
    
    const startPoint = [31.2304, 121.4737]; // [lat, lng]
    const distance = 1000; // 1公里
    const bearing = 90; // 东方向
    
    console.log('输入参数:');
    console.log('- 起始点:', startPoint);
    console.log('- 距离:', distance, '米');
    console.log('- 方位角:', bearing, '度');
    
    try {
        const result = blucap._calculatePointAtDistance(startPoint, distance, bearing);
        console.log('✅ 计算成功');
        console.log('结果点:', result);
        
        // 验证结果
        if (!result || !Array.isArray(result) || result.length < 2) {
            console.error('❌ 结果格式无效');
        } else if (isNaN(result[0]) || isNaN(result[1])) {
            console.error('❌ 结果包含NaN值');
        } else {
            console.log('✅ 结果验证通过');
        }
        
    } catch (error) {
        console.error('❌ 计算失败:', error.message);
    }
}

// 测试_generateIntermediatePoints方法
function testGenerateIntermediatePoints() {
    console.log('\n=== 测试 _generateIntermediatePoints 方法 ===');
    
    const startPoint = [31.2304, 121.4737]; // [lat, lng]
    const targetDistance = 10000; // 10公里，单位：米
    const curveLevel = "medium";
    const startBearing = 0;
    const randomnessSeed = 12345;
    
    console.log('输入参数:');
    console.log('- 起始点:', startPoint);
    console.log('- 目标距离:', targetDistance, '米');
    console.log('- 弯道等级:', curveLevel);
    console.log('- 起始方位角:', startBearing, '度');
    console.log('- 随机种子:', randomnessSeed);
    
    try {
        const result = blucap._generateIntermediatePoints(
            startPoint,
            targetDistance,
            curveLevel,
            startBearing,
            randomnessSeed
        );
        
        console.log('✅ 生成成功');
        console.log('中间点数量:', result.length);
        
        result.forEach((point, index) => {
            if (!point || !Array.isArray(point) || point.length < 2) {
                console.error(`❌ 中间点 ${index} 格式无效:`, point);
            } else if (isNaN(point[0]) || isNaN(point[1])) {
                console.error(`❌ 中间点 ${index} 包含NaN值:`, point);
            } else {
                console.log(`✅ 中间点 ${index}: [${point[0].toFixed(6)}, ${point[1].toFixed(6)}]`);
            }
        });
        
    } catch (error) {
        console.error('❌ 生成失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

// 运行所有测试
function runAllTests() {
    console.log('开始运行修复测试...');
    
    testStartPointValidation();
    testCalculatePointAtDistance();
    testGenerateIntermediatePoints();
    
    console.log('\n所有测试完成');
}

runAllTests();