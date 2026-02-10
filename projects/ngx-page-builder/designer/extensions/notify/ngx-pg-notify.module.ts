import { CommonModule } from '@angular/common';
import { NgModule, Optional, SkipSelf, ModuleWithProviders } from '@angular/core';
import { NgxPgNotifyService } from './notify.service';
import { Notify as NotifyFacade } from './notify-facade';
@NgModule({
  imports: [CommonModule],
  providers: [NgxPgNotifyService],
})
export class NgxPgNotifyModule {
  constructor(
    @Optional() @SkipSelf() parentModule: NgxPgNotifyModule | null,
    service: NgxPgNotifyService,
  ) {
    if (parentModule) return;
    // connect static facade
    NotifyFacade._setService(service as any);
  }

  static forRoot(): ModuleWithProviders<NgxPgNotifyModule> {
    return {
      ngModule: NgxPgNotifyModule,
      providers: [NgxPgNotifyService],
    };
  }
}
