const Blucap = require('./blucap.js');

async function debugRouteGeneration() {
    console.log('🔍 调试路线生成错误');
    
    try {
        const blucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
        
        // 测试点：广州
        const startPoint = [23.1291, 113.2644]; // [lat, lng]
        const targetDistance = 5000; // 5公里
        
        console.log('起始点:', startPoint);
        console.log('目标距离:', targetDistance, '米');
        
        console.log('\n🔄 测试新算法（多候选）...');
        try {
            const newResult = await blucap._generateMultipleCandidateRoundTrips(
                startPoint, 
                targetDistance, 
                'medium', 
                'moderate'
            );
            
            if (newResult && newResult.paths && newResult.paths.length > 0) {
                console.log('✅ 新算法成功!');
                console.log('路线距离:', newResult.paths[0].distance, '米');
                console.log('路线时间:', newResult.paths[0].time, '毫秒');
            } else {
                console.log('❌ 新算法失败 - 无有效路线');
                console.log('返回结果:', JSON.stringify(newResult, null, 2));
            }
        } catch (error) {
            console.error('❌ 新算法异常:', error.message);
            console.error('错误堆栈:', error.stack);
            if (error.response) {
                console.error('API响应:', error.response);
            }
        }
        
        console.log('\n🔄 测试旧算法（单路线）...');
        try {
            const reqArgs = {
                start_point: startPoint,
                target_distance: targetDistance,
                curve_level: 'medium',
                start_bearing: 0
            };
            const oldResult = await blucap._generateRoundTrip(reqArgs);
            
            if (oldResult && oldResult.paths && oldResult.paths.length > 0) {
                console.log('✅ 旧算法成功!');
                console.log('路线距离:', oldResult.paths[0].distance, '米');
                console.log('路线时间:', oldResult.paths[0].time, '毫秒');
            } else {
                console.log('❌ 旧算法失败 - 无有效路线');
                console.log('返回结果:', JSON.stringify(oldResult, null, 2));
            }
        } catch (error) {
            console.error('❌ 旧算法异常:', error.message);
            console.error('错误堆栈:', error.stack);
            if (error.response) {
                console.error('API响应:', error.response);
            }
        }
        
    } catch (error) {
        console.error('❌ 初始化失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

debugRouteGeneration();