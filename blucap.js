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
            const error = new Error(`HTTP ${response.status}`);
            error.response = {
                status: response.status,
                statusText: response.statusText,
                data: await response.json().catch(() => ({ message: response.statusText }))
            };
            throw error;
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
                data: await response.json().catch(() => ({ message: response.statusText }))
            };
            throw error;
        }
        
        return {
            data: await response.json()
        };
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
        
        // 确定螺旋方向（顺时针或逆时针）
        const spiralDirection = this._determineSpiralDirection(startBearing);
        
        for (let i = 0; i < numPoints; i++) {
            const progress = (i + 1) / (numPoints + 1); // 避免最后一点过于接近起点
            
            // 螺旋式半径分布，确保路径不重叠
            const spiralRadius = this._calculateSpiralRadius(baseRadius, progress, curveLevel);
            
            // 改进的角度分布，避免均匀分布导致的单调性
            const angle = this._calculateSpiralAngle(startBearing, progress, spiralDirection, curveLevel);
            
            const point = this._calculatePointAtDistance(startPoint, spiralRadius, angle);
            
            // 增强的随机偏移策略
            const enhancedPoint = this._applyEnhancedOffset(point, spiralRadius, curveLevel, i);
            
            points.push(enhancedPoint);
        }
        
        return points;
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
     * 计算螺旋式半径
     */
    _calculateSpiralRadius(baseRadius, progress, curveLevel) {
        // 螺旋式半径分布，内圈到外圈渐进
        const minRadius = baseRadius * 0.4;
        const maxRadius = baseRadius * 1.2;
        const spiralFactor = curveLevel === "high" ? 0.8 : (curveLevel === "medium" ? 0.6 : 0.4);
        
        return minRadius + (maxRadius - minRadius) * Math.pow(progress, spiralFactor);
    }

    /**
     * 计算螺旋式角度
     */
    _calculateSpiralAngle(startBearing, progress, spiralDirection, curveLevel) {
        // 非均匀角度分布，增加路径的自然性
        const totalAngle = curveLevel === "high" ? 300 : (curveLevel === "medium" ? 270 : 240);
        const angleVariation = (Math.sin(progress * Math.PI) * 30); // 正弦波动
        
        return startBearing + (spiralDirection * totalAngle * progress) + angleVariation;
    }

    /**
     * 应用增强的随机偏移
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
            const bearing = this._calculateBearing(startPoint, endPoint);
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
    async _doRouteRequest(routeRequest) {
        const url = `${this.config.host}/route?key=${this.config.apiKey}`;
        
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
                throw new Error(`GraphHopper API Error: ${error.response.status} - ${error.response.data.message || error.response.statusText}`);
            } else if (error.request) {
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
     * 验证环形路线的闭合度
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
        
        // 计算起终点距离
        const closureDistance = this._calculateDistance(routeStart, routeEnd);
        
        // 计算闭合比率（距离越小，比率越高）
        const maxAcceptableDistance = Math.min(targetDistance * 0.01, 1000); // 目标距离的1%或1km，取较小值
        const closureRatio = Math.max(0, 1 - (closureDistance / maxAcceptableDistance));
        
        // 验证起点是否接近原始起点
        const startPointDistance = this._calculateDistance(startPoint, routeStart);
        
        return {
            is_valid: closureDistance <= 500 && startPointDistance <= 200, // 500米闭合阈值，200米起点偏差阈值
            closure_distance: closureDistance,
            closure_ratio: closureRatio,
            start_point_deviation: startPointDistance,
            route_start: routeStart,
            route_end: routeEnd,
            total_points: coordinates.length
        };
    }
    
    /**
     * 优化环形路线的闭合度
     * @param {Object} originalRequest - 原始路线请求
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @returns {Object|null} 优化后的路线结果或null
     */
    async _optimizeCircularClosure(originalRequest, startPoint, targetDistance, curveLevel) {
        const maxRetries = 3;
        
        for (let retry = 0; retry < maxRetries; retry++) {
            try {
                // 重新生成中间点，使用更保守的参数
                const optimizedPoints = this._generateOptimizedIntermediatePoints(
                    startPoint, 
                    targetDistance, 
                    curveLevel, 
                    retry
                );
                
                // 构建优化的路线请求 - 确保总点数不超过5个
                // GraphHopper API限制：最多5个点（包括起点和终点）
                const maxOptimizedPoints = Math.min(optimizedPoints.length, 3);
                const limitedOptimizedPoints = optimizedPoints.slice(0, maxOptimizedPoints);
                
                const optimizedRequest = {
                    ...originalRequest,
                    points: [startPoint, ...limitedOptimizedPoints, startPoint]
                };
                
                const result = await this._doRouteRequest(optimizedRequest);
                const validation = this._validateCircularClosure(result, startPoint, targetDistance);
                
                // 如果闭合度改善，返回优化结果
                if (validation.closure_distance <= 500) {
                    result.route_info = {
                        type: "roundtrip",
                        target_distance: targetDistance,
                        actual_distance: result.paths[0].distance,
                        curve_level: curveLevel,
                        closure_validation: validation,
                        optimization_retry: retry + 1,
                        optimized: true
                    };
                    return result;
                }
            } catch (error) {
                console.warn(`闭合优化重试 ${retry + 1} 失败:`, error.message);
            }
        }
        
        return null; // 优化失败
    }
    
    /**
     * 生成优化的中间点（用于闭合度优化）
     * @param {Array} startPoint - 起始点
     * @param {number} targetDistance - 目标距离
     * @param {string} curveLevel - 弯道等级
     * @param {number} retryIndex - 重试索引
     * @returns {Array} 优化的中间点数组
     */
    _generateOptimizedIntermediatePoints(startPoint, targetDistance, curveLevel, retryIndex) {
        const points = [];
        const numPoints = this._calculateOptimalPointCount(targetDistance, curveLevel);
        
        // 根据重试次数调整参数
        const radiusReduction = 0.9 - (retryIndex * 0.1); // 逐渐减小半径
        const baseRadius = this._calculateBaseRadius(targetDistance, curveLevel) * radiusReduction;
        
        // 使用更规则的角度分布以提高闭合度
        const angleStep = 360 / (numPoints + 1);
        const startBearing = Math.random() * 360; // 随机起始角度
        
        for (let i = 0; i < numPoints; i++) {
            const angle = startBearing + (angleStep * (i + 1));
            const progress = (i + 1) / (numPoints + 1);
            
            // 使用更保守的半径变化
            const radius = baseRadius * (0.8 + 0.4 * Math.sin(progress * Math.PI));
            
            const point = this._calculatePointAtDistance(startPoint, radius, angle);
            
            // 减少随机偏移以提高可预测性
            const offsetMagnitude = Math.min(radius * 0.05, 1000); // 减小偏移
            const offsetAngle = angle + 90;
            const offsetDistance = offsetMagnitude * (0.5 + Math.random() * 0.5);
            
            const optimizedPoint = this._calculatePointAtDistance(point, offsetDistance, offsetAngle);
            points.push(optimizedPoint);
        }
        
        return points;
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
         const minBacktrackDistance = 200; // 最小折返检测距离(米)
         const angleThreshold = 150; // 角度阈值(度)，超过此角度认为是折返
         
         // 分析路径段，检测折返
         for (let i = 2; i < coordinates.length - 1; i++) {
             const prevPoint = coordinates[i - 2];
             const currentPoint = coordinates[i - 1];
             const nextPoint = coordinates[i];
             
             // 计算前后两段的方位角
             const bearing1 = this._calculateBearing(prevPoint, currentPoint);
             const bearing2 = this._calculateBearing(currentPoint, nextPoint);
             
             // 计算角度差
             let angleDiff = Math.abs(bearing2 - bearing1);
             if (angleDiff > 180) {
                 angleDiff = 360 - angleDiff;
             }
             
             // 检测是否为折返（角度变化大且距离足够）
             if (angleDiff > angleThreshold) {
                 const segmentDistance = this._calculateDistance(prevPoint, nextPoint);
                 
                 if (segmentDistance > minBacktrackDistance) {
                     // 进一步验证：检查是否真的在走回头路
                     const isRealBacktrack = this._verifyBacktrackSegment(
                         coordinates, i - 2, i, minBacktrackDistance
                     );
                     
                     if (isRealBacktrack) {
                         backtrackSegments.push({
                             start_index: i - 2,
                             end_index: i,
                             angle_change: angleDiff,
                             distance: segmentDistance,
                             severity: this._calculateBacktrackSeverity(angleDiff, segmentDistance)
                         });
                     }
                 }
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
          const newDistance = this._estimatePathDistance(smoothedCoordinates);
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
          const minSegmentLength = 100; // 最小段长度(米)
          
          for (let i = 1; i < coordinates.length - 1; i++) {
              const prevPoint = coordinates[i - 1];
              const currentPoint = coordinates[i];
              const nextPoint = coordinates[i + 1];
              
              // 检查段长度
              const dist1 = this._calculateDistance(prevPoint, currentPoint);
              const dist2 = this._calculateDistance(currentPoint, nextPoint);
              
              if (dist1 < minSegmentLength || dist2 < minSegmentLength) {
                  continue;
              }
              
              // 计算转角
              const angle = this._calculateTurnAngle(prevPoint, currentPoint, nextPoint);
              
              if (angle < 120) { // 小于120度认为是尖锐转角
                  corners.push({
                      index: i,
                      angle: angle,
                      point: currentPoint,
                      prev_point: prevPoint,
                      next_point: nextPoint,
                      severity: (120 - angle) / 120 // 严重程度 0-1
                  });
              }
          }
          
          return corners;
      }
      
      /**
       * 计算三点间的转角
       * @param {Array} p1 - 第一个点
       * @param {Array} p2 - 中间点
       * @param {Array} p3 - 第三个点
       * @returns {number} 转角(度)
       */
      _calculateTurnAngle(p1, p2, p3) {
          const bearing1 = this._calculateBearing(p2, p1);
          const bearing2 = this._calculateBearing(p2, p3);
          
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
          
          // 从后往前处理，避免索引偏移问题
          for (let i = sharpCorners.length - 1; i >= 0; i--) {
              const corner = sharpCorners[i];
              const smoothedSegment = this._createBezierCurve(
                  corner.prev_point,
                  corner.point,
                  corner.next_point,
                  intensity
              );
              
              // 替换尖锐转角点
              smoothedCoords.splice(corner.index, 1, ...smoothedSegment);
          }
          
          return smoothedCoords;
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
              quality_grade: this._calculateQualityGrade(totalScore),
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
           const qualityGrade = this._calculateQualityGrade(overallScore);
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
           const center = this._calculateRouteCenter(coordinates);
           
           coordinates.forEach(coord => {
               const bearing = this._calculateBearing(center, coord);
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
          const bearing1 = this._calculateBearing(p2, p1);
          const bearing2 = this._calculateBearing(p2, p3);
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