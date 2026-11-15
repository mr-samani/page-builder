import { ChangeDetectorRef, Component, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PBSnippetService } from '../../services/snippet/snippet.service';
import { LoadingComponent } from '../../controls/loading/loading.component';
import { NgxIconComponent } from 'ngx-page-builder/icons';
import { CommonModule } from '@angular/common';
import { ISnippet, LibConsts } from 'ngx-page-builder/core';
import { Notify } from 'ngx-kit/notify';
import { PbPanel } from '../panel.layout';

@Component({
  selector: 'app-snippets',
  templateUrl: './snippets.component.html',
  styleUrls: ['./snippets.component.scss'],
  imports: [FormsModule, LoadingComponent, NgxIconComponent, CommonModule, PbPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [PBSnippetService],
})
export class SnippetsComponent implements OnInit {
  snippets: ISnippet[] = [];
  loading = true;
  search = '';

  take = 10;
  skip = 0;
  total = 0;

  pagination: number[] = [];
  selectedPage = 0;

  canDeleteSnippet = LibConsts.canDeleteSnippet;
  constructor(
    private snippetService: PBSnippetService,
    private chdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.getList();
  }

  getList() {
    this.loading = true;
    this.snippetService
      .getAllSnippets(this.take, this.skip, this.search)
      .finally(() => (this.loading = false))
      .then((p) => {
        this.snippets = p?.items ?? [];
        this.total = p?.total ?? 0;
        this.updatePagination();
        this.chdr.detectChanges();
      })
      .catch((error) => {
        Notify.error(error);
      });
  }

  filterList() {
    this.snippets = [];
    this.skip = 0;
    this.getList();
  }

  ok(snippet: ISnippet) {
    if (!snippet) return;
    this.snippetService.addToForm(snippet).catch((err) => Notify.error(err instanceof Error ? err.message : err));
  }

  updatePagination() {
    const c = Math.ceil(this.total / this.take);
    this.pagination = [];
    for (let i = 0; i < c; i++) {
      this.pagination.push(i);
    }
  }
  changePage(p: number) {
    this.selectedPage = p;
    this.skip = p * this.take;
    this.getList();
  }
  deleteItem(item: ISnippet, index: number) {
    item.loading = true;
    this.snippetService
      .deleteSnippet(item, this.skip + index)
      .finally(() => (item.loading = false))
      .then((p) => {
        if (p) {
          this.snippets.splice(index, 1);
        }
        this.updatePagination();
        this.chdr.detectChanges();
      })
      .catch((error) => {
        Notify.error(error);
      });
  }
}
