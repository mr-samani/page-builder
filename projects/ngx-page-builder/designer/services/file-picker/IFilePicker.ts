export interface IPageBuilderFilePicker {
  /**
   * Opens a file picker dialog.
   * and return file url or base64 data image
   * @param type file types : 'image'|'file'
   */
  openFilePicker(type: 'image' | 'file'): Promise<string>;

  /**
   * Base URL address for load file
   * @example https://example.com/files/
   */
  baseUrlAddress: string | undefined;
}
