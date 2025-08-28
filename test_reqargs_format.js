const Blucap = require('./blucap.js');

async function testReqArgsFormat() {
    console.log('🔍 测试reqArgs格式问题');
    
    try {
        const blucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
        
        // 测试点：广州
        const startPoint = [23.1291, 113.2644]; // [lat, lng]
        
        // 构建reqArgs对象（模拟_generateRoundTrip的调用）
        const reqArgs = {
            start_point: startPoint,
            target_distance: 5000,
            curve_level: 'medium',
            start_bearing: 0
        };
        
        console.log('reqArgs对象:', JSON.stringify(reqArgs, null, 2));
        console.log('reqArgs.start_point:', reqArgs.start_point);
        console.log('reqArgs.start_point类型:', typeof reqArgs.start_point);
        console.log('reqArgs.start_point是否为数组:', Array.isArray(reqArgs.start_point));
        
        if (Array.isArray(reqArgs.start_point)) {
            console.log('reqArgs.start_point长度:', reqArgs.start_point.length);
            console.log('reqArgs.start_point[0]:', reqArgs.start_point[0], '类型:', typeof reqArgs.start_point[0]);
            console.log('reqArgs.start_point[1]:', reqArgs.start_point[1], '类型:', typeof reqArgs.start_point[1]);
        }
        
        // 直接测试_generateRoundTrip方法
        console.log('\n🎯 测试_generateRoundTrip方法...');
        try {
            const result = await blucap._generateRoundTrip(reqArgs);
            console.log('✅ _generateRoundTrip成功!');
            console.log('路线距离:', result.paths[0].distance, '米');
            console.log('路线时间:', result.paths[0].time, '毫秒');
            console.log('路线点数量:', result.paths[0].points.coordinates.length);
            
        } catch (error) {
            console.error('❌ _generateRoundTrip失败:', error.message);
            console.error('错误堆栈:', error.stack);
            
            // 检查错误是否与startPoint相关
            if (error.message.includes('undefined') || error.message.includes('Invalid point')) {
                console.log('\n🔍 详细调试startPoint处理...');
                
                // 手动执行_generateRoundTrip的前几步
                const extractedStartPoint = reqArgs.start_point;
                console.log('提取的startPoint:', extractedStartPoint);
                
                try {
                    const intermediatePoints = blucap._generateIntermediatePoints(
                        extractedStartPoint, 
                        reqArgs.target_distance, 
                        reqArgs.curve_level,
                        reqArgs.start_bearing
                    );
                    console.log('✅ _generateIntermediatePoints成功!');
                    console.log('生成的中间点:', intermediatePoints);
                } catch (innerError) {
                    console.error('❌ _generateIntermediatePoints失败:', innerError.message);
                    console.error('内部错误堆栈:', innerError.stack);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ 初始化失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

testReqArgsFormat();