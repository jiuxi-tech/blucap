// 浏览器兼容的 HTTP 客户端
const httpClient = {
    async post(url, data, config = {}) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
             throw new Error(`HTTP ${response.status}: ${response.statusText}`);
         }

        return {
            data: await response.json()
        };
    },

    async get(url, config = {}) {
        const response = await fetch(url, {
            method: 'GET',
            headers: config.headers || {}
        });

        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}`);
            error.response = {
                status: response.status,
                statusText: response.statusText,
                data: await response.text()
            };
            throw error;
        }

        return {
            data: await response.json()
        };
    }
};

// 辅助函数
const utils = {
    /**
     * 计算质量等级
     * @param {number} score - 质量评分
     * @returns {string} 质量等级
     */
    _calculateQualityGrade(score) {
        if (score >= 0.95) return 'A+';
        if (score >= 0.90) return 'A';
        if (score >= 0.85) return 'B+';
        if (score >= 0.80) return 'B';
        if (score >= 0.75) return 'C+';
        if (score >= 0.70) return 'C';
        if (score >= 0.60) return 'D';
        return 'F';
    },

    /**
     * 计算智能动态闭合阈值
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @param {number} previousAttempts - 之前尝试次数
     * @returns {number} 智能动态阈值
     */
    _calculateDynamicClosureThreshold(targetDistance, curveLevel = 'medium', previousAttempts = 0) {
        // 基础阈值计算 - 更精确的分段函数
        let baseThreshold;
        if (targetDistance < 2000) {
            baseThreshold = targetDistance * 0.002; // 短距离更严格
        } else if (targetDistance < 10000) {
            baseThreshold = targetDistance * 0.0025; // 中距离适中
        } else {
            baseThreshold = targetDistance * 0.003; // 长距离稍宽松
        }
        
        // 弯道等级调整系数
        const curveAdjustment = {
            'low': 0.8,     // 直线路线要求更严格
            'medium': 1.0,  // 标准要求
            'high': 1.2,    // 弯曲路线稍宽松
            'extreme': 1.4  // 极弯路线更宽松
        };
        
        // 重试次数调整 - 随着重试次数增加，适当放宽标准
        const retryAdjustment = 1 + (previousAttempts * 0.1);
        
        // 应用调整系数
        baseThreshold *= (curveAdjustment[curveLevel] || 1.0) * retryAdjustment;
        
        // 动态边界值
        const minThreshold = Math.max(30, targetDistance * 0.001); // 动态最小值
        const maxThreshold = Math.min(500, targetDistance * 0.01);  // 动态最大值
        
        return Math.max(minThreshold, Math.min(maxThreshold, baseThreshold));
    },

    // 距离计算缓存
    _distanceCache: new Map(),
    
    /**
     * 计算高精度距离（优化版）
     * @param {Array} point1 - 点1 [lng, lat]
     * @param {Array} point2 - 点2 [lng, lat]
     * @param {boolean} useCache - 是否使用缓存
     * @returns {number} 高精度距离（米）
     */
    _calculateHighPrecisionDistance(point1, point2, useCache = true) {
        const [lng1, lat1] = point1;
        const [lng2, lat2] = point2;
        
        // 缓存键值
        const cacheKey = useCache ? `${lng1.toFixed(6)},${lat1.toFixed(6)}-${lng2.toFixed(6)},${lat2.toFixed(6)}` : null;
        
        // 检查缓存
        if (useCache && this._distanceCache.has(cacheKey)) {
            return this._distanceCache.get(cacheKey);
        }
        
        // 快速检查是否为相同点
        if (Math.abs(lng1 - lng2) < 1e-10 && Math.abs(lat1 - lat2) < 1e-10) {
            return 0;
        }
        
        // 使用更精确的WGS84椭球体参数
        const a = 6378137.0; // WGS84长半轴（米）
        const f = 1/298.257223563; // WGS84扁率
        const b = (1-f)*a; // 短半轴
        
        const L = (lng2-lng1) * Math.PI/180;
        const U1 = Math.atan((1-f) * Math.tan(lat1 * Math.PI/180));
        const U2 = Math.atan((1-f) * Math.tan(lat2 * Math.PI/180));
        const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
        const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);
        
        let lambda = L, lambdaP, iterLimit = 100;
        let cosSqAlpha, sinSigma, cos2SigmaM, cosSigma, sigma;
        
        do {
            const sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
            sinSigma = Math.sqrt((cosU2*sinLambda) * (cosU2*sinLambda) + 
                               (cosU1*sinU2-sinU1*cosU2*cosLambda) * (cosU1*sinU2-sinU1*cosU2*cosLambda));
            if (sinSigma==0) return 0; // 重合点
            
            cosSigma = sinU1*sinU2 + cosU1*cosU2*cosLambda;
            sigma = Math.atan2(sinSigma, cosSigma);
            const sinAlpha = cosU1 * cosU2 * sinLambda / sinSigma;
            cosSqAlpha = 1 - sinAlpha*sinAlpha;
            cos2SigmaM = cosSigma - 2*sinU1*sinU2/cosSqAlpha;
            if (isNaN(cos2SigmaM)) cos2SigmaM = 0; // 赤道线
            
            const C = f/16*cosSqAlpha*(4+f*(4-3*cosSqAlpha));
            lambdaP = lambda;
            lambda = L + (1-C) * f * sinAlpha *
                (sigma + C*sinSigma*(cos2SigmaM+C*cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)));
        } while (Math.abs(lambda-lambdaP) > 1e-12 && --iterLimit>0);
        
        let distance;
        
        if (iterLimit==0) {
            // Vincenty迭代失败，使用优化的Haversine公式作为备选
            const R = 6371008.8; // 更精确的地球平均半径（米）
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lng2 - lng1) * Math.PI / 180;
            const lat1Rad = lat1 * Math.PI / 180;
            const lat2Rad = lat2 * Math.PI / 180;
            
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance = R * c;
            
            console.warn('Vincenty算法收敛失败，使用Haversine公式计算距离');
        } else {
            // Vincenty公式成功收敛
            const uSq = cosSqAlpha * (a*a - b*b) / (b*b);
            const A = 1 + uSq/16384*(4096+uSq*(-768+uSq*(320-175*uSq)));
            const B = uSq/1024 * (256+uSq*(-128+uSq*(74-47*uSq)));
            const deltaSigma = B*sinSigma*(cos2SigmaM+B/4*(cosSigma*(-1+2*cos2SigmaM*cos2SigmaM)-
                B/6*cos2SigmaM*(-3+4*sinSigma*sinSigma)*(-3+4*cos2SigmaM*cos2SigmaM)));
            
            distance = b*A*(sigma-deltaSigma);
        }
        
        // 缓存结果（限制缓存大小防止内存泄漏）
        if (useCache && cacheKey) {
            if (this._distanceCache.size > 1000) {
                // 清理最旧的缓存项
                const firstKey = this._distanceCache.keys().next().value;
                this._distanceCache.delete(firstKey);
            }
            this._distanceCache.set(cacheKey, distance);
        }
        
        return distance;
    },

    /**
     * 计算高级闭合质量指标
     * @param {Object} params - 参数对象
     * @returns {Object} 闭合质量指标
     */
    _calculateAdvancedClosureMetrics(params) {
        const { routeStart, routeEnd, startPoint, coordinates, targetDistance, closureDistance, startPointDistance } = params;
        
        // 计算闭合向量
        const closureVector = {
            dx: routeEnd[0] - routeStart[0],
            dy: routeEnd[1] - routeStart[1]
        };
        
        // 计算闭合角度偏差
        const closureAngle = Math.atan2(closureVector.dy, closureVector.dx) * 180 / Math.PI;
        
        // 计算路径总长度
        const totalPathLength = utils._estimatePathDistance(coordinates);
        
        // 计算闭合效率（闭合距离与总路径长度的比值）
        const closureEfficiency = 1 - (closureDistance / totalPathLength);
        
        // 计算路径偏心率
        const eccentricity = utils._calculatePathEccentricity(coordinates);
        
        // 计算闭合一致性
        const closureConsistency = utils._calculateClosureConsistency(coordinates, startPoint);
        
        return {
            closure_vector: closureVector,
            closure_angle: closureAngle,
            closure_efficiency: Math.max(0, closureEfficiency),
            path_eccentricity: eccentricity,
            closure_consistency: closureConsistency,
            relative_closure_error: closureDistance / targetDistance
        };
    },

    /**
     * 选择优化策略
     * @param {number} retryIndex - 重试索引
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @returns {Object} 优化策略
     */
    _selectOptimizationStrategy(retryIndex, targetDistance, curveLevel) {
        const strategies = [
            {
                name: 'conservative',
                radius_adjustment: 0.95,
                angle_coverage: 355,
                radius_pattern: 'uniform',
                apply_offset: false,
                closure_prediction: true
            },
            {
                name: 'elliptical',
                radius_adjustment: 0.92,
                angle_coverage: 350,
                radius_pattern: 'elliptical',
                apply_offset: true,
                offset_ratio: 0.03,
                max_offset: 500,
                offset_angle: 90,
                closure_prediction: true
            },
            {
                name: 'spiral',
                radius_adjustment: 0.90,
                angle_coverage: 345,
                radius_pattern: 'spiral',
                apply_offset: true,
                offset_ratio: 0.05,
                max_offset: 800,
                offset_angle: 45,
                closure_prediction: false
            },
            {
                name: 'adaptive',
                radius_adjustment: 0.88 - (retryIndex * 0.02),
                angle_coverage: 340 + (retryIndex * 2),
                radius_pattern: 'adaptive',
                apply_offset: true,
                offset_ratio: 0.02 + (retryIndex * 0.01),
                max_offset: 300 + (retryIndex * 100),
                offset_angle: 60 + (retryIndex * 15),
                closure_prediction: true
            },
            {
                name: 'precision',
                radius_adjustment: 0.85,
                angle_coverage: 358,
                radius_pattern: 'uniform',
                apply_offset: false,
                closure_prediction: true,
                start_bearing: 0
            }
        ];
        
        return strategies[Math.min(retryIndex, strategies.length - 1)];
    },

    /**
     * 应用智能闭合预测调整（优化版）
     * @param {Array} points - 中间点数组
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @param {number} previousAttempts - 之前尝试次数
     * @returns {Array} 调整后的点数组
     */
    _applyClosurePredictionAdjustment(points, startPoint, targetDistance, curveLevel = 'medium', previousAttempts = 0) {
        if (points.length === 0) return points;
        
        // 预测最后一个点到起点的距离
        const lastPoint = points[points.length - 1];
        const predictedClosureDistance = utils._calculateHighPrecisionDistance(lastPoint, startPoint);
        
        // 使用智能动态阈值
        const maxAcceptableDistance = utils._calculateDynamicClosureThreshold(targetDistance, curveLevel, previousAttempts);
        
        if (predictedClosureDistance > maxAcceptableDistance) {
            // 多级调整策略
            let adjustedPoint = lastPoint;
            let adjustmentAttempts = 0;
            const maxAdjustmentAttempts = 3;
            
            while (adjustmentAttempts < maxAdjustmentAttempts) {
                // 计算渐进式调整比例
                const baseRatio = maxAcceptableDistance / predictedClosureDistance;
                const progressiveRatio = baseRatio * (0.7 + adjustmentAttempts * 0.1); // 0.7, 0.8, 0.9
                
                adjustedPoint = [
                    startPoint[0] + (lastPoint[0] - startPoint[0]) * progressiveRatio,
                    startPoint[1] + (lastPoint[1] - startPoint[1]) * progressiveRatio
                ];
                
                const newDistance = utils._calculateHighPrecisionDistance(adjustedPoint, startPoint);
                
                if (newDistance <= maxAcceptableDistance) {
                    points[points.length - 1] = adjustedPoint;
                    console.log(`智能闭合调整成功 (尝试${adjustmentAttempts + 1}): ${predictedClosureDistance.toFixed(1)}m -> ${newDistance.toFixed(1)}m`);
                    break;
                }
                
                adjustmentAttempts++;
            }
            
            // 如果多次调整仍未达标，应用保守调整
            if (adjustmentAttempts >= maxAdjustmentAttempts) {
                const conservativeRatio = 0.6; // 保守调整
                const conservativePoint = [
                    startPoint[0] + (lastPoint[0] - startPoint[0]) * conservativeRatio,
                    startPoint[1] + (lastPoint[1] - startPoint[1]) * conservativeRatio
                ];
                points[points.length - 1] = conservativePoint;
                const finalDistance = utils._calculateHighPrecisionDistance(conservativePoint, startPoint);
                console.log(`应用保守闭合调整: ${predictedClosureDistance.toFixed(1)}m -> ${finalDistance.toFixed(1)}m`);
            }
        }
        
        return points;
    },

    /**
     * 计算闭合等级
     * @param {number} closureDistance - 闭合距离
     * @param {number} targetDistance - 目标距离
     * @returns {string} 闭合等级
     */
    _calculateClosureGrade(closureDistance, targetDistance) {
        const relativeError = closureDistance / targetDistance;
        
        if (relativeError <= 0.001) return 'A+';
        if (relativeError <= 0.002) return 'A';
        if (relativeError <= 0.005) return 'B+';
        if (relativeError <= 0.01) return 'B';
        if (relativeError <= 0.02) return 'C+';
        if (relativeError <= 0.05) return 'C';
        return 'D';
    },

    /**
     * 评估闭合质量指标
     * @param {Object} closureMetrics - 闭合质量指标
     * @returns {number} 指标评分
     */
    _scoreClosureMetrics(closureMetrics) {
        const efficiencyScore = Math.max(0, Math.min(1, closureMetrics.closure_efficiency));
        const consistencyScore = Math.max(0, Math.min(1, closureMetrics.closure_consistency));
        const eccentricityScore = Math.max(0, 1 - closureMetrics.path_eccentricity);
        
        return (efficiencyScore + consistencyScore + eccentricityScore) / 3;
    },

    /**
     * 评估路径连续性
     * @param {Object} closureMetrics - 闭合质量指标
     * @returns {number} 连续性评分
     */
    _evaluatePathContinuity(closureMetrics) {
        // 基于闭合角度和效率评估连续性
        const angleScore = Math.max(0, 1 - Math.abs(closureMetrics.closure_angle) / 180);
        const efficiencyScore = closureMetrics.closure_efficiency;
        
        return (angleScore + efficiencyScore) / 2;
    },

    /**
     * 生成增强的改进建议
     * @param {Object} params - 评估参数
     * @returns {Array} 改进建议数组
     */
    _generateEnhancedRecommendations(params) {
        const { closureScore, startDeviationScore, geometryAnalysis, closureMetrics, continuityScore, targetDistance } = params;
        const recommendations = [];
        
        if (closureScore < 0.8) {
            recommendations.push({
                type: 'closure',
                priority: 'high',
                message: '优化路线闭合度：减少起终点距离',
                suggestion: '调整中间点分布，使用更精确的角度计算'
            });
        }
        
        if (startDeviationScore < 0.8) {
            recommendations.push({
                type: 'deviation',
                priority: 'high',
                message: '减少起点偏差：确保路线从指定起点开始',
                suggestion: '验证起点坐标精度，调整路径规划参数'
            });
        }
        
        if (geometryAnalysis.circularity < 0.6) {
            recommendations.push({
                type: 'geometry',
                priority: 'medium',
                message: '提高路径圆形度：创建更规则的环形路径',
                suggestion: '使用均匀的角度分布和一致的半径变化'
            });
        }
        
        if (closureMetrics.closure_efficiency < 0.8) {
            recommendations.push({
                type: 'efficiency',
                priority: 'medium',
                message: '提高闭合效率：优化路径长度与闭合距离的比例',
                suggestion: '减少不必要的路径弯曲，优化中间点位置'
            });
        }
        
        if (continuityScore < 0.7) {
            recommendations.push({
                type: 'continuity',
                priority: 'low',
                message: '改善路径连续性：确保平滑的路径过渡',
                suggestion: '应用路径平滑算法，减少急转弯'
            });
        }
        
        return recommendations;
    },

    /**
     * 验证增强的闭合标准（更严格版本）
     * @param {Object} params - 验证参数
     * @returns {Object} 详细验证结果
     */
    _validateEnhancedClosure(params) {
        const { qualityScore, closureDistance, startPointDistance, targetDistance, closureMetrics, coordinates } = params;
        
        // 动态阈值计算
        const dynamicThreshold = utils._calculateDynamicClosureThreshold(targetDistance);
        const strictThreshold = dynamicThreshold * 0.8; // 更严格的80%阈值
        const maxStartDeviation = Math.min(targetDistance * 0.003, 75); // 更严格的起点偏差
        
        // 基础验证条件（更严格）
        const qualityCheck = qualityScore >= 0.8; // 从0.75提升到0.8
        const closureCheck = closureDistance <= strictThreshold;
        const deviationCheck = startPointDistance <= maxStartDeviation;
        const efficiencyCheck = closureMetrics.closure_efficiency >= 0.75; // 从0.7提升到0.75
        const consistencyCheck = closureMetrics.closure_consistency >= 0.7; // 从0.6提升到0.7
        
        // 新增高级验证条件
        const geometricValidation = this._validateGeometricIntegrity(coordinates, targetDistance);
        const pathStabilityCheck = this._validatePathStability(closureMetrics, targetDistance);
        const circularityCheck = this._validateCircularity(coordinates, targetDistance);
        const symmetryCheck = this._validatePathSymmetry(coordinates);
        
        // 计算各项验证得分
        const validationScores = {
            quality: qualityCheck ? 1.0 : qualityScore / 0.8,
            closure: closureCheck ? 1.0 : Math.max(0, 1 - (closureDistance / strictThreshold)),
            deviation: deviationCheck ? 1.0 : Math.max(0, 1 - (startPointDistance / maxStartDeviation)),
            efficiency: efficiencyCheck ? 1.0 : closureMetrics.closure_efficiency / 0.75,
            consistency: consistencyCheck ? 1.0 : closureMetrics.closure_consistency / 0.7,
            geometric: geometricValidation.score,
            stability: pathStabilityCheck.score,
            circularity: circularityCheck.score,
            symmetry: symmetryCheck.score
        };
        
        // 计算综合验证得分
        const overallScore = (
            validationScores.quality * 0.20 +
            validationScores.closure * 0.20 +
            validationScores.deviation * 0.15 +
            validationScores.efficiency * 0.15 +
            validationScores.consistency * 0.10 +
            validationScores.geometric * 0.08 +
            validationScores.stability * 0.05 +
            validationScores.circularity * 0.04 +
            validationScores.symmetry * 0.03
        );
        
        // 严格的通过标准
        const basicValidation = qualityCheck && closureCheck && deviationCheck && efficiencyCheck && consistencyCheck;
        const advancedValidation = geometricValidation.passed && pathStabilityCheck.passed && circularityCheck.passed;
        const strictValidation = overallScore >= 0.85; // 综合得分需达到85%
        
        const isPassed = basicValidation && advancedValidation && strictValidation;
        
        return {
            passed: isPassed,
            overall_score: overallScore,
            validation_scores: validationScores,
            basic_validation: basicValidation,
            advanced_validation: advancedValidation,
            strict_validation: strictValidation,
            failure_reasons: this._identifyValidationFailures(validationScores, {
                basicValidation,
                advancedValidation,
                strictValidation
            }),
            improvement_suggestions: this._generateValidationImprovements(validationScores)
        };
    },

    /**
     * 验证几何完整性
     * @param {Array} coordinates - 路径坐标
     * @param {number} targetDistance - 目标距离
     * @returns {Object} 几何验证结果
     */
    _validateGeometricIntegrity(coordinates, targetDistance) {
        if (!coordinates || coordinates.length < 3) {
            return { passed: false, score: 0, reason: "坐标数据不足" };
        }
        
        // 计算路径的几何特征
        const pathLength = utils._estimatePathDistance(coordinates);
        const center = utils._calculateRouteCenter(coordinates);
        const averageRadius = utils._calculateAverageRadius(coordinates, center);
        const angleSpread = utils._calculateAngleSpread(coordinates, center);
        
        // 几何完整性检查
        const lengthRatio = pathLength / targetDistance;
        const lengthCheck = lengthRatio >= 0.9 && lengthRatio <= 1.15; // 路径长度在目标距离的90%-115%之间
        
        const radiusConsistency = utils._calculateRadiusConsistency(coordinates, center, averageRadius);
        const radiusCheck = radiusConsistency >= 0.7; // 半径一致性至少70%
        
        const angleDistribution = angleSpread / 360; // 角度分布覆盖率
        const angleCheck = angleDistribution >= 0.8; // 至少覆盖80%的角度范围
        
        const convexityAnalysis = utils._analyzePathConvexity(coordinates);
        const convexityScore = convexityAnalysis.convexityScore;
        const convexityCheck = convexityScore >= 0.6; // 凸性得分至少60%
        
        // 计算综合几何得分
        const geometricScore = (
            (lengthCheck ? 1.0 : Math.max(0, 1 - Math.abs(lengthRatio - 1.0) * 2)) * 0.3 +
            (radiusCheck ? 1.0 : radiusConsistency) * 0.3 +
            (angleCheck ? 1.0 : angleDistribution) * 0.25 +
            convexityScore * 0.15
        );
        
        const passed = lengthCheck && radiusCheck && angleCheck && convexityCheck;
        
        return {
            passed,
            score: geometricScore,
            details: {
                length_ratio: lengthRatio,
                length_check: lengthCheck,
                radius_consistency: radiusConsistency,
                radius_check: radiusCheck,
                angle_distribution: angleDistribution,
                angle_check: angleCheck,
                convexity_score: convexityScore,
                convexity_check: convexityCheck
            }
        };
    },
    
    /**
     * 验证路径稳定性
     * @param {Object} closureMetrics - 闭合指标
     * @param {number} targetDistance - 目标距离
     * @returns {Object} 稳定性验证结果
     */
    _validatePathStability(closureMetrics, targetDistance) {
        // 效率稳定性检查
        const efficiencyStability = closureMetrics.closure_efficiency >= 0.75;
        
        // 一致性稳定性检查
        const consistencyStability = closureMetrics.closure_consistency >= 0.7;
        
        // 相对误差稳定性检查
        const relativeError = closureMetrics.relative_closure_error || 0;
        const errorStability = relativeError <= 0.05; // 相对误差不超过5%
        
        // 路径偏心率稳定性检查
        const eccentricity = closureMetrics.path_eccentricity || 0;
        const eccentricityStability = eccentricity <= 0.3; // 偏心率不超过0.3
        
        // 计算稳定性得分
        const stabilityScore = (
            (efficiencyStability ? 1.0 : closureMetrics.closure_efficiency / 0.75) * 0.3 +
            (consistencyStability ? 1.0 : closureMetrics.closure_consistency / 0.7) * 0.3 +
            (errorStability ? 1.0 : Math.max(0, 1 - relativeError * 20)) * 0.25 +
            (eccentricityStability ? 1.0 : Math.max(0, 1 - eccentricity / 0.3)) * 0.15
        );
        
        const passed = efficiencyStability && consistencyStability && errorStability && eccentricityStability;
        
        return {
            passed,
            score: stabilityScore,
            details: {
                efficiency_stability: efficiencyStability,
                consistency_stability: consistencyStability,
                error_stability: errorStability,
                eccentricity_stability: eccentricityStability,
                relative_error: relativeError,
                eccentricity: eccentricity
            }
        };
    },
    
    /**
     * 验证圆形度
     * @param {Array} coordinates - 路径坐标
     * @param {number} targetDistance - 目标距离
     * @returns {Object} 圆形度验证结果
     */
    _validateCircularity(coordinates, targetDistance) {
        if (!coordinates || coordinates.length < 3) {
            return { passed: false, score: 0, reason: "坐标数据不足" };
        }
        
        const center = utils._calculateRouteCenter(coordinates);
        const circularity = utils._calculateCircularity(coordinates, center);
        const compactness = utils._calculatePathCompactness(coordinates, targetDistance);
        
        // 圆形度检查
        const circularityCheck = circularity >= 0.7; // 圆形度至少70%
        const compactnessCheck = compactness >= 0.6; // 紧凑度至少60%
        
        // 计算圆形度得分
        const circularityScore = (
            (circularityCheck ? 1.0 : circularity) * 0.7 +
            (compactnessCheck ? 1.0 : compactness) * 0.3
        );
        
        const passed = circularityCheck && compactnessCheck;
        
        return {
            passed,
            score: circularityScore,
            details: {
                circularity: circularity,
                circularity_check: circularityCheck,
                compactness: compactness,
                compactness_check: compactnessCheck
            }
        };
    },
    
    /**
     * 验证路径对称性
     * @param {Array} coordinates - 路径坐标
     * @returns {Object} 对称性验证结果
     */
    _validatePathSymmetry(coordinates) {
        if (!coordinates || coordinates.length < 4) {
            return { passed: false, score: 0, reason: "坐标数据不足" };
        }
        
        const center = utils._calculateRouteCenter(coordinates);
        const symmetry = utils._calculatePathSymmetry(coordinates, center);
        const uniformity = utils._calculatePathUniformity(coordinates, center);
        
        // 对称性检查
        const symmetryCheck = symmetry >= 0.6; // 对称性至少60%
        const uniformityCheck = uniformity >= 0.65; // 均匀性至少65%
        
        // 计算对称性得分
        const symmetryScore = (
            (symmetryCheck ? 1.0 : symmetry) * 0.6 +
            (uniformityCheck ? 1.0 : uniformity) * 0.4
        );
        
        const passed = symmetryCheck && uniformityCheck;
        
        return {
            passed,
            score: symmetryScore,
            details: {
                symmetry: symmetry,
                symmetry_check: symmetryCheck,
                uniformity: uniformity,
                uniformity_check: uniformityCheck
            }
        };
    },
    
    /**
     * 计算半径一致性
     * @param {Array} coordinates - 路径坐标
     * @param {Array} center - 中心点
     * @param {number} averageRadius - 平均半径
     * @returns {number} 半径一致性得分
     */
    _calculateRadiusConsistency(coordinates, center, averageRadius) {
        if (!coordinates || coordinates.length < 3) return 0;
        
        let totalDeviation = 0;
        let validPoints = 0;
        
        for (const coord of coordinates) {
            const distance = utils._calculateHighPrecisionDistance(center, coord, false);
            const deviation = Math.abs(distance - averageRadius) / averageRadius;
            totalDeviation += deviation;
            validPoints++;
        }
        
        if (validPoints === 0) return 0;
        
        const averageDeviation = totalDeviation / validPoints;
        return Math.max(0, 1 - averageDeviation);
    },
    
    /**
     * 识别验证失败原因
     * @param {Object} validationScores - 验证得分
     * @param {Object} validationResults - 验证结果
     * @returns {Array} 失败原因列表
     */
    _identifyValidationFailures(validationScores, validationResults) {
        const failures = [];
        
        if (!validationResults.basicValidation) {
            if (validationScores.quality < 1.0) failures.push("整体质量得分不达标");
            if (validationScores.closure < 1.0) failures.push("闭合距离超出严格阈值");
            if (validationScores.deviation < 1.0) failures.push("起点偏差过大");
            if (validationScores.efficiency < 1.0) failures.push("闭合效率不足");
            if (validationScores.consistency < 1.0) failures.push("闭合一致性不足");
        }
        
        if (!validationResults.advancedValidation) {
            if (validationScores.geometric < 0.8) failures.push("几何完整性不足");
            if (validationScores.stability < 0.8) failures.push("路径稳定性不足");
            if (validationScores.circularity < 0.7) failures.push("圆形度不达标");
        }
        
        if (!validationResults.strictValidation) {
            failures.push("综合验证得分未达到85%标准");
        }
        
        return failures;
    },
    
    /**
     * 生成验证改进建议
     * @param {Object} validationScores - 验证得分
     * @returns {Array} 改进建议列表
     */
    _generateValidationImprovements(validationScores) {
        const suggestions = [];
        
        if (validationScores.quality < 0.9) {
            suggestions.push("建议优化路径规划算法以提升整体质量");
        }
        
        if (validationScores.closure < 0.9) {
            suggestions.push("建议调整中间点分布以改善闭合精度");
        }
        
        if (validationScores.geometric < 0.8) {
            suggestions.push("建议优化几何形状以提升路径完整性");
        }
        
        if (validationScores.stability < 0.8) {
            suggestions.push("建议增强路径稳定性控制机制");
        }
        
        if (validationScores.circularity < 0.7) {
            suggestions.push("建议改进圆形路径生成算法");
        }
        
        if (validationScores.symmetry < 0.7) {
            suggestions.push("建议优化路径对称性和均匀性");
        }
        
        return suggestions;
    },

    /**
     * 计算路径偏心率
     * @param {Array} coordinates - 路径坐标
     * @returns {number} 偏心率
     */
    _calculatePathEccentricity(coordinates) {
        if (coordinates.length < 3) return 1;
        
        const center = utils._calculateRouteCenter(coordinates);
        const distances = coordinates.map(coord => 
            utils._calculateHighPrecisionDistance(center, coord)
        );
        
        const maxDistance = Math.max(...distances);
        const minDistance = Math.min(...distances);
        
        return minDistance > 0 ? (maxDistance - minDistance) / maxDistance : 1;
    },

    /**
      * 计算闭合一致性
      * @param {Array} coordinates - 路径坐标
      * @param {Array} startPoint - 起始点
      * @returns {number} 一致性评分
      */
     _calculateClosureConsistency(coordinates, startPoint) {
         if (coordinates.length < 4) return 0;
         
         // 计算路径各段到起点的距离变化
         const segmentCount = Math.min(8, coordinates.length);
         const step = Math.floor(coordinates.length / segmentCount);
         const distances = [];
         
         for (let i = 0; i < segmentCount; i++) {
             const index = i * step;
             if (index < coordinates.length) {
                 distances.push(utils._calculateHighPrecisionDistance(startPoint, coordinates[index]));
             }
         }
         
         // 计算距离变化的标准差
         const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
         const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
         const stdDev = Math.sqrt(variance);
         
         // 一致性评分（标准差越小，一致性越高）
         return Math.max(0, 1 - (stdDev / mean));
     },

     /**
      * 估算路径总距离
      * @param {Array} coordinates - 路径坐标数组
      * @returns {number} 估算的路径总距离（米）
      */
     _estimatePathDistance(coordinates) {
         if (coordinates.length < 2) return 0;
         
         let totalDistance = 0;
         for (let i = 1; i < coordinates.length; i++) {
             totalDistance += utils._calculateHighPrecisionDistance(coordinates[i-1], coordinates[i]);
         }
         
         return totalDistance;
     },

     /**
      * 计算路线中心点
      * @param {Array} coordinates - 路径坐标数组
      * @returns {Array} 中心点坐标 [lng, lat]
      */
     _calculateRouteCenter(coordinates) {
         if (coordinates.length === 0) return [0, 0];
         
         const sumLng = coordinates.reduce((sum, coord) => sum + coord[0], 0);
         const sumLat = coordinates.reduce((sum, coord) => sum + coord[1], 0);
         
         return [sumLng / coordinates.length, sumLat / coordinates.length];
     },

     /**
      * 智能选择最优闭合策略（增强版）
      * @param {number} targetDistance - 目标距离
      * @param {string} curveLevel - 弯道等级
      * @param {number} previousAttempts - 之前尝试次数
      * @param {Object} contextData - 上下文数据（可选）
      * @returns {Object} 最优策略配置
      */
     _selectOptimalClosureStrategy(targetDistance, curveLevel, previousAttempts, contextData = {}) {
         // 基础策略配置
         const baseStrategies = {
             short_distance: { // 短距离路线 (<5km)
                 max_closure_ratio: 0.002,
                 preferred_strategies: ['conservative', 'precision', 'micro_adaptive'],
                 angle_coverage_range: [355, 358],
                 radius_adjustment_range: [0.92, 0.98],
                 complexity_threshold: 0.3
             },
             medium_distance: { // 中距离路线 (5-15km)
                 max_closure_ratio: 0.003,
                 preferred_strategies: ['elliptical', 'adaptive', 'hybrid_optimization'],
                 angle_coverage_range: [350, 355],
                 radius_adjustment_range: [0.88, 0.95],
                 complexity_threshold: 0.5
             },
             long_distance: { // 长距离路线 (>15km)
                 max_closure_ratio: 0.005,
                 preferred_strategies: ['spiral', 'adaptive', 'progressive_refinement'],
                 angle_coverage_range: [345, 352],
                 radius_adjustment_range: [0.85, 0.92],
                 complexity_threshold: 0.7
             },
             ultra_long: { // 超长距离路线 (>30km)
                 max_closure_ratio: 0.008,
                 preferred_strategies: ['multi_phase', 'intelligent_segmentation'],
                 angle_coverage_range: [340, 350],
                 radius_adjustment_range: [0.80, 0.90],
                 complexity_threshold: 0.9
             }
         };
         
         // 智能分类决策
         let category = this._determineOptimalCategory(targetDistance, curveLevel, contextData);
         
         const config = baseStrategies[category];
         
         // 环境感知调整
         const environmentalFactors = this._analyzeEnvironmentalFactors({
             targetDistance,
             curveLevel,
             previousAttempts,
             contextData
         });
         
         // 动态策略选择
         const optimalStrategy = this._selectDynamicStrategy({
             config,
             environmentalFactors,
             previousAttempts,
             curveLevel
         });
         
         // 自适应参数调整
         const adaptiveParams = this._calculateAdaptiveParameters({
             config,
             environmentalFactors,
             previousAttempts,
             targetDistance
         });
         
         return {
             category,
             strategy_name: optimalStrategy.name,
             strategy_type: optimalStrategy.type,
             max_closure_ratio: adaptiveParams.closureRatio,
             angle_coverage: adaptiveParams.angleCoverage,
             radius_adjustment: adaptiveParams.radiusAdjustment,
             optimization_level: optimalStrategy.optimizationLevel,
             adaptive_features: optimalStrategy.features,
             environmental_adjustments: environmentalFactors,
             confidence_score: optimalStrategy.confidence,
             fallback_strategies: optimalStrategy.fallbacks
         };
      },

     /**
      * 智能确定最优策略分类
      * @param {number} targetDistance - 目标距离
      * @param {string} curveLevel - 弯道等级
      * @param {Object} contextData - 上下文数据
      * @returns {string} 策略分类
      */
     _determineOptimalCategory(targetDistance, curveLevel, contextData) {
         // 基础距离分类
         let baseCategory;
         if (targetDistance < 5000) baseCategory = 'short_distance';
         else if (targetDistance < 15000) baseCategory = 'medium_distance';
         else if (targetDistance < 30000) baseCategory = 'long_distance';
         else baseCategory = 'ultra_long';
         
         // 复杂度调整
         const complexityFactor = this._calculateRouteComplexity(targetDistance, curveLevel, contextData);
         
         // 根据复杂度可能升级分类
         if (complexityFactor > 0.8 && baseCategory === 'short_distance') {
             return 'medium_distance';
         }
         if (complexityFactor > 0.7 && baseCategory === 'medium_distance') {
             return 'long_distance';
         }
         if (complexityFactor > 0.6 && baseCategory === 'long_distance') {
             return 'ultra_long';
         }
         
         return baseCategory;
     },
     
     /**
      * 分析环境因素
      * @param {Object} params - 分析参数
      * @returns {Object} 环境因素分析结果
      */
     _analyzeEnvironmentalFactors(params) {
         const { targetDistance, curveLevel, previousAttempts, contextData } = params;
         
         // 地理环境因素
         const geographicComplexity = this._assessGeographicComplexity(contextData);
         
         // 历史性能因素
         const historicalPerformance = this._analyzeHistoricalPerformance(previousAttempts, contextData);
         
         // 路线特征因素
         const routeCharacteristics = this._analyzeRouteCharacteristics(targetDistance, curveLevel);
         
         // 计算环境压力指数
         const environmentalStress = this._calculateEnvironmentalStress({
             geographic: geographicComplexity,
             historical: historicalPerformance,
             route: routeCharacteristics
         });
         
         return {
             geographic_complexity: geographicComplexity,
             historical_performance: historicalPerformance,
             route_characteristics: routeCharacteristics,
             environmental_stress: environmentalStress,
             adaptation_urgency: environmentalStress > 0.7 ? 'high' : environmentalStress > 0.4 ? 'medium' : 'low'
         };
     },
     
     /**
      * 动态策略选择
      * @param {Object} params - 选择参数
      * @returns {Object} 最优策略
      */
     _selectDynamicStrategy(params) {
         const { config, environmentalFactors, previousAttempts, curveLevel } = params;
         
         // 策略候选池
         const strategyCandidates = this._generateStrategyCandidates(config, environmentalFactors);
         
         // 策略评分
         const scoredStrategies = strategyCandidates.map(strategy => {
             const score = this._scoreStrategy(strategy, {
                 environmentalFactors,
                 previousAttempts,
                 curveLevel,
                 config
             });
             return { ...strategy, score };
         });
         
         // 选择最高分策略
         const optimalStrategy = scoredStrategies.reduce((best, current) => 
             current.score > best.score ? current : best
         );
         
         // 添加置信度和后备策略
         optimalStrategy.confidence = this._calculateStrategyConfidence(optimalStrategy, environmentalFactors);
         optimalStrategy.fallbacks = this._generateFallbackStrategies(scoredStrategies, optimalStrategy);
         
         return optimalStrategy;
     },
     
     /**
      * 计算自适应参数
      * @param {Object} params - 计算参数
      * @returns {Object} 自适应参数
      */
     _calculateAdaptiveParameters(params) {
         const { config, environmentalFactors, previousAttempts, targetDistance } = params;
         
         // 基础参数
         const baseClosureRatio = config.max_closure_ratio;
         const baseAngleRange = config.angle_coverage_range;
         const baseRadiusRange = config.radius_adjustment_range;
         
         // 环境调整因子
         const envAdjustment = this._calculateEnvironmentalAdjustment(environmentalFactors);
         
         // 重试调整因子
         const retryAdjustment = this._calculateRetryAdjustment(previousAttempts);
         
         // 距离调整因子
         const distanceAdjustment = this._calculateDistanceAdjustment(targetDistance);
         
         // 综合调整
         const totalAdjustment = {
             closure: envAdjustment.closure * retryAdjustment.closure * distanceAdjustment.closure,
             angle: envAdjustment.angle * retryAdjustment.angle * distanceAdjustment.angle,
             radius: envAdjustment.radius * retryAdjustment.radius * distanceAdjustment.radius
         };
         
         return {
             closureRatio: Math.max(0.001, Math.min(0.01, baseClosureRatio * totalAdjustment.closure)),
             angleCoverage: Math.max(340, Math.min(358, 
                 baseAngleRange[0] + (baseAngleRange[1] - baseAngleRange[0]) * totalAdjustment.angle
             )),
             radiusAdjustment: Math.max(0.75, Math.min(0.99, 
                 baseRadiusRange[0] + (baseRadiusRange[1] - baseRadiusRange[0]) * totalAdjustment.radius
             ))
         };
     },

     /**
      * 预测闭合质量
      * @param {Array} intermediatePoints - 中间点数组
      * @param {Array} startPoint - 起始点
      * @param {number} targetDistance - 目标距离
      * @returns {Object} 预测结果
      */
     _predictClosureQuality(intermediatePoints, startPoint, targetDistance, curveLevel = 'medium') {
         if (intermediatePoints.length === 0) {
             return {
                 predicted_closure_distance: Infinity,
                 quality_prediction: 0,
                 confidence: 0,
                 risk_factors: ['no_intermediate_points']
             };
         }
         
         const lastPoint = intermediatePoints[intermediatePoints.length - 1];
         const predictedClosureDistance = utils._calculateHighPrecisionDistance(lastPoint, startPoint);
         
         // 高级几何特征分析
         const pathLength = utils._estimatePathDistance([startPoint, ...intermediatePoints]);
         const averageRadius = utils._calculateAverageRadius(intermediatePoints, startPoint);
         const angleSpread = utils._calculateAngleSpread(intermediatePoints, startPoint);
         const pathVariability = utils._calculatePathVariability(intermediatePoints, startPoint);
         const directionConsistency = utils._calculateDirectionConsistency(intermediatePoints, startPoint);
         const stabilityScore = utils._calculateStabilityScore(intermediatePoints, startPoint, targetDistance);
         
         // 弯道等级评估
         const curveComplexity = utils._evaluateCurveComplexity(curveLevel, pathLength, targetDistance);
         
         // 风险因素识别
         const riskFactors = utils._identifyRiskFactors({
             closureDistance: predictedClosureDistance,
             targetDistance,
             pathLength,
             angleSpread,
             pathVariability,
             directionConsistency,
             curveLevel
         });
         
         // 多维度质量评估
         const closureRatio = predictedClosureDistance / targetDistance;
         const pathEfficiency = targetDistance / pathLength;
         const geometryScore = utils._evaluateGeometryScore(averageRadius, angleSpread, targetDistance);
         
         // 智能权重分配
         const weights = utils._calculateAdaptiveWeights(curveLevel, riskFactors.length);
         
         const qualityPrediction = (
             (1 - Math.min(closureRatio, 1)) * weights.closure +
             pathEfficiency * weights.efficiency +
             geometryScore * weights.geometry +
             directionConsistency * weights.consistency +
             stabilityScore * weights.stability +
             (1 - curveComplexity) * weights.complexity
         );
         
         // 动态置信度计算
         const baseConfidence = Math.max(0, 1 - (closureRatio * 1.5));
         const riskPenalty = Math.min(0.5, riskFactors.length * 0.1);
         const stabilityBonus = stabilityScore * 0.2;
         const confidence = Math.max(0, Math.min(1, baseConfidence - riskPenalty + stabilityBonus));
         
         return {
             predicted_closure_distance: predictedClosureDistance,
             quality_prediction: Math.max(0, Math.min(1, qualityPrediction)),
             confidence: confidence,
             path_efficiency: pathEfficiency,
             geometry_score: geometryScore,
             direction_consistency: directionConsistency,
             stability_score: stabilityScore,
             curve_complexity: curveComplexity,
             risk_factors: riskFactors,
             adaptive_weights: weights
         };
     },

     /**
      * 计算路径可变性
      * @param {Array} points - 点数组
      * @param {Array} center - 中心点
      * @returns {number} 路径可变性得分 (0-1)
      */
     _calculatePathVariability(points, center) {
         if (points.length < 2) return 0;
         
         const distances = points.map(point => 
             utils._calculateHighPrecisionDistance(point, center)
         );
         
         const mean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
         const variance = distances.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / distances.length;
         const standardDeviation = Math.sqrt(variance);
         
         // 标准化可变性得分
         const normalizedVariability = Math.min(1, standardDeviation / (mean * 0.5));
         return 1 - normalizedVariability; // 可变性越小，得分越高
     },
     
     /**
      * 计算方向一致性
      * @param {Array} points - 点数组
      * @param {Array} center - 中心点
      * @returns {number} 方向一致性得分 (0-1)
      */
     _calculateDirectionConsistency(points, center) {
          if (points.length < 3) return 1;
          
          const bearings = [];
          for (let i = 0; i < points.length - 1; i++) {
              const bearing = utils._calculateBearing(points[i], points[i + 1]);
              bearings.push(bearing);
          }
         
         // 计算相邻方向角度差异
         let totalAngleDiff = 0;
         for (let i = 0; i < bearings.length - 1; i++) {
             let angleDiff = Math.abs(bearings[i + 1] - bearings[i]);
             if (angleDiff > 180) angleDiff = 360 - angleDiff;
             totalAngleDiff += angleDiff;
         }
         
         const averageAngleDiff = totalAngleDiff / (bearings.length - 1);
         return Math.max(0, 1 - (averageAngleDiff / 90)); // 角度差异越小，一致性越高
     },
     
     /**
      * 计算稳定性得分
      * @param {Array} points - 点数组
      * @param {Array} center - 中心点
      * @param {number} targetDistance - 目标距离
      * @returns {number} 稳定性得分 (0-1)
      */
     _calculateStabilityScore(points, center, targetDistance) {
         if (points.length < 2) return 0;
         
         const pathVariability = utils._calculatePathVariability(points, center);
         const directionConsistency = utils._calculateDirectionConsistency(points, center);
         const geometryScore = utils._evaluateGeometryScore(
             utils._calculateAverageRadius(points, center),
             utils._calculateAngleSpread(points, center),
             targetDistance
         );
         
         // 综合稳定性评估
         return (pathVariability * 0.4 + directionConsistency * 0.4 + geometryScore * 0.2);
     },
     
     /**
      * 评估弯道复杂度
      * @param {string} curveLevel - 弯道等级
      * @param {number} pathLength - 路径长度
      * @param {number} targetDistance - 目标距离
      * @returns {number} 复杂度得分 (0-1)
      */
     _evaluateCurveComplexity(curveLevel, pathLength, targetDistance) {
         const lengthRatio = pathLength / targetDistance;
         
         const complexityMap = {
             'straight': 0.1,
             'gentle': 0.3,
             'medium': 0.5,
             'sharp': 0.7,
             'extreme': 0.9
         };
         
         const baseCurvature = complexityMap[curveLevel] || 0.5;
         const lengthFactor = Math.min(1, (lengthRatio - 1) * 2); // 路径越长，复杂度越高
         
         return Math.min(1, baseCurvature + lengthFactor * 0.3);
     },
     
     /**
      * 识别风险因素
      * @param {Object} params - 分析参数
      * @returns {Array} 风险因素列表
      */
     _identifyRiskFactors(params) {
         const risks = [];
         const { closureDistance, targetDistance, pathLength, angleSpread, pathVariability, directionConsistency, curveLevel } = params;
         
         const closureRatio = closureDistance / targetDistance;
         const pathRatio = pathLength / targetDistance;
         
         if (closureRatio > 0.15) risks.push('high_closure_distance');
         if (pathRatio > 2.5) risks.push('excessive_path_length');
         if (angleSpread < 180) risks.push('insufficient_angle_coverage');
         if (pathVariability < 0.3) risks.push('high_path_variability');
         if (directionConsistency < 0.4) risks.push('poor_direction_consistency');
         if (curveLevel === 'extreme' && closureRatio > 0.1) risks.push('extreme_curve_closure_risk');
         if (pathRatio < 1.2) risks.push('insufficient_detour');
         
         return risks;
     },
     
     /**
      * 计算自适应权重
      * @param {string} curveLevel - 弯道等级
      * @param {number} riskCount - 风险因素数量
      * @returns {Object} 权重配置
      */
     _calculateAdaptiveWeights(curveLevel, riskCount) {
         const baseWeights = {
             closure: 0.35,
             efficiency: 0.25,
             geometry: 0.20,
             consistency: 0.10,
             stability: 0.05,
             complexity: 0.05
         };
         
         // 根据弯道等级调整权重
         if (curveLevel === 'extreme') {
             baseWeights.stability += 0.05;
             baseWeights.consistency += 0.05;
             baseWeights.efficiency -= 0.05;
             baseWeights.geometry -= 0.05;
         } else if (curveLevel === 'straight') {
             baseWeights.efficiency += 0.10;
             baseWeights.closure += 0.05;
             baseWeights.stability -= 0.05;
             baseWeights.complexity -= 0.10;
         }
         
         // 根据风险因素调整权重
         if (riskCount > 2) {
             baseWeights.closure += 0.10;
             baseWeights.stability += 0.05;
             baseWeights.efficiency -= 0.10;
             baseWeights.geometry -= 0.05;
         }
         
         return baseWeights;
     },
     
     /**
      * 计算方位角
      * @param {Array} point1 - 起始点 [lng, lat]
      * @param {Array} point2 - 目标点 [lng, lat]
      * @returns {number} 方位角(度)
      */
     /**
       * 计算路线复杂度
       * @param {number} targetDistance - 目标距离
       * @param {string} curveLevel - 弯道等级
       * @param {Object} contextData - 上下文数据
       * @returns {number} 复杂度因子 (0-1)
       */
      _calculateRouteComplexity(targetDistance, curveLevel, contextData) {
          let complexity = 0;
          
          // 弯道等级复杂度
          const curveComplexity = {
              'low': 0.2,
              'medium': 0.5,
              'high': 0.8,
              'extreme': 1.0
          };
          complexity += (curveComplexity[curveLevel] || 0.5) * 0.4;
          
          // 距离复杂度
          const distanceComplexity = Math.min(1.0, targetDistance / 50000); // 50km为最高复杂度
          complexity += distanceComplexity * 0.3;
          
          // 上下文复杂度
          if (contextData.terrain_difficulty) {
              complexity += contextData.terrain_difficulty * 0.2;
          }
          if (contextData.weather_conditions) {
              complexity += contextData.weather_conditions * 0.1;
          }
          
          return Math.min(1.0, complexity);
      },
      
      /**
       * 评估地理复杂度
       * @param {Object} contextData - 上下文数据
       * @returns {number} 地理复杂度 (0-1)
       */
      _assessGeographicComplexity(contextData) {
          let complexity = 0.5; // 默认中等复杂度
          
          if (contextData.elevation_change) {
              complexity += Math.min(0.3, contextData.elevation_change / 1000); // 1000m为最高
          }
          if (contextData.terrain_type) {
              const terrainComplexity = {
                  'flat': 0.1,
                  'hilly': 0.3,
                  'mountainous': 0.6,
                  'extreme': 0.9
              };
              complexity += (terrainComplexity[contextData.terrain_type] || 0.3) * 0.2;
          }
          
          return Math.min(1.0, complexity);
      },
      
      /**
       * 分析历史性能
       * @param {number} previousAttempts - 之前尝试次数
       * @param {Object} contextData - 上下文数据
       * @returns {number} 历史性能指标 (0-1)
       */
      _analyzeHistoricalPerformance(previousAttempts, contextData) {
          let performance = 1.0 - (previousAttempts * 0.15); // 每次失败降低15%
          
          if (contextData.success_rate) {
              performance = (performance + contextData.success_rate) / 2;
          }
          
          return Math.max(0.1, Math.min(1.0, performance));
      },
      
      /**
       * 分析路线特征
       * @param {number} targetDistance - 目标距离
       * @param {string} curveLevel - 弯道等级
       * @returns {Object} 路线特征分析
       */
      _analyzeRouteCharacteristics(targetDistance, curveLevel) {
          return {
              distance_category: targetDistance < 5000 ? 'short' : targetDistance < 15000 ? 'medium' : 'long',
              curve_intensity: curveLevel,
              estimated_difficulty: utils._estimateRouteDifficulty(targetDistance, curveLevel),
              optimization_potential: utils._assessOptimizationPotential(targetDistance, curveLevel)
          };
      },
      
      /**
       * 计算环境压力指数
       * @param {Object} factors - 环境因素
       * @returns {number} 环境压力指数 (0-1)
       */
      _calculateEnvironmentalStress(factors) {
          const weights = {
              geographic: 0.4,
              historical: 0.4,
              route: 0.2
          };
          
          const routeStress = factors.route.estimated_difficulty;
          
          return (factors.geographic * weights.geographic + 
                  (1 - factors.historical) * weights.historical + 
                  routeStress * weights.route);
      },
      
      /**
       * 生成策略候选池
       * @param {Object} config - 配置
       * @param {Object} environmentalFactors - 环境因素
       * @returns {Array} 策略候选
       */
      _generateStrategyCandidates(config, environmentalFactors) {
          const candidates = [];
          
          // 基础策略
          config.preferred_strategies.forEach((strategyName, index) => {
              candidates.push({
                  name: strategyName,
                  type: 'base',
                  optimizationLevel: index + 1,
                  features: this._getStrategyFeatures(strategyName),
                  priority: config.preferred_strategies.length - index
              });
          });
          
          // 环境适应策略
          if (environmentalFactors.adaptation_urgency === 'high') {
              candidates.push({
                  name: 'emergency_adaptive',
                  type: 'emergency',
                  optimizationLevel: 5,
                  features: ['aggressive_adjustment', 'rapid_convergence'],
                  priority: 10
              });
          }
          
          return candidates;
      },
      
      /**
       * 策略评分
       * @param {Object} strategy - 策略
       * @param {Object} context - 上下文
       * @returns {number} 策略得分
       */
      _scoreStrategy(strategy, context) {
          let score = strategy.priority * 10; // 基础优先级分数
          
          // 环境适应性加分
          if (context.environmentalFactors.adaptation_urgency === 'high' && 
              strategy.features.includes('aggressive_adjustment')) {
              score += 20;
          }
          
          // 重试次数调整
          if (context.previousAttempts > 2 && strategy.type === 'emergency') {
              score += 15;
          }
          
          // 弯道等级匹配
          if (this._isStrategyOptimalForCurve(strategy, context.curveLevel)) {
              score += 10;
          }
          
          return score;
      },
      
      /**
       * 计算策略置信度
       * @param {Object} strategy - 策略
       * @param {Object} environmentalFactors - 环境因素
       * @returns {number} 置信度 (0-1)
       */
      _calculateStrategyConfidence(strategy, environmentalFactors) {
          let confidence = 0.7; // 基础置信度
          
          if (environmentalFactors.historical_performance > 0.8) {
              confidence += 0.2;
          }
          if (environmentalFactors.environmental_stress < 0.3) {
              confidence += 0.1;
          }
          
          return Math.min(1.0, confidence);
      },
      
      /**
       * 生成后备策略
       * @param {Array} scoredStrategies - 评分策略列表
       * @param {Object} optimalStrategy - 最优策略
       * @returns {Array} 后备策略
       */
      _generateFallbackStrategies(scoredStrategies, optimalStrategy) {
          return scoredStrategies
              .filter(s => s.name !== optimalStrategy.name)
              .sort((a, b) => b.score - a.score)
              .slice(0, 2)
              .map(s => ({ name: s.name, type: s.type }));
      },
      
      /**
       * 计算环境调整因子
       * @param {Object} environmentalFactors - 环境因素
       * @returns {Object} 调整因子
       */
      _calculateEnvironmentalAdjustment(environmentalFactors) {
          const stress = environmentalFactors.environmental_stress;
          
          return {
              closure: 1 + stress * 0.5, // 压力大时放宽闭合要求
              angle: 1 - stress * 0.1,   // 压力大时减少角度覆盖
              radius: 1 - stress * 0.05   // 压力大时减少半径调整
          };
      },
      
      /**
       * 计算重试调整因子
       * @param {number} previousAttempts - 之前尝试次数
       * @returns {Object} 调整因子
       */
      _calculateRetryAdjustment(previousAttempts) {
          const factor = Math.min(0.3, previousAttempts * 0.1);
          
          return {
              closure: 1 + factor,     // 重试次数多时放宽要求
              angle: 1 - factor * 0.5, // 重试次数多时调整角度
              radius: 1 - factor * 0.3  // 重试次数多时调整半径
          };
      },
      
      /**
       * 计算距离调整因子
       * @param {number} targetDistance - 目标距离
       * @returns {Object} 调整因子
       */
      _calculateDistanceAdjustment(targetDistance) {
          const longDistance = targetDistance > 20000;
          
          return {
              closure: longDistance ? 1.2 : 1.0,
              angle: longDistance ? 0.95 : 1.0,
              radius: longDistance ? 0.9 : 1.0
          };
      },
      
      /**
       * 获取策略特征
       * @param {string} strategyName - 策略名称
       * @returns {Array} 策略特征
       */
      _getStrategyFeatures(strategyName) {
          const features = {
              'conservative': ['high_precision', 'low_risk'],
              'precision': ['ultra_precision', 'minimal_deviation'],
              'micro_adaptive': ['fine_tuning', 'micro_adjustments'],
              'elliptical': ['shape_optimization', 'geometric_balance'],
              'adaptive': ['dynamic_adjustment', 'learning_capability'],
              'hybrid_optimization': ['multi_approach', 'best_of_both'],
              'spiral': ['progressive_closure', 'spiral_optimization'],
              'progressive_refinement': ['iterative_improvement', 'gradual_optimization'],
              'multi_phase': ['phase_separation', 'complex_handling'],
              'intelligent_segmentation': ['smart_division', 'segment_optimization']
          };
          
          return features[strategyName] || ['standard'];
      },
      
      /**
       * 估算路线难度
       * @param {number} targetDistance - 目标距离
       * @param {string} curveLevel - 弯道等级
       * @returns {number} 难度系数 (0-1)
       */
      _estimateRouteDifficulty(targetDistance, curveLevel) {
          const distanceFactor = Math.min(1.0, targetDistance / 30000);
          const curveFactor = {
              'low': 0.2,
              'medium': 0.5,
              'high': 0.8,
              'extreme': 1.0
          }[curveLevel] || 0.5;
          
          return (distanceFactor + curveFactor) / 2;
      },
      
      /**
       * 评估优化潜力
       * @param {number} targetDistance - 目标距离
       * @param {string} curveLevel - 弯道等级
       * @returns {number} 优化潜力 (0-1)
       */
      _assessOptimizationPotential(targetDistance, curveLevel) {
          // 中等距离和中等弯道有最高优化潜力
          const distanceOptimal = targetDistance >= 5000 && targetDistance <= 20000;
          const curveOptimal = curveLevel === 'medium' || curveLevel === 'high';
          
          return (distanceOptimal ? 0.6 : 0.4) + (curveOptimal ? 0.4 : 0.2);
      },
      
      /**
       * 判断策略是否适合特定弯道等级
       * @param {Object} strategy - 策略
       * @param {string} curveLevel - 弯道等级
       * @returns {boolean} 是否适合
       */
      _isStrategyOptimalForCurve(strategy, curveLevel) {
          const optimalMappings = {
              'conservative': ['low', 'medium'],
              'precision': ['low'],
              'elliptical': ['medium', 'high'],
              'spiral': ['high', 'extreme'],
              'adaptive': ['medium', 'high', 'extreme']
          };
          
          return optimalMappings[strategy.name]?.includes(curveLevel) || false;
      },



      _calculateBearing(point1, point2) {
         const lat1Rad = point1[1] * Math.PI / 180;
         const lat2Rad = point2[1] * Math.PI / 180;
         const deltaLngRad = (point2[0] - point1[0]) * Math.PI / 180;
         
         const y = Math.sin(deltaLngRad) * Math.cos(lat2Rad);
         const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad);
         
         const bearing = Math.atan2(y, x) * 180 / Math.PI;
         return (bearing + 360) % 360;
     },
     
     /**
      * 计算平均半径
      * @param {Array} points - 点数组
      * @param {Array} center - 中心点
      * @returns {number} 平均半径
      */
     _calculateAverageRadius(points, center) {
         if (points.length === 0) return 0;
         
         const distances = points.map(point => 
             utils._calculateHighPrecisionDistance(center, point)
         );
         
         return distances.reduce((sum, d) => sum + d, 0) / distances.length;
     },

     /**
      * 计算角度分布
      * @param {Array} points - 点数组
      * @param {Array} center - 中心点
      * @returns {number} 角度分布评分
      */
     _calculateAngleSpread(points, center) {
         if (points.length < 2) return 0;
         
         const angles = points.map(point => {
             const dx = point[0] - center[0];
             const dy = point[1] - center[1];
             return Math.atan2(dy, dx) * 180 / Math.PI;
         });
         
         // 计算角度间隔的标准差
         angles.sort((a, b) => a - b);
         const intervals = [];
         for (let i = 1; i < angles.length; i++) {
             intervals.push(angles[i] - angles[i-1]);
         }
         
         if (intervals.length === 0) return 0;
         
         const expectedInterval = 360 / points.length;
         const variance = intervals.reduce((sum, interval) => 
             sum + Math.pow(interval - expectedInterval, 2), 0
         ) / intervals.length;
         
         return Math.max(0, 1 - Math.sqrt(variance) / expectedInterval);
     },

     /**
      * 评估几何评分
      * @param {number} averageRadius - 平均半径
      * @param {number} angleSpread - 角度分布
      * @param {number} targetDistance - 目标距离
      * @returns {number} 几何评分
      */
     _evaluateGeometryScore(averageRadius, angleSpread, targetDistance) {
         const expectedRadius = targetDistance / (2 * Math.PI); // 理想圆形的半径
         const radiusScore = Math.max(0, 1 - Math.abs(averageRadius - expectedRadius) / expectedRadius);
         
         return (radiusScore + angleSpread) / 2;
     },

     /**
      * 分析路径凸性
      * @param {Array} coordinates - 坐标数组
      * @returns {Object} 凸性分析结果
      */
     _analyzePathConvexity(coordinates) {
         if (!coordinates || coordinates.length < 3) {
             return { isConvex: false, convexityScore: 0, violations: [] };
         }

         const violations = [];
         let crossProductSum = 0;
         let signChanges = 0;
         let lastSign = 0;

         for (let i = 0; i < coordinates.length; i++) {
             const p1 = coordinates[i];
             const p2 = coordinates[(i + 1) % coordinates.length];
             const p3 = coordinates[(i + 2) % coordinates.length];

             const crossProduct = (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]);
             crossProductSum += Math.abs(crossProduct);

             const currentSign = Math.sign(crossProduct);
             if (currentSign !== 0 && lastSign !== 0 && currentSign !== lastSign) {
                 signChanges++;
                 violations.push({ index: i, crossProduct });
             }
             if (currentSign !== 0) lastSign = currentSign;
         }

         const isConvex = signChanges <= 2; // 允许少量符号变化
         const convexityScore = Math.max(0, 1 - signChanges / coordinates.length);

         return { isConvex, convexityScore, violations };
     },

     _calculateCircularity(coordinates, center) {
         if (!coordinates || coordinates.length < 3) return 0;
         
         const distances = coordinates.map(coord => {
             const point = [coord[0], coord[1]];
             const centerPoint = [center[0], center[1]];
             return utils._calculateHighPrecisionDistance(centerPoint, point);
         });
         
         const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
         
         // 计算距离的标准差
         const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgDistance, 2), 0) / distances.length;
         const stdDev = Math.sqrt(variance);
         
         // 圆形度 = 1 - (标准差 / 平均距离)
         return Math.max(0, 1 - (stdDev / avgDistance));
     },

     /**
      * 计算路径的对称性
      * @param {Array} coordinates - 路径坐标数组
      * @param {Array} center - 路径中心点 [lng, lat]
      * @returns {number} 对称性评分 (0-1)
      */
     _calculatePathSymmetry(coordinates, center) {
         if (!coordinates || coordinates.length < 4) return 0;
         
         const halfLength = Math.floor(coordinates.length / 2);
         let symmetryScore = 0;
         const centerPoint = [center[0], center[1]];
         
         for (let i = 0; i < halfLength; i++) {
             const point1 = [coordinates[i][0], coordinates[i][1]];
             const point2 = [coordinates[coordinates.length - 1 - i][0], coordinates[coordinates.length - 1 - i][1]];
             
             const dist1 = utils._calculateHighPrecisionDistance(centerPoint, point1);
             const dist2 = utils._calculateHighPrecisionDistance(centerPoint, point2);
             
             const symmetryRatio = 1 - Math.abs(dist1 - dist2) / Math.max(dist1, dist2);
             symmetryScore += symmetryRatio;
         }
         
         return symmetryScore / halfLength;
     },

     /**
      * 计算路径的均匀性
      * @param {Array} coordinates - 路径坐标数组
      * @param {Array} center - 路径中心点 [lng, lat]
      * @returns {number} 均匀性评分 (0-1)
      */
     _calculatePathUniformity(coordinates, center) {
         if (!coordinates || coordinates.length < 3) return 0;
         
         const angles = [];
         
         for (let i = 0; i < coordinates.length; i++) {
             const bearing = utils._calculateBearing(center, coordinates[i]);
             angles.push(bearing);
         }
         
         // 计算相邻角度差
         const angleDiffs = [];
         for (let i = 0; i < angles.length; i++) {
             const nextIndex = (i + 1) % angles.length;
             let diff = Math.abs(angles[nextIndex] - angles[i]);
             if (diff > 180) diff = 360 - diff;
             angleDiffs.push(diff);
         }
         
         const expectedAngleDiff = 360 / coordinates.length;
         const avgDiff = angleDiffs.reduce((sum, d) => sum + Math.abs(d - expectedAngleDiff), 0) / angleDiffs.length;
         
         return Math.max(0, 1 - (avgDiff / expectedAngleDiff));
     },

     /**
      * 计算路径的紧凑度
      * @param {Array} coordinates - 路径坐标数组
      * @param {number} targetDistance - 目标距离
      * @returns {number} 紧凑度评分 (0-1)
      */
     _calculatePathCompactness(coordinates, targetDistance) {
         if (!coordinates || coordinates.length < 3) return 0;
         
         // 计算路径包围的近似面积（使用鞋带公式）
         let area = 0;
         for (let i = 0; i < coordinates.length; i++) {
             const j = (i + 1) % coordinates.length;
             area += coordinates[i][0] * coordinates[j][1];
             area -= coordinates[j][0] * coordinates[i][1];
         }
         area = Math.abs(area) / 2;
         
         // 理想圆形的面积
         const idealRadius = targetDistance / (2 * Math.PI);
         const idealArea = Math.PI * idealRadius * idealRadius;
         
         // 紧凑度 = min(实际面积/理想面积, 理想面积/实际面积)
         const compactnessRatio = area > 0 ? Math.min(area / idealArea, idealArea / area) : 0;
         
         return Math.max(0, Math.min(1, compactnessRatio));
     }
};

/**
 * Blucap
 * 一个用于生成有趣和风景优美的驾驶路线的 JavaScript 库
 * 基于 GraphHopper API
 * 
 * @author Your Name
 * @version 1.0.0
 */
class Blucap {
    /**
     * 创建 Blucap 实例
     * @param {Object} config - 配置对象
     */
    constructor(options = {}) {
        this.config = {
            apiKey: options.apiKey || '',
            host: options.host || 'https://graphhopper.com/api/1',
            timeout: options.timeout || 15000,
            profile: options.profile || 'car',
            locale: options.locale || 'en',
            instructions: options.instructions !== false,
            points_encoded: options.points_encoded !== false,
            elevation: options.elevation || false,
            // 趣味路线特有参数
            distance_range: [50000, 500000], // 50km - 500km (单位：米)
            curve_level: "medium", // 弯道等级: "low", "medium", "high"
            route_type: "roundtrip", // "roundtrip" 或 "point_to_point"
            ...options
        };
        
        if (!this.config.apiKey) {
            throw new Error('GraphHopper API key is required');
        }
        
        // 增强的弯道等级配置
        this.curveSettings = {
            "low": {
                avoid_highways: false,
                prefer_scenic: false,
                detour_factor: 1.1,
                spiral_intensity: 0.3,
                randomness_factor: 0.4,
                min_segment_angle: 45
            },
            "medium": {
                avoid_highways: true,
                prefer_scenic: true,
                detour_factor: 1.3,
                spiral_intensity: 0.6,
                randomness_factor: 0.7,
                min_segment_angle: 30
            },
            "high": {
                avoid_highways: true,
                prefer_scenic: true,
                detour_factor: 1.6,
                spiral_intensity: 0.8,
                randomness_factor: 1.0,
                min_segment_angle: 20
            }
        };
    }

    /**
     * 生成趣味路线
     * @param {Object} reqArgs - 请求参数
     * @param {Array} reqArgs.start_point - 起始点 [lng, lat]
     * @param {Array} reqArgs.end_point - 终点 [lng, lat] (可选，roundtrip时不需要)
     * @param {number} reqArgs.target_distance - 目标距离(米)
     * @param {string} reqArgs.curve_level - 弯道等级
     * @param {string} reqArgs.route_type - 路线类型
     * @param {number} reqArgs.start_bearing - 起始方向(度) (可选)
     */
    async generateFunRoute(reqArgs) {
        // 应用默认值
        const params = {
            profile: this.config.profile,
            locale: this.config.locale,
            points_encoded: this.config.points_encoded,
            instructions: this.config.instructions,
            elevation: this.config.elevation,
            curve_level: this.config.curve_level,
            route_type: this.config.route_type,
            ...reqArgs
        };
        
        // 验证参数
        if (!params.start_point || !Array.isArray(params.start_point)) {
            throw new Error("起始点参数无效");
        }
        
        if (params.route_type === "point_to_point" && (!params.end_point || !Array.isArray(params.end_point))) {
            throw new Error("点对点路线需要提供终点");
        }
        
        if (params.target_distance < 50000 || params.target_distance > 500000) {
            throw new Error("目标距离必须在50-500km之间");
        }
        
        if (params.route_type === "roundtrip") {
            return this._generateRoundTrip(params);
        } else {
            return this._generatePointToPoint(params);
        }
    }
    
    /**
     * 生成环形趣味路线
     * @param {Object} options - 路线配置选项
     * @param {Array} options.startPoint - 起始点 [lat, lng]
     * @param {number} options.distance - 目标距离 (km)
     * @param {string} options.curveLevel - 弯道等级: 'low', 'medium', 'high'
     * @param {number} options.startBearing - 起始方向 (度)
     * @returns {Promise} 路线数据
     */
    async generateRoundTrip(options) {
        const { startPoint, distance, curveLevel = 'medium', startBearing = 0 } = options;
        
        if (!startPoint || !Array.isArray(startPoint) || startPoint.length !== 2) {
            throw new Error('startPoint must be an array of [lat, lng]');
        }
        
        if (!distance || distance < 50 || distance > 500) {
            throw new Error('distance must be between 50 and 500 km');
        }

        // 转换为新API格式
        return this.generateFunRoute({
            start_point: [startPoint[1], startPoint[0]], // 转换为 [lng, lat]
            target_distance: distance * 1000, // 转换为米
            curve_level: curveLevel,
            route_type: "roundtrip",
            start_bearing: startBearing
        });
    }

    /**
     * 生成点对点趣味路线
     * @param {Object} options - 路线配置选项
     * @param {Array} options.startPoint - 起始点 [lat, lng]
     * @param {Array} options.endPoint - 终点 [lat, lng]
     * @param {string} options.curveLevel - 弯道等级: 'low', 'medium', 'high'
     * @param {number} options.targetDistance - 目标距离 (km, 可选)
     * @returns {Promise} 路线数据
     */
    async generatePointToPoint(options) {
        const { startPoint, endPoint, curveLevel = 'medium', targetDistance } = options;
        
        if (!startPoint || !Array.isArray(startPoint) || startPoint.length !== 2) {
            throw new Error('startPoint must be an array of [lat, lng]');
        }
        
        if (!endPoint || !Array.isArray(endPoint) || endPoint.length !== 2) {
            throw new Error('endPoint must be an array of [lat, lng]');
        }

        let routePoints = [startPoint, endPoint];
        
        // 如果指定了目标距离，添加绕行点
        if (targetDistance) {
            if (targetDistance < 50 || targetDistance > 500) {
                throw new Error('targetDistance must be between 50 and 500 km');
            }
            
            const detourPoints = this._generateDetourPoints(
                startPoint, endPoint, targetDistance * 1000, curveLevel
            );
            routePoints = [startPoint, ...detourPoints, endPoint];
        }
        
        return this._requestRoute(routePoints, curveLevel);
    }

    /**
     * 生成环形路线
     */
    async _generateRoundTrip(reqArgs) {
        const startPoint = reqArgs.start_point;
        const targetDistance = reqArgs.target_distance;
        const curveLevel = reqArgs.curve_level || "medium";
        const startBearing = reqArgs.start_bearing || 0;
        
        // 生成中间点来创建环形路线
        const intermediatePoints = this._generateIntermediatePoints(
            startPoint, 
            targetDistance, 
            curveLevel,
            startBearing
        );
        
        // 构建路线点数组 (起点 -> 中间点们 -> 起点)
        // GraphHopper API限制：最多5个点（包括起点和终点）
        const maxIntermediatePoints = Math.min(intermediatePoints.length, 3);
        const limitedIntermediatePoints = intermediatePoints.slice(0, maxIntermediatePoints);
        const routePoints = [startPoint, ...limitedIntermediatePoints, startPoint];
        
        const routeRequest = {
            points: routePoints,
            profile: reqArgs.profile,
            instructions: reqArgs.instructions,
            points_encoded: reqArgs.points_encoded,
            elevation: reqArgs.elevation,
            locale: reqArgs.locale
        };
        
        // 应用弯道设置
        this._applyCurveSettings(routeRequest, curveLevel);
        
        const result = await this._doRouteRequest(routeRequest);
        
        // 环形闭合验证和优化
        const validationResult = this._validateCircularClosure(result, startPoint, targetDistance);
        
        // 原路折返检测
        const backtrackingResult = this._detectBacktracking(result);
        
        // 路径平滑处理
        const smoothedResult = this._applySmoothingAlgorithm(result, curveLevel);
        
        // 执行多层次路径验证
        const multiLevelValidation = this._performMultiLevelValidation(result, {
            target_distance: targetDistance,
            curve_level: curveLevel,
            closure_validation: validationResult,
            backtracking_analysis: backtrackingResult,
            smoothing_result: smoothedResult
        });
        
        // 计算路径质量评分
        const qualityScore = this._calculatePathQualityScore({
            closure_validation: validationResult,
            backtracking_analysis: backtrackingResult,
            smoothing_result: smoothedResult,
            validation_result: multiLevelValidation,
            route_result: result,
            target_distance: targetDistance,
            curve_level: curveLevel
        });
        
        result.route_info = {
            type: "roundtrip",
            target_distance: targetDistance,
            actual_distance: result.paths[0].distance,
            curve_level: curveLevel,
            start_bearing: startBearing,
            closure_validation: validationResult,
            backtracking_analysis: backtrackingResult,
            smoothing_applied: smoothedResult.applied,
            smoothing_stats: smoothedResult.stats,
            multi_level_validation: multiLevelValidation,
            quality_score: qualityScore
        };
        
        // 如果多层次验证不通过或质量评分过低，启动智能重试机制
        if (!multiLevelValidation.overall_passed || qualityScore.overall_score < 0.6) {
            const retryResult = await this._intelligentRetryMechanism({
                original_result: result,
                start_point: startPoint,
                target_distance: targetDistance,
                curve_level: curveLevel,
                quality_score: qualityScore,
                validation_result: multiLevelValidation
            });
            
            if (retryResult && retryResult.route_info.quality_score.overall_score > qualityScore.overall_score) {
                return retryResult;
            }
        }
        
        return result;
    }
    
    /**
     * 生成点对点路线
     */
    async _generatePointToPoint(reqArgs) {
        const startPoint = reqArgs.start_point;
        const endPoint = reqArgs.end_point;
        const targetDistance = reqArgs.target_distance;
        const curveLevel = reqArgs.curve_level || "medium";
        
        // 首先计算直线距离
        const directDistance = this._calculateDistance(startPoint, endPoint);
        
        if (directDistance > targetDistance) {
            throw new Error("起终点直线距离超过目标距离");
        }
        
        // 生成中间点来增加路线长度和弯道
        const intermediatePoints = this._generateDetourPoints(
            startPoint, 
            endPoint, 
            targetDistance, 
            curveLevel
        );
        
        // GraphHopper API限制：最多5个点（包括起点和终点）
        const maxIntermediatePoints = Math.min(intermediatePoints.length, 3);
        const limitedIntermediatePoints = intermediatePoints.slice(0, maxIntermediatePoints);
        const routePoints = [startPoint, ...limitedIntermediatePoints, endPoint];
        
        const routeRequest = {
            points: routePoints,
            profile: reqArgs.profile,
            instructions: reqArgs.instructions,
            points_encoded: reqArgs.points_encoded,
            elevation: reqArgs.elevation,
            locale: reqArgs.locale
        };
        
        // 应用弯道设置
        this._applyCurveSettings(routeRequest, curveLevel);
        
        const result = await this._doRouteRequest(routeRequest);
        result.route_info = {
            type: "point_to_point",
            target_distance: targetDistance,
            actual_distance: result.paths[0].distance,
            direct_distance: directDistance,
            curve_level: curveLevel
        };
        return result;
    }
    
    /**
     * 为环形路线生成中间点（改进的螺旋式算法）
     */
    _generateIntermediatePoints(startPoint, targetDistance, curveLevel, startBearing) {
        const points = [];
        const numPoints = this._calculateOptimalPointCount(targetDistance, curveLevel);
        const baseRadius = this._calculateBaseRadius(targetDistance, curveLevel);
        
        // 使用改进的自然角度分布策略
        const startAngle = startBearing || 0;
        const angleDistribution = this._calculateNaturalAngleDistribution(numPoints, curveLevel);
        
        for (let i = 0; i < numPoints; i++) {
            // 计算当前点的角度（自然分布）
            const currentAngle = startAngle + angleDistribution[i];
            
            // 使用多层半径策略，创建更自然的环形
            const radiusVariation = this._calculateCircularRadius(baseRadius, i, numPoints, curveLevel);
            
            // 计算基础圆周点
            const circularPoint = this._calculatePointAtDistance(startPoint, radiusVariation, currentAngle);
            
            // 应用智能偏移，避免过于规则的圆形
            const enhancedPoint = this._applyCircularOffset(circularPoint, radiusVariation, curveLevel, i, currentAngle);
            
            points.push(enhancedPoint);
        }
        
        return points;
    }
    
    /**
     * 计算自然角度分布
     * @param {number} numPoints - 点数量
     * @param {string} curveLevel - 弯道等级
     * @returns {Array} 角度分布数组
     */
    _calculateNaturalAngleDistribution(numPoints, curveLevel) {
        const angles = [];
        const goldenAngle = 137.508; // 黄金角度，创造自然螺旋
        
        // 根据弯道等级调整分布策略
        const distributionStrategy = {
            'low': 'uniform',      // 低弯道：均匀分布
            'medium': 'golden',    // 中弯道：黄金角度分布
            'high': 'fibonacci'    // 高弯道：斐波那契分布
        };
        
        const strategy = distributionStrategy[curveLevel] || 'golden';
        
        switch (strategy) {
            case 'uniform':
                return this._generateUniformAngles(numPoints);
            case 'golden':
                return this._generateGoldenAngles(numPoints, goldenAngle);
            case 'fibonacci':
                return this._generateFibonacciAngles(numPoints);
            default:
                return this._generateGoldenAngles(numPoints, goldenAngle);
        }
    }
    
    /**
     * 生成均匀角度分布
     * @param {number} numPoints - 点数量
     * @returns {Array} 角度数组
     */
    _generateUniformAngles(numPoints) {
        const angles = [];
        const angleStep = 360 / (numPoints + 1);
        
        for (let i = 0; i < numPoints; i++) {
            angles.push((i + 1) * angleStep);
        }
        
        return angles;
    }
    
    /**
     * 生成黄金角度分布
     * @param {number} numPoints - 点数量
     * @param {number} goldenAngle - 黄金角度
     * @returns {Array} 角度数组
     */
    _generateGoldenAngles(numPoints, goldenAngle) {
        const angles = [];
        let currentAngle = 0;
        
        for (let i = 0; i < numPoints; i++) {
            currentAngle += goldenAngle;
            // 添加轻微的随机变化，使分布更自然
            const variation = (Math.random() - 0.5) * 10; // ±5度变化
            angles.push((currentAngle + variation) % 360);
        }
        
        return angles.sort((a, b) => a - b); // 按角度排序
    }
    
    /**
     * 生成斐波那契角度分布
     * @param {number} numPoints - 点数量
     * @returns {Array} 角度数组
     */
    _generateFibonacciAngles(numPoints) {
        const angles = [];
        const phi = (1 + Math.sqrt(5)) / 2; // 黄金比例
        
        for (let i = 0; i < numPoints; i++) {
            // 使用斐波那契螺旋公式
            const angle = (i * 360 / phi) % 360;
            // 添加基于斐波那契数列的变化
            const fibVariation = this._getFibonacciVariation(i) * 5;
            angles.push((angle + fibVariation) % 360);
        }
        
        return angles.sort((a, b) => a - b);
    }
    
    /**
     * 获取斐波那契变化值
     * @param {number} index - 索引
     * @returns {number} 变化值
     */
    _getFibonacciVariation(index) {
        if (index <= 1) return index;
        
        let a = 0, b = 1;
        for (let i = 2; i <= index; i++) {
            const temp = a + b;
            a = b;
            b = temp;
        }
        
        return (b % 10) - 5; // 将斐波那契数转换为-5到5的变化值
    }

    /**
     * 计算最优中间点数量
     */
    _calculateOptimalPointCount(targetDistance, curveLevel) {
        const baseCount = curveLevel === "high" ? 4 : (curveLevel === "medium" ? 3 : 2);
        const distanceFactor = Math.min(Math.max(targetDistance / 100000, 0.5), 2); // 50-200km范围调整
        const calculatedCount = Math.round(baseCount * distanceFactor);
        // GraphHopper API限制：最多4个中间点（加上起点总共5个点）
        return Math.min(calculatedCount, 4);
    }

    /**
     * 计算基础半径
     */
    _calculateBaseRadius(targetDistance, curveLevel) {
        // 更保守的半径计算，避免路径过于紧密
        const circumferenceFactor = curveLevel === "high" ? 3.5 : (curveLevel === "medium" ? 3.0 : 2.5);
        return (targetDistance / 1000) / circumferenceFactor;
    }

    /**
     * 确定螺旋方向
     */
    _determineSpiralDirection(startBearing) {
        // 基于起始方向智能选择螺旋方向，避免不自然的路径
        return (startBearing >= 0 && startBearing < 180) ? 1 : -1; // 1为顺时针，-1为逆时针
    }

    /**
     * 计算圆周半径变化
     */
    _calculateCircularRadius(baseRadius, index, totalPoints, curveLevel) {
        // 创建多层半径分布，避免完美圆形
        const radiusVariation = curveLevel === "high" ? 0.3 : (curveLevel === "medium" ? 0.2 : 0.15);
        const minRadius = baseRadius * (1 - radiusVariation);
        const maxRadius = baseRadius * (1 + radiusVariation);
        
        // 使用正弦波创建自然的半径变化
        const wavePhase = (index / totalPoints) * 2 * Math.PI;
        const waveAmplitude = (maxRadius - minRadius) / 2;
        const averageRadius = (minRadius + maxRadius) / 2;
        
        return averageRadius + Math.sin(wavePhase) * waveAmplitude;
    }

    /**
     * 应用圆周智能偏移
     */
    _applyCircularOffset(point, radius, curveLevel, index, currentAngle) {
        // 基于角度的智能偏移，确保环形的自然性
        const offsetMagnitude = Math.min(radius * 0.08, 2000); // 进一步减少偏移幅度
        const offsetScale = curveLevel === "high" ? 0.6 : (curveLevel === "medium" ? 0.4 : 0.3);
        
        // 使用改进的自然变化算法
        const naturalVariation = this._calculateNaturalVariation(index, currentAngle, radius);
        const offsetAngle = currentAngle + 90 + naturalVariation.angleOffset;
        const offsetDistance = offsetMagnitude * offsetScale * naturalVariation.distanceMultiplier;
        
        const offsetPoint = this._calculatePointAtDistance(point, offsetDistance, offsetAngle);
        return offsetPoint;
    }
    
    /**
     * 计算自然变化
     * @param {number} index - 点索引
     * @param {number} angle - 角度
     * @param {number} radius - 半径
     * @returns {Object} 变化参数
     */
    _calculateNaturalVariation(index, angle, radius) {
        // 使用多重正弦波叠加创造更自然的变化
        const wave1 = Math.sin(angle * Math.PI / 180) * 30; // 基础波动
        const wave2 = Math.cos(angle * Math.PI / 180 + index * 0.5) * 20; // 次级波动
        const wave3 = Math.sin(angle * Math.PI / 90 + index * 0.3) * 15; // 高频波动
        
        // 添加基于黄金比例的微调
        const goldenRatio = (1 + Math.sqrt(5)) / 2;
        const goldenVariation = Math.sin(index * goldenRatio) * 10;
        
        // 计算角度偏移
        const angleOffset = wave1 + wave3 + goldenVariation;
        
        // 计算距离倍数（保持在合理范围内）
        const distanceMultiplier = 0.7 + (wave2 + goldenVariation) / 100;
        
        return {
            angleOffset: Math.max(-45, Math.min(45, angleOffset)), // 限制角度偏移范围
            distanceMultiplier: Math.max(0.5, Math.min(1.2, distanceMultiplier)) // 限制距离倍数范围
        };
    }

    /**
     * 计算螺旋式半径（保留用于兼容性）
     */
    _calculateSpiralRadius(baseRadius, progress, curveLevel) {
        // 螺旋式半径分布，内圈到外圈渐进
        const minRadius = baseRadius * 0.4;
        const maxRadius = baseRadius * 1.2;
        const spiralFactor = curveLevel === "high" ? 0.8 : (curveLevel === "medium" ? 0.6 : 0.4);
        
        return minRadius + (maxRadius - minRadius) * Math.pow(progress, spiralFactor);
    }

    /**
     * 计算螺旋式角度（保留用于兼容性）
     */
    _calculateSpiralAngle(startBearing, progress, spiralDirection, curveLevel) {
        // 非均匀角度分布，增加路径的自然性
        const totalAngle = curveLevel === "high" ? 300 : (curveLevel === "medium" ? 270 : 240);
        const angleVariation = (Math.sin(progress * Math.PI) * 30); // 正弦波动
        
        return startBearing + (spiralDirection * totalAngle * progress) + angleVariation;
    }

    /**
     * 应用增强的随机偏移（保留用于兼容性）
     */
    _applyEnhancedOffset(point, radius, curveLevel, index) {
        // 基于半径和弯道等级的智能偏移
        const offsetMagnitude = Math.min(radius * 0.15, 5000); // 最大5km偏移
        const offsetScale = curveLevel === "high" ? 1.0 : (curveLevel === "medium" ? 0.7 : 0.4);
        
        // 使用更自然的偏移模式
        const offsetAngle = (index * 137.5) % 360; // 黄金角度分布
        const offsetDistance = offsetMagnitude * offsetScale * (0.5 + Math.random() * 0.5);
        
        const offsetPoint = this._calculatePointAtDistance(point, offsetDistance, offsetAngle);
        return offsetPoint;
    }

    /**
     * 为点对点路线生成绕行点
     */
    _generateDetourPoints(startPoint, endPoint, targetDistance, curveLevel) {
        const points = [];
        const directDistance = this._calculateDistance(startPoint, endPoint);
        const extraDistance = targetDistance - directDistance;
        
        if (extraDistance <= 0) return points;
        
        let numDetours = curveLevel === "high" ? 2 : (curveLevel === "medium" ? 1 : 1);
        // GraphHopper API限制：最多4个中间点（加上起点和终点总共6个点，但对于点对点路线，最多4个中间点）
        numDetours = Math.min(numDetours, 4);
        
        for (let i = 0; i < numDetours; i++) {
            const progress = (i + 1) / (numDetours + 1);
            const midPoint = [
                startPoint[0] + (endPoint[0] - startPoint[0]) * progress,
                startPoint[1] + (endPoint[1] - startPoint[1]) * progress
            ];
            
            // 垂直于主方向的偏移
            const bearing = utils._calculateBearing(startPoint, endPoint);
            const perpBearing = bearing + 90 + (Math.random() - 0.5) * 60; // 添加随机性
            const offsetDistance = (extraDistance / numDetours) * 0.3; // 偏移距离
            
            const detourPoint = this._calculatePointAtDistance(midPoint, offsetDistance, perpBearing);
            points.push(detourPoint);
        }
        
        return points;
    }

    /**
     * 执行路线请求
     */
    async _doRouteRequest(routeRequest, retryCount = 0) {
        const url = `${this.config.host}/route?key=${this.config.apiKey}`;
        const maxRetries = 3;
        const baseDelay = 1000; // 1秒基础延迟
        
        try {
            const response = await httpClient.post(url, routeRequest, {
                headers: {'Content-Type': 'application/json'}
            });
            
            const data = response.data;
            
            if (data.paths) {
                for (let i = 0; i < data.paths.length; i++) {
                    const path = data.paths[i];
                    // 转换编码的路径点
                    if (path.points_encoded && typeof path.points === 'string') {
                        // 简化的解码逻辑，实际项目中可能需要更完整的实现
                        path.points = {
                            "type": "LineString", 
                            "coordinates": this._decodePolyline(path.points)
                        };
                    }
                    
                    if (path.snapped_waypoints && typeof path.snapped_waypoints === 'string') {
                        path.snapped_waypoints = {
                            "type": "LineString", 
                            "coordinates": this._decodePolyline(path.snapped_waypoints)
                        };
                    }
                }
            }
            
            return data;
        } catch (error) {
            if (error.response) {
                const status = error.response.status;
                
                // 处理429错误（请求过于频繁）
                if (status === 429 && retryCount < maxRetries) {
                    const delay = baseDelay * Math.pow(2, retryCount); // 指数退避
                    console.warn(`API请求频率限制，${delay}ms后重试 (第${retryCount + 1}/${maxRetries}次)`);
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this._doRouteRequest(routeRequest, retryCount + 1);
                }
                
                // 处理其他可重试的服务器错误
                if ((status >= 500 || status === 502 || status === 503 || status === 504) && retryCount < maxRetries) {
                    const delay = baseDelay * Math.pow(1.5, retryCount); // 较小的指数退避
                    console.warn(`服务器错误 ${status}，${delay}ms后重试 (第${retryCount + 1}/${maxRetries}次)`);
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this._doRouteRequest(routeRequest, retryCount + 1);
                }
                
                throw new Error(`GraphHopper API Error: ${status} - ${error.response.data.message || error.response.statusText}`);
            } else if (error.request) {
                // 网络错误也可以重试
                if (retryCount < maxRetries) {
                    const delay = baseDelay * Math.pow(1.5, retryCount);
                    console.warn(`网络错误，${delay}ms后重试 (第${retryCount + 1}/${maxRetries}次)`);
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this._doRouteRequest(routeRequest, retryCount + 1);
                }
                
                throw new Error('Network Error: Unable to reach GraphHopper API');
            } else {
                throw new Error(`Request Error: ${error.message}`);
            }
        }
    }
    
    /**
     * 发送路线请求到 GraphHopper API
     */
    async _requestRoute(points, curveLevel) {
        // 转换坐标格式：从 [lat, lng] 转换为 GraphHopper API 期望的 [lng, lat]
        const convertedPoints = points.map(point => [point[1], point[0]]);
        
        const routeRequest = {
            points: convertedPoints,
            profile: this.config.profile,
            instructions: true,
            points_encoded: true,
            elevation: false,
            locale: this.config.locale
        };
        
        // 应用弯道设置
        this._applyCurveSettings(routeRequest, curveLevel);
        
        return this._doRouteRequest(routeRequest);
    }
    
    /**
     * 简化的 Polyline 解码
     */
    _decodePolyline(encoded) {
        // 这是一个简化版本，实际使用中建议使用专门的polyline解码库
        const coordinates = [];
        let index = 0, lat = 0, lng = 0;
        
        while (index < encoded.length) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;
            
            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;
            
            coordinates.push([lng / 1e5, lat / 1e5]);
        }
        
        return coordinates;
    }

    /**
     * 应用弯道设置到路线请求（兼容免费套餐）
     */
    _applyCurveSettings(routeRequest, curveLevel) {
        const settings = this.curveSettings[curveLevel] || this.curveSettings["medium"];
        
        // 基础避让策略（免费套餐兼容）
        if (settings.avoid_highways && curveLevel !== "low") {
            routeRequest.avoid = "motorway";
        }
        
        // 基础路径权重策略
        if (settings.prefer_scenic) {
            routeRequest.weighting = "shortest";
        } else {
            routeRequest.weighting = "fastest";
        }
        
        return routeRequest;
    }

    /**
     * 计算两点间距离（米）
     */
    _calculateDistance(point1, point2) {
        const R = 6371000; // 地球半径(米)
        const lat1Rad = point1[1] * Math.PI / 180;
        const lat2Rad = point2[1] * Math.PI / 180;
        const deltaLatRad = (point2[1] - point1[1]) * Math.PI / 180;
        const deltaLngRad = (point2[0] - point1[0]) * Math.PI / 180;

        const a = Math.sin(deltaLatRad/2) * Math.sin(deltaLatRad/2) +
                Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                Math.sin(deltaLngRad/2) * Math.sin(deltaLngRad/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }
    
    /**
     * 计算方位角
     */
    _calculateBearing(point1, point2) {
        const lat1Rad = point1[1] * Math.PI / 180;
        const lat2Rad = point2[1] * Math.PI / 180;
        const deltaLngRad = (point2[0] - point1[0]) * Math.PI / 180;
        
        const y = Math.sin(deltaLngRad) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad);
        
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }
    
    /**
     * 根据距离和方位角计算新点
     */
    _calculatePointAtDistance(point, distance, bearing) {
        const R = 6371000; // 地球半径(米)
        const lat1Rad = point[1] * Math.PI / 180;
        const lng1Rad = point[0] * Math.PI / 180;
        const bearingRad = bearing * Math.PI / 180;
        
        const lat2Rad = Math.asin(Math.sin(lat1Rad) * Math.cos(distance/R) +
                               Math.cos(lat1Rad) * Math.sin(distance/R) * Math.cos(bearingRad));
        
        const lng2Rad = lng1Rad + Math.atan2(Math.sin(bearingRad) * Math.sin(distance/R) * Math.cos(lat1Rad),
                                          Math.cos(distance/R) - Math.sin(lat1Rad) * Math.sin(lat2Rad));
        
        return [lng2Rad * 180 / Math.PI, lat2Rad * 180 / Math.PI];
    }
    
    /**
     * 验证环形路线的闭合度（优化版）
     * @param {Object} routeResult - 路线结果
     * @param {Array} startPoint - 起始点 [lng, lat]
     * @param {number} targetDistance - 目标距离
     * @returns {Object} 验证结果
     */
    _validateCircularClosure(routeResult, startPoint, targetDistance) {
        if (!routeResult.paths || !routeResult.paths[0] || !routeResult.paths[0].points) {
            return {
                is_valid: false,
                closure_distance: Infinity,
                closure_ratio: 0,
                error: "无效的路线数据"
            };
        }
        
        const path = routeResult.paths[0];
        const coordinates = path.points.coordinates || [];
        
        if (coordinates.length < 2) {
            return {
                is_valid: false,
                closure_distance: Infinity,
                closure_ratio: 0,
                error: "路径点数量不足"
            };
        }
        
        // 获取路径的起点和终点
        const routeStart = coordinates[0];
        const routeEnd = coordinates[coordinates.length - 1];
        
        // 优化的闭合距离计算 - 使用高精度算法
        const closureDistance = utils._calculateHighPrecisionDistance(routeStart, routeEnd);
        
        // 动态计算最大可接受距离 - 更严格的标准
        const maxAcceptableDistance = utils._calculateDynamicClosureThreshold(targetDistance);
        const closureRatio = Math.max(0, 1 - (closureDistance / maxAcceptableDistance));
        
        // 验证起点是否接近原始起点
        const startPointDistance = utils._calculateHighPrecisionDistance(startPoint, routeStart);
        
        // 增强的几何验证
        const geometryAnalysis = this._analyzeRouteGeometry(coordinates, startPoint, targetDistance);
        
        // 多维度闭合质量评估
        const closureQualityMetrics = utils._calculateAdvancedClosureMetrics({
            routeStart,
            routeEnd,
            startPoint,
            coordinates,
            targetDistance,
            closureDistance,
            startPointDistance
        });
        
        // 综合评估环形质量
        const overallValidity = this._evaluateEnhancedCircularQuality({
            closureDistance,
            startPointDistance,
            geometryAnalysis,
            targetDistance,
            closureMetrics: closureQualityMetrics,
            coordinates
        });
        
        return {
            is_valid: overallValidity.is_valid,
            closure_distance: closureDistance,
            closure_ratio: closureRatio,
            start_point_deviation: startPointDistance,
            route_start: routeStart,
            route_end: routeEnd,
            total_points: coordinates.length,
            geometry_analysis: geometryAnalysis,
            circular_quality_score: overallValidity.quality_score,
            closure_quality_metrics: closureQualityMetrics,
            closure_grade: utils._calculateClosureGrade(closureDistance, targetDistance),
            recommendations: overallValidity.recommendations,
            max_acceptable_distance: maxAcceptableDistance
        };
    }
    
    /**
     * 分析路径几何特征
     * @param {Array} coordinates - 路径坐标数组
     * @param {Object} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @returns {Object} 几何分析结果
     */
    _analyzeRouteGeometry(coordinates, startPoint, targetDistance) {
        // 计算路径中心点
        const center = utils._calculateRouteCenter(coordinates);
        
        // 分析路径的圆形度
        const circularity = utils._calculateCircularity(coordinates, center);
        
        // 分析路径的对称性
        const symmetry = utils._calculatePathSymmetry(coordinates, center);
        
        // 分析路径的均匀性
        const uniformity = utils._calculatePathUniformity(coordinates, center);
        
        // 检测路径的凸性（是否为凸多边形）
        const convexity = utils._analyzePathConvexity(coordinates);
        
        // 计算路径的紧凑度
        const compactness = utils._calculatePathCompactness(coordinates, targetDistance);
        
        return {
            center,
            circularity,
            symmetry,
            uniformity,
            convexity,
            compactness,
            overall_geometry_score: (circularity + symmetry + uniformity + convexity + compactness) / 5
        };
    }
    
    /**
     * 评估环形路线的整体质量（增强版）
     * @param {Object} params - 评估参数
     * @returns {Object} 质量评估结果
     */
    _evaluateEnhancedCircularQuality(params) {
        const { closureDistance, startPointDistance, geometryAnalysis, targetDistance, closureMetrics, coordinates } = params;
        
        // 动态闭合度评分 - 基于目标距离自适应调整
        const dynamicThreshold = utils._calculateDynamicClosureThreshold(targetDistance);
        const closureScore = Math.max(0, 1 - (closureDistance / dynamicThreshold));
        
        // 起点偏差评分 - 更严格的标准
        const maxStartDeviation = Math.min(targetDistance * 0.005, 100); // 目标距离的0.5%或100米
        const startDeviationScore = Math.max(0, 1 - (startPointDistance / maxStartDeviation));
        
        // 几何形状评分
        const geometryScore = geometryAnalysis.overall_geometry_score;
        
        // 闭合质量指标评分
        const closureMetricsScore = utils._scoreClosureMetrics(closureMetrics);
        
        // 路径连续性评分
        const continuityScore = utils._evaluatePathContinuity(closureMetrics);
        
        // 综合质量评分 - 调整权重分配
        const qualityScore = (
            closureScore * 0.35 +           // 闭合度权重增加
            startDeviationScore * 0.25 +    // 起点偏差权重增加
            geometryScore * 0.25 +          // 几何形状权重
            closureMetricsScore * 0.10 +    // 闭合指标权重
            continuityScore * 0.05          // 连续性权重
        );
        
        // 生成详细的改进建议
        const recommendations = utils._generateEnhancedRecommendations({
            closureScore,
            startDeviationScore,
            geometryAnalysis,
            closureMetrics,
            continuityScore,
            targetDistance
        });
        
        // 更严格的验证标准
        const enhancedValidation = utils._validateEnhancedClosure({
            qualityScore,
            closureDistance,
            startPointDistance,
            targetDistance,
            closureMetrics,
            coordinates
        });
        
        return {
            is_valid: enhancedValidation.passed,
            quality_score: qualityScore,
            enhanced_validation: enhancedValidation,
            component_scores: {
                closure: closureScore,
                start_deviation: startDeviationScore,
                geometry: geometryScore,
                closure_metrics: closureMetricsScore,
                continuity: continuityScore
            },
            recommendations: [...recommendations, ...enhancedValidation.improvement_suggestions],
            quality_grade: utils._calculateQualityGrade(qualityScore),
            validation_details: {
                overall_validation_score: enhancedValidation.overall_score,
                validation_breakdown: enhancedValidation.validation_scores,
                failure_reasons: enhancedValidation.failure_reasons
            }
        };
    }
    
    /**
     * 优化环形路线的闭合度（渐进式优化）
     * @param {Object} originalRequest - 原始路线请求
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @returns {Object|null} 优化后的路线结果或null
     */
    async _optimizeCircularClosure(originalRequest, startPoint, targetDistance, curveLevel) {
        const maxRetries = 5; // 增加重试次数
        const dynamicThreshold = utils._calculateDynamicClosureThreshold(targetDistance);
        let bestResult = null;
        let bestValidation = null;
        
        console.log(`开始渐进式闭合优化，目标阈值: ${dynamicThreshold.toFixed(1)}米`);
        
        for (let retry = 0; retry < maxRetries; retry++) {
            try {
                // 渐进式优化策略
                const optimizationStrategy = this._selectOptimizationStrategy(retry, targetDistance, curveLevel);
                
                // 生成优化的中间点
                const optimizedPoints = this._generateProgressiveOptimizedPoints(
                    startPoint, 
                    targetDistance, 
                    curveLevel, 
                    retry,
                    optimizationStrategy
                );
                
                // 构建优化的路线请求
                const maxOptimizedPoints = Math.min(optimizedPoints.length, 3);
                const limitedOptimizedPoints = optimizedPoints.slice(0, maxOptimizedPoints);
                
                const optimizedRequest = {
                    ...originalRequest,
                    points: [startPoint, ...limitedOptimizedPoints, startPoint]
                };
                
                const result = await this._doRouteRequest(optimizedRequest);
                const validation = this._validateCircularClosure(result, startPoint, targetDistance);
                
                console.log(`重试 ${retry + 1}: 闭合距离 ${validation.closure_distance.toFixed(1)}米, 质量评分 ${validation.circular_quality_score.toFixed(3)}`);
                
                // 记录最佳结果
                if (!bestResult || validation.circular_quality_score > bestValidation.circular_quality_score) {
                    bestResult = result;
                    bestValidation = validation;
                }
                
                // 检查是否达到优化目标
                if (validation.closure_distance <= dynamicThreshold && validation.circular_quality_score >= 0.8) {
                    console.log(`闭合优化成功！闭合距离: ${validation.closure_distance.toFixed(1)}米`);
                    result.route_info = {
                        type: "roundtrip",
                        target_distance: targetDistance,
                        actual_distance: result.paths[0].distance,
                        curve_level: curveLevel,
                        closure_validation: validation,
                        optimization_retry: retry + 1,
                        optimization_strategy: optimizationStrategy,
                        optimized: true
                    };
                    return result;
                }
            } catch (error) {
                console.warn(`闭合优化重试 ${retry + 1} 失败:`, error.message);
            }
        }
        
        // 如果没有达到理想效果，尝试渐进式优化
        if (bestResult && bestValidation.closure_distance <= dynamicThreshold * 1.5) {
            console.log(`返回最佳优化结果，闭合距离: ${bestValidation.closure_distance.toFixed(1)}米`);
            bestResult.route_info = {
                type: "roundtrip",
                target_distance: targetDistance,
                actual_distance: bestResult.paths[0].distance,
                curve_level: curveLevel,
                closure_validation: bestValidation,
                optimization_retry: maxRetries,
                optimized: true,
                partial_optimization: true
            };
            return bestResult;
        }
        
        // 尝试渐进式闭合优化
        console.log('常规优化未达到理想效果，启动渐进式闭合优化...');
        const progressiveResult = await this._performProgressiveClosureOptimization(
            originalRequest, 
            startPoint, 
            targetDistance, 
            curveLevel
        );
        
        if (progressiveResult) {
            console.log('渐进式闭合优化成功');
            return progressiveResult;
        }
        
        console.warn('闭合优化失败，未能达到可接受的闭合质量');
        return null;
    }

    /**
     * 执行渐进式闭合优化
     * @param {Object} originalRequest - 原始路线请求
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @returns {Object|null} 优化后的路线结果
     */
    async _performProgressiveClosureOptimization(originalRequest, startPoint, targetDistance, curveLevel) {
        const maxIterations = 5;
        const convergenceThreshold = 0.95;
        let iterationHistory = [];
        let bestResult = null;
        let bestQuality = 0;
        
        console.log('开始渐进式闭合优化...');
        
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            console.log(`执行第 ${iteration + 1} 轮优化`);
            
            // 生成迭代策略
            const strategy = this._generateIterationStrategy(iteration, iterationHistory, targetDistance, curveLevel);
            
            // 执行迭代优化
            const iterationResult = await this._executeIterationOptimization(originalRequest, startPoint, targetDistance, curveLevel, iteration, strategy);
            
            if (iterationResult) {
                // 评估迭代质量
                const quality = this._assessIterationQuality(iterationResult, startPoint, targetDistance, curveLevel);
                
                // 记录迭代历史
                iterationHistory.push({
                    iteration,
                    quality,
                    strategy,
                    result: iterationResult,
                    timestamp: Date.now()
                });
                
                // 更新最佳结果
                if (quality > bestQuality) {
                    bestQuality = quality;
                    bestResult = iterationResult;
                }
                
                // 检查收敛性
                if (quality >= convergenceThreshold) {
                    console.log(`在第 ${iteration + 1} 轮达到收敛，质量评分: ${quality.toFixed(3)}`);
                    break;
                }
                
                // 检查改进停滞
                if (iteration >= 2) {
                    const recentQualities = iterationHistory.slice(-3).map(h => h.quality);
                    const improvement = Math.max(...recentQualities) - Math.min(...recentQualities);
                    if (improvement < 0.02) {
                        console.log('检测到改进停滞，提前结束优化');
                        break;
                    }
                }
            }
        }
        
        if (bestResult) {
            console.log(`渐进式优化完成，最佳质量评分: ${bestQuality.toFixed(3)}`);
            return {
                ...bestResult,
                optimizationReport: this._generateOptimizationReport(iterationHistory, bestQuality)
            };
        }
        
        console.warn('渐进式闭合优化失败');
        return null;
    }

    /**
     * 生成迭代策略
     * @param {number} iteration - 当前迭代次数
     * @param {Array} history - 迭代历史
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @returns {Object} 迭代策略
     */
    _generateIterationStrategy(iteration, history, targetDistance, curveLevel) {
        const baseStrategies = [
            { name: 'conservative', pointMultiplier: 1.0, radiusAdjustment: 1.0, angleVariation: 0.8 },
            { name: 'aggressive', pointMultiplier: 1.2, radiusAdjustment: 0.9, angleVariation: 1.2 },
            { name: 'balanced', pointMultiplier: 1.1, radiusAdjustment: 0.95, angleVariation: 1.0 },
            { name: 'precision', pointMultiplier: 1.3, radiusAdjustment: 0.85, angleVariation: 0.9 },
            { name: 'adaptive', pointMultiplier: 1.15, radiusAdjustment: 0.92, angleVariation: 1.1 }
        ];
        
        let strategy = baseStrategies[iteration % baseStrategies.length];
        
        // 基于历史结果调整策略
        if (history.length > 0) {
            const lastResult = history[history.length - 1];
            const convergenceAnalysis = this._analyzeConvergence(history);
            
            // 如果上次质量较低，增加激进程度
            if (lastResult.quality < 0.7) {
                strategy = {
                    ...strategy,
                    pointMultiplier: strategy.pointMultiplier * 1.1,
                    radiusAdjustment: strategy.radiusAdjustment * 0.95,
                    angleVariation: strategy.angleVariation * 1.15
                };
            }
            
            // 基于收敛分析调整
            if (convergenceAnalysis.trend === 'improving') {
                strategy.confidence = 0.8;
            } else if (convergenceAnalysis.trend === 'declining') {
                strategy = {
                    ...strategy,
                    pointMultiplier: strategy.pointMultiplier * 0.9,
                    radiusAdjustment: strategy.radiusAdjustment * 1.05,
                    confidence: 0.6
                };
            }
        }
        
        return {
            ...strategy,
            iteration,
            targetDistance,
            curveLevel,
            timestamp: Date.now()
        };
    }

    /**
     * 执行迭代优化
     * @param {Object} originalRequest - 原始请求
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @param {number} iteration - 迭代次数
     * @param {Object} strategy - 优化策略
     * @returns {Object|null} 迭代结果
     */
    async _executeIterationOptimization(originalRequest, startPoint, targetDistance, curveLevel, iteration, strategy) {
        try {
            // 调整请求参数
            const adjustedRequest = this._adjustRequestForIteration(originalRequest, strategy);
            
            // 生成优化的中间点
            const optimizedPoints = this._generateIterativeOptimizedPoints(startPoint, targetDistance, curveLevel, iteration, strategy);
            
            // 执行路线请求
            const routeResult = await this._requestRoute([startPoint, ...optimizedPoints], curveLevel);
            
            if (routeResult && routeResult.coordinates) {
                // 应用迭代后处理
                return this._applyIterationPostProcessing(routeResult, strategy, startPoint, targetDistance);
            }
            
            return null;
        } catch (error) {
            console.warn(`第 ${iteration + 1} 轮优化失败:`, error.message);
            return null;
        }
    }

    /**
     * 评估迭代质量
     * @param {Object} result - 迭代结果
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @returns {number} 质量评分
     */
    _assessIterationQuality(result, startPoint, targetDistance, curveLevel) {
        if (!result || !result.coordinates) {
            return 0;
        }
        
        const coordinates = result.coordinates;
        const endPoint = coordinates[coordinates.length - 1];
        
        // 计算基础指标
        const closureDistance = this._calculateDistance(startPoint, endPoint);
        const actualDistance = result.distance || utils._estimatePathDistance(coordinates);
        const closureRatio = closureDistance / targetDistance;
        
        // 计算高级闭合指标
        const advancedMetrics = utils._calculateAdvancedClosureMetrics({
            coordinates,
            startPoint,
            targetDistance,
            curveLevel
        });
        
        // 几何分析
        const geometryAnalysis = this._analyzeRouteGeometry(coordinates, startPoint, targetDistance);
        
        // 综合质量评估
        const qualityScore = this._calculateIterationQualityScore({
            closureRatio,
            actualDistance,
            targetDistance,
            advancedMetrics,
            geometryAnalysis,
            curveLevel
        });
        
        return Math.max(0, Math.min(1, qualityScore));
    }

    /**
     * 计算迭代质量评分
     * @param {Object} params - 评分参数
     * @returns {number} 质量评分
     */
    _calculateIterationQualityScore(params) {
        const { closureRatio, actualDistance, targetDistance, advancedMetrics, geometryAnalysis, curveLevel } = params;
        
        // 闭合质量权重 (40%)
        const closureScore = Math.max(0, 1 - Math.abs(closureRatio - 0.05) * 10);
        
        // 距离精度权重 (25%)
        const distanceAccuracy = Math.max(0, 1 - Math.abs(actualDistance - targetDistance) / targetDistance);
        
        // 几何质量权重 (20%)
        const geometryScore = (geometryAnalysis.circularity + geometryAnalysis.symmetry + geometryAnalysis.uniformity) / 3;
        
        // 高级指标权重 (15%)
        const advancedScore = utils._scoreClosureMetrics(advancedMetrics);
        
        return (
            closureScore * 0.4 +
            distanceAccuracy * 0.25 +
            geometryScore * 0.2 +
            advancedScore * 0.15
        );
    }

    /**
     * 生成渐进式优化的中间点
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @param {number} retryIndex - 重试索引
     * @param {Object} strategy - 优化策略
     * @returns {Array} 优化的中间点数组
     */
    _generateIterativeOptimizedPoints(startPoint, targetDistance, curveLevel, retryIndex, strategy) {
        const points = [];
        const numPoints = Math.floor(this._calculateOptimalPointCount(targetDistance, curveLevel) * strategy.pointMultiplier);
        
        // 基于策略调整参数
        const radiusAdjustment = strategy.radius_adjustment || (0.95 - (retryIndex * 0.05));
        const baseRadius = this._calculateBaseRadius(targetDistance, curveLevel) * radiusAdjustment;
        
        // 精确的角度分布计算
        const totalAngle = strategy.angle_coverage || 350; // 留10度间隙确保闭合
        const angleStep = totalAngle / (numPoints + 1);
        const startBearing = strategy.start_bearing || (Math.random() * 60); // 限制起始角度范围
        
        console.log(`生成优化点: 策略=${strategy.name}, 半径调整=${radiusAdjustment.toFixed(3)}, 角度覆盖=${totalAngle}°`);
        
        for (let i = 0; i < numPoints; i++) {
            const angle = startBearing + (angleStep * (i + 1));
            const progress = (i + 1) / (numPoints + 1);
            
            // 应用策略特定的半径变化
            let radius;
            switch (strategy.radius_pattern) {
                case 'uniform':
                    radius = baseRadius;
                    break;
                case 'elliptical':
                    radius = baseRadius * (0.9 + 0.2 * Math.cos(progress * Math.PI * 2));
                    break;
                case 'spiral':
                    radius = baseRadius * (0.8 + 0.4 * progress);
                    break;
                default:
                    radius = baseRadius * (0.85 + 0.3 * Math.sin(progress * Math.PI));
            }
            
            const point = this._calculatePointAtDistance(startPoint, radius, angle);
            
            // 应用策略特定的偏移
            if (strategy.apply_offset) {
                const offsetMagnitude = Math.min(radius * strategy.offset_ratio, strategy.max_offset);
                const offsetAngle = angle + (strategy.offset_angle || 90);
                const offsetDistance = offsetMagnitude * (0.7 + Math.random() * 0.3);
                
                const optimizedPoint = this._calculatePointAtDistance(point, offsetDistance, offsetAngle);
                points.push(optimizedPoint);
            } else {
                points.push(point);
            }
        }
        
        // 应用闭合预测调整
        if (strategy.closure_prediction) {
            return this._applyClosurePredictionAdjustment(points, startPoint, targetDistance);
        }
        
        return points;
    }

    /**
     * 调整请求参数以适应迭代策略
     * @param {Object} originalRequest - 原始请求
     * @param {Object} strategy - 迭代策略
     * @returns {Object} 调整后的请求
     */
    _adjustRequestForIteration(originalRequest, strategy) {
        const adjustedRequest = { ...originalRequest };
        
        // 基于策略调整路线偏好
        if (strategy.name === 'aggressive') {
            adjustedRequest.avoid_highways = false;
            adjustedRequest.prefer_scenic = true;
        } else if (strategy.name === 'conservative') {
            adjustedRequest.avoid_highways = true;
            adjustedRequest.prefer_main_roads = true;
        } else if (strategy.name === 'precision') {
            adjustedRequest.optimize_for = 'distance';
            adjustedRequest.tolerance = 'low';
        }
        
        // 调整路线复杂度
        if (strategy.pointMultiplier > 1.2) {
            adjustedRequest.complexity = 'high';
        } else if (strategy.pointMultiplier < 0.9) {
            adjustedRequest.complexity = 'low';
        }
        
        return adjustedRequest;
    }

    /**
     * 应用迭代后处理
     * @param {Object} routeResult - 路线结果
     * @param {Object} strategy - 策略
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @returns {Object} 处理后的结果
     */
    _applyIterationPostProcessing(routeResult, strategy, startPoint, targetDistance) {
        let processedResult = { ...routeResult };
        
        // 应用策略特定的后处理
        if (strategy.name === 'precision') {
            // 精确策略：应用额外的平滑处理
            processedResult = this._applySmoothingAlgorithm(processedResult, 'high');
        } else if (strategy.name === 'aggressive') {
            // 激进策略：保持更多的弯曲
            processedResult = this._applySmoothingAlgorithm(processedResult, 'low');
        }
        
        // 验证闭合质量
        const closureValidation = this._validateCircularClosure(processedResult, startPoint, targetDistance);
        processedResult.closureValidation = closureValidation;
        
        // 添加策略信息
        processedResult.strategy = strategy;
        processedResult.iterationTimestamp = Date.now();
        
        return processedResult;
    }

    /**
     * 分析收敛趋势
     * @param {Array} history - 迭代历史
     * @returns {Object} 收敛分析结果
     */
    _analyzeConvergence(history) {
        if (history.length < 2) {
            return { trend: 'unknown', confidence: 0 };
        }
        
        const recentQualities = history.slice(-3).map(h => h.quality);
        const qualityTrend = this._calculateTrend(recentQualities);
        
        let trend = 'stable';
        if (qualityTrend > 0.02) {
            trend = 'improving';
        } else if (qualityTrend < -0.02) {
            trend = 'declining';
        }
        
        // 计算收敛置信度
        const variance = this._calculateVariance(recentQualities);
        const confidence = Math.max(0, 1 - variance * 10);
        
        return {
            trend,
            confidence,
            qualityTrend,
            variance,
            recentQualities
        };
    }

    /**
     * 计算趋势
     * @param {Array} values - 数值数组
     * @returns {number} 趋势值
     */
    _calculateTrend(values) {
        if (values.length < 2) return 0;
        
        let sum = 0;
        for (let i = 1; i < values.length; i++) {
            sum += values[i] - values[i - 1];
        }
        
        return sum / (values.length - 1);
    }

    /**
     * 计算方差
     * @param {Array} values - 数值数组
     * @returns {number} 方差
     */
    _calculateVariance(values) {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        
        return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    }

    /**
     * 生成优化报告
     * @param {Array} iterationHistory - 迭代历史
     * @param {number} bestQuality - 最佳质量
     * @returns {Object} 优化报告
     */
    _generateOptimizationReport(iterationHistory, bestQuality) {
        const totalIterations = iterationHistory.length;
        const convergenceAnalysis = this._analyzeConvergence(iterationHistory);
        const strategyEffectiveness = this._analyzeStrategyEffectiveness(iterationHistory);
        
        return {
            summary: {
                totalIterations,
                bestQuality,
                convergenceAchieved: bestQuality >= 0.95,
                improvementRate: convergenceAnalysis.qualityTrend
            },
            convergence: convergenceAnalysis,
            strategies: strategyEffectiveness,
            recommendations: this._generateOptimizationRecommendations(iterationHistory, bestQuality),
            timestamp: Date.now()
        };
    }

    /**
     * 分析策略有效性
     * @param {Array} history - 迭代历史
     * @returns {Object} 策略分析结果
     */
    _analyzeStrategyEffectiveness(history) {
        const strategyPerformance = {};
        
        history.forEach(iteration => {
            const strategyName = iteration.strategy.name;
            if (!strategyPerformance[strategyName]) {
                strategyPerformance[strategyName] = {
                    count: 0,
                    totalQuality: 0,
                    bestQuality: 0,
                    averageQuality: 0
                };
            }
            
            const perf = strategyPerformance[strategyName];
            perf.count++;
            perf.totalQuality += iteration.quality;
            perf.bestQuality = Math.max(perf.bestQuality, iteration.quality);
            perf.averageQuality = perf.totalQuality / perf.count;
        });
        
        // 排序策略按效果
        const rankedStrategies = Object.entries(strategyPerformance)
            .sort(([,a], [,b]) => b.averageQuality - a.averageQuality)
            .map(([name, perf]) => ({ name, ...perf }));
        
        return {
            performance: strategyPerformance,
            ranked: rankedStrategies,
            mostEffective: rankedStrategies[0]?.name || 'unknown'
        };
    }

    /**
     * 生成优化建议
     * @param {Array} history - 迭代历史
     * @param {number} bestQuality - 最佳质量
     * @returns {Array} 建议列表
     */
    _generateOptimizationRecommendations(history, bestQuality) {
        const recommendations = [];
        
        if (bestQuality < 0.8) {
            recommendations.push({
                type: 'quality_improvement',
                message: '建议增加迭代次数或调整策略参数以提高闭合质量',
                priority: 'high'
            });
        }
        
        if (history.length >= 5 && bestQuality < 0.9) {
            recommendations.push({
                type: 'strategy_adjustment',
                message: '当前策略组合效果有限，建议尝试更激进的参数设置',
                priority: 'medium'
            });
        }
        
        const convergenceAnalysis = this._analyzeConvergence(history);
        if (convergenceAnalysis.trend === 'declining') {
            recommendations.push({
                type: 'convergence_issue',
                message: '检测到质量下降趋势，建议重新评估策略选择',
                priority: 'high'
            });
        }
        
        if (bestQuality >= 0.95) {
            recommendations.push({
                type: 'success',
                message: '优化成功达到高质量闭合标准',
                priority: 'info'
            });
        }
        
        return recommendations;
    }
     
     /**
      * 检测路径中的原路折返情况
      * @param {Object} routeResult - 路线结果
      * @returns {Object} 折返分析结果
      */
     _detectBacktracking(routeResult) {
         if (!routeResult.paths || !routeResult.paths[0] || !routeResult.paths[0].points) {
             return {
                 has_backtracking: false,
                 backtrack_ratio: 0,
                 backtrack_segments: [],
                 error: "无效的路线数据"
             };
         }
         
         const coordinates = routeResult.paths[0].points.coordinates || [];
         
         if (coordinates.length < 4) {
             return {
                 has_backtracking: false,
                 backtrack_ratio: 0,
                 backtrack_segments: [],
                 total_points: coordinates.length
             };
         }
         
         const backtrackSegments = [];
         const minBacktrackDistance = 100; // 降低最小折返检测距离(米)
         const angleThreshold = 120; // 降低角度阈值(度)，提高敏感度
         const microBacktrackThreshold = 90; // 微小回头路阈值(度)
         
         // 多层次分析路径段，检测不同程度的折返
         for (let i = 2; i < coordinates.length - 1; i++) {
             const prevPoint = coordinates[i - 2];
             const currentPoint = coordinates[i - 1];
             const nextPoint = coordinates[i];
             
             // 计算前后两段的方位角
             const bearing1 = utils._calculateBearing(prevPoint, currentPoint);
                const bearing2 = utils._calculateBearing(currentPoint, nextPoint);
             
             // 计算角度差
             let angleDiff = Math.abs(bearing2 - bearing1);
             if (angleDiff > 180) {
                 angleDiff = 360 - angleDiff;
             }
             
             const segmentDistance = this._calculateDistance(prevPoint, nextPoint);
             
             // 多层次检测：严重回头路和微小回头路
             let isBacktrack = false;
             let backtrackType = 'none';
             
             if (angleDiff > angleThreshold && segmentDistance > minBacktrackDistance) {
                 // 严重回头路检测
                 isBacktrack = this._verifyBacktrackSegment(
                     coordinates, i - 2, i, minBacktrackDistance
                 );
                 backtrackType = 'severe';
             } else if (angleDiff > microBacktrackThreshold && segmentDistance > minBacktrackDistance * 0.5) {
                 // 微小回头路检测（更敏感）
                 isBacktrack = this._verifyMicroBacktrack(
                     coordinates, i - 2, i, minBacktrackDistance * 0.5
                 );
                 backtrackType = 'micro';
             }
             
             if (isBacktrack) {
                 backtrackSegments.push({
                     start_index: i - 2,
                     end_index: i,
                     angle_change: angleDiff,
                     distance: segmentDistance,
                     type: backtrackType,
                     severity: this._calculateBacktrackSeverity(angleDiff, segmentDistance)
                 });
             }
         }
         
         // 计算折返比率
         const totalDistance = routeResult.paths[0].distance || 0;
         const backtrackDistance = backtrackSegments.reduce((sum, segment) => sum + segment.distance, 0);
         const backtrackRatio = totalDistance > 0 ? backtrackDistance / totalDistance : 0;
         
         return {
             has_backtracking: backtrackSegments.length > 0,
             backtrack_ratio: backtrackRatio,
             backtrack_segments: backtrackSegments,
             total_segments: backtrackSegments.length,
             total_backtrack_distance: backtrackDistance,
             severity_score: this._calculateOverallBacktrackSeverity(backtrackSegments),
             total_points: coordinates.length
         };
     }
     
     /**
      * 验证微小回头路
      * @param {Array} coordinates - 路径坐标数组
      * @param {number} startIdx - 起始索引
      * @param {number} endIdx - 结束索引
      * @param {number} minDistance - 最小距离阈值
      * @returns {boolean} 是否为微小回头路
      */
     _verifyMicroBacktrack(coordinates, startIdx, endIdx, minDistance) {
         const segmentStart = coordinates[startIdx];
         const segmentEnd = coordinates[endIdx];
         
         // 检查更小范围内的路径重叠
         const checkRange = Math.min(5, Math.floor(coordinates.length * 0.05));
         
         // 计算当前段的中点
         const midPoint = {
             lat: (segmentStart.lat + segmentEnd.lat) / 2,
             lng: (segmentStart.lng + segmentEnd.lng) / 2
         };
         
         // 检查前后路径是否与当前段过于接近
         for (let i = Math.max(0, startIdx - checkRange); i < startIdx; i++) {
             const checkPoint = coordinates[i];
             const distanceToMid = this._calculateDistance(checkPoint, midPoint);
             
             if (distanceToMid < minDistance * 0.3) {
                 return true;
             }
         }
         
         for (let i = endIdx + 1; i < Math.min(coordinates.length, endIdx + checkRange); i++) {
             const checkPoint = coordinates[i];
             const distanceToMid = this._calculateDistance(checkPoint, midPoint);
             
             if (distanceToMid < minDistance * 0.3) {
                 return true;
             }
         }
         
         return false;
     }
     
     /**
      * 验证折返段是否为真正的原路折返
      * @param {Array} coordinates - 路径坐标数组
      * @param {number} startIdx - 起始索引
      * @param {number} endIdx - 结束索引
      * @param {number} minDistance - 最小距离阈值
      * @returns {boolean} 是否为真正的折返
      */
     _verifyBacktrackSegment(coordinates, startIdx, endIdx, minDistance) {
         const segmentStart = coordinates[startIdx];
         const segmentEnd = coordinates[endIdx];
         
         // 检查前后一定范围内是否有重复经过的区域
         const checkRange = Math.min(10, Math.floor(coordinates.length * 0.1));
         
         for (let i = Math.max(0, startIdx - checkRange); i < startIdx; i++) {
             const checkPoint = coordinates[i];
             const distanceToEnd = this._calculateDistance(checkPoint, segmentEnd);
             
             // 如果终点接近之前经过的点，可能是折返
             if (distanceToEnd < minDistance * 0.5) {
                 return true;
             }
         }
         
         // 检查后续路径是否与当前段重叠
         for (let i = endIdx + 1; i < Math.min(coordinates.length, endIdx + checkRange); i++) {
             const checkPoint = coordinates[i];
             const distanceToStart = this._calculateDistance(checkPoint, segmentStart);
             
             if (distanceToStart < minDistance * 0.5) {
                 return true;
             }
         }
         
         return false;
     }
     
     /**
      * 计算单个折返段的严重程度
      * @param {number} angleChange - 角度变化
      * @param {number} distance - 折返距离
      * @returns {number} 严重程度评分 (0-1)
      */
     _calculateBacktrackSeverity(angleChange, distance) {
         // 角度因子：角度越大越严重
         const angleFactor = Math.min(angleChange / 180, 1);
         
         // 距离因子：距离越长越严重
         const distanceFactor = Math.min(distance / 5000, 1); // 5km为最大参考距离
         
         return (angleFactor * 0.7 + distanceFactor * 0.3);
     }
     
     /**
      * 计算整体折返严重程度
      * @param {Array} backtrackSegments - 折返段数组
      * @returns {number} 整体严重程度评分 (0-1)
      */
     _calculateOverallBacktrackSeverity(backtrackSegments) {
         if (backtrackSegments.length === 0) return 0;
         
         const avgSeverity = backtrackSegments.reduce((sum, segment) => sum + segment.severity, 0) / backtrackSegments.length;
         const countFactor = Math.min(backtrackSegments.length / 5, 1); // 5个折返段为最大参考
         
         return avgSeverity * 0.8 + countFactor * 0.2;
      }
      
      /**
       * 应用路径平滑算法
       * @param {Object} routeResult - 路线结果
       * @param {string} curveLevel - 弯道等级
       * @returns {Object} 平滑处理结果
       */
      _applySmoothingAlgorithm(routeResult, curveLevel) {
          if (!routeResult.paths || !routeResult.paths[0] || !routeResult.paths[0].points) {
              return {
                  applied: false,
                  stats: { error: "无效的路线数据" }
              };
          }
          
          const coordinates = routeResult.paths[0].points.coordinates || [];
          
          if (coordinates.length < 4) {
              return {
                  applied: false,
                  stats: { 
                      original_points: coordinates.length,
                      reason: "路径点数量不足，无需平滑"
                  }
              };
          }
          
          // 根据弯道等级确定平滑强度
          const smoothingIntensity = this._getSmoothingIntensity(curveLevel);
          
          // 检测需要平滑的尖锐转角
          const sharpCorners = this._detectSharpCorners(coordinates);
          
          if (sharpCorners.length === 0) {
              return {
                  applied: false,
                  stats: {
                      original_points: coordinates.length,
                      sharp_corners: 0,
                      reason: "未检测到需要平滑的尖锐转角"
                  }
              };
          }
          
          // 应用贝塞尔曲线平滑
          const smoothedCoordinates = this._applyBezierSmoothing(
              coordinates, 
              sharpCorners, 
              smoothingIntensity
          );
          
          // 更新路线数据
          routeResult.paths[0].points.coordinates = smoothedCoordinates;
          
          // 重新计算距离（简化估算）
          const newDistance = utils._estimatePathDistance(smoothedCoordinates);
          routeResult.paths[0].distance = newDistance;
          
          return {
              applied: true,
              stats: {
                  original_points: coordinates.length,
                  smoothed_points: smoothedCoordinates.length,
                  sharp_corners_smoothed: sharpCorners.length,
                  smoothing_intensity: smoothingIntensity,
                  distance_change: newDistance - (routeResult.paths[0].distance || 0)
              }
          };
      }
      
      /**
       * 获取平滑强度参数
       * @param {string} curveLevel - 弯道等级
       * @returns {Object} 平滑参数
       */
      _getSmoothingIntensity(curveLevel) {
          const intensityMap = {
              "low": {
                  angle_threshold: 120, // 角度阈值
                  control_point_ratio: 0.2, // 控制点距离比例
                  interpolation_points: 3 // 插值点数量
              },
              "medium": {
                  angle_threshold: 90,
                  control_point_ratio: 0.3,
                  interpolation_points: 5
              },
              "high": {
                  angle_threshold: 60,
                  control_point_ratio: 0.4,
                  interpolation_points: 7
              }
          };
          
          return intensityMap[curveLevel] || intensityMap["medium"];
      }
      
      /**
       * 检测路径中的尖锐转角
       * @param {Array} coordinates - 坐标数组
       * @returns {Array} 尖锐转角信息数组
       */
      _detectSharpCorners(coordinates) {
          const corners = [];
          const minSegmentLength = 50; // 降低最小段长度，提高敏感度
          
          for (let i = 1; i < coordinates.length - 1; i++) {
              const prevPoint = { lat: coordinates[i - 1][1], lng: coordinates[i - 1][0] };
              const currentPoint = { lat: coordinates[i][1], lng: coordinates[i][0] };
              const nextPoint = { lat: coordinates[i + 1][1], lng: coordinates[i + 1][0] };
              
              // 检查段长度
              const dist1 = this._calculateDistance(prevPoint, currentPoint);
              const dist2 = this._calculateDistance(currentPoint, nextPoint);
              
              if (dist1 < minSegmentLength || dist2 < minSegmentLength) {
                  continue;
              }
              
              // 计算转角
              const angle = this._calculateTurnAngle(prevPoint, currentPoint, nextPoint);
              
              // 多层次角度检测
              let isSharpCorner = false;
              let severity = 0;
              
              if (angle < 60) {
                  // 极尖锐转角
                  isSharpCorner = true;
                  severity = 1.0;
              } else if (angle < 90) {
                  // 尖锐转角
                  isSharpCorner = true;
                  severity = 0.8;
              } else if (angle < 120) {
                  // 中等尖锐转角
                  isSharpCorner = true;
                  severity = 0.6;
              } else if (angle < 140) {
                  // 轻微尖锐转角
                  isSharpCorner = true;
                  severity = 0.4;
              }
              
              if (isSharpCorner) {
                  corners.push({
                      index: i,
                      angle: angle,
                      point: coordinates[i],
                      prev_point: coordinates[i - 1],
                      next_point: coordinates[i + 1],
                      severity: severity,
                      category: this._categorizeCorner(angle)
                  });
              }
          }
          
          return corners;
      }
      
      /**
       * 分类转角类型
       * @param {number} angle - 转角度数
       * @returns {string} 转角类型
       */
      _categorizeCorner(angle) {
          if (angle < 60) return 'extreme';
          if (angle < 90) return 'sharp';
          if (angle < 120) return 'moderate';
          if (angle < 140) return 'mild';
          return 'normal';
      }
      
      /**
       * 计算三点间的转角
       * @param {Array} p1 - 第一个点
       * @param {Array} p2 - 中间点
       * @param {Array} p3 - 第三个点
       * @returns {number} 转角(度)
       */
      _calculateTurnAngle(p1, p2, p3) {
          const bearing1 = utils._calculateBearing(p2, p1);
          const bearing2 = utils._calculateBearing(p2, p3);
          
          let angle = Math.abs(bearing2 - bearing1);
          if (angle > 180) {
              angle = 360 - angle;
          }
          
          return angle;
      }
      
      /**
       * 应用贝塞尔曲线平滑
       * @param {Array} coordinates - 原始坐标
       * @param {Array} sharpCorners - 尖锐转角数组
       * @param {Object} intensity - 平滑强度参数
       * @returns {Array} 平滑后的坐标
       */
      _applyBezierSmoothing(coordinates, sharpCorners, intensity) {
          let smoothedCoords = [...coordinates];
          
          // 按严重程度排序，优先处理最严重的转角
          const sortedCorners = sharpCorners.sort((a, b) => b.severity - a.severity);
          
          // 从后往前处理，避免索引偏移问题
          for (let i = sortedCorners.length - 1; i >= 0; i--) {
              const corner = sortedCorners[i];
              
              // 根据转角类型调整平滑参数
              const adaptiveIntensity = this._getAdaptiveIntensity(corner, intensity);
              
              const smoothedSegment = this._createAdvancedBezierCurve(
                  corner.prev_point,
                  corner.point,
                  corner.next_point,
                  adaptiveIntensity,
                  corner.category
              );
              
              // 替换尖锐转角点
              smoothedCoords.splice(corner.index, 1, ...smoothedSegment);
          }
          
          return smoothedCoords;
      }
      
      /**
       * 获取自适应平滑强度
       * @param {Object} corner - 转角信息
       * @param {Object} baseIntensity - 基础强度参数
       * @returns {Object} 自适应强度参数
       */
      _getAdaptiveIntensity(corner, baseIntensity) {
          const severityMultiplier = {
              'extreme': 1.5,
              'sharp': 1.3,
              'moderate': 1.1,
              'mild': 0.9
          };
          
          const multiplier = severityMultiplier[corner.category] || 1.0;
          
          return {
              angle_threshold: baseIntensity.angle_threshold,
              control_point_ratio: Math.min(0.6, baseIntensity.control_point_ratio * multiplier),
              interpolation_points: Math.max(3, Math.floor(baseIntensity.interpolation_points * multiplier))
          };
      }
      
      /**
       * 创建高级贝塞尔曲线
       * @param {Array} p1 - 前一个点
       * @param {Array} p2 - 当前点
       * @param {Array} p3 - 下一个点
       * @param {Object} intensity - 强度参数
       * @param {string} category - 转角类型
       * @returns {Array} 平滑后的点数组
       */
      _createAdvancedBezierCurve(p1, p2, p3, intensity, category) {
          const points = [];
          const numPoints = intensity.interpolation_points;
          const controlRatio = intensity.control_point_ratio;
          
          // 转换为标准格式
          const point1 = { lat: p1[1], lng: p1[0] };
          const point2 = { lat: p2[1], lng: p2[0] };
          const point3 = { lat: p3[1], lng: p3[0] };
          
          // 计算控制点
          const dist1 = this._calculateDistance(point1, point2);
          const dist2 = this._calculateDistance(point2, point3);
          const avgDist = (dist1 + dist2) / 2;
          
          // 根据转角类型调整控制点策略
          let controlPoints;
          if (category === 'extreme' || category === 'sharp') {
              // 对于极尖锐转角，使用双控制点策略
              controlPoints = this._createDualControlPoints(point1, point2, point3, avgDist, controlRatio);
          } else {
              // 对于中等和轻微转角，使用单控制点策略
              controlPoints = this._createSingleControlPoint(point1, point2, point3, avgDist, controlRatio);
          }
          
          // 生成贝塞尔曲线点
          if (controlPoints.length === 1) {
              // 二次贝塞尔曲线
              for (let i = 0; i <= numPoints; i++) {
                  const t = i / numPoints;
                  const bezierPoint = this._calculateQuadraticBezierPoint(
                      [point1.lng, point1.lat],
                      [controlPoints[0].lng, controlPoints[0].lat],
                      [point3.lng, point3.lat],
                      t
                  );
                  points.push(bezierPoint);
              }
          } else {
              // 三次贝塞尔曲线
              for (let i = 0; i <= numPoints; i++) {
                  const t = i / numPoints;
                  const bezierPoint = this._calculateCubicBezierPoint(
                      [point1.lng, point1.lat],
                      [controlPoints[0].lng, controlPoints[0].lat],
                      [controlPoints[1].lng, controlPoints[1].lat],
                      [point3.lng, point3.lat],
                      t
                  );
                  points.push(bezierPoint);
              }
          }
          
          return points;
      }
      
      /**
        * 创建单控制点
        * @param {Object} p1 - 前一个点
        * @param {Object} p2 - 当前点
        * @param {Object} p3 - 下一个点
        * @param {number} avgDist - 平均距离
        * @param {number} controlRatio - 控制点比例
        * @returns {Array} 控制点数组
        */
       _createSingleControlPoint(p1, p2, p3, avgDist, controlRatio) {
           const controlDist = avgDist * controlRatio;
           const bearing1 = utils._calculateBearing(p2, p1);
           const bearing2 = utils._calculateBearing(p2, p3);
           const avgBearing = (bearing1 + bearing2) / 2;
           
           const controlPoint = this._calculatePointAtDistance(p2, controlDist, avgBearing);
           return [controlPoint];
       }
       
       /**
        * 创建双控制点（用于极尖锐转角）
        * @param {Object} p1 - 前一个点
        * @param {Object} p2 - 当前点
        * @param {Object} p3 - 下一个点
        * @param {number} avgDist - 平均距离
        * @param {number} controlRatio - 控制点比例
        * @returns {Array} 控制点数组
        */
       _createDualControlPoints(p1, p2, p3, avgDist, controlRatio) {
           const controlDist = avgDist * controlRatio;
           
           // 第一个控制点：朝向p1方向
           const bearing1 = this._calculateBearing(p2, p1);
           const control1 = this._calculatePointAtDistance(p2, controlDist * 0.7, bearing1);
           
           // 第二个控制点：朝向p3方向
           const bearing2 = this._calculateBearing(p2, p3);
           const control2 = this._calculatePointAtDistance(p2, controlDist * 0.7, bearing2);
           
           return [control1, control2];
       }
       
       /**
        * 计算三次贝塞尔曲线上的点
        * @param {Array} p0 - 起点
        * @param {Array} p1 - 第一个控制点
        * @param {Array} p2 - 第二个控制点
        * @param {Array} p3 - 终点
        * @param {number} t - 参数 (0-1)
        * @returns {Array} 贝塞尔曲线上的点
        */
       _calculateCubicBezierPoint(p0, p1, p2, p3, t) {
           const u = 1 - t;
           const tt = t * t;
           const uu = u * u;
           const uuu = uu * u;
           const ttt = tt * t;
           
           const x = uuu * p0[0] + 3 * uu * t * p1[0] + 3 * u * tt * p2[0] + ttt * p3[0];
           const y = uuu * p0[1] + 3 * uu * t * p1[1] + 3 * u * tt * p2[1] + ttt * p3[1];
           
           return [x, y];
       }
       
       /**
        * 执行多层次路径验证
        * @param {Object} routeResult - 路线结果
       * @param {Object} validationParams - 验证参数
       * @returns {Object} 多层次验证结果
       */
      _performMultiLevelValidation(routeResult, validationParams) {
          const {
              target_distance,
              curve_level,
              closure_validation,
              backtracking_analysis,
              smoothing_result
          } = validationParams;
          
          const validationResults = {
              closure_test: this._validateClosureQuality(closure_validation),
              distance_accuracy: this._validateDistanceAccuracy(routeResult, target_distance),
              path_smoothness: this._validatePathSmoothness(smoothing_result, curve_level),
              backtracking_severity: this._validateBacktrackingSeverity(backtracking_analysis),
              route_complexity: this._validateRouteComplexity(routeResult, curve_level)
          };
          
          // 计算综合评分
          const weights = {
              closure_test: 0.25,
              distance_accuracy: 0.20,
              path_smoothness: 0.20,
              backtracking_severity: 0.20,
              route_complexity: 0.15
          };
          
          let totalScore = 0;
          let passedTests = 0;
          
          Object.keys(validationResults).forEach(testName => {
              const testResult = validationResults[testName];
              totalScore += testResult.score * weights[testName];
              if (testResult.passed) passedTests++;
          });
          
          const overallPassed = totalScore >= 0.7 && passedTests >= 3;
          
          return {
              overall_passed: overallPassed,
              overall_score: totalScore,
              passed_tests: passedTests,
              total_tests: Object.keys(validationResults).length,
              test_results: validationResults,
              quality_grade: utils._calculateQualityGrade(totalScore),
              recommendations: this._generateValidationRecommendations(validationResults)
          };
      }
      
      /**
       * 验证闭合质量
       */
      _validateClosureQuality(closureValidation) {
          if (!closureValidation || !closureValidation.is_valid) {
              return { passed: false, score: 0, reason: "闭合验证失败" };
          }
          
          const closureDistance = closureValidation.closure_distance || Infinity;
          const closureRatio = closureValidation.closure_ratio || 0;
          
          let score = 0;
          if (closureDistance <= 200) score = 1.0;
          else if (closureDistance <= 500) score = 0.8;
          else if (closureDistance <= 1000) score = 0.5;
          else score = 0.2;
          
          return {
              passed: closureDistance <= 500,
              score: score,
              closure_distance: closureDistance,
              closure_ratio: closureRatio
          };
      }
      
      /**
       * 验证距离精度
       */
      _validateDistanceAccuracy(routeResult, targetDistance) {
          const actualDistance = routeResult.paths?.[0]?.distance || 0;
          const distanceDiff = Math.abs(actualDistance - targetDistance);
          const accuracyRatio = 1 - (distanceDiff / targetDistance);
          
          let score = Math.max(0, accuracyRatio);
          const tolerance = 0.15; // 15%容差
          const passed = accuracyRatio >= (1 - tolerance);
          
          return {
              passed: passed,
              score: score,
              target_distance: targetDistance,
              actual_distance: actualDistance,
              accuracy_ratio: accuracyRatio,
              distance_diff: distanceDiff
          };
      }
      
      /**
       * 验证路径平滑度
       */
      _validatePathSmoothness(smoothingResult, curveLevel) {
          if (!smoothingResult) {
              return { passed: false, score: 0, reason: "无平滑处理结果" };
          }
          
          const expectedSmoothness = {
              "low": 0.3,
              "medium": 0.6,
              "high": 0.8
          };
          
          const targetSmoothness = expectedSmoothness[curveLevel] || 0.5;
          
          let score = 0.5; // 基础分
          if (smoothingResult.applied) {
              const cornersSmoothed = smoothingResult.stats?.sharp_corners_smoothed || 0;
              if (cornersSmoothed > 0) {
                  score = Math.min(1.0, 0.5 + (cornersSmoothed * 0.1));
              }
          }
          
          return {
              passed: score >= targetSmoothness,
              score: score,
              smoothing_applied: smoothingResult.applied,
              target_smoothness: targetSmoothness
          };
      }
      
      /**
       * 验证折返严重程度
       */
      _validateBacktrackingSeverity(backtrackingAnalysis) {
          if (!backtrackingAnalysis) {
              return { passed: true, score: 1.0, reason: "无折返分析结果" };
          }
          
          const backtrackRatio = backtrackingAnalysis.backtrack_ratio || 0;
          const severityScore = backtrackingAnalysis.severity_score || 0;
          
          let score = Math.max(0, 1 - backtrackRatio * 2); // 折返比例越高分数越低
          score = Math.max(0, score - severityScore * 0.5); // 严重程度影响
          
          return {
              passed: backtrackRatio <= 0.1 && severityScore <= 0.3,
              score: score,
              backtrack_ratio: backtrackRatio,
              severity_score: severityScore
          };
      }
      
      /**
       * 验证路线复杂度
       */
      _validateRouteComplexity(routeResult, curveLevel) {
          const coordinates = routeResult.paths?.[0]?.points?.coordinates || [];
          const totalDistance = routeResult.paths?.[0]?.distance || 0;
          
          if (coordinates.length < 2 || totalDistance === 0) {
              return { passed: false, score: 0, reason: "路线数据不足" };
          }
          
          // 计算路径复杂度指标
          const pointDensity = coordinates.length / (totalDistance / 1000); // 每公里点数
          const expectedComplexity = {
              "low": { min: 5, max: 15 },
              "medium": { min: 10, max: 25 },
              "high": { min: 15, max: 35 }
          };
          
          const complexity = expectedComplexity[curveLevel] || expectedComplexity["medium"];
          const isInRange = pointDensity >= complexity.min && pointDensity <= complexity.max;
          
          let score = 0.5;
          if (isInRange) {
              score = 1.0;
          } else if (pointDensity < complexity.min) {
              score = pointDensity / complexity.min;
          } else {
              score = Math.max(0.2, complexity.max / pointDensity);
          }
          
          return {
              passed: isInRange,
              score: score,
              point_density: pointDensity,
              expected_range: complexity,
              total_points: coordinates.length
          };
      }
      
      /**
       * 计算质量等级
       */
      _calculateQualityGrade(totalScore) {
          if (totalScore >= 0.9) return "A+";
          if (totalScore >= 0.8) return "A";
          if (totalScore >= 0.7) return "B+";
          if (totalScore >= 0.6) return "B";
          if (totalScore >= 0.5) return "C+";
          if (totalScore >= 0.4) return "C";
          return "D";
      }
      
      /**
       * 生成验证建议
       */
      _generateValidationRecommendations(validationResults) {
          const recommendations = [];
          
          Object.keys(validationResults).forEach(testName => {
              const result = validationResults[testName];
              if (!result.passed) {
                  switch (testName) {
                      case "closure_test":
                          recommendations.push("建议调整中间点分布以改善环形闭合度");
                          break;
                      case "distance_accuracy":
                          recommendations.push("建议优化路径规划算法以提高距离精度");
                          break;
                      case "path_smoothness":
                          recommendations.push("建议增强路径平滑处理以减少尖锐转角");
                          break;
                      case "backtracking_severity":
                          recommendations.push("建议优化路径以减少原路折返");
                          break;
                      case "route_complexity":
                          recommendations.push("建议调整路线复杂度以匹配弯道等级要求");
                          break;
                  }
              }
          });
          
          return recommendations;
      }
      
      /**
        * 计算路径质量评分
        * @param {Object} scoreParams - 评分参数
        * @returns {Object} 质量评分结果
        */
       _calculatePathQualityScore(scoreParams) {
           const {
               closure_validation,
               backtracking_analysis,
               smoothing_result,
               validation_result,
               route_result,
               target_distance,
               curve_level
           } = scoreParams;
           
           // 基础质量指标评分
           const baseScores = {
               closure_quality: this._scoreClosureQuality(closure_validation),
               distance_precision: this._scoreDistancePrecision(route_result, target_distance),
               path_smoothness: this._scorePathSmoothness(smoothing_result, curve_level),
               backtrack_avoidance: this._scoreBacktrackAvoidance(backtracking_analysis),
               route_efficiency: this._scoreRouteEfficiency(route_result, target_distance)
           };
           
           // 高级质量指标评分
           const advancedScores = {
               geometric_consistency: this._scoreGeometricConsistency(route_result),
               curve_distribution: this._scoreCurveDistribution(route_result, curve_level),
               navigation_friendliness: this._scoreNavigationFriendliness(route_result)
           };
           
           // 权重配置
           const weights = {
               base: {
                   closure_quality: 0.25,
                   distance_precision: 0.20,
                   path_smoothness: 0.20,
                   backtrack_avoidance: 0.20,
                   route_efficiency: 0.15
               },
               advanced: {
                   geometric_consistency: 0.4,
                   curve_distribution: 0.35,
                   navigation_friendliness: 0.25
               }
           };
           
           // 计算基础评分
           let baseScore = 0;
           Object.keys(baseScores).forEach(key => {
               baseScore += baseScores[key] * weights.base[key];
           });
           
           // 计算高级评分
           let advancedScore = 0;
           Object.keys(advancedScores).forEach(key => {
               advancedScore += advancedScores[key] * weights.advanced[key];
           });
           
           // 综合评分 (基础评分占70%，高级评分占30%)
           const overallScore = baseScore * 0.7 + advancedScore * 0.3;
           
           // 计算质量等级和建议
           const qualityGrade = utils._calculateQualityGrade(overallScore);
           const improvements = this._generateQualityImprovements(baseScores, advancedScores);
           
           return {
               overall_score: Math.round(overallScore * 100) / 100,
               quality_grade: qualityGrade,
               base_scores: baseScores,
               advanced_scores: advancedScores,
               score_breakdown: {
                   base_weighted: Math.round(baseScore * 70),
                   advanced_weighted: Math.round(advancedScore * 30),
                   total: Math.round(overallScore * 100)
               },
               improvements: improvements,
               validation_passed: validation_result?.overall_passed || false
           };
       }
       
       /**
        * 评分闭合质量
        */
       _scoreClosureQuality(closureValidation) {
           if (!closureValidation || !closureValidation.is_valid) {
               return 0;
           }
           
           const closureDistance = closureValidation.closure_distance || Infinity;
           
           if (closureDistance <= 100) return 1.0;
           if (closureDistance <= 200) return 0.9;
           if (closureDistance <= 300) return 0.8;
           if (closureDistance <= 500) return 0.6;
           if (closureDistance <= 1000) return 0.3;
           return 0.1;
       }
       
       /**
        * 评分距离精度
        */
       _scoreDistancePrecision(routeResult, targetDistance) {
           const actualDistance = routeResult.paths?.[0]?.distance || 0;
           const deviation = Math.abs(actualDistance - targetDistance) / targetDistance;
           
           if (deviation <= 0.05) return 1.0; // 5%以内
           if (deviation <= 0.10) return 0.8; // 10%以内
           if (deviation <= 0.15) return 0.6; // 15%以内
           if (deviation <= 0.25) return 0.4; // 25%以内
           return 0.2;
       }
       
       /**
        * 评分路径平滑度
        */
       _scorePathSmoothness(smoothingResult, curveLevel) {
           if (!smoothingResult) return 0.5;
           
           const baseScore = smoothingResult.applied ? 0.7 : 0.4;
           const cornersSmoothed = smoothingResult.stats?.sharp_corners_smoothed || 0;
           
           // 根据弯道等级调整期望
           const expectedSmoothness = {
               "low": 0.5,
               "medium": 0.7,
               "high": 0.9
           };
           
           const target = expectedSmoothness[curveLevel] || 0.7;
           const smoothnessBonus = Math.min(0.3, cornersSmoothed * 0.05);
           
           return Math.min(1.0, baseScore + smoothnessBonus);
       }
       
       /**
        * 评分折返避免程度
        */
       _scoreBacktrackAvoidance(backtrackingAnalysis) {
           if (!backtrackingAnalysis) return 1.0;
           
           const backtrackRatio = backtrackingAnalysis.backtrack_ratio || 0;
           const severityScore = backtrackingAnalysis.severity_score || 0;
           
           let score = 1.0 - (backtrackRatio * 2); // 折返比例惩罚
           score -= severityScore * 0.5; // 严重程度惩罚
           
           return Math.max(0, score);
       }
       
       /**
        * 评分路线效率
        */
       _scoreRouteEfficiency(routeResult, targetDistance) {
           const coordinates = routeResult.paths?.[0]?.points?.coordinates || [];
           const actualDistance = routeResult.paths?.[0]?.distance || 0;
           
           if (coordinates.length < 2) return 0;
           
           // 计算直线距离与实际距离的比率
           const startPoint = coordinates[0];
           const endPoint = coordinates[coordinates.length - 1];
           const directDistance = this._calculateDistance(startPoint, endPoint);
           
           // 对于环形路线，直线距离应该很小
           const circularityScore = directDistance < 500 ? 1.0 : Math.max(0, 1 - directDistance / 2000);
           
           // 路径复杂度评分
           const complexityRatio = coordinates.length / (actualDistance / 100); // 每100米的点数
           const complexityScore = complexityRatio > 0.5 && complexityRatio < 3 ? 1.0 : 0.6;
           
           return (circularityScore + complexityScore) / 2;
       }
       
       /**
        * 评分几何一致性
        */
       _scoreGeometricConsistency(routeResult) {
           const coordinates = routeResult.paths?.[0]?.points?.coordinates || [];
           
           if (coordinates.length < 4) return 0.5;
           
           // 计算转角变化的一致性
           const angles = [];
           for (let i = 1; i < coordinates.length - 1; i++) {
               const angle = this._calculateTurnAngle(
                   coordinates[i - 1],
                   coordinates[i],
                   coordinates[i + 1]
               );
               angles.push(angle);
           }
           
           // 计算角度变化的标准差
           const avgAngle = angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
           const variance = angles.reduce((sum, angle) => sum + Math.pow(angle - avgAngle, 2), 0) / angles.length;
           const stdDev = Math.sqrt(variance);
           
           // 标准差越小，一致性越好
           return Math.max(0, 1 - stdDev / 60); // 60度作为参考标准
       }
       
       /**
        * 评分弯道分布
        */
       _scoreCurveDistribution(routeResult, curveLevel) {
           const coordinates = routeResult.paths?.[0]?.points?.coordinates || [];
           
           if (coordinates.length < 4) return 0.5;
           
           // 将路径分成4个象限，检查弯道分布
           const quadrants = [0, 0, 0, 0];
           const center = utils._calculateRouteCenter(coordinates);
           
           coordinates.forEach(coord => {
               const bearing = utils._calculateBearing(center, coord);
               const quadrant = Math.floor(bearing / 90);
               quadrants[quadrant]++;
           });
           
           // 计算分布均匀性
           const total = coordinates.length;
           const expectedPerQuadrant = total / 4;
           const deviations = quadrants.map(count => Math.abs(count - expectedPerQuadrant));
           const avgDeviation = deviations.reduce((sum, dev) => sum + dev, 0) / 4;
           
           return Math.max(0, 1 - avgDeviation / expectedPerQuadrant);
       }
       
       /**
        * 评分导航友好性
        */
       _scoreNavigationFriendliness(routeResult) {
           const coordinates = routeResult.paths?.[0]?.points?.coordinates || [];
           
           if (coordinates.length < 2) return 0.5;
           
           // 检查急转弯数量
           let sharpTurns = 0;
           for (let i = 1; i < coordinates.length - 1; i++) {
               const angle = this._calculateTurnAngle(
                   coordinates[i - 1],
                   coordinates[i],
                   coordinates[i + 1]
               );
               if (angle < 60) sharpTurns++; // 小于60度认为是急转弯
           }
           
           const sharpTurnRatio = sharpTurns / coordinates.length;
           return Math.max(0, 1 - sharpTurnRatio * 3); // 急转弯比例惩罚
       }
       
       /**
        * 计算路线中心点
        */
       _calculateRouteCenter(coordinates) {
           const sumLat = coordinates.reduce((sum, coord) => sum + coord[1], 0);
           const sumLng = coordinates.reduce((sum, coord) => sum + coord[0], 0);
           
           return [
               sumLng / coordinates.length,
               sumLat / coordinates.length
           ];
       }
       
       /**
        * 计算路径的圆形度
        * @param {Array} coordinates - 路径坐标数组
        * @param {Array} center - 路径中心点 [lng, lat]
        * @returns {number} 圆形度评分 (0-1)
        */

       
       /**
        * 智能重试机制
        * @param {Object} retryParams - 重试参数
        * @returns {Object} 优化后的路线结果
        */
       async _intelligentRetryMechanism(retryParams) {
           const {
               original_result,
               start_point,
               target_distance,
               curve_level,
               quality_score,
               validation_result
           } = retryParams;
           
           const maxRetries = 3;
           let bestResult = original_result;
           let bestScore = quality_score.overall_score;
           
           // 分析失败原因并制定重试策略
           const retryStrategies = this._analyzeFailureAndCreateStrategies(quality_score, validation_result);
           
           for (let retryIndex = 0; retryIndex < maxRetries; retryIndex++) {
               try {
                   // 选择当前重试策略
                   const strategy = retryStrategies[retryIndex % retryStrategies.length];
                   
                   // 根据策略调整参数
                   const adjustedParams = this._adjustParametersForRetry({
                       start_point,
                       target_distance,
                       curve_level,
                       strategy,
                       retry_index: retryIndex,
                       previous_failures: quality_score
                   });
                   
                   // 生成新的路线
                   const newResult = await this._generateRetryRoute(adjustedParams);
                   
                   if (!newResult || !newResult.paths || !newResult.paths[0]) {
                       continue;
                   }
                   
                   // 评估新路线质量
                   const newQualityScore = await this._evaluateRetryResult(newResult, adjustedParams);
                   
                   // 如果质量有显著提升，使用新结果
                   if (newQualityScore.overall_score > bestScore + 0.1) {
                       bestResult = newResult;
                       bestScore = newQualityScore.overall_score;
                       
                       // 如果达到满意质量，提前结束
                       if (bestScore >= 0.8) {
                           break;
                       }
                   }
                   
               } catch (error) {
                   console.warn(`重试 ${retryIndex + 1} 失败:`, error.message);
                   continue;
               }
           }
           
           // 添加重试信息到结果中
           if (bestResult.route_info) {
               bestResult.route_info.retry_info = {
                   retry_attempted: true,
                   retry_count: maxRetries,
                   original_score: quality_score.overall_score,
                   final_score: bestScore,
                   improvement: bestScore - quality_score.overall_score,
                   strategies_used: retryStrategies.map(s => s.name)
               };
           }
           
           return bestResult !== original_result ? bestResult : null;
       }
       
       /**
        * 分析失败原因并创建重试策略
        */
       _analyzeFailureAndCreateStrategies(qualityScore, validationResult) {
           const strategies = [];
           const baseScores = qualityScore.base_scores || {};
           const advancedScores = qualityScore.advanced_scores || {};
           
           // 基于具体问题制定策略
           if (baseScores.closure_quality < 0.6) {
               strategies.push({
                   name: "closure_optimization",
                   description: "优化环形闭合",
                   adjustments: {
                       reduce_radius_variation: true,
                       increase_point_density: true,
                       adjust_spiral_direction: true
                   }
               });
           }
           
           if (baseScores.backtrack_avoidance < 0.6) {
               strategies.push({
                   name: "backtrack_reduction",
                   description: "减少原路折返",
                   adjustments: {
                       increase_curve_smoothness: true,
                       adjust_intermediate_spacing: true,
                       modify_spiral_parameters: true
                   }
               });
           }
           
           if (baseScores.distance_precision < 0.6) {
               strategies.push({
                   name: "distance_calibration",
                   description: "校准距离精度",
                   adjustments: {
                       recalculate_target_radius: true,
                       adjust_point_count: true,
                       fine_tune_offsets: true
                   }
               });
           }
           
           if (advancedScores.geometric_consistency < 0.6) {
               strategies.push({
                   name: "geometric_balancing",
                   description: "平衡几何结构",
                   adjustments: {
                       normalize_angle_changes: true,
                       balance_curve_distribution: true,
                       smooth_transition_points: true
                   }
               });
           }
           
           // 如果没有特定策略，使用通用优化策略
           if (strategies.length === 0) {
               strategies.push({
                   name: "general_optimization",
                   description: "通用优化",
                   adjustments: {
                       random_variation: true,
                       parameter_fine_tuning: true
                   }
               });
           }
           
           return strategies;
       }
       
       /**
        * 根据策略调整参数
        */
       _adjustParametersForRetry(adjustParams) {
           const {
               start_point,
               target_distance,
               curve_level,
               strategy,
               retry_index,
               previous_failures
           } = adjustParams;
           
           const adjustedParams = {
               start_point,
               target_distance,
               curve_level,
               retry_adjustments: {}
           };
           
           const adjustments = strategy.adjustments;
           
           // 根据策略调整参数
           if (adjustments.reduce_radius_variation) {
               adjustedParams.retry_adjustments.radius_variation_factor = 0.7 - (retry_index * 0.1);
           }
           
           if (adjustments.increase_point_density) {
               adjustedParams.retry_adjustments.point_density_multiplier = 1.2 + (retry_index * 0.2);
           }
           
           if (adjustments.adjust_spiral_direction) {
               adjustedParams.retry_adjustments.force_spiral_direction = retry_index % 2 === 0 ? 1 : -1;
           }
           
           if (adjustments.increase_curve_smoothness) {
               adjustedParams.retry_adjustments.smoothness_factor = 1.3 + (retry_index * 0.2);
           }
           
           if (adjustments.adjust_intermediate_spacing) {
               adjustedParams.retry_adjustments.spacing_adjustment = 0.8 + (retry_index * 0.15);
           }
           
           if (adjustments.recalculate_target_radius) {
               adjustedParams.retry_adjustments.radius_recalculation = true;
               adjustedParams.retry_adjustments.radius_adjustment_factor = 0.9 + (retry_index * 0.05);
           }
           
           if (adjustments.random_variation) {
               adjustedParams.retry_adjustments.random_seed = Date.now() + retry_index;
               adjustedParams.retry_adjustments.variation_strength = 0.1 + (retry_index * 0.05);
           }
           
           return adjustedParams;
       }
       
       /**
        * 生成重试路线
        */
       async _generateRetryRoute(adjustedParams) {
           const {
               start_point,
               target_distance,
               curve_level,
               retry_adjustments
           } = adjustedParams;
           
           // 使用调整后的参数生成中间点
           const adjustedIntermediatePoints = this._generateAdjustedIntermediatePoints(
               start_point,
               target_distance,
               curve_level,
               retry_adjustments
           );
           
           // 构建路线请求 - 确保总点数不超过5个
           // GraphHopper API限制：最多5个点（包括起点和终点）
           const maxIntermediatePoints = Math.min(adjustedIntermediatePoints.length, 3);
           const limitedIntermediatePoints = adjustedIntermediatePoints.slice(0, maxIntermediatePoints);
           
           const routeRequest = {
               points: [start_point, ...limitedIntermediatePoints, start_point],
               vehicle: "foot",
               locale: "zh_CN",
               optimize: "false",
               instructions: true,
               calc_points: true,
               debug: false,
               elevation: this.elevation,
               points_encoded: false
           };
           
           // 应用弯道设置
           this._applyCurveSettings(routeRequest, curve_level);
           
           // 执行路线请求
           return await this._doRouteRequest(routeRequest);
       }
       
       /**
        * 生成调整后的中间点
        */
       _generateAdjustedIntermediatePoints(startPoint, targetDistance, curveLevel, adjustments) {
           // 基础参数计算
           let pointCount = this._calculateOptimalPointCount(targetDistance, curveLevel);
           let baseRadius = this._calculateBaseRadius(targetDistance, curveLevel);
           
           // 应用调整
           if (adjustments.point_density_multiplier) {
               pointCount = Math.round(pointCount * adjustments.point_density_multiplier);
           }
           
           // GraphHopper API限制：最多4个中间点（加上起点总共5个点）
           pointCount = Math.min(pointCount, 4);
           
           if (adjustments.radius_adjustment_factor) {
               baseRadius *= adjustments.radius_adjustment_factor;
           }
           
           const points = [];
           const startBearing = Math.random() * 360; // 随机起始方向
           
           // 确定螺旋方向
           let spiralDirection = this._determineSpiralDirection(startBearing);
           if (adjustments.force_spiral_direction) {
               spiralDirection = adjustments.force_spiral_direction;
           }
           
           // 生成调整后的点
           for (let i = 0; i < pointCount; i++) {
               const progress = i / pointCount;
               
               // 计算螺旋半径
               let spiralRadius = this._calculateSpiralRadius(baseRadius, progress, curveLevel);
               
               // 应用半径变化调整
               if (adjustments.radius_variation_factor) {
                   const variation = Math.sin(progress * Math.PI * 4) * baseRadius * adjustments.radius_variation_factor;
                   spiralRadius += variation;
               }
               
               // 计算螺旋角度
               let spiralAngle = this._calculateSpiralAngle(startBearing, progress, spiralDirection, curveLevel);
               
               // 应用平滑度调整
               if (adjustments.smoothness_factor) {
                   spiralAngle += Math.sin(progress * Math.PI * 2) * 10 * adjustments.smoothness_factor;
               }
               
               // 计算点位置
               const point = this._calculatePointAtDistance(startPoint, spiralRadius, spiralAngle);
               
               // 应用增强偏移
               const enhancedPoint = this._applyEnhancedOffset(point, spiralRadius, curveLevel, i);
               
               points.push(enhancedPoint);
           }
           
           return points;
       }
       
       /**
        * 评估重试结果
        */
       async _evaluateRetryResult(routeResult, adjustedParams) {
           // 执行完整的质量评估流程
           const closureValidation = this._validateCircularClosure(routeResult, adjustedParams.start_point, adjustedParams.target_distance);
           const backtrackingAnalysis = this._detectBacktracking(routeResult);
           const smoothingResult = this._applySmoothingAlgorithm(routeResult, adjustedParams.curve_level);
           
           const multiLevelValidation = this._performMultiLevelValidation(routeResult, {
               target_distance: adjustedParams.target_distance,
               curve_level: adjustedParams.curve_level,
               closure_validation: closureValidation,
               backtracking_analysis: backtrackingAnalysis,
               smoothing_result: smoothingResult
           });
           
           const qualityScore = this._calculatePathQualityScore({
               closure_validation: closureValidation,
               backtracking_analysis: backtrackingAnalysis,
               smoothing_result: smoothingResult,
               validation_result: multiLevelValidation,
               route_result: routeResult,
               target_distance: adjustedParams.target_distance,
               curve_level: adjustedParams.curve_level
           });
           
           // 更新路线信息
           routeResult.route_info = {
               type: "roundtrip",
               target_distance: adjustedParams.target_distance,
               actual_distance: routeResult.paths[0].distance,
               curve_level: adjustedParams.curve_level,
               closure_validation: closureValidation,
               backtracking_analysis: backtrackingAnalysis,
               smoothing_applied: smoothingResult.applied,
               smoothing_stats: smoothingResult.stats,
               multi_level_validation: multiLevelValidation,
               quality_score: qualityScore
           };
           
           return qualityScore;
       }
       
       /**
        * 生成质量改进建议
        */
       _generateQualityImprovements(baseScores, advancedScores) {
           const improvements = [];
           
           // 检查基础评分
           Object.keys(baseScores).forEach(key => {
               if (baseScores[key] < 0.6) {
                   switch (key) {
                       case "closure_quality":
                           improvements.push("优化起终点闭合，建议调整中间点分布");
                           break;
                       case "distance_precision":
                           improvements.push("提高距离精度，建议优化路径规划算法");
                           break;
                       case "path_smoothness":
                           improvements.push("增强路径平滑度，减少尖锐转角");
                           break;
                       case "backtrack_avoidance":
                           improvements.push("减少原路折返，优化路径规划策略");
                           break;
                       case "route_efficiency":
                           improvements.push("提高路线效率，优化路径复杂度");
                           break;
                   }
               }
           });
           
           // 检查高级评分
           Object.keys(advancedScores).forEach(key => {
               if (advancedScores[key] < 0.6) {
                   switch (key) {
                       case "geometric_consistency":
                           improvements.push("改善几何一致性，平衡转角变化");
                           break;
                       case "curve_distribution":
                           improvements.push("优化弯道分布，确保路径均匀性");
                           break;
                       case "navigation_friendliness":
                           improvements.push("提升导航友好性，减少急转弯");
                           break;
                   }
               }
           });
           
           return improvements.length > 0 ? improvements : ["路径质量良好，无需特别改进"];
       }
       
       /**
        * 创建贝塞尔曲线
        * @param {Array} p1 - 起点
       * @param {Array} p2 - 控制点(原尖锐转角点)
       * @param {Array} p3 - 终点
       * @param {Object} intensity - 强度参数
       * @returns {Array} 贝塞尔曲线点数组
       */
      _createBezierCurve(p1, p2, p3, intensity) {
          const points = [];
          const numPoints = intensity.interpolation_points;
          const controlRatio = intensity.control_point_ratio;
          
          // 计算控制点
          const dist1 = this._calculateDistance(p1, p2);
          const dist2 = this._calculateDistance(p2, p3);
          const avgDist = (dist1 + dist2) / 2;
          
          // 控制点偏移距离
          const controlDist = avgDist * controlRatio;
          
          // 计算控制点位置
          const bearing1 = utils._calculateBearing(p2, p1);
          const bearing2 = utils._calculateBearing(p2, p3);
          const avgBearing = (bearing1 + bearing2) / 2;
          
          const controlPoint = this._calculatePointAtDistance(p2, controlDist, avgBearing);
          
          // 生成贝塞尔曲线点
          for (let i = 0; i <= numPoints; i++) {
              const t = i / numPoints;
              const bezierPoint = this._calculateQuadraticBezierPoint(p1, controlPoint, p3, t);
              points.push(bezierPoint);
          }
          
          return points;
      }
      
      /**
       * 计算二次贝塞尔曲线上的点
       * @param {Array} p0 - 起点
       * @param {Array} p1 - 控制点
       * @param {Array} p2 - 终点
       * @param {number} t - 参数 (0-1)
       * @returns {Array} 贝塞尔曲线上的点
       */
      _calculateQuadraticBezierPoint(p0, p1, p2, t) {
          const x = Math.pow(1 - t, 2) * p0[0] + 2 * (1 - t) * t * p1[0] + Math.pow(t, 2) * p2[0];
          const y = Math.pow(1 - t, 2) * p0[1] + 2 * (1 - t) * t * p1[1] + Math.pow(t, 2) * p2[1];
          
          return [x, y];
      }
      
      /**
       * 估算路径总距离
       * @param {Array} coordinates - 坐标数组
       * @returns {number} 估算距离(米)
       */
      _estimatePathDistance(coordinates) {
          let totalDistance = 0;
          
          for (let i = 1; i < coordinates.length; i++) {
              totalDistance += this._calculateDistance(coordinates[i - 1], coordinates[i]);
          }
          
          return totalDistance;
      }
  }

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blucap;
} else if (typeof window !== 'undefined') {
    window.Blucap = Blucap;
}