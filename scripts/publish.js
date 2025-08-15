#!/usr/bin/env node

/**
 * Fun Route Generator 发布脚本
 * 自动化 NPM 发布流程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

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
function runCommand(command, description, options = {}) {
    try {
        log(`执行: ${command}`, 'blue');
        const output = execSync(command, { 
            encoding: 'utf8', 
            stdio: options.silent ? 'pipe' : 'inherit',
            cwd: path.resolve(__dirname, '..'),
            ...options
        });
        if (options.silent && output.trim()) {
            return output.trim();
        }
        logSuccess(description);
        return true;
    } catch (error) {
        logError(`${description} 失败`);
        if (options.silent) {
            console.error(error.message);
        }
        return false;
    }
}

// 询问用户确认
function askConfirmation(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        rl.question(`${colors.yellow}${question} (y/N): ${colors.reset}`, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

// 检查 NPM 登录状态
function checkNpmLogin() {
    logStep('1', '检查 NPM 登录状态');
    
    const whoami = runCommand('npm whoami', 'NPM 用户检查', { silent: true });
    if (whoami && typeof whoami === 'string') {
        logSuccess(`已登录 NPM，用户: ${whoami}`);
        return whoami;
    } else {
        logError('未登录 NPM，请先运行 npm login');
        process.exit(1);
    }
}

// 检查包是否已存在
function checkPackageExists(packageName, version) {
    logStep('2', '检查包版本');
    
    try {
        const info = runCommand(`npm view ${packageName}@${version} version`, '包版本检查', { silent: true });
        if (info && info.trim() === version) {
            logError(`版本 ${version} 已存在于 NPM`);
            return true;
        }
    } catch (error) {
        // 包不存在或版本不存在，这是正常的
    }
    
    logSuccess(`版本 ${version} 可以发布`);
    return false;
}

// 验证构建文件
function validateBuild() {
    logStep('3', '验证构建文件');
    
    const requiredFiles = [
        'dist/fun-route-generator.min.js',
        'fun-route-generator.js',
        'fun-route-generator.d.ts',
        'package.json',
        'README.md'
    ];
    
    let allValid = true;
    for (const file of requiredFiles) {
        const filePath = path.resolve(__dirname, '..', file);
        if (!fs.existsSync(filePath)) {
            logError(`缺少必要文件: ${file}`);
            allValid = false;
        } else {
            logSuccess(`文件存在: ${file}`);
        }
    }
    
    if (!allValid) {
        logError('构建文件验证失败，请先运行构建');
        process.exit(1);
    }
}

// 运行发布前检查
function runPrePublishChecks() {
    logStep('4', '运行发布前检查');
    
    // 检查 package.json
    const packagePath = path.resolve(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // 验证必要字段
    const requiredFields = {
        name: '包名',
        version: '版本号',
        description: '描述',
        main: '主入口文件',
        types: '类型定义文件',
        author: '作者',
        license: '许可证',
        keywords: '关键词',
        repository: '仓库地址'
    };
    
    let allValid = true;
    for (const [field, desc] of Object.entries(requiredFields)) {
        if (!packageJson[field]) {
            logError(`package.json 缺少 ${desc} (${field})`);
            allValid = false;
        }
    }
    
    if (!allValid) {
        logError('package.json 验证失败');
        process.exit(1);
    }
    
    // 检查版本格式
    const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
    if (!versionRegex.test(packageJson.version)) {
        logError(`版本号格式不正确: ${packageJson.version}`);
        process.exit(1);
    }
    
    logSuccess('发布前检查通过');
    return packageJson;
}

// 显示发布信息
function showPublishInfo(packageJson) {
    log('\n📦 发布信息:', 'bright');
    log('='.repeat(40), 'bright');
    log(`包名: ${packageJson.name}`, 'cyan');
    log(`版本: ${packageJson.version}`, 'cyan');
    log(`描述: ${packageJson.description}`, 'cyan');
    log(`作者: ${packageJson.author}`, 'cyan');
    log(`许可证: ${packageJson.license}`, 'cyan');
    
    if (packageJson.keywords && packageJson.keywords.length > 0) {
        log(`关键词: ${packageJson.keywords.join(', ')}`, 'cyan');
    }
    
    // 显示文件大小
    const distPath = path.resolve(__dirname, '..', 'dist', 'fun-route-generator.min.js');
    if (fs.existsSync(distPath)) {
        const stats = fs.statSync(distPath);
        const sizeKB = Math.round(stats.size / 1024 * 100) / 100;
        log(`构建文件大小: ${sizeKB} KB`, 'cyan');
    }
    
    log('='.repeat(40), 'bright');
}

// 执行干运行
async function dryRun(packageJson) {
    logStep('5', '执行发布预检 (dry run)');
    
    if (!runCommand('npm publish --dry-run', '发布预检')) {
        logError('发布预检失败');
        process.exit(1);
    }
    
    logSuccess('发布预检通过');
}

// 执行实际发布
async function publishPackage(packageJson, options = {}) {
    logStep('6', '发布到 NPM');
    
    let publishCommand = 'npm publish';
    
    // 添加发布选项
    if (options.tag && options.tag !== 'latest') {
        publishCommand += ` --tag ${options.tag}`;
    }
    
    if (options.access) {
        publishCommand += ` --access ${options.access}`;
    }
    
    if (!runCommand(publishCommand, 'NPM 发布')) {
        logError('NPM 发布失败');
        process.exit(1);
    }
    
    logSuccess(`成功发布 ${packageJson.name}@${packageJson.version}`);
}

// 发布后操作
function postPublish(packageJson) {
    logStep('7', '发布后操作');
    
    // 显示安装命令
    log('\n🎉 发布成功!', 'green');
    log('='.repeat(50), 'bright');
    
    log('\n📝 用户可以通过以下方式安装:', 'bright');
    log(`   npm install ${packageJson.name}`, 'yellow');
    log(`   yarn add ${packageJson.name}`, 'yellow');
    
    log('\n🔗 有用的链接:', 'bright');
    log(`   NPM 页面: https://www.npmjs.com/package/${packageJson.name}`, 'blue');
    
    if (packageJson.repository && packageJson.repository.url) {
        const repoUrl = packageJson.repository.url.replace('git+', '').replace('.git', '');
        log(`   GitHub 仓库: ${repoUrl}`, 'blue');
    }
    
    log('\n📊 下一步建议:', 'bright');
    log('   1. 更新项目文档', 'cyan');
    log('   2. 创建 GitHub Release', 'cyan');
    log('   3. 通知用户新版本发布', 'cyan');
    log('   4. 监控下载量和反馈', 'cyan');
}

// 主发布流程
async function main() {
    const args = process.argv.slice(2);
    const isDryRun = args.includes('--dry-run') || args.includes('--dry');
    const tag = args.find(arg => arg.startsWith('--tag='))?.split('=')[1] || 'latest';
    const access = args.find(arg => arg.startsWith('--access='))?.split('=')[1];
    
    log('🚀 Fun Route Generator 发布流程', 'bright');
    log('='.repeat(50), 'bright');
    
    if (isDryRun) {
        log('🔍 运行模式: 预检 (Dry Run)', 'yellow');
    } else {
        log('📦 运行模式: 实际发布', 'green');
    }
    
    try {
        // 执行发布流程
        const npmUser = checkNpmLogin();
        const packageJson = runPrePublishChecks();
        
        // 检查包是否已存在
        if (checkPackageExists(packageJson.name, packageJson.version)) {
            const shouldContinue = await askConfirmation('版本已存在，是否继续？');
            if (!shouldContinue) {
                log('发布已取消', 'yellow');
                process.exit(0);
            }
        }
        
        validateBuild();
        showPublishInfo(packageJson);
        
        if (isDryRun) {
            await dryRun(packageJson);
            log('\n✅ 预检完成，可以进行实际发布', 'green');
            log('运行 npm run publish 进行实际发布', 'yellow');
        } else {
            // 最终确认
            const shouldPublish = await askConfirmation('确认发布到 NPM？');
            if (!shouldPublish) {
                log('发布已取消', 'yellow');
                process.exit(0);
            }
            
            await publishPackage(packageJson, { tag, access });
            postPublish(packageJson);
        }
        
    } catch (error) {
        logError(`发布过程中发生错误: ${error.message}`);
        process.exit(1);
    }
}

// 显示帮助信息
function showHelp() {
    log('Fun Route Generator 发布脚本', 'bright');
    log('\n用法:', 'bright');
    log('  node scripts/publish.js [选项]', 'cyan');
    log('\n选项:', 'bright');
    log('  --dry-run, --dry    执行发布预检，不实际发布', 'yellow');
    log('  --tag=<tag>         指定发布标签 (默认: latest)', 'yellow');
    log('  --access=<access>   指定访问级别 (public/restricted)', 'yellow');
    log('  --help, -h          显示帮助信息', 'yellow');
    log('\n示例:', 'bright');
    log('  node scripts/publish.js --dry-run', 'cyan');
    log('  node scripts/publish.js --tag=beta', 'cyan');
    log('  node scripts/publish.js --access=public', 'cyan');
}

// 如果直接运行此脚本
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    
    main();
}

module.exports = {
    main,
    checkNpmLogin,
    checkPackageExists,
    validateBuild,
    runPrePublishChecks,
    dryRun,
    publishPackage,
    postPublish
};