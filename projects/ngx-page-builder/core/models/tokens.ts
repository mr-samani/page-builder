import { InjectionToken } from '@angular/core';
import { PageBuilderConfiguration } from './PageBuilderConfiguration';
import { ComponentDataContext } from './ComponentDataContext';
import { PagePreviewConfiguration } from './PagePreviewConfiguration';

export const PAGE_BUILDER_CONFIGURATION = new InjectionToken<PageBuilderConfiguration>('PAGE_BUILDER_CONFIGURATION');

export const COMPONENT_DATA = new InjectionToken<ComponentDataContext>('COMPONENT_DATA');

export const PAGE_PREVIEW_CONFIGURATION = new InjectionToken<PagePreviewConfiguration>('PAGE_PREVIEW_CONFIGURATION');
