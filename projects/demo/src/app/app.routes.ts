import { Routes } from '@angular/router';
import { BuilderComponent } from './builder/builder.component';

export const routes: Routes = [
  { path: '', component: BuilderComponent },
  {
    path: 'preview',
    loadComponent: () => import('./preview/preview.component').then((c) => c.PreviewComponent),
  },
  {
    path: 'test',
    loadComponent: () => import('./test/test.component').then((m) => m.TestComponent),
  },
];
