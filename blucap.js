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
        
        // 弯道等级配置
        this.curveSettings = {
            "low": {
                avoid_highways: false,
                prefer_scenic: false,
                detour_factor: 1.1
            },
            "medium": {
                avoid_highways: true,
                prefer_scenic: true,
                detour_factor: 1.3
            },
            "high": {
                avoid_highways: true,
                prefer_scenic: true,
                detour_factor: 1.6
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
        const routePoints = [startPoint, ...intermediatePoints, startPoint];
        
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
            type: "roundtrip",
            target_distance: targetDistance,
            actual_distance: result.paths[0].distance,
            curve_level: curveLevel,
            start_bearing: startBearing
        };
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
        
        const routePoints = [startPoint, ...intermediatePoints, endPoint];
        
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
     * 为环形路线生成中间点
     */
    _generateIntermediatePoints(startPoint, targetDistance, curveLevel, startBearing) {
        const points = [];
        const numPoints = curveLevel === "high" ? 3 : (curveLevel === "medium" ? 2 : 1);
        const radiusKm = (targetDistance / 1000) / (2 * Math.PI); // 估算半径
        
        for (let i = 0; i < numPoints; i++) {
            const angle = startBearing + (360 / numPoints) * (i + 1);
            const point = this._calculatePointAtDistance(startPoint, radiusKm * 1000, angle);
            
            // 添加一些随机偏移来增加趣味性
            const randomOffset = (Math.random() - 0.5) * 0.01; // 约1km的随机偏移
            point[0] += randomOffset;
            point[1] += randomOffset;
            
            points.push(point);
        }
        
        return points;
    }

    /**
     * 为点对点路线生成绕行点
     */
    _generateDetourPoints(startPoint, endPoint, targetDistance, curveLevel) {
        const points = [];
        const directDistance = this._calculateDistance(startPoint, endPoint);
        const extraDistance = targetDistance - directDistance;
        
        if (extraDistance <= 0) return points;
        
        const numDetours = curveLevel === "high" ? 2 : (curveLevel === "medium" ? 1 : 1);
        
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
     * 应用弯道设置到路线请求
     */
    _applyCurveSettings(routeRequest, curveLevel) {
        const settings = this.curveSettings[curveLevel] || this.curveSettings["medium"];
        
        // 使用免费API支持的基本参数
        if (settings.avoid_highways) {
            routeRequest.avoid = "motorway";
        }
        
        // 设置路由类型偏好
        if (settings.prefer_scenic) {
            routeRequest.weighting = "shortest"; // 使用最短路径可能更有趣
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
}

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blucap;
} else if (typeof window !== 'undefined') {
    window.Blucap = Blucap;
}