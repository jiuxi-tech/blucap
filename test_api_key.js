/**
 * 测试API密钥有效性
 */
async function testApiKey() {
    const apiKey = '88a887a5-cad1-4c0a-bf60-3b50429a25c1';
    const testUrl = `https://graphhopper.com/api/1/route?key=${apiKey}`;
    
    console.log('🔑 测试API密钥有效性...');
    console.log('API密钥:', apiKey);
    console.log('测试URL:', testUrl);
    
    // 构造一个简单的路线请求
    const testRequest = {
        points: [
            [116.4074, 39.9042], // 北京天安门 [lng, lat]
            [116.4174, 39.9142]  // 附近一点
        ],
        profile: 'car',
        instructions: true,
        points_encoded: true,
        elevation: false,
        locale: 'en'
    };
    
    try {
        console.log('\n📡 发送测试请求...');
        console.log('请求参数:', JSON.stringify(testRequest, null, 2));
        
        const response = await fetch(testUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testRequest)
        });
        
        console.log('\n📊 响应状态:', response.status, response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ API密钥有效!');
            console.log('响应数据:', {
                paths_count: data.paths ? data.paths.length : 0,
                has_coordinates: data.paths && data.paths[0] && data.paths[0].points ? '是' : '否'
            });
            return true;
        } else {
            const errorText = await response.text();
            console.log('❌ API请求失败');
            console.log('错误响应:', errorText);
            
            if (response.status === 401) {
                console.log('🔍 分析: API密钥无效或已过期');
            } else if (response.status === 429) {
                console.log('🔍 分析: 请求频率过高');
            } else if (response.status === 400) {
                console.log('🔍 分析: 请求参数错误');
            }
            
            return false;
        }
        
    } catch (error) {
        console.log('❌ 网络错误:', error.message);
        return false;
    }
}

/**
 * 测试不同的API端点
 */
async function testDifferentEndpoints() {
    const apiKey = '88a887a5-cad1-4c0a-bf60-3b50429a25c1';
    const endpoints = [
        'https://graphhopper.com/api/1/route',
        'https://graphhopper.com/api/1/info'
    ];
    
    console.log('\n🌐 测试不同API端点...');
    
    for (const endpoint of endpoints) {
        console.log(`\n测试端点: ${endpoint}`);
        
        try {
            const url = `${endpoint}?key=${apiKey}`;
            const response = await fetch(url, {
                method: endpoint.includes('info') ? 'GET' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: endpoint.includes('info') ? undefined : JSON.stringify({
                    points: [[116.4074, 39.9042], [116.4174, 39.9142]],
                    profile: 'car'
                })
            });
            
            console.log(`状态: ${response.status} ${response.statusText}`);
            
            if (response.status === 401) {
                console.log('❌ 401 Unauthorized - API密钥问题');
            } else if (response.ok) {
                console.log('✅ 请求成功');
            } else {
                const errorText = await response.text();
                console.log('❌ 其他错误:', errorText.substring(0, 200));
            }
            
        } catch (error) {
            console.log('❌ 网络错误:', error.message);
        }
    }
}

/**
 * 主测试函数
 */
async function runApiKeyTest() {
    console.log('🚀 开始API密钥测试\n');
    console.log('=' .repeat(60));
    
    // 测试基本API密钥
    const isValid = await testApiKey();
    
    // 测试不同端点
    await testDifferentEndpoints();
    
    console.log('\n' + '='.repeat(60));
    console.log('📋 测试总结:');
    console.log('API密钥状态:', isValid ? '✅ 有效' : '❌ 无效');
    
    if (!isValid) {
        console.log('\n💡 建议:');
        console.log('1. 检查API密钥是否正确');
        console.log('2. 确认API密钥是否已激活');
        console.log('3. 检查API密钥是否有足够的配额');
        console.log('4. 访问 https://graphhopper.com 检查账户状态');
    }
    
    console.log('\n✅ API密钥测试完成!');
}

// 运行测试
runApiKeyTest().catch(console.error);