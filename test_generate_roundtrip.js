const Blucap = require('./blucap.js');

// 创建Blucap实例（提供有效的API密钥格式）
const blucap = new Blucap({
    apiKey: 'test-api-key-for-internal-testing' // 提供apiKey而不是graphhopperApiKey
});

async function testGenerateRoundTrip() {
    console.log('测试_generateRoundTrip函数...');
    
    const reqArgs = {
        start_point: [31.2304, 121.4737], // 上海
        target_distance: 50000, // 50km
        curve_level: 'medium',
        route_type: 'roundtrip',
        profile: 'car'
    };
    
    try {
        console.log('测试参数:', reqArgs);
        
        // 直接调用内部函数进行测试
        const result = await blucap._generateRoundTrip(reqArgs);
        
        console.log('\n✅ _generateRoundTrip函数执行成功！');
        console.log('生成的中间点数量:', result.intermediatePoints ? result.intermediatePoints.length : '未知');
        
        if (result.intermediatePoints) {
            console.log('中间点坐标:');
            result.intermediatePoints.forEach((point, index) => {
                console.log(`  点${index + 1}: [${point[0].toFixed(6)}, ${point[1].toFixed(6)}]`);
            });
        }
        
    } catch (error) {
        console.error('❌ _generateRoundTrip函数执行失败:', error.message);
        console.error('错误堆栈:', error.stack);
        
        // 检查是否是我们要修复的特定错误
        if (error.message.includes('无法生成有效的中间点')) {
            console.error('\n🔍 这正是我们要修复的错误！');
        }
    }
}

// 运行测试
testGenerateRoundTrip();