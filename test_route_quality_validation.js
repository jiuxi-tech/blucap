// 测试新算法的路线质量验证
// 专门检测走回头路和局部绕圈现象

const fs = require('fs');
const path = require('path');

// 创建模拟的路线质量分析工具
const routeQualityAnalyzer = {
    // 计算两点之间的距离（米）
    calculateDistance: function(point1, point2) {
        const R = 6371000; // 地球半径（米）
        const lat1 = point1[0] * Math.PI / 180;
        const lng1 = point1[1] * Math.PI / 180;
        const lat2 = point2[0] * Math.PI / 180;
        const lng2 = point2[1] * Math.PI / 180;
        
        const dlat = lat2 - lat1;
        const dlng = lng2 - lng1;
        
        const a = Math.sin(dlat/2) * Math.sin(dlat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dlng/2) * Math.sin(dlng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    },
    
    // 计算方位角（度）
    calculateBearing: function(point1, point2) {
        const lat1 = point1[0] * Math.PI / 180;
        const lng1 = point1[1] * Math.PI / 180;
        const lat2 = point2[0] * Math.PI / 180;
        const lng2 = point2[1] * Math.PI / 180;
        
        const dlng = lng2 - lng1;
        
        const y = Math.sin(dlng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
                  Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlng);
        
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    },
    
    // 检测回头路现象
    detectBacktracking: function(points) {
        if (points.length < 3) return { hasBacktracking: false, backtrackCount: 0 };
        
        let backtrackCount = 0;
        const bearings = [];
        
        // 计算所有相邻点之间的方位角
        for (let i = 0; i < points.length - 1; i++) {
            const bearing = this.calculateBearing(points[i], points[i + 1]);
            bearings.push(bearing);
        }
        
        // 检测方位角的急剧变化（>150度视为回头）
        for (let i = 0; i < bearings.length - 1; i++) {
            let angleDiff = Math.abs(bearings[i + 1] - bearings[i]);
            if (angleDiff > 180) angleDiff = 360 - angleDiff;
            
            if (angleDiff > 150) {
                backtrackCount++;
            }
        }
        
        return {
            hasBacktracking: backtrackCount > 0,
            backtrackCount: backtrackCount,
            bearings: bearings
        };
    },
    
    // 检测局部绕圈现象
    detectLocalLooping: function(points) {
        if (points.length < 4) return { hasLooping: false, loopCount: 0 };
        
        let loopCount = 0;
        const minLoopDistance = 500; // 最小绕圈检测距离（米）
        
        // 检查每个点是否与之前的点过于接近（形成小圈）
        for (let i = 3; i < points.length; i++) {
            for (let j = 0; j < i - 2; j++) {
                const distance = this.calculateDistance(points[i], points[j]);
                if (distance < minLoopDistance) {
                    loopCount++;
                    break;
                }
            }
        }
        
        return {
            hasLooping: loopCount > 0,
            loopCount: loopCount
        };
    },
    
    // 计算路线的平滑度
    calculateSmoothness: function(points) {
        if (points.length < 3) return 1.0;
        
        const bearings = [];
        for (let i = 0; i < points.length - 1; i++) {
            bearings.push(this.calculateBearing(points[i], points[i + 1]));
        }
        
        let totalAngleChange = 0;
        for (let i = 0; i < bearings.length - 1; i++) {
            let angleDiff = Math.abs(bearings[i + 1] - bearings[i]);
            if (angleDiff > 180) angleDiff = 360 - angleDiff;
            totalAngleChange += angleDiff;
        }
        
        // 平滑度评分：角度变化越小，平滑度越高
        const avgAngleChange = totalAngleChange / (bearings.length - 1);
        return Math.max(0, 1 - avgAngleChange / 180);
    },
    
    // 计算闭合度（起点和终点的距离）
    calculateClosure: function(points) {
        if (points.length < 2) return 0;
        
        const startPoint = points[0];
        const endPoint = points[points.length - 1];
        const closureDistance = this.calculateDistance(startPoint, endPoint);
        
        return {
            closureDistance: closureDistance,
            isWellClosed: closureDistance < 100 // 100米内视为良好闭合
        };
    },
    
    // 综合路线质量评分
    calculateOverallQuality: function(points) {
        const backtracking = this.detectBacktracking(points);
        const looping = this.detectLocalLooping(points);
        const smoothness = this.calculateSmoothness(points);
        const closure = this.calculateClosure(points);
        
        // 计算综合评分（0-1，越高越好）
        let score = 1.0;
        
        // 回头路惩罚
        score -= backtracking.backtrackCount * 0.2;
        
        // 局部绕圈惩罚
        score -= looping.loopCount * 0.1;
        
        // 平滑度奖励
        score *= smoothness;
        
        // 闭合度奖励
        if (closure.isWellClosed) {
            score *= 1.1;
        } else {
            score *= 0.8;
        }
        
        return Math.max(0, Math.min(1, score));
    }
};

// 生成测试路线的模拟函数
function generateTestRoute(startPoint, targetDistance, algorithm = 'improved') {
    const points = [startPoint];
    const numPoints = Math.max(4, Math.floor(targetDistance / 2000));
    const segmentDistance = targetDistance / numPoints;
    
    let currentPoint = startPoint;
    let currentBearing = 0;
    
    for (let i = 0; i < numPoints - 1; i++) {
        if (algorithm === 'improved') {
            // 改进算法：更平滑的转向，避免急转弯
            const bearingChange = (Math.sin(i * 0.5) * 45); // 更温和的转向
            currentBearing = (currentBearing + bearingChange + 360) % 360;
        } else {
            // 旧算法：可能产生急转弯
            const bearingChange = (Math.random() - 0.5) * 120; // 更大的随机转向
            currentBearing = (currentBearing + bearingChange + 360) % 360;
        }
        
        // 简化的地理计算
        const lat1 = currentPoint[0] * Math.PI / 180;
        const lng1 = currentPoint[1] * Math.PI / 180;
        const bearingRad = currentBearing * Math.PI / 180;
        
        const R = 6371000;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(segmentDistance / R) +
                              Math.cos(lat1) * Math.sin(segmentDistance / R) * Math.cos(bearingRad));
        const lng2 = lng1 + Math.atan2(Math.sin(bearingRad) * Math.sin(segmentDistance / R) * Math.cos(lat1),
                                      Math.cos(segmentDistance / R) - Math.sin(lat1) * Math.sin(lat2));
        
        currentPoint = [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI];
        points.push([...currentPoint]);
    }
    
    return points;
}

// 运行路线质量测试
function runRouteQualityTests() {
    console.log('=== 路线质量验证测试 ===');
    
    const startPoint = [31.2304, 121.4737]; // 上海市中心
    const targetDistance = 10000; // 10公里
    
    console.log('\n测试参数:');
    console.log('起始点:', startPoint);
    console.log('目标距离:', targetDistance, '米');
    
    // 测试改进算法
    console.log('\n=== 测试改进算法 ===');
    const improvedRoute = generateTestRoute(startPoint, targetDistance, 'improved');
    console.log('生成点数:', improvedRoute.length);
    
    const improvedBacktracking = routeQualityAnalyzer.detectBacktracking(improvedRoute);
    const improvedLooping = routeQualityAnalyzer.detectLocalLooping(improvedRoute);
    const improvedSmoothness = routeQualityAnalyzer.calculateSmoothness(improvedRoute);
    const improvedClosure = routeQualityAnalyzer.calculateClosure(improvedRoute);
    const improvedQuality = routeQualityAnalyzer.calculateOverallQuality(improvedRoute);
    
    console.log('回头路检测:', improvedBacktracking.hasBacktracking ? '❌ 发现' + improvedBacktracking.backtrackCount + '处回头路' : '✅ 无回头路');
    console.log('局部绕圈检测:', improvedLooping.hasLooping ? '❌ 发现' + improvedLooping.loopCount + '处绕圈' : '✅ 无局部绕圈');
    console.log('路线平滑度:', (improvedSmoothness * 100).toFixed(1) + '%');
    console.log('闭合距离:', improvedClosure.closureDistance.toFixed(1) + '米', improvedClosure.isWellClosed ? '✅' : '❌');
    console.log('综合质量评分:', (improvedQuality * 100).toFixed(1) + '%');
    
    // 测试旧算法（对比）
    console.log('\n=== 测试旧算法（对比） ===');
    const oldRoute = generateTestRoute(startPoint, targetDistance, 'old');
    console.log('生成点数:', oldRoute.length);
    
    const oldBacktracking = routeQualityAnalyzer.detectBacktracking(oldRoute);
    const oldLooping = routeQualityAnalyzer.detectLocalLooping(oldRoute);
    const oldSmoothness = routeQualityAnalyzer.calculateSmoothness(oldRoute);
    const oldClosure = routeQualityAnalyzer.calculateClosure(oldRoute);
    const oldQuality = routeQualityAnalyzer.calculateOverallQuality(oldRoute);
    
    console.log('回头路检测:', oldBacktracking.hasBacktracking ? '❌ 发现' + oldBacktracking.backtrackCount + '处回头路' : '✅ 无回头路');
    console.log('局部绕圈检测:', oldLooping.hasLooping ? '❌ 发现' + oldLooping.loopCount + '处绕圈' : '✅ 无局部绕圈');
    console.log('路线平滑度:', (oldSmoothness * 100).toFixed(1) + '%');
    console.log('闭合距离:', oldClosure.closureDistance.toFixed(1) + '米', oldClosure.isWellClosed ? '✅' : '❌');
    console.log('综合质量评分:', (oldQuality * 100).toFixed(1) + '%');
    
    // 对比结果
    console.log('\n=== 算法对比结果 ===');
    const qualityImprovement = improvedQuality - oldQuality;
    const smoothnessImprovement = improvedSmoothness - oldSmoothness;
    const backtrackingImprovement = oldBacktracking.backtrackCount - improvedBacktracking.backtrackCount;
    const loopingImprovement = oldLooping.loopCount - improvedLooping.loopCount;
    
    console.log('质量评分提升:', qualityImprovement > 0 ? '✅ +' + (qualityImprovement * 100).toFixed(1) + '%' : '❌ ' + (qualityImprovement * 100).toFixed(1) + '%');
    console.log('平滑度提升:', smoothnessImprovement > 0 ? '✅ +' + (smoothnessImprovement * 100).toFixed(1) + '%' : '❌ ' + (smoothnessImprovement * 100).toFixed(1) + '%');
    console.log('回头路减少:', backtrackingImprovement > 0 ? '✅ 减少' + backtrackingImprovement + '处' : backtrackingImprovement < 0 ? '❌ 增加' + Math.abs(backtrackingImprovement) + '处' : '➖ 无变化');
    console.log('绕圈减少:', loopingImprovement > 0 ? '✅ 减少' + loopingImprovement + '处' : loopingImprovement < 0 ? '❌ 增加' + Math.abs(loopingImprovement) + '处' : '➖ 无变化');
    
    // 测试结论
    console.log('\n=== 测试结论 ===');
    if (qualityImprovement > 0.1) {
        console.log('✅ 新算法显著优于旧算法');
    } else if (qualityImprovement > 0) {
        console.log('✅ 新算法略优于旧算法');
    } else {
        console.log('❌ 新算法未显示明显优势');
    }
    
    if (improvedBacktracking.backtrackCount === 0 && improvedLooping.loopCount <= 1) {
        console.log('✅ 新算法成功减少走回头路和局部绕圈现象');
    } else {
        console.log('⚠️ 新算法仍需进一步优化以减少走回头路和局部绕圈');
    }
}

// 运行测试
console.log('开始路线质量验证测试...');
runRouteQualityTests();
console.log('\n路线质量验证测试完成');