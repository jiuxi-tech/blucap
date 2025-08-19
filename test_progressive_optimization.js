const Blucap = require('./blucap.js');

// 测试渐进式闭合优化功能
async function testProgressiveOptimization() {
    console.log('=== 测试渐进式闭合优化功能 ===\n');
    
    // 创建Blucap实例
    const blucap = new Blucap({
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com'
    });
    
    // 测试参数
    const testCases = [
        {
            name: '短距离路线 (2km)',
            startPoint: [116.3974, 39.9093], // 北京天安门
            targetDistance: 2000,
            curveLevel: 'medium'
        },
        {
            name: '中距离路线 (5km)',
            startPoint: [121.4737, 31.2304], // 上海外滩
            targetDistance: 5000,
            curveLevel: 'high'
        },
        {
            name: '长距离路线 (10km)',
            startPoint: [113.2644, 23.1291], // 广州
            targetDistance: 10000,
            curveLevel: 'low'
        }
    ];
    
    for (const testCase of testCases) {
        console.log(`\n--- 测试: ${testCase.name} ---`);
        console.log(`起点: [${testCase.startPoint[0]}, ${testCase.startPoint[1]}]`);
        console.log(`目标距离: ${testCase.targetDistance}米`);
        console.log(`曲线级别: ${testCase.curveLevel}`);
        
        try {
            // 模拟原始请求
            const originalRequest = {
                points: [testCase.startPoint, testCase.startPoint],
                profile: 'cycling',
                format: 'geojson',
                geometries: 'geojson'
            };
            
            // 测试渐进式优化
            console.log('\n开始渐进式闭合优化测试...');
            
            // 由于这是测试环境，我们主要测试函数调用和参数传递
            // 实际的API调用会在真实环境中进行
            
            // 测试策略生成
            const strategy1 = blucap._generateIterationStrategy(0, [], testCase.targetDistance, testCase.curveLevel);
            console.log('第1轮策略:', strategy1);
            
            const strategy2 = blucap._generateIterationStrategy(1, [{ quality: 0.6 }], testCase.targetDistance, testCase.curveLevel);
            console.log('第2轮策略:', strategy2);
            
            // 测试优化点生成
            const optimizedPoints = blucap._generateIterativeOptimizedPoints(
                testCase.startPoint,
                testCase.targetDistance,
                testCase.curveLevel,
                0,
                strategy1
            );
            console.log(`生成优化点数量: ${optimizedPoints.length}`);
            
            // 测试质量评估
            const mockResult = {
                paths: [{ distance: testCase.targetDistance * 1.05 }],
                features: [{
                    geometry: {
                        coordinates: [testCase.startPoint, ...optimizedPoints, testCase.startPoint]
                    }
                }]
            };
            
            const qualityAssessment = blucap._assessIterationQuality(
                mockResult,
                testCase.startPoint,
                testCase.targetDistance,
                testCase.curveLevel
            );
            console.log('质量评估结果:', qualityAssessment);
            
            console.log(`✅ ${testCase.name} 测试完成`);
            
        } catch (error) {
            console.error(`❌ ${testCase.name} 测试失败:`, error.message);
        }
    }
    
    console.log('\n=== 渐进式闭合优化功能测试完成 ===');
}

// 运行测试
if (require.main === module) {
    testProgressiveOptimization().catch(console.error);
}

module.exports = { testProgressiveOptimization };