export class NgxDialogConfig<DataType = any> {
    /**
     * pass data to dialog
     */
    data?: DataType | any = {};
    /** close dialog on outside click
     * - default false */
    allowCloseOnOutsideClick?: boolean = false;
    /**
     * container class 
     * - You can separate the list of classes with a space 
     * - for example:"`my class one two three ...`"
     */
    containerClass?= '';
    header?: {
        enable?: true,
        title?: '',
        showCloseButton?: true
    };
    footer?: {
        enable?: true
    };
    width?: string = '';
    minWidth?: string = '';
    maxWidth?: string = '';
    height?: string = '';
    minHeight?: string = '';
    maxHeight?: string = '';

    constructor() {
    }
}