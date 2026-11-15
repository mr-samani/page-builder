import { ChangeDetectorRef, Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PBSnippetService } from '../../services/snippet/snippet.service';
import { LoadingComponent } from '../../controls/loading/loading.component';
import { PageBuilderService } from '../../services/page-builder.service';
import { ISnippet, PageItem } from 'ngx-page-builder/core';
import { NgxDialogModule, DIALOG_DATA, DIALOG_REF } from 'ngx-kit/dialog';
import { Notify } from 'ngx-kit/notify';

@Component({
  selector: 'app-save-snippet-dialog',
  templateUrl: './save-snippet-dialog.component.html',
  styleUrls: ['./save-snippet-dialog.component.scss'],
  imports: [FormsModule, NgxDialogModule, LoadingComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PBSnippetService],
})
export class SaveSnippetDialogComponent implements OnInit {
  name = '';
  img = '';

  snippet?: ISnippet;
  loading = true;
  private _data = inject<PageItem>(DIALOG_DATA);
  private dialogRef = inject(DIALOG_REF);
  protected readonly pb = inject(PageBuilderService);

  constructor(
    private snippetService: PBSnippetService,
    private chdr: ChangeDetectorRef,
  ) {
    this.loading = true;
  }

  ngOnInit() {
    this.getData();
  }

  getData() {
    const tmpShowOutlines = this.pb.showOutlines();
    this.pb.showOutlines.set(false);
    this.snippetService
      .getSnippet(this._data)
      .then((p) => {
        this.snippet = p;
        this.img = p.image;
        this.name = p.name;
        this.loading = false;
        this.pb.showOutlines.set(tmpShowOutlines);
        this.chdr.detectChanges();
      })
      .catch((error) => {
        Notify.error(error);
        this.pb.showOutlines.set(tmpShowOutlines);
        this.dialogRef.close();
      });
  }

  ok(ev?: Event) {
    if (ev) {
      ev.stopPropagation();
      ev.preventDefault();
    }
    if (!this.snippet || !this.name) return;
    this.snippet.name = this.name;
    // save می‌تواند async باشد (ذخیره روی سرور)؛ تا موفق نشده دیالوگ بسته نمی‌شود
    Promise.resolve(this.snippetService.save(this.snippet))
      .then(() => this.dialogRef.close(true))
      .catch((error) => Notify.error(error instanceof Error ? error.message : error));
  }
}
