/**
 * 图片处理插件类型定义
 * 注意：此文件中的类型仅用于组件内部状态管理
 * 后端 API 调用应使用 bindings 中的类型
 */

import type { IconName } from '../Icon';

// 导出后端类型供组件使用
export type {
  ProcessingMode,
  ImageFile,
  CompressOptions,
  CropOptions,
  WatermarkOptions,
  SteganographyOptions,
  FaviconOptions,
  BatchProgress,
  PreviewResult,
  ProcessingRequest,
  ProcessingResult,
} from '../../../bindings/ltools/plugins/imageprocessor/models';

// 功能项（仅用于 UI 显示）
export interface FunctionItem {
  id: string;
  label: string;
  icon: IconName;
  description: string;
}
