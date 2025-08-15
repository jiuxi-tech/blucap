#!/usr/bin/env node

/**
 * Blucap 构建脚本
 * 自动化构建、测试和打包流程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
    log(`\n[${step}] ${message}`, 'cyan');
}

function logSuccess(message) {
    log(`✅ ${message}`, 'green');
}

function logError(message) {
    log(`❌ ${message}`, 'red');
}

function logWarning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

// 执行命令
function runCommand(command, description) {
    try {
        log(`执行: ${command}`, 'blue');
        const output = execSync(command, { 
            encoding: 'utf8', 
            stdio: 'pipe',
            cwd: path.resolve(__dirname, '..')
        });
        if (output.trim()) {
            console.log(output);
        }
        logSuccess(description);
        return true;
    } catch (error) {
        logError(`${description} 失败`);
        console.error(error.message);
        return false;
    }
}

// 检查文件是否存在
function checkFile(filePath, description) {
    const fullPath = path.resolve(__dirname, '..', filePath);
    if (fs.existsSync(fullPath)) {
        logSuccess(`${description} 存在: ${filePath}`);
        return true;
    } else {
        logError(`${description} 不存在: ${filePath}`);
        return false;
    }
}

// 清理构建目录
function cleanBuild() {
    logStep('1', '清理构建目录');
    
    const distPath = path.resolve(__dirname, '..', 'dist');
    if (fs.existsSync(distPath)) {
        fs.rmSync(distPath, { recursive: true, force: true });
        logSuccess('已清理 dist 目录');
    }
    
    // 创建 dist 目录
    fs.mkdirSync(distPath, { recursive: true });
    logSuccess('已创建 dist 目录');
}

// 验证源文件
function validateSources() {
    logStep('2', '验证源文件');
    
    const requiredFiles = [
        { path: 'fun-route-generator.js', desc: '主库文件' },
        { path: 'fun-route-generator.d.ts', desc: 'TypeScript 类型定义' },
        { path: 'package.json', desc: '包配置文件' },
        { path: 'webpack.config.js', desc: 'Webpack 配置' },
        { path: 'README.md', desc: '文档文件' }
    ];
    
    let allValid = true;
    for (const file of requiredFiles) {
        if (!checkFile(file.path, file.desc)) {
            allValid = false;
        }
    }
    
    if (!allValid) {
        logError('源文件验证失败，请检查缺失的文件');
        process.exit(1);
    }
    
    logSuccess('所有源文件验证通过');
}

// 安装依赖
function installDependencies() {
    logStep('3', '安装依赖');
    
    if (!runCommand('npm install', '依赖安装')) {
        logError('依赖安装失败');
        process.exit(1);
    }
}

// 构建生产版本
function buildProduction() {
    logStep('4', '构建生产版本');
    
    if (!runCommand('npm run build', '生产版本构建')) {
        logError('生产版本构建失败');
        process.exit(1);
    }
    
    // 验证构建输出
    const outputFiles = [
        'dist/fun-route-generator.min.js',
        'dist/fun-route-generator.min.js.map'
    ];
    
    for (const file of outputFiles) {
        if (!checkFile(file, '构建输出文件')) {
            logError('构建输出验证失败');
            process.exit(1);
        }
    }
}

// 构建开发版本
function buildDevelopment() {
    logStep('5', '构建开发版本');
    
    if (!runCommand('npm run build:dev', '开发版本构建')) {
        logWarning('开发版本构建失败，但不影响发布');
    }
}

// 运行测试
function runTests() {
    logStep('6', '运行测试');
    
    // 检查是否有测试文件
    const testFiles = ['test', 'tests', '__tests__'];
    let hasTests = false;
    
    for (const testDir of testFiles) {
        if (fs.existsSync(path.resolve(__dirname, '..', testDir))) {
            hasTests = true;
            break;
        }
    }
    
    if (hasTests) {
        if (!runCommand('npm test', '测试执行')) {
            logError('测试失败');
            process.exit(1);
        }
    } else {
        logWarning('未找到测试文件，跳过测试');
    }
}

// 验证包信息
function validatePackage() {
    logStep('7', '验证包信息');
    
    const packagePath = path.resolve(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // 检查必要字段
    const requiredFields = ['name', 'version', 'description', 'main', 'types', 'author', 'license'];
    let allValid = true;
    
    for (const field of requiredFields) {
        if (!packageJson[field]) {
            logError(`package.json 缺少必要字段: ${field}`);
            allValid = false;
        }
    }
    
    if (!allValid) {
        logError('package.json 验证失败');
        process.exit(1);
    }
    
    logSuccess(`包信息验证通过: ${packageJson.name}@${packageJson.version}`);
}

// 生成构建报告
function generateReport() {
    logStep('8', '生成构建报告');
    
    const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
    const distPath = path.resolve(__dirname, '..', 'dist');
    
    const report = {
        name: packageJson.name,
        version: packageJson.version,
        buildTime: new Date().toISOString(),
        files: []
    };
    
    // 收集构建文件信息
    if (fs.existsSync(distPath)) {
        const files = fs.readdirSync(distPath);
        for (const file of files) {
            const filePath = path.join(distPath, file);
            const stats = fs.statSync(filePath);
            report.files.push({
                name: file,
                size: stats.size,
                sizeKB: Math.round(stats.size / 1024 * 100) / 100
            });
        }
    }
    
    // 写入报告文件
    const reportPath = path.resolve(__dirname, '..', 'dist', 'build-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    logSuccess('构建报告已生成');
    
    // 显示构建摘要
    log('\n📊 构建摘要:', 'bright');
    log(`   包名: ${report.name}`, 'cyan');
    log(`   版本: ${report.version}`, 'cyan');
    log(`   构建时间: ${report.buildTime}`, 'cyan');
    log(`   输出文件:`, 'cyan');
    
    for (const file of report.files) {
        log(`     - ${file.name} (${file.sizeKB} KB)`, 'blue');
    }
}

// 主构建流程
function main() {
    log('🚀 Blucap 构建开始', 'bright');
    log('='.repeat(50), 'bright');
    
    try {
        cleanBuild();
        validateSources();
        installDependencies();
        buildProduction();
        buildDevelopment();
        runTests();
        validatePackage();
        generateReport();
        
        log('\n🎉 构建完成!', 'green');
        log('='.repeat(50), 'bright');
        
        // 显示下一步操作提示
        log('\n📝 下一步操作:', 'bright');
        log('   1. 检查 dist/ 目录中的构建文件', 'yellow');
        log('   2. 运行 npm run publish:dry 进行发布预检', 'yellow');
        log('   3. 运行 npm publish 发布到 NPM', 'yellow');
        
    } catch (error) {
        logError(`构建过程中发生错误: ${error.message}`);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = {
    main,
    cleanBuild,
    validateSources,
    installDependencies,
    buildProduction,
    buildDevelopment,
    runTests,
    validatePackage,
    generateReport
};