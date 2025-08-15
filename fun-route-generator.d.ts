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

export interface RoundTripOptions {
  /** Starting point [lat, lng] */
  startPoint: Point;
  /** Target distance in kilometers (50-500) */
  distance: number;
  /** Curve difficulty level */
  curveLevel?: CurveLevel;
  /** Starting bearing in degrees (0-360) */
  startBearing?: number;
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
 * Fun Route Generator Library
 * Generates scenic and fun driving routes using GraphHopper API
 */
export default class FunRouteGenerator {
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
}

/**
 * Export the class as both default and named export for compatibility
 */
export { FunRouteGenerator };