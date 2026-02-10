import { InjectionToken } from '@angular/core';
import { IPlugin } from "ngx-page-builder/core";

export const NGX_PAGE_BUILDER_EXPORT_PLUGIN_STORE = new InjectionToken<IPlugin>('PluginStore');
