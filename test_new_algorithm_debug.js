const Blucap = require('./blucap.js');

async function debugNewAlgorithm() {
    console.log('🔍 调试新算法问题');
    
    try {
        const blucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
        
        // 测试点：广州
        const startPoint = [23.1291, 113.2644]; // [lat, lng]
        const targetDistance = 5000; // 5公里
        
        console.log('起始点:', startPoint);
        console.log('目标距离:', targetDistance, '米');
        
        console.log('\n🔄 测试新算法（多候选）...');
        try {
            // 设置较小的候选数量来避免过多的失败尝试
            const originalMaxCandidates = 10;
            
            console.log('开始生成多候选路线，最大候选数量:', originalMaxCandidates);
            
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
                console.log('候选路线信息:', newResult.candidate_info || '无候选信息');
            } else {
                console.log('❌ 新算法失败 - 无有效路线');
                console.log('返回结果类型:', typeof newResult);
                if (newResult) {
                    console.log('返回结果键:', Object.keys(newResult));
                    if (newResult.error) {
                        console.log('错误信息:', newResult.error);
                    }
                }
            }
        } catch (error) {
            console.error('❌ 新算法异常:', error.message);
            console.error('错误堆栈:', error.stack);
            
            // 检查是否是特定的错误类型
            if (error.message.includes('Invalid point')) {
                console.log('\n🔍 检测到Invalid point错误，可能的原因:');
                console.log('1. _calculatePointAtDistance返回undefined');
                console.log('2. 坐标验证失败');
                console.log('3. 参数传递错误');
                
                // 测试基础的点计算功能
                console.log('\n🧮 测试基础点计算功能...');
                try {
                    const testPoint = blucap._calculatePointAtDistance(startPoint, 1000, 90);
                    console.log('基础点计算结果:', testPoint);
                } catch (calcError) {
                    console.error('基础点计算失败:', calcError.message);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ 初始化失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

debugNewAlgorithm();