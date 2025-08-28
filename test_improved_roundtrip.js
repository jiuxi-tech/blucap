/**
 * 测试改进后的环形路线生成算法
 * 验证多候选路线生成能有效减少走回头路和局部绕圈现象
 */

const Blucap = require('./blucap');

// 测试配置
const TEST_CONFIGS = [
    {
        name: '北京市中心 - 10公里环形路线',
        start_point: [39.9042, 116.4074], // 天安门
        target_distance: 10000, // 10公里 = 10000米
        curve_level: 'medium'
    },
    {
        name: '上海市中心 - 15公里环形路线',
        start_point: [31.2304, 121.4737], // 人民广场
        target_distance: 15000, // 15公里 = 15000米
        curve_level: 'high'
    },
    {
        name: '广州市中心 - 8公里环形路线',
        start_point: [23.1291, 113.2644], // 广州塔
        target_distance: 8000, // 8公里 = 8000米
        curve_level: 'low'
    }
];

/**
 * 分析路线质量
 * @param {Object} route - 路线结果
 * @param {Object} config - 测试配置
 * @returns {Object} 分析结果
 */
function analyzeRouteQuality(route, config) {
    if (!route || !route.coordinates) {
        return {
            valid: false,
            error: '路线生成失败'
        };
    }

    const coordinates = route.coordinates;
    const actualDistance = route.distance;
    const targetDistance = config.target_distance; // 已经是米为单位

    // 1. 距离偏差分析
    const distanceDeviation = Math.abs(actualDistance - targetDistance) / targetDistance;
    
    // 2. 闭合度分析
    const startPoint = coordinates[0];
    const endPoint = coordinates[coordinates.length - 1];
    // 创建临时blucap实例用于计算
    const tempBlucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
    const closureDistance = tempBlucap._calculateHighPrecisionDistance(startPoint, endPoint);
    
    // 3. 回头路检测
    const backtrackAnalysis = detectBacktracking(coordinates);
    
    // 4. 局部绕圈检测
    const localLoopAnalysis = detectLocalLoops(coordinates);
    
    // 5. 路径平滑度分析
    const smoothnessAnalysis = analyzeSmoothness(coordinates);
    
    return {
        valid: true,
        config_name: config.name,
        distance_analysis: {
            target_km: (config.target_distance / 1000).toFixed(1),
            actual_km: (actualDistance / 1000).toFixed(2),
            deviation_percent: (distanceDeviation * 100).toFixed(2)
        },
        closure_analysis: {
            closure_distance_m: closureDistance.toFixed(2),
            is_well_closed: closureDistance < 100
        },
        backtrack_analysis: backtrackAnalysis,
        local_loop_analysis: localLoopAnalysis,
        smoothness_analysis: smoothnessAnalysis,
        quality_metrics: route.quality_metrics || null,
        overall_quality: calculateOverallQuality({
            distanceDeviation,
            closureDistance,
            backtrackAnalysis,
            localLoopAnalysis,
            smoothnessAnalysis
        })
    };
}

/**
 * 检测回头路现象
 * @param {Array} coordinates - 路径坐标
 * @returns {Object} 回头路分析结果
 */
function detectBacktracking(coordinates) {
    let backtrackCount = 0;
    let maxBacktrackAngle = 0;
    const backtrackSegments = [];
    
    for (let i = 2; i < coordinates.length; i++) {
        const p1 = coordinates[i - 2];
        const p2 = coordinates[i - 1];
        const p3 = coordinates[i];
        
        // 计算方向变化角度
        const tempBlucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
        const bearing1 = tempBlucap._calculateBearing(p1, p2);
        const bearing2 = tempBlucap._calculateBearing(p2, p3);
        
        let angleDiff = Math.abs(bearing2 - bearing1);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        
        // 如果角度变化超过120度，认为是潜在的回头路
        if (angleDiff > 120) {
            backtrackCount++;
            maxBacktrackAngle = Math.max(maxBacktrackAngle, angleDiff);
            backtrackSegments.push({
                segment_index: i - 1,
                angle_change: angleDiff.toFixed(2),
                coordinates: [p1, p2, p3]
            });
        }
    }
    
    return {
        backtrack_count: backtrackCount,
        max_backtrack_angle: maxBacktrackAngle.toFixed(2),
        backtrack_ratio: (backtrackCount / (coordinates.length - 2)).toFixed(4),
        has_significant_backtrack: backtrackCount > 0 && maxBacktrackAngle > 150,
        backtrack_segments: backtrackSegments.slice(0, 5) // 只显示前5个
    };
}

/**
 * 检测局部绕圈现象
 * @param {Array} coordinates - 路径坐标
 * @returns {Object} 局部绕圈分析结果
 */
function detectLocalLoops(coordinates) {
    const loops = [];
    const visitedAreas = new Map();
    const gridSize = 0.001; // 约100米的网格
    
    for (let i = 0; i < coordinates.length; i++) {
        const coord = coordinates[i];
        const gridKey = `${Math.floor(coord[0] / gridSize)}_${Math.floor(coord[1] / gridSize)}`;
        
        if (visitedAreas.has(gridKey)) {
            const previousVisit = visitedAreas.get(gridKey);
            const segmentLength = i - previousVisit.index;
            
            // 如果在短距离内重复访问同一区域，认为是局部绕圈
            if (segmentLength < 20 && segmentLength > 3) {
                loops.push({
                    start_index: previousVisit.index,
                    end_index: i,
                    segment_length: segmentLength,
                    grid_key: gridKey,
                    coordinates: coordinates.slice(previousVisit.index, i + 1)
                });
            }
            
            visitedAreas.set(gridKey, { index: i, coord });
        } else {
            visitedAreas.set(gridKey, { index: i, coord });
        }
    }
    
    return {
        loop_count: loops.length,
        has_local_loops: loops.length > 0,
        loops: loops.slice(0, 3), // 只显示前3个
        loop_ratio: (loops.length / coordinates.length * 100).toFixed(2)
    };
}

/**
 * 分析路径平滑度
 * @param {Array} coordinates - 路径坐标
 * @returns {Object} 平滑度分析结果
 */
function analyzeSmoothness(coordinates) {
    if (coordinates.length < 3) {
        return { valid: false, reason: '坐标点太少' };
    }
    
    let totalAngleChange = 0;
    let sharpTurnCount = 0;
    const angleChanges = [];
    
    for (let i = 1; i < coordinates.length - 1; i++) {
        const p1 = coordinates[i - 1];
        const p2 = coordinates[i];
        const p3 = coordinates[i + 1];
        
        const tempBlucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
        const bearing1 = tempBlucap._calculateBearing(p1, p2);
        const bearing2 = tempBlucap._calculateBearing(p2, p3);
        
        let angleChange = Math.abs(bearing2 - bearing1);
        if (angleChange > 180) angleChange = 360 - angleChange;
        
        totalAngleChange += angleChange;
        angleChanges.push(angleChange);
        
        // 超过90度认为是急转弯
        if (angleChange > 90) {
            sharpTurnCount++;
        }
    }
    
    const avgAngleChange = totalAngleChange / angleChanges.length;
    const smoothnessScore = Math.max(0, 1 - avgAngleChange / 180);
    
    return {
        valid: true,
        avg_angle_change: avgAngleChange.toFixed(2),
        sharp_turn_count: sharpTurnCount,
        sharp_turn_ratio: (sharpTurnCount / angleChanges.length).toFixed(4),
        smoothness_score: smoothnessScore.toFixed(4),
        is_smooth: smoothnessScore > 0.7 && sharpTurnCount < 3
    };
}

/**
 * 计算综合质量评分
 * @param {Object} metrics - 各项指标
 * @returns {Object} 综合质量评分
 */
function calculateOverallQuality(metrics) {
    const {
        distanceDeviation,
        closureDistance,
        backtrackAnalysis,
        localLoopAnalysis,
        smoothnessAnalysis
    } = metrics;
    
    // 各项评分 (0-1)
    const distanceScore = Math.max(0, 1 - distanceDeviation);
    const closureScore = Math.max(0, 1 - closureDistance / 1000); // 1000米内为满分
    const backtrackScore = Math.max(0, 1 - parseFloat(backtrackAnalysis.backtrack_ratio) * 10);
    const loopScore = Math.max(0, 1 - localLoopAnalysis.loop_count * 0.2);
    const smoothnessScore = parseFloat(smoothnessAnalysis.smoothness_score) || 0;
    
    // 权重
    const weights = {
        distance: 0.2,
        closure: 0.25,
        backtrack: 0.25,
        loop: 0.15,
        smoothness: 0.15
    };
    
    const overallScore = 
        distanceScore * weights.distance +
        closureScore * weights.closure +
        backtrackScore * weights.backtrack +
        loopScore * weights.loop +
        smoothnessScore * weights.smoothness;
    
    return {
        distance_score: distanceScore.toFixed(3),
        closure_score: closureScore.toFixed(3),
        backtrack_score: backtrackScore.toFixed(3),
        loop_score: loopScore.toFixed(3),
        smoothness_score: smoothnessScore.toFixed(3),
        overall_score: overallScore.toFixed(3),
        quality_level: getQualityLevel(overallScore),
        weights: weights
    };
}

/**
 * 获取质量等级
 * @param {number} score - 综合评分
 * @returns {string} 质量等级
 */
function getQualityLevel(score) {
    if (score >= 0.8) return '优秀';
    if (score >= 0.6) return '良好';
    if (score >= 0.4) return '一般';
    if (score >= 0.2) return '较差';
    return '很差';
}

/**
 * 使用模拟数据运行测试
 * @param {Object} config - 测试配置
 */
async function runMockTest(config) {
    // 生成模拟的路线数据
    const mockNewResult = {
        coordinates: generateMockCoordinates(config.start_point, config.target_distance, 'improved'),
        distance: config.target_distance * 1000,
        route_type: 'roundtrip'
    };
    
    const mockOldResult = {
        coordinates: generateMockCoordinates(config.start_point, config.target_distance, 'traditional'),
        distance: config.target_distance * 1000,
        route_type: 'roundtrip'
    };
    
    // 分析结果
    const newAnalysis = analyzeRouteQuality(mockNewResult, config);
    const oldAnalysis = analyzeRouteQuality(mockOldResult, config);
    
    // 输出比较结果
    console.log('\n📊 算法性能比较（模拟数据）:');
    console.log('\n新算法（多候选）结果:');
    printAnalysisResult(newAnalysis);
    
    console.log('\n旧算法（单路线）结果:');
    printAnalysisResult(oldAnalysis);
    
    // 性能改进分析
    console.log('\n📈 性能改进分析:');
    compareMetrics(newAnalysis, oldAnalysis);
    
    return {
        config: config.name,
        new_algorithm: newAnalysis,
        old_algorithm: oldAnalysis,
        improvement: calculateImprovement(newAnalysis, oldAnalysis),
        is_mock: true
    };
}

/**
 * 生成模拟坐标数据
 * @param {Array} startPoint - 起始点
 * @param {number} targetDistance - 目标距离（公里）
 * @param {string} type - 算法类型
 */
function generateMockCoordinates(startPoint, targetDistance, type) {
    const [startLat, startLng] = startPoint;
    const coordinates = [[startLng, startLat]];
    
    const numPoints = Math.max(20, Math.floor(targetDistance * 2)); // 每公里约2个点
    const radius = targetDistance / (2 * Math.PI); // 估算半径
    
    for (let i = 1; i < numPoints; i++) {
        const angle = (2 * Math.PI * i) / numPoints;
        
        if (type === 'improved') {
            // 改进算法：更平滑的圆形路径，减少回头路
            const radiusVariation = 1 + 0.1 * Math.sin(angle * 3); // 轻微的半径变化
            const lat = startLat + (radius * radiusVariation * Math.cos(angle)) / 111;
            const lng = startLng + (radius * radiusVariation * Math.sin(angle)) / (111 * Math.cos(startLat * Math.PI / 180));
            coordinates.push([lng, lat]);
        } else {
            // 传统算法：更多的回头路和不规则路径
            const radiusVariation = 1 + 0.3 * Math.sin(angle * 5) + 0.2 * Math.cos(angle * 7); // 更大的变化
            let lat = startLat + (radius * radiusVariation * Math.cos(angle)) / 111;
            let lng = startLng + (radius * radiusVariation * Math.sin(angle)) / (111 * Math.cos(startLat * Math.PI / 180));
            
            // 添加一些回头路
            if (i % 8 === 0) {
                const backtrackAngle = angle - Math.PI / 4;
                lat += (radius * 0.2 * Math.cos(backtrackAngle)) / 111;
                lng += (radius * 0.2 * Math.sin(backtrackAngle)) / (111 * Math.cos(startLat * Math.PI / 180));
            }
            
            coordinates.push([lng, lat]);
        }
    }
    
    // 闭合路径
    coordinates.push([startLng, startLat]);
    
    return coordinates;
}

/**
 * 比较新旧算法的性能
 * @param {Object} config - 测试配置
 */
async function compareAlgorithms(config) {
    console.log(`\n=== 测试配置: ${config.name} ===`);
    
    // 使用提供的API密钥创建Blucap实例
    const blucap = new Blucap({ apiKey: '88a887a5-cad1-4c0a-bf60-3b50429a25c1' });
    
    try {
        // 测试新算法（多候选）
        console.log('\n🔄 测试新算法（多候选路线生成）...');
        const newAlgorithmResult = await blucap.generateFunRoute({
            start_point: config.start_point,
            target_distance: config.target_distance,
            curve_level: config.curve_level,
            route_type: 'roundtrip',
            use_multiple_candidates: true,
            candidate_count: 10
        });
        
        // 测试旧算法（单路线）
        console.log('\n🔄 测试旧算法（单路线生成）...');
        const oldAlgorithmResult = await blucap.generateFunRoute({
            start_point: config.start_point,
            target_distance: config.target_distance,
            curve_level: config.curve_level,
            route_type: 'roundtrip',
            use_multiple_candidates: false
        });
        
        // 分析结果
        const newAnalysis = analyzeRouteQuality(newAlgorithmResult, config);
        const oldAnalysis = analyzeRouteQuality(oldAlgorithmResult, config);
        
        // 输出比较结果
        console.log('\n📊 算法性能比较:');
        console.log('\n新算法（多候选）结果:');
        printAnalysisResult(newAnalysis);
        
        console.log('\n旧算法（单路线）结果:');
        printAnalysisResult(oldAnalysis);
        
        // 性能改进分析
        console.log('\n📈 性能改进分析:');
        compareMetrics(newAnalysis, oldAnalysis);
        
        return {
            config: config.name,
            new_algorithm: newAnalysis,
            old_algorithm: oldAnalysis,
            improvement: calculateImprovement(newAnalysis, oldAnalysis)
        };
        
    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
        return {
            config: config.name,
            error: error.message
        };
    }
}

/**
 * 打印分析结果
 * @param {Object} analysis - 分析结果
 */
function printAnalysisResult(analysis) {
    if (!analysis.valid) {
        console.log(`❌ ${analysis.error}`);
        return;
    }
    
    console.log(`  📏 距离: 目标${analysis.distance_analysis.target_km}km, 实际${analysis.distance_analysis.actual_km}km, 偏差${analysis.distance_analysis.deviation_percent}%`);
    console.log(`  🔄 闭合: ${analysis.closure_analysis.closure_distance_m}米, ${analysis.closure_analysis.is_well_closed ? '✅良好' : '❌较差'}`);
    console.log(`  ↩️  回头路: ${analysis.backtrack_analysis.backtrack_count}次, 比例${analysis.backtrack_analysis.backtrack_ratio}, ${analysis.backtrack_analysis.has_significant_backtrack ? '❌严重' : '✅轻微'}`);
    console.log(`  🔁 局部绕圈: ${analysis.local_loop_analysis.loop_count}次, ${analysis.local_loop_analysis.has_local_loops ? '❌存在' : '✅无'}`);
    console.log(`  🌊 平滑度: ${analysis.smoothness_analysis.smoothness_score}, ${analysis.smoothness_analysis.is_smooth ? '✅平滑' : '❌不平滑'}`);
    console.log(`  🏆 综合评分: ${analysis.overall_quality.overall_score} (${analysis.overall_quality.quality_level})`);
}

/**
 * 比较指标
 * @param {Object} newAnalysis - 新算法分析结果
 * @param {Object} oldAnalysis - 旧算法分析结果
 */
function compareMetrics(newAnalysis, oldAnalysis) {
    if (!newAnalysis.valid || !oldAnalysis.valid) {
        console.log('❌ 无法比较，存在无效结果');
        return;
    }
    
    const newScore = parseFloat(newAnalysis.overall_quality.overall_score);
    const oldScore = parseFloat(oldAnalysis.overall_quality.overall_score);
    const improvement = ((newScore - oldScore) / oldScore * 100).toFixed(1);
    
    console.log(`  综合评分: ${oldScore} → ${newScore} (${improvement > 0 ? '+' : ''}${improvement}%)`);
    
    // 回头路改进
    const newBacktrack = parseInt(newAnalysis.backtrack_analysis.backtrack_count);
    const oldBacktrack = parseInt(oldAnalysis.backtrack_analysis.backtrack_count);
    const backtrackImprovement = oldBacktrack - newBacktrack;
    console.log(`  回头路次数: ${oldBacktrack} → ${newBacktrack} (${backtrackImprovement > 0 ? '减少' : '增加'}${Math.abs(backtrackImprovement)}次)`);
    
    // 局部绕圈改进
    const newLoops = newAnalysis.local_loop_analysis.loop_count;
    const oldLoops = oldAnalysis.local_loop_analysis.loop_count;
    const loopImprovement = oldLoops - newLoops;
    console.log(`  局部绕圈: ${oldLoops} → ${newLoops} (${loopImprovement > 0 ? '减少' : '增加'}${Math.abs(loopImprovement)}次)`);
}

/**
 * 计算改进程度
 * @param {Object} newAnalysis - 新算法分析结果
 * @param {Object} oldAnalysis - 旧算法分析结果
 * @returns {Object} 改进程度
 */
function calculateImprovement(newAnalysis, oldAnalysis) {
    if (!newAnalysis.valid || !oldAnalysis.valid) {
        return { valid: false };
    }
    
    const newScore = parseFloat(newAnalysis.overall_quality.overall_score);
    const oldScore = parseFloat(oldAnalysis.overall_quality.overall_score);
    
    return {
        valid: true,
        score_improvement: ((newScore - oldScore) / oldScore * 100).toFixed(1),
        backtrack_reduction: oldAnalysis.backtrack_analysis.backtrack_count - newAnalysis.backtrack_analysis.backtrack_count,
        loop_reduction: oldAnalysis.local_loop_analysis.loop_count - newAnalysis.local_loop_analysis.loop_count,
        is_improved: newScore > oldScore
    };
}

/**
 * 主测试函数
 */
async function runTests() {
    console.log('🚀 开始测试改进后的环形路线生成算法\n');
    console.log('测试目标: 验证多候选路线生成能有效减少走回头路和局部绕圈现象\n');
    
    const results = [];
    
    for (const config of TEST_CONFIGS) {
        const result = await compareAlgorithms(config);
        results.push(result);
        
        // 等待一段时间避免API限制
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 总结报告
    console.log('\n\n📋 测试总结报告:');
    console.log('=' .repeat(50));
    
    let improvedCount = 0;
    let totalScoreImprovement = 0;
    let totalBacktrackReduction = 0;
    let totalLoopReduction = 0;
    
    results.forEach((result, index) => {
        if (result.error) {
            console.log(`${index + 1}. ${result.config}: ❌ 测试失败`);
            return;
        }
        
        if (result.improvement && result.improvement.valid) {
            const improvement = result.improvement;
            console.log(`${index + 1}. ${result.config}:`);
            console.log(`   评分改进: ${improvement.score_improvement}%`);
            console.log(`   回头路减少: ${improvement.backtrack_reduction}次`);
            console.log(`   绕圈减少: ${improvement.loop_reduction}次`);
            console.log(`   整体: ${improvement.is_improved ? '✅ 改进' : '❌ 未改进'}`);
            
            if (improvement.is_improved) {
                improvedCount++;
                totalScoreImprovement += parseFloat(improvement.score_improvement);
                totalBacktrackReduction += improvement.backtrack_reduction;
                totalLoopReduction += improvement.loop_reduction;
            }
        }
    });
    
    console.log('\n🎯 总体效果:');
    console.log(`  改进成功率: ${improvedCount}/${results.length} (${(improvedCount/results.length*100).toFixed(1)}%)`);
    if (improvedCount > 0) {
        console.log(`  平均评分提升: ${(totalScoreImprovement/improvedCount).toFixed(1)}%`);
        console.log(`  总回头路减少: ${totalBacktrackReduction}次`);
        console.log(`  总绕圈减少: ${totalLoopReduction}次`);
    }
    
    console.log('\n✅ 测试完成!');
}

// 运行测试
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    analyzeRouteQuality,
    detectBacktracking,
    detectLocalLoops,
    analyzeSmoothness,
    compareAlgorithms,
    runTests
};