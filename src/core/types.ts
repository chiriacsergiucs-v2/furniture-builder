/**
 * Core domain types, re-exported from their files (G-548, ADR-306): the kernel (`kernelTypes.ts`), boards and bands
 * (`materialTypes.ts`), the built model (`modelTypes.ts`) and its diagnostics (`diagnosticCodes.ts`), the products
 * (`productTypes.ts`) and the design document (`designTypes.ts`). Pure data: no React, no storage, no three.js.
 * Files outside src/core keep importing from here; files in src/core may import the domain file directly.
 */
export type { Axis, Box, Face, Mm, Yaw } from './kernelTypes';
export type {
  BoardFinish,
  EdgeBand,
  EdgeBandKind,
  HardwareProduct,
  Leftover,
  Material,
  MaterialImage,
  MaterialKind,
  MaterialMaker,
  ProductRef,
  RoleBoardRole,
  SellerItem,
} from './materialTypes';
export type { Diagnostic, Severity } from './diagnosticCodes';
export type {
  FurnitureModel,
  HardwareItem,
  HardwareKind,
  Panel,
  PanelRole,
  PanelShape,
  PinRows,
  SpaceOpening,
} from './modelTypes';
export type {
  ApplianceNiche,
  CabinetParams,
  CornerParams,
  DeskParams,
  DeskSupport,
  DoorsFront,
  DrawerSettings,
  DrawersSpace,
  FlapFront,
  FrameKind,
  FrameParams,
  Front,
  FrontStyle,
  Handle,
  LoosePanel,
  PanelLie,
  PanelParams,
  PanelSetParams,
  Product,
  Space,
  SpaceKind,
  SplitSize,
  StaggerRule,
} from './productTypes';
export { KIT_EDITS } from './designTypes';
export type {
  AssemblyEdit,
  CatalogMeta,
  Design,
  DesignVariable,
  KitEdit,
  RuleSettings,
  StepId,
  WizardAnswers,
} from './designTypes';
