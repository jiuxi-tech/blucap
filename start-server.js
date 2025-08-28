const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// MIME类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css', 
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let filePath = req.url;
  
  // 根路径重定向到interactive-test.html
  if (filePath === '/') {
    filePath = '/examples/interactive-test.html';
  }
  
  // 构建完整文件路径
  const fullPath = path.join(__dirname, filePath);
  
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} -> ${fullPath}`);
  
  // 读取文件
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      console.log(`❌ 文件未找到: ${fullPath}`);
      res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
      res.end(`404 - 文件未找到: ${req.url}`);
      return;
    }
    
    // 获取文件扩展名并设置MIME类型
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = mimeTypes[ext] || 'text/plain';
    
    // 设置响应头
    res.writeHead(200, {
      'Content-Type': contentType + '; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    
    res.end(data);
    console.log(`✅ 成功返回: ${req.url}`);
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log('');
  console.log('==========================================');
  console.log('🚀 Blucap 交互式测试服务已启动！');
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log('📋 默认页面: examples/interactive-test.html');
  console.log('🎯 功能: GraphHopper路线生成测试工具');
  console.log('==========================================');
  console.log('');
  console.log('💡 提示:');
  console.log('  - 在浏览器中访问 http://localhost:3000');
  console.log('  - 需要配置GraphHopper API Key才能正常使用');
  console.log('  - 按 Ctrl+C 停止服务器');
  console.log('');
});

// 错误处理
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用，请先关闭占用该端口的程序`);
  } else {
    console.error('❌ 服务器错误:', err.message);
  }
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n');
  console.log('🛑 正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭，再见！');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close();
});