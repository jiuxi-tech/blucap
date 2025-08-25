const Blucap = require('./blucap.js');

// 创建Blucap实例（使用测试密钥）
const blucap = new Blucap({
    apiKey: 'test-api-key-for-internal-testing'
});

async function testCompleteRoute() {
    console.log('测试完整50km路线生成...');
    
    const routeParams = {
        start_point: [31.2304, 121.4737], // 上海
        target_distance: 50000, // 50km
        curve_level: 'medium',
        route_type: 'roundtrip',
        profile: 'car'
    };
    
    try {
        console.log('生成路线参数:', routeParams);
        
        const result = await blucap.generateFunRoute(routeParams);
        
        console.log('\n✅ 路线生成成功！');
        console.log('路线总距离:', result.distance, '米');
        console.log('路线点数:', result.coordinates.length);
        console.log('质量评分:', result.qualityScore);
        
        if (result.validationResult) {
            console.log('验证结果:', result.validationResult.isValid ? '通过' : '失败');
            if (result.validationResult.closureValidation) {
                console.log('闭合距离:', result.validationResult.closureValidation.closureDistance, '米');
            }
        }
        
    } catch (error) {
        console.error('❌ 路线生成失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

// 运行测试
testCompleteRoute();