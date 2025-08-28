const Blucap = require('./blucap.js');

/**
 * 简单测试GraphHopper API连接
 */
async function testBasicConnection() {
    console.log('🔍 测试GraphHopper API基本连接...');
    
    try {
        // 创建Blucap实例
        const blucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
        
        console.log('✅ Blucap实例创建成功');
        console.log('📍 API密钥:', blucap.apiKey ? '已设置' : '未设置');
        
        // 测试简单的路线生成
        console.log('\n🚗 测试基本路线生成...');
        const result = await blucap.generateFunRoute({
            start_point: [39.9042, 116.4074], // 北京天安门
            target_distance: 5000, // 5公里
            curve_level: 'medium',
            route_type: 'roundtrip',
            use_multiple_candidates: false // 使用简单模式
        });
        
        if (result && result.coordinates) {
            console.log('✅ 路线生成成功!');
            console.log('📏 路线距离:', (result.distance / 1000).toFixed(2), 'km');
            console.log('📍 坐标点数量:', result.coordinates.length);
            console.log('🎯 路线类型:', result.route_type);
            
            // 检查闭合度
            const start = result.coordinates[0];
            const end = result.coordinates[result.coordinates.length - 1];
            const closureDistance = blucap._calculateHighPrecisionDistance(start, end);
            console.log('🔄 闭合距离:', closureDistance.toFixed(2), 'm');
            
            return true;
        } else {
            console.log('❌ 路线生成失败: 无有效结果');
            return false;
        }
        
    } catch (error) {
        console.log('❌ 测试失败:', error.message);
        console.log('🔍 错误详情:', error);
        return false;
    }
}

/**
 * 测试API密钥验证
 */
async function testApiKeyValidation() {
    console.log('\n🔑 测试API密钥验证...');
    
    try {
        // 测试无效密钥
        const invalidBlucap = new Blucap({ apiKey: 'invalid-key' });
        
        const result = await invalidBlucap.generateFunRoute({
            start_point: [39.9042, 116.4074],
            target_distance: 1000,
            curve_level: 'low',
            route_type: 'roundtrip'
        });
        
        console.log('⚠️  无效密钥测试: 意外成功');
        
    } catch (error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            console.log('✅ API密钥验证正常: 无效密钥被正确拒绝');
        } else {
            console.log('❓ API密钥验证结果不明确:', error.message);
        }
    }
}

/**
 * 主测试函数
 */
async function runSimpleTest() {
    console.log('🚀 开始简单连接测试\n');
    console.log('=' .repeat(50));
    
    // 测试基本连接
    const basicSuccess = await testBasicConnection();
    
    // 测试API密钥验证
    await testApiKeyValidation();
    
    console.log('\n' + '='.repeat(50));
    console.log('📋 测试总结:');
    console.log('基本连接:', basicSuccess ? '✅ 成功' : '❌ 失败');
    console.log('\n✅ 简单测试完成!');
}

// 运行测试
runSimpleTest().catch(console.error);