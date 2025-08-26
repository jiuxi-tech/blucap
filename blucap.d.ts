export interface FunRouteGeneratorConfig {
  /** GraphHopper API key (required) */
  apiKey: string;
  /** GraphHopper API host URL */
  host?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Vehicle profile */
  profile?: 'car' | 'bike' | 'foot' | 'motorcycle';
  /** Response locale */
  locale?: string;
}

export interface Point {
  /** Latitude */
  0: number;
  /** Longitude */
  1: number;
}

export type CurveLevel = 'low' | 'medium' | 'high';

export type HighwayAvoidanceLevel = 'none' | 'moderate' | 'strict';

export type AlternativeRoutePreference = 'fastest' | 'balanced' | 'scenic';

export interface HighwayAvoidanceSettings {
  /** Enable highway avoidance */
  avoid_highways?: boolean;
  /** Strict highway avoidance mode */
  avoid_highways_strict?: boolean;
  /** Highway avoidance level */
  highway_avoidance_level?: HighwayAvoidanceLevel;
  /** Alternative route preference */
  alternative_route_preference?: AlternativeRoutePreference;
  /** Prefer scenic routes */
  prefer_scenic?: boolean;
}

export interface AvoidanceDecision {
  /** Decision timestamp */
  timestamp: string;
  /** Curve level used */
  curveLevel: CurveLevel;
  /** Applied settings */
  settings: HighwayAvoidanceSettings;
  /** List of decisions made */
  decisions: AvoidanceDecisionItem[];
  /** Alternative routes calculated */
  alternativeRoutes: AlternativeRoute[];
}

export interface AvoidanceDecisionItem {
  /** Decision type */
  type: 'highway_avoidance' | 'route_preference' | 'alternative_calculation';
  /** Action taken */
  action: string;
  /** Reason for the decision */
  reason: string;
  /** Method used (optional) */
  method?: string;
  /** Count (optional) */
  count?: number;
}

export interface AlternativeRoute {
  /** Alternative route ID */
  id: string;
  /** Strategy name */
  strategy: string;
  /** Strategy description */
  description: string;
  /** Route parameters */
  parameters: any;
  /** Estimated impact */
  estimatedImpact: {
    timeIncrease: string;
    distanceIncrease: string;
    scenicValue: string;
  };
}

export interface AvoidanceStatistics {
  /** Total number of decisions */
  totalDecisions: number;
  /** Number of times avoidance was enabled */
  avoidanceEnabled: number;
  /** Number of times avoidance was disabled */
  avoidanceDisabled: number;
  /** Number of strict avoidance decisions */
  strictAvoidance: number;
  /** Number of moderate avoidance decisions */
  moderateAvoidance: number;
  /** Number of no avoidance decisions */
  noAvoidance: number;
  /** Average decisions per route */
  averageDecisionsPerRoute: number;
}

export interface AvoidanceHistoryOptions {
  /** Limit number of returned records */
  limit?: number;
  /** Filter by curve level */
  curveLevel?: CurveLevel;
  /** Filter records since this date */
  since?: Date;
}

export interface AvoidanceClearOptions {
  /** Keep recent records */
  keepRecent?: boolean;
  /** Number of records to keep */
  keepCount?: number;
}

export interface RoundTripOptions {
  /** Starting point [lat, lng] */
  startPoint: Point;
  /** Target distance in kilometers (50-500) */
  distance: number;
  /** Curve difficulty level */
  curveLevel?: CurveLevel;
  /** Starting bearing in degrees (0-360) */
  startBearing?: number;
  /** Highway avoidance settings */
  highwayAvoidance?: HighwayAvoidanceSettings;
}

export interface PointToPointOptions {
  /** Starting point [lat, lng] */
  startPoint: Point;
  /** End point [lat, lng] */
  endPoint: Point;
  /** Curve difficulty level */
  curveLevel?: CurveLevel;
  /** Target distance in kilometers (optional, for detours) */
  targetDistance?: number;
  /** Highway avoidance settings */
  highwayAvoidance?: HighwayAvoidanceSettings;
}

export interface RouteInstruction {
  /** Instruction text */
  text: string;
  /** Distance for this instruction in meters */
  distance: number;
  /** Time for this instruction in milliseconds */
  time: number;
  /** Interval of points for this instruction */
  interval: [number, number];
  /** Turn sign */
  sign: number;
}

export interface RouteInfo {
  /** Total distance in meters */
  distance: number;
  /** Total time in milliseconds */
  time: number;
  /** Ascent in meters */
  ascent?: number;
  /** Descent in meters */
  descent?: number;
}

export interface RoutePath {
  /** Encoded polyline or array of coordinates */
  points: string | number[][];
  /** Route instructions */
  instructions: RouteInstruction[];
  /** Route information */
  info: RouteInfo;
  /** Snapped waypoints */
  snapped_waypoints?: string | number[][];
}

export interface RouteResponse {
  /** Array of route paths */
  paths: RoutePath[];
  /** Route information */
  info: {
    /** Copyright information */
    copyrights: string[];
    /** Processing time */
    took: number;
  };
}

/**
 * Blucap Library
 * Generates scenic and fun driving routes using GraphHopper API
 */
export default class Blucap {
  /**
   * Create a new FunRouteGenerator instance
   * @param config Configuration options
   */
  constructor(config: FunRouteGeneratorConfig);

  /**
   * Generate a round trip route
   * @param options Round trip configuration
   * @returns Promise resolving to route data
   */
  generateRoundTrip(options: RoundTripOptions): Promise<RouteResponse>;

  /**
   * Generate a point-to-point route
   * @param options Point-to-point configuration
   * @returns Promise resolving to route data
   */
  generatePointToPoint(options: PointToPointOptions): Promise<RouteResponse>;

  /**
   * Get highway avoidance decision history
   * @param options Filter options
   * @returns Array of avoidance decisions
   */
  getAvoidanceHistory(options?: AvoidanceHistoryOptions): AvoidanceDecision[];

  /**
   * Get the last avoidance decision made
   * @returns Last avoidance decision or null
   */
  getLastAvoidanceDecision(): AvoidanceDecision | null;

  /**
   * Clear avoidance decision history
   * @param options Clear options
   */
  clearAvoidanceHistory(options?: AvoidanceClearOptions): void;

  /**
   * Get avoidance statistics
   * @returns Statistics about avoidance decisions
   */
  getAvoidanceStatistics(): AvoidanceStatistics;
}

/**
 * Export the class as both default and named export for compatibility
 */
export { Blucap };