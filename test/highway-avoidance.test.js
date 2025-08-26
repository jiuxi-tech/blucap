const Blucap = require('../blucap');
const assert = require('assert');

describe('Highway Avoidance Feature', function() {
    let blucap;
    
    beforeEach(function() {
        blucap = new Blucap({
            apiKey: 'test-key',
            baseUrl: 'https://graphhopper.com/api/1'
        });
    });
    
    describe('Configuration Tests', function() {
        it('should have highway avoidance settings in curve configurations', function() {
            const mediumSettings = blucap.curveSettings.medium;
            assert(mediumSettings.hasOwnProperty('avoid_highways_strict'));
            assert(mediumSettings.hasOwnProperty('highway_avoidance_level'));
            assert(mediumSettings.hasOwnProperty('alternative_route_preference'));
        });
        
        it('should initialize avoidance log', function() {
            assert(Array.isArray(blucap.avoidanceLog));
            assert.strictEqual(blucap.avoidanceLog.length, 0);
        });
    });
    
    describe('API Interface Tests', function() {
        it('should accept highwayAvoidance parameter in generateRoundTrip', async function() {
            const options = {
                startPoint: [40.7128, -74.0060], // [lat, lng] format
                targetDistance: 5,
                curveLevel: 'medium',
                highwayAvoidance: {
                    avoid_highways: true,
                    avoid_highways_strict: true,
                    highway_avoidance_level: 'strict'
                }
            };
            
            // Mock the HTTP request to avoid actual API calls
            const originalDoRouteRequest = blucap._doRouteRequest;
            blucap._doRouteRequest = async () => ({
                paths: [{
                    points: 'mock_polyline',
                    distance: 10000,
                    time: 600000,
                    instructions: []
                }]
            });
            
            try {
                const result = await blucap.generateRoundTrip({
                    startPoint: options.startPoint,
                    distance: options.targetDistance,
                    curveLevel: options.curveLevel,
                    highwayAvoidance: options.highwayAvoidance
                });
                assert(result);
                assert(blucap.avoidanceLog.length > 0);
            } finally {
                blucap._doRouteRequest = originalDoRouteRequest;
            }
        });
        
        it('should accept highwayAvoidance parameter in generatePointToPoint', async function() {
            const options = {
                startPoint: [40.7128, -74.0060],
                endPoint: [40.7589, -73.9851],
                curveLevel: 'high',
                highwayAvoidance: {
                    avoid_highways: true,
                    alternative_route_preference: 'scenic'
                }
            };
            
            // Mock the HTTP request
            const originalDoRouteRequest = blucap._doRouteRequest;
            blucap._doRouteRequest = async () => ({
                paths: [{
                    points: 'mock_polyline',
                    distance: 8000,
                    time: 480000,
                    instructions: []
                }]
            });
            
            try {
                const result = await blucap.generatePointToPoint(options);
                assert(result);
                assert(blucap.avoidanceLog.length > 0);
            } finally {
                blucap._doRouteRequest = originalDoRouteRequest;
            }
        });
    });
    
    describe('Avoidance Strategy Tests', function() {
        it('should apply highway avoidance strategy correctly', function() {
            const routeRequest = { point: [], vehicle: 'car' };
            const settings = {
                avoid_highways: true,
                avoid_highways_strict: true,
                highway_avoidance_level: 'moderate'
            };
            const avoidanceDecision = {
                decisions: [],
                alternativeRoutes: []
            };
            
            blucap._applyHighwayAvoidanceStrategy(routeRequest, settings, avoidanceDecision);
            
            assert(avoidanceDecision.decisions.length > 0);
            const decision = avoidanceDecision.decisions.find(d => d.type === 'highway_avoidance');
            assert(decision);
            assert(decision.action === 'avoid_highways' || decision.action === 'moderate_avoidance');
        });
        
        it('should generate alternative routes when highway avoidance is enabled', function() {
            const routeRequest = { point: [], vehicle: 'car' };
            const settings = {
                avoid_highways: true,
                alternative_route_preference: 'balanced'
            };
            const avoidanceDecision = {
                decisions: [],
                alternativeRoutes: []
            };
            
            blucap._applyAlternativeRouteStrategy(routeRequest, settings, avoidanceDecision);
            
            if (settings.avoid_highways) {
                assert(avoidanceDecision.alternativeRoutes.length > 0);
            }
        });
    });
    
    describe('Avoidance History API Tests', function() {
        beforeEach(function() {
            // Add some mock avoidance decisions
            blucap.avoidanceLog = [
                {
                    timestamp: '2024-01-15T10:00:00.000Z',
                    curveLevel: 'medium',
                    decisions: [{ type: 'highway_avoidance', action: 'avoid_highways' }],
                    alternativeRoutes: [{ strategy: 'scenic', applied: true }]
                },
                {
                    timestamp: '2024-01-15T11:00:00.000Z',
                    curveLevel: 'high',
                    decisions: [{ type: 'highway_avoidance', action: 'allow_highways' }],
                    alternativeRoutes: []
                }
            ];
        });
        
        it('should return complete avoidance history', function() {
            const history = blucap.getAvoidanceHistory();
            assert.strictEqual(history.length, 2);
            assert(history[0].timestamp);
            assert(history[0].decisions);
        });
        
        it('should return filtered avoidance history', function() {
            const history = blucap.getAvoidanceHistory({ curveLevel: 'medium' });
            assert.strictEqual(history.length, 1);
            assert.strictEqual(history[0].curveLevel, 'medium');
        });
        
        it('should return last avoidance decision', function() {
            const lastDecision = blucap.getLastAvoidanceDecision();
            assert(lastDecision);
            assert.strictEqual(lastDecision.curveLevel, 'high');
        });
        
        it('should clear avoidance history', function() {
            blucap.clearAvoidanceHistory();
            assert.strictEqual(blucap.avoidanceLog.length, 0);
        });
        
        it('should generate avoidance statistics', function() {
            const stats = blucap.getAvoidanceStatistics();
            assert(stats);
            assert.strictEqual(stats.totalDecisions, 2);
            assert(typeof stats.avoidanceRate === 'number');
            assert(stats.avoidanceRate >= 0 && stats.avoidanceRate <= 1);
            assert(stats.curveDistribution);
            assert(stats.alternativeRouteUsage);
        });
    });
    
    describe('Integration Tests', function() {
        it('should integrate highway avoidance with curve settings', function() {
            const routeRequest = { point: [], vehicle: 'car' };
            const highwayAvoidance = {
                avoid_highways: true,
                highway_avoidance_level: 'strict',
                alternative_route_preference: 'city_roads'
            };
            
            const result = blucap._applyCurveSettings(routeRequest, 'medium', highwayAvoidance);
            
            assert(result);
            assert(blucap.avoidanceLog.length > 0);
            
            const lastDecision = blucap.avoidanceLog[blucap.avoidanceLog.length - 1];
            assert(lastDecision.highwayAvoidanceOverride);
            assert.strictEqual(lastDecision.highwayAvoidanceOverride.highway_avoidance_level, 'strict');
        });
        
        it('should handle different avoidance levels correctly', function() {
            const testCases = [
                { level: 'lenient', expectedDecisions: 1 },
                { level: 'moderate', expectedDecisions: 1 },
                { level: 'strict', expectedDecisions: 1 }
            ];
            
            testCases.forEach(testCase => {
                blucap.clearAvoidanceHistory();
                
                const routeRequest = { point: [], vehicle: 'car' };
                const highwayAvoidance = {
                    avoid_highways: true,
                    highway_avoidance_level: testCase.level
                };
                
                blucap._applyCurveSettings(routeRequest, 'medium', highwayAvoidance);
                
                assert(blucap.avoidanceLog.length > 0);
                const decision = blucap.avoidanceLog[0];
                assert(decision.decisions.length >= testCase.expectedDecisions);
            });
        });
    });
    
    describe('Performance Tests', function() {
        it('should handle large avoidance history efficiently', function() {
            // Generate large history
            const largeHistory = [];
            for (let i = 0; i < 1000; i++) {
                largeHistory.push({
                    timestamp: new Date(Date.now() - i * 60000).toISOString(),
                    curveLevel: ['low', 'medium', 'high'][i % 3],
                    decisions: [{ type: 'highway_avoidance', action: 'avoid_highways' }],
                    alternativeRoutes: []
                });
            }
            blucap.avoidanceLog = largeHistory;
            
            const startTime = Date.now();
            const stats = blucap.getAvoidanceStatistics();
            const endTime = Date.now();
            
            assert(stats);
            assert(endTime - startTime < 100); // Should complete within 100ms
        });
        
        it('should limit history size to prevent memory issues', function() {
            // Test history size limit (if implemented)
            for (let i = 0; i < 2000; i++) {
                const routeRequest = { point: [], vehicle: 'car' };
                blucap._applyCurveSettings(routeRequest, 'medium');
            }
            
            // Assuming a reasonable limit is implemented
            assert(blucap.avoidanceLog.length <= 1000);
        });
    });
});