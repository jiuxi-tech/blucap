const Blucap = require('./blucap.js');

async function testCoordinateFormat() {
    console.log('🔍 测试坐标格式和API调用');
    
    try {
        const blucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
        
        // 测试点：北京天安门
        const startPoint = [39.9042, 116.4074]; // [lat, lng]
        console.log('起始点 (lat, lng):', startPoint);
        
        // 测试简单的两点路线
        const endPoint = [39.9142, 116.4174]; // [lat, lng]
        console.log('终点 (lat, lng):', endPoint);
        
        // 直接调用_requestRoute方法测试坐标转换
        console.log('\n📡 测试_requestRoute方法...');
        const result = await blucap._requestRoute([startPoint, endPoint], 'medium');
        
        if (result && result.paths && result.paths.length > 0) {
            console.log('✅ 路线生成成功!');
            console.log('路线距离:', result.paths[0].distance, '米');
            console.log('路线时间:', result.paths[0].time, '毫秒');
            
            if (result.paths[0].points && result.paths[0].points.coordinates) {
                console.log('路线坐标点数量:', result.paths[0].points.coordinates.length);
                console.log('前3个坐标点:', result.paths[0].points.coordinates.slice(0, 3));
            }
        } else {
            console.log('❌ 路线生成失败');
            console.log('返回结果:', JSON.stringify(result, null, 2));
        }
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('API响应状态:', error.response.status);
            console.error('API响应数据:', error.response.data);
        }
    }
}

testCoordinateFormat();