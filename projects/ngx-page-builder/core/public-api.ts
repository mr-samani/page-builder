/*
 * Public API for Shared Module
 * ZERO external dependencies (only @angular/core)
 */

// Contracts
export * from './contracts/IPageBuilderDto';
export * from './contracts/IPage';
export * from './contracts/IPageConfig';
export * from './contracts/IPageItem';
export * from './contracts/IPageBuilderOutput';
export * from './contracts/IStyleSheetFile';
export * from './contracts/IPlugin';

// Models
export * from './models/SourceItem';
export * from './models/PageBuilderConfiguration';
export * from './models/PagePreviewConfiguration';
export * from './models/PageBuilderDto';
export * from './models/DynamicData';
export * from './models/DataSourceSetting';
export * from './models/tokens';
export * from './models/ComponentDataContext';
export * from './models/PageItem';
export * from './models/Page';
export * from './models/types';
export * from './models/storage-type';

// Services (بدون dependency به Material یا libraries دیگر)
export * from './services/class-manager.service';
export * from './services/dynamic-data.service';
export * from './services/preview.service';
export * from './services/dynamic-element.service';

// Utils
export * from './utiles/clone-deep';
export * from './utiles/collection-helper';
export * from './utiles/css-parser';
export * from './utiles/file';
export * from './utiles/generateUUID';
export * from './utiles/isEqual';
export * from './utiles/merge-css-styles';
export * from './utiles/parseBackground';
export * from './utiles/randomNumber';
export * from './utiles/rendering';
export * from './utiles/sequentialGUID';

// Consts
export * from './consts/ViewMode';
export * from './consts/defauls';
export * from './consts/validateViewMode';
