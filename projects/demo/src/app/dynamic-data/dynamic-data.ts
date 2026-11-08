import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DynamicDataInput, DynamicDataInputType, DynamicDataStructure, DynamicValueType } from 'ngx-page-builder/core';
import { catchError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InitializeDynamicData {
  public DynamicData: DynamicDataStructure[] = [
    // personal info
    {
      id: '1',
      displayName: 'Personal Information',
      name: 'personalInfo',
      type: DynamicValueType.Object,
      values: [
        {
          displayName: 'First name',
          name: 'firstName',
          type: DynamicValueType.String,
          value: 'Mohammadreza',
        },
        {
          displayName: 'Last name',
          name: 'lastName',
          type: DynamicValueType.String,
          value: 'Samani',
        },
        {
          displayName: 'Age',
          name: 'age',
          type: DynamicValueType.Int,
          value: 36,
        },
        {
          displayName: 'Email',
          name: 'email',
          type: DynamicValueType.String,
          value: 'example@example.com',
        },
      ],
    },
    // job data
    {
      id: '2',
      displayName: 'Job Data',
      name: 'jobData',
      type: DynamicValueType.Object,
      values: [
        {
          displayName: 'Title',
          name: 'title',
          type: DynamicValueType.String,
          value: 'Software Engineer',
        },
        {
          displayName: 'Company',
          name: 'company',
          type: DynamicValueType.String,
          value: 'Example Corp',
        },
        {
          displayName: 'Location',
          name: 'location',
          type: DynamicValueType.String,
          value: 'New York',
        },
        {
          displayName: 'Start Date',
          name: 'startDate',
          type: DynamicValueType.Date,
          value: new Date('2020-01-01'),
        },
        {
          displayName: 'End Date',
          name: 'endDate',
          type: DynamicValueType.Date,
          value: new Date('2023-12-31'),
        },
      ],
    },
    // product categories
    {
      id: 'cat-3',
      name: 'category',
      displayName: 'Product categories',
      type: DynamicValueType.Array,
      list: [
        [
          {
            displayName: 'id',
            name: 'id',
            type: DynamicValueType.String,
            value: '123-456',
          },
          {
            displayName: 'name',
            name: 'name',
            type: DynamicValueType.String,
            value: 'Clothing',
          },
          {
            displayName: 'description',
            name: 'description',
            type: DynamicValueType.String,
            value: 'description of clothing and accessories and more',
          },
          {
            displayName: 'image',
            name: 'image',
            type: DynamicValueType.String,
            value: 'image-url.jpg',
          },
        ],
        [
          {
            displayName: 'id',
            name: 'id',
            type: DynamicValueType.String,
            value: '785',
          },
          {
            displayName: 'name',
            name: 'name',
            type: DynamicValueType.String,
            value: 'electronics',
          },
          {
            displayName: 'description',
            name: 'description',
            type: DynamicValueType.String,
            value: 'description of electronics and gadgets',
          },
          {
            displayName: 'image',
            name: 'image',
            type: DynamicValueType.String,
            value: 'image-url.jpg',
          },
        ],
      ],
    }, // products version 1
    {
      id: 'products',
      name: 'products',
      displayName: 'All Products',
      type: DynamicValueType.Array,
      list: [
        [
          {
            name: 'name',
            displayName: 'عنوان کالا',
            type: DynamicValueType.String,
            value: 'Sample Product',
          },
          {
            name: 'price',
            displayName: 'قیمت کالا',
            type: DynamicValueType.Int,
            value: 100,
          },
          {
            name: 'description',
            displayName: 'توضیحات کالا',
            type: DynamicValueType.String,
            value: 'Sample product description',
          },
          {
            name: 'image',
            displayName: 'تصویر کالا',
            type: DynamicValueType.String,
            value: 'image-url.jpg',
          },
        ],
      ],
    },
    // product category version 1
    {
      id: 'CategoryProducts',
      name: 'CategoryProducts',
      displayName: 'محصولات یک دسته بندی خاص',
      type: DynamicValueType.Array,
      inputData: [
        {
          name: 'categoryId',
          label: 'دسته بندی',
          type: DynamicDataInputType.Select,
          options: [
            { id: 1, title: 'cat 1' },
            { id: 2, title: 'cat 2' },
            { id: 3, title: 'cat 3' },
            { id: 4, title: 'cat 4' },
            { id: 5, title: 'cat 5' },
            { id: 6, title: 'cat 6' },
          ],
          value: undefined,
        },
      ],
      list: (params: DynamicDataInput) => this.getObsrvProducts(params),
    },

    /// --------- my data cms
    // product cms
    {
      id: 'Product',
      name: 'Product',
      displayName: 'Product',
      type: DynamicValueType.Array,
      values: [
        {
          id: 'TenantId',
          name: 'TenantId',
          displayName: 'TenantId',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'CategoryId',
          name: 'CategoryId',
          displayName: 'CategoryId',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'SKU',
          name: 'SKU',
          displayName: 'SKU',
          type: DynamicValueType.String,
          values: null,
          value: '',
          inputData: null,
        },
        {
          id: 'Slug',
          name: 'Slug',
          displayName: 'Slug',
          type: DynamicValueType.String,
          values: null,
          value: '',
          inputData: null,
        },
        {
          id: 'IsActive',
          name: 'IsActive',
          displayName: 'IsActive',
          type: DynamicValueType.Boolean,
          values: null,
          value: false,
          inputData: null,
        },
        {
          id: 'ProductTypeId',
          name: 'ProductTypeId',
          displayName: 'ProductTypeId',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'Tags',
          name: 'Tags',
          displayName: 'Tags',
          type: DynamicValueType.String,
          values: null,
          value: '',
          inputData: null,
        },
        {
          id: 'Id',
          name: 'Id',
          displayName: 'Id',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'CreatedAt',
          name: 'CreatedAt',
          displayName: 'CreatedAt',
          type: DynamicValueType.DateTime,
          values: null,
          value: '0001-01-01T00:00:00.0000000Z',
          inputData: null,
        },
        {
          id: 'CreatedBy',
          name: 'CreatedBy',
          displayName: 'CreatedBy',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'ModifiedAt',
          name: 'ModifiedAt',
          displayName: 'ModifiedAt',
          type: DynamicValueType.DateTime,
          values: null,
          value: '0001-01-01T00:00:00.0000000Z',
          inputData: null,
        },
        {
          id: 'ModifiedBy',
          name: 'ModifiedBy',
          displayName: 'ModifiedBy',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'DeletedAt',
          name: 'DeletedAt',
          displayName: 'DeletedAt',
          type: DynamicValueType.DateTime,
          values: null,
          value: '0001-01-01T00:00:00.0000000Z',
          inputData: null,
        },
        {
          id: 'DeletedBy',
          name: 'DeletedBy',
          displayName: 'DeletedBy',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'IsDeleted',
          name: 'IsDeleted',
          displayName: 'IsDeleted',
          type: DynamicValueType.Boolean,
          values: null,
          value: false,
          inputData: null,
        },
        {
          id: 'RowVersion',
          name: 'RowVersion',
          displayName: 'RowVersion',
          type: DynamicValueType.Array,
          values: null,
          value: null,
          inputData: null,
        },
      ],
      value: null,
      inputData: null,
    },
    // product category cms
    {
      id: 'ProductCategory',
      name: 'ProductCategory',
      displayName: 'ProductCategory',
      type: DynamicValueType.Array,
      values: [
        {
          id: 'TenantId',
          name: 'TenantId',
          displayName: 'TenantId',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'ParentId',
          name: 'ParentId',
          displayName: 'ParentId',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'Slug',
          name: 'Slug',
          displayName: 'Slug',
          type: DynamicValueType.String,
          values: null,
          value: '',
          inputData: null,
        },
        {
          id: 'Image',
          name: 'Image',
          displayName: 'Image',
          type: DynamicValueType.String,
          values: null,
          value: '',
          inputData: null,
        },
        {
          id: 'OrderIndex',
          name: 'OrderIndex',
          displayName: 'OrderIndex',
          type: DynamicValueType.Int,
          values: null,
          value: 0,
          inputData: null,
        },
        {
          id: 'IsActive',
          name: 'IsActive',
          displayName: 'IsActive',
          type: DynamicValueType.Boolean,
          values: null,
          value: false,
          inputData: null,
        },
        {
          id: 'Id',
          name: 'Id',
          displayName: 'Id',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'CreatedAt',
          name: 'CreatedAt',
          displayName: 'CreatedAt',
          type: DynamicValueType.DateTime,
          values: null,
          value: '0001-01-01T00:00:00.0000000Z',
          inputData: null,
        },
        {
          id: 'CreatedBy',
          name: 'CreatedBy',
          displayName: 'CreatedBy',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'ModifiedAt',
          name: 'ModifiedAt',
          displayName: 'ModifiedAt',
          type: DynamicValueType.DateTime,
          values: null,
          value: '0001-01-01T00:00:00.0000000Z',
          inputData: null,
        },
        {
          id: 'ModifiedBy',
          name: 'ModifiedBy',
          displayName: 'ModifiedBy',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'DeletedAt',
          name: 'DeletedAt',
          displayName: 'DeletedAt',
          type: DynamicValueType.DateTime,
          values: null,
          value: '0001-01-01T00:00:00.0000000Z',
          inputData: null,
        },
        {
          id: 'DeletedBy',
          name: 'DeletedBy',
          displayName: 'DeletedBy',
          type: DynamicValueType.String,
          values: null,
          value: '00000000-0000-0000-0000-000000000000',
          inputData: null,
        },
        {
          id: 'IsDeleted',
          name: 'IsDeleted',
          displayName: 'IsDeleted',
          type: DynamicValueType.Boolean,
          values: null,
          value: false,
          inputData: null,
        },
        {
          id: 'RowVersion',
          name: 'RowVersion',
          displayName: 'RowVersion',
          type: DynamicValueType.Array,
          values: null,
          value: null,
          inputData: null,
        },
      ],
      value: null,
      inputData: null,
    },
  ];

  /*----------------------------------------------------------------------------------------------------*/
  private list = [
    [
      {
        name: 'name',
        displayName: 'عنوان کالا',
        type: DynamicValueType.String,
        value: 'Sample Product',
      },
      {
        name: 'price',
        displayName: 'قیمت کالا',
        type: DynamicValueType.Int,
        value: 100,
      },
      {
        name: 'description',
        displayName: 'توضیحات کالا',
        type: DynamicValueType.String,
        value: 'Sample product description',
      },
      {
        name: 'image',
        displayName: 'تصویر کالا',
        type: DynamicValueType.String,
        value: 'image-url.jpg',
      },
    ],
  ];
  constructor(private http: HttpClient) {}

  private getPromiseProducts(input: DynamicDataInput): Promise<DynamicDataStructure[][]> {
    return new Promise((resolve, reject) => {
      return this.list;
    });
  }

  private getObsrvProducts(input: DynamicDataInput): Observable<DynamicDataStructure[][]> {
    const api = this.http.post<DynamicDataStructure[][]>('api.test/api/products', input).pipe(
      catchError((err) => {
        return of(this.list);
      }),
    );
    return api;
  }
}
