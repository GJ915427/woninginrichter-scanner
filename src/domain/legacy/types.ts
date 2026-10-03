import { Point2D } from './collinear-simplifier';

export interface FloorplanRenderOptions {
  basePoints: Point2D[];
  frontWallIdx?: number;
  wallThickness?: number;
  showInnerDimensions?: boolean;
  showOuterDimensions?: boolean;
  etageIndex?: number | 'section';
  totalWoonoppervlakte?: number;
  isMandelig?: boolean;
  mandeligWallIdx?: number;
  roofType?: 'auto' | 'slanted' | 'flat';
  orientation?: 'north' | 'front_left';
  oppDakPlat?: number;
  oppDakSchuin?: number;
  bag3d?: any;
  streetViewHeading?: number;
}

export interface SectionRenderOptions {
  basePoints: Point2D[];
  frontWallIdx?: number;
  totalWoonoppervlakte?: number;
  nokhoogte?: number;
  goothoogte?: number;
  bouwlagen?: number;
  goothoogteAanbouw?: number;
}
