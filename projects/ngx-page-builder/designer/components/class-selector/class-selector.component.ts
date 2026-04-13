import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  EventEmitter,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SvgIconDirective } from '../../directives/svg-icon.directive';
import { Notify } from '../../extensions/notify';
import { PageBuilderService } from '../../services/page-builder.service';
import { PageItem } from 'ngx-page-builder/core';
import { ClassManagerService } from '../../services/class-manager.service';

interface IClassList {
  name: string;
  editMode?: boolean;
  newName?: string;
}
export interface IClassOutput {
  name: string;
  value: string;
}
@Component({
  selector: 'class-selector',
  templateUrl: './class-selector.component.html',
  styleUrls: ['./class-selector.component.scss'],

  standalone: true,
  imports: [FormsModule, SvgIconDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClassSelectorComponent implements OnInit {
  @Output() selectedCss = new EventEmitter<IClassOutput>();
  item?: PageItem;

  activeClass = '';
  showAddClassBtn = true;

  classes: IClassList[] = [];
  availableClasses: string[] = [];

  // auto complete
  searchClassModel: string = '';
  showSuggestions: boolean = false;
  filteredSuggestions: string[] = [];

  constructor(
    private cdr: ChangeDetectorRef,
    public cls: ClassManagerService,
    private pb: PageBuilderService,
  ) {
    effect(() => {
      this.item = this.pb.activeEl();
      if (this.item) {
        this.classes = [];
        for (let c of this.item.classList) {
          this.classes.push({ name: c });
        }
        this.onSelectClass(this.item.classList[0]);
      }
    });

    cls.availableClasses$.subscribe((c: string[]) => {
      this.availableClasses = c;
    });
  }

  ngOnInit() {}

  writeValue(item: PageItem): void {
    this.item = item;

    this.cdr.detectChanges();
  }

  onInputChange(): void {
    if (this.searchClassModel.length > 0) {
      this.filteredSuggestions = this.availableClasses.filter((suggestion) =>
        suggestion.toLowerCase().includes(this.searchClassModel.toLowerCase()),
      );
    }
  }

  onAddClass(ev: any) {
    if (this.item && this.item.classList) {
      const val = (typeof ev == 'string' ? ev : ev.currentTarget?.value).trim();
      // not start witn number
      if (val && /\d/.test(val.at(0)) == false) {
        if (this.item.classList.indexOf(val) == -1) {
          this.item.classList.push(val);
          this.item.el?.classList.add(val);
          this.classes.push({ name: val });
        }
        this.onSelectClass(val);
      }
    }
    this.showAddClassBtn = true;
    this.showSuggestions = false;
    this.searchClassModel = '';
    this.cdr.detectChanges();
  }

  onSelectClass(className: string) {
    if (!this.item) return;
    this.activeClass = className;
    const css = this.cls.getClassStyles(className) || '';
    this.selectedCss.emit({
      name: className,
      value: css,
    });
    this.cls.updateClass(className, css);
    this.cdr.detectChanges();
  }

  remove(index: number) {
    if (this.item?.classList.length == 1) {
      Notify.error('Can not delete all classes!');
      return;
    }
    if (this.item && this.item.classList) {
      this.item.classList.splice(index, 1);
      this.classes.splice(index, 1);
    }
  }

  clear(property: any) {
    property = undefined;
  }

  editClassName(item: IClassList, chips: HTMLElement) {
    item.newName = item.name;
    item.editMode = true;
    setTimeout(() => {
      chips.querySelector('input')?.select();
      chips.querySelector('input')?.focus();
    });
  }
  onBlurEditClassName(item: IClassList) {
    if (!item.editMode || !this.item) return;
    if (item.newName) {
      // if (this.cls.hasClass(item.newName.trim())) {
      //   Notify.error(item.newName + ' is duplicated!');
      //   return;
      // }

      this.cls.renameClass(item.name, item.newName);
      let i = this.item.classList.findIndex((x: string) => x == item.name);
      this.item.classList[i] = item.newName;
      item.name = item.newName;
      this.onSelectClass(item.name);
    }
    item.editMode = false;
  }
  cancelEditClassName(item: IClassList, ev: Event) {
    ev.stopPropagation();
    ev.preventDefault();
    item.editMode = false;
  }
}
