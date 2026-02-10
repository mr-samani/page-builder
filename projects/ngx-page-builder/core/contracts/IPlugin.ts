export interface IPlugin {
  name: string;
  plugin: string;
  image: string;
}

export interface IPaginationPlugin {
  items: IPlugin[];
  total: number;
}
