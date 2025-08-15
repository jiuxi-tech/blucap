/**
 * Blucap - Node.js 示例
 * 演示如何在 Node.js 环境中使用路线生成器
 */

const Blucap = require('../blucap');

// 配置 API 密钥 (请替换为你的实际密钥)
const API_KEY = 'your-graphhopper-api-key';

// 创建路线生成器实例
const generator = new Blucap({
  apiKey: API_KEY,
  profile: 'car',
  locale: 'zh'
});

/**
 * 示例 1: 生成环形路线
 */
async function example1_RoundTrip() {
  console.log('\n=== 示例 1: 环形路线 ===');
  
  try {
    const route = await generator.generateRoundTrip({
      startPoint: [39.9042, 116.4074], // 北京天安门
      distance: 120, // 120km
      curveLevel: 'medium',
      startBearing: 90 // 向东出发
    });
    
    console.log('✅ 环形路线生成成功!');
    console.log(`📏 总距离: ${(route.paths[0].distance / 1000).toFixed(1)} km`);
    console.log(`⏱️ 预计时间: ${(route.paths[0].time / 60000).toFixed(0)} 分钟`);
    console.log(`🗺️ 路径点数量: ${route.paths[0].instructions.length}`);
    
  } catch (error) {
    console.error('❌ 环形路线生成失败:', error.message);
  }
}

/**
 * 示例 2: 生成点对点路线
 */
async function example2_PointToPoint() {
  console.log('\n=== 示例 2: 点对点路线 ===');
  
  try {
    const route = await generator.generatePointToPoint({
      startPoint: [31.2304, 121.4737], // 上海
      endPoint: [30.2741, 120.1551],   // 杭州
      curveLevel: 'low' // 最快路线
    });
    
    console.log('✅ 点对点路线生成成功!');
    console.log(`📏 总距离: ${(route.paths[0].distance / 1000).toFixed(1)} km`);
    console.log(`⏱️ 预计时间: ${(route.paths[0].time / 60000).toFixed(0)} 分钟`);
    
  } catch (error) {
    console.error('❌ 点对点路线生成失败:', error.message);
  }
}

/**
 * 示例 3: 生成带绕行的风景路线
 */
async function example3_ScenicRoute() {
  console.log('\n=== 示例 3: 风景绕行路线 ===');
  
  try {
    const route = await generator.generatePointToPoint({
      startPoint: [22.3193, 114.1694], // 香港
      endPoint: [22.1987, 113.5439],   // 澳门
      curveLevel: 'high', // 高弯道等级
      targetDistance: 200 // 200km 绕行
    });
    
    console.log('✅ 风景绕行路线生成成功!');
    console.log(`📏 总距离: ${(route.paths[0].distance / 1000).toFixed(1)} km`);
    console.log(`⏱️ 预计时间: ${(route.paths[0].time / 60000).toFixed(0)} 分钟`);
    console.log(`🌄 弯道等级: 高 (风景优美)`);
    
  } catch (error) {
    console.error('❌ 风景路线生成失败:', error.message);
  }
}

/**
 * 示例 4: 批量生成不同难度的路线
 */
async function example4_BatchGeneration() {
  console.log('\n=== 示例 4: 批量生成不同难度路线 ===');
  
  const startPoint = [25.0330, 121.5654]; // 台北
  const curveLevels = ['low', 'medium', 'high'];
  
  for (const level of curveLevels) {
    try {
      const route = await generator.generateRoundTrip({
        startPoint,
        distance: 80,
        curveLevel: level
      });
      
      console.log(`\n🛣️ ${level.toUpperCase()} 难度路线:`);
      console.log(`   📏 距离: ${(route.paths[0].distance / 1000).toFixed(1)} km`);
      console.log(`   ⏱️ 时间: ${(route.paths[0].time / 60000).toFixed(0)} 分钟`);
      
    } catch (error) {
      console.error(`❌ ${level} 难度路线生成失败:`, error.message);
    }
    
    // 避免 API 限制，添加延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * 示例 5: 错误处理演示
 */
async function example5_ErrorHandling() {
  console.log('\n=== 示例 5: 错误处理演示 ===');
  
  // 测试无效参数
  try {
    await generator.generateRoundTrip({
      startPoint: [0, 0], // 无效位置
      distance: 1000 // 超出范围
    });
  } catch (error) {
    console.log('✅ 成功捕获参数错误:', error.message);
  }
  
  // 测试无效 API 密钥
  try {
    const invalidGenerator = new FunRouteGenerator({
      apiKey: 'invalid-key'
    });
    
    await invalidGenerator.generateRoundTrip({
      startPoint: [39.9042, 116.4074],
      distance: 100
    });
  } catch (error) {
    console.log('✅ 成功捕获 API 错误:', error.message);
  }
}

/**
 * 主函数 - 运行所有示例
 */
async function main() {
  console.log('🚗 Blucap - Node.js 示例');
  console.log('=====================================');
  
  if (API_KEY === 'your-graphhopper-api-key') {
    console.log('⚠️ 请先设置有效的 GraphHopper API 密钥!');
    console.log('   在文件顶部修改 API_KEY 变量');
    return;
  }
  
  // 运行所有示例
  await example1_RoundTrip();
  await example2_PointToPoint();
  await example3_ScenicRoute();
  await example4_BatchGeneration();
  await example5_ErrorHandling();
  
  console.log('\n🎉 所有示例运行完成!');
}

// 运行示例
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  example1_RoundTrip,
  example2_PointToPoint,
  example3_ScenicRoute,
  example4_BatchGeneration,
  example5_ErrorHandling
};