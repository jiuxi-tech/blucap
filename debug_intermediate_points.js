const Blucap = require('./blucap.js');

// 创建Blucap实例
const blucap = new Blucap({
    apiKey: 'test-api-key-for-debugging'
});

function debugIntermediatePointGeneration() {
    console.log('调试中间点生成过程...');
    
    const startPoint = [31.2304, 121.4737]; // 上海
    const targetDistance = 50000; // 50km
    const curveLevel = 'medium';
    const startBearing = 45; // 假设起始方位角
    
    console.log('参数:');
    console.log('- 起点:', startPoint);
    console.log('- 目标距离:', targetDistance, '米');
    console.log('- 弯道等级:', curveLevel);
    console.log('- 起始方位角:', startBearing);
    
    // 计算最优点数
    const optimalCount = blucap._calculateOptimalPointCount(targetDistance, curveLevel);
    console.log('\n最优点数:', optimalCount);
    
    // 计算基础半径
    const baseRadius = blucap._calculateBaseRadius(targetDistance, curveLevel);
    console.log('基础半径:', baseRadius, '米');
    
    // 计算最小距离阈值
    const minDistance = targetDistance * 0.05;
    console.log('最小距离阈值:', minDistance, '米');
    
    // 生成角度分布
    const angles = blucap._calculateNaturalAngleDistribution(optimalCount, curveLevel);
    console.log('\n生成的角度分布:', angles.slice(0, 5), '...(共', angles.length, '个)');
    
    // 尝试生成中间点
    console.log('\n开始生成中间点...');
    const validPoints = [];
    const rejectedPoints = [];
    
    for (let i = 0; i < angles.length; i++) {
        const angle = angles[i];
        const radius = blucap._calculateCircularRadius(baseRadius, i, angles.length, curveLevel);
        
        // 生成候选点
        const candidatePoint = blucap._calculatePointAtDistance(startPoint, radius, angle);
        
        // 验证点的有效性
        const isValid = blucap._isValidIntermediatePoint(candidatePoint, startPoint, validPoints, targetDistance);
        
        if (isValid) {
            validPoints.push(candidatePoint);
            console.log(`✅ 点${i+1}: [${candidatePoint[0].toFixed(6)}, ${candidatePoint[1].toFixed(6)}] - 角度: ${angle.toFixed(1)}°, 半径: ${radius.toFixed(0)}m`);
        } else {
            // 计算被拒绝的原因
            const distanceToStart = blucap._calculateDistance(candidatePoint, startPoint);
            let rejectionReason = '';
            
            if (distanceToStart < minDistance) {
                rejectionReason = `距离起点太近 (${distanceToStart.toFixed(0)}m < ${minDistance.toFixed(0)}m)`;
            } else {
                // 检查与已有点的距离
                for (const existingPoint of validPoints) {
                    const distanceToExisting = blucap._calculateDistance(candidatePoint, existingPoint);
                    if (distanceToExisting < minDistance) {
                        rejectionReason = `距离已有点太近 (${distanceToExisting.toFixed(0)}m < ${minDistance.toFixed(0)}m)`;
                        break;
                    }
                }
            }
            
            rejectedPoints.push({ point: candidatePoint, reason: rejectionReason });
            console.log(`❌ 点${i+1}: [${candidatePoint[0].toFixed(6)}, ${candidatePoint[1].toFixed(6)}] - ${rejectionReason}`);
        }
    }
    
    console.log('\n生成结果:');
    console.log('- 有效中间点数量:', validPoints.length);
    console.log('- 被拒绝点数量:', rejectedPoints.length);
    
    if (validPoints.length === 0) {
        console.log('\n❌ 没有生成任何有效的中间点！');
        console.log('\n可能的解决方案:');
        console.log('1. 降低最小距离阈值 (当前为目标距离的5%)');
        console.log('2. 增加基础半径');
        console.log('3. 调整角度分布算法');
        
        // 尝试降低阈值
        console.log('\n尝试降低最小距离阈值到2%...');
        const reducedMinDistance = targetDistance * 0.02;
        const validPointsReduced = [];
        
        for (let i = 0; i < Math.min(angles.length, 5); i++) {
            const angle = angles[i];
            const radius = blucap._calculateCircularRadius(baseRadius, i, angles.length, curveLevel);
            const candidatePoint = blucap._calculatePointAtDistance(startPoint, radius, angle);
            
            // 使用降低的阈值验证
            const distanceToStart = blucap._calculateDistance(candidatePoint, startPoint);
            let isValidReduced = distanceToStart >= reducedMinDistance;
            
            if (isValidReduced) {
                for (const existingPoint of validPointsReduced) {
                    const distanceToExisting = blucap._calculateDistance(candidatePoint, existingPoint);
                    if (distanceToExisting < reducedMinDistance) {
                        isValidReduced = false;
                        break;
                    }
                }
            }
            
            if (isValidReduced) {
                validPointsReduced.push(candidatePoint);
                console.log(`✅ 降低阈值后点${i+1}: [${candidatePoint[0].toFixed(6)}, ${candidatePoint[1].toFixed(6)}]`);
            }
        }
        
        console.log('降低阈值后有效点数量:', validPointsReduced.length);
    }
}

// 运行调试
debugIntermediatePointGeneration();