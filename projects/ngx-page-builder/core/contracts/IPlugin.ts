export interface IPlugin {
  name: string;
  plugin: string;
  image: string;
  loading?: boolean;
}

export interface IPaginationPlugin {
  items: IPlugin[];
  total: number;
}
