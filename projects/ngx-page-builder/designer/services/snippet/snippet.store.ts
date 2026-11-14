import { IPaginationSnippet, ISnippet } from 'ngx-page-builder/core';

export interface ISnippetStore {
  save(snippet: ISnippet): void | Promise<void>;
  getAllSnippets(take: number, skip: number, filter: string): Promise<IPaginationSnippet>;
  deleteSnippet(item: ISnippet, index: number): Promise<boolean>;
}

export class SnippetStore implements ISnippetStore {
  private _snippets: ISnippet[] = [];

  save(snippet: ISnippet) {
    this._snippets.push(snippet);
  }

  getAllSnippets(take: number, skip: number, filter: string): Promise<IPaginationSnippet> {
    return new Promise<IPaginationSnippet>((resolve, reject) => {
      const result = this._snippets.filter((x: ISnippet) => x.name.includes(filter));
      const list = result.slice(skip, skip + take);
      resolve({
        items: list,
        total: result.length,
      });
    });
  }

  deleteSnippet(item: ISnippet, index: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this._snippets.splice(index, 1);
      resolve(true);
    });
  }
}
