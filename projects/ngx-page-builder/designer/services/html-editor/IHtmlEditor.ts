export interface IPageBuilderHtmlEditor {
  openEditor(content: string): Promise<string>;
}
