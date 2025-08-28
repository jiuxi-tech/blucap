const Blucap = require('./blucap.js');

async function testStartPointFormat() {
    console.log('🔍 测试startPoint格式问题');
    
    try {
        const blucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
        
        // 测试点：广州
        const startPoint = [23.1291, 113.2644]; // [lat, lng]
        console.log('起始点 [lat, lng]:', startPoint);
        
        // 验证startPoint格式
        console.log('startPoint是否为数组:', Array.isArray(startPoint));
        console.log('startPoint长度:', startPoint.length);
        console.log('startPoint[0] (lat):', startPoint[0], '类型:', typeof startPoint[0]);
        console.log('startPoint[1] (lng):', startPoint[1], '类型:', typeof startPoint[1]);
        
        // 测试_calculatePointAtDistance方法
        console.log('\n🧮 测试_calculatePointAtDistance方法...');
        try {
            const testDistance = 5000; // 5公里
            const testBearing = 90; // 东方向
            
            console.log('输入参数:');
            console.log('  point:', startPoint);
            console.log('  distance:', testDistance);
            console.log('  bearing:', testBearing);
            
            const newPoint = blucap._calculatePointAtDistance(startPoint, testDistance, testBearing);
            console.log('✅ _calculatePointAtDistance成功!');
            console.log('输出点:', newPoint);
            
            // 验证距离
            const actualDistance = blucap._calculateDistance(startPoint, newPoint);
            console.log('实际距离:', actualDistance.toFixed(2), '米');
            console.log('目标距离:', testDistance, '米');
            console.log('误差:', Math.abs(actualDistance - testDistance).toFixed(2), '米');
            
        } catch (error) {
            console.error('❌ _calculatePointAtDistance失败:', error.message);
            console.error('错误堆栈:', error.stack);
        }
        
        // 测试_generateIntermediatePoints方法
        console.log('\n🎯 测试_generateIntermediatePoints方法...');
        try {
            const targetDistance = 5000; // 5公里
            const curveLevel = 'medium';
            const startBearing = 0;
            
            console.log('输入参数:');
            console.log('  startPoint:', startPoint);
            console.log('  targetDistance:', targetDistance);
            console.log('  curveLevel:', curveLevel);
            console.log('  startBearing:', startBearing);
            
            const intermediatePoints = blucap._generateIntermediatePoints(
                startPoint, 
                targetDistance, 
                curveLevel,
                startBearing
            );
            
            console.log('✅ _generateIntermediatePoints成功!');
            console.log('生成的中间点数量:', intermediatePoints.length);
            intermediatePoints.forEach((point, index) => {
                console.log(`  点${index + 1}: [${point[0].toFixed(6)}, ${point[1].toFixed(6)}]`);
            });
            
        } catch (error) {
            console.error('❌ _generateIntermediatePoints失败:', error.message);
            console.error('错误堆栈:', error.stack);
        }
        
    } catch (error) {
        console.error('❌ 初始化失败:', error.message);
        console.error('错误堆栈:', error.stack);
    }
}

testStartPointFormat();