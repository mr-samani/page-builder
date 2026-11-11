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
      fields: [
        {
          displayName: 'First name',
          name: 'firstName',
          type: DynamicValueType.String,
        },
        {
          displayName: 'Last name',
          name: 'lastName',
          type: DynamicValueType.String,
        },
        {
          displayName: 'Age',
          name: 'age',
          type: DynamicValueType.Int,
        },
        {
          displayName: 'Email',
          name: 'email',
          type: DynamicValueType.String,
        },
      ],
    },
    // job data
    {
      id: '2',
      displayName: 'Job Data',
      name: 'jobData',
      type: DynamicValueType.Object,
      fields: [
        {
          displayName: 'Title',
          name: 'title',
          type: DynamicValueType.String,
        },
        {
          displayName: 'Company',
          name: 'company',
          type: DynamicValueType.String,
        },
        {
          displayName: 'Location',
          name: 'location',
          type: DynamicValueType.String,
        },
        {
          displayName: 'Start Date',
          name: 'startDate',
          type: DynamicValueType.Date,
        },
        {
          displayName: 'End Date',
          name: 'endDate',
          type: DynamicValueType.Date,
        },
      ],
    },
    // product categories
    {
      id: 'cat-3',
      name: 'category',
      displayName: 'Product categories',
      type: DynamicValueType.Array,
      rawData: [],
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
        },
      ],
      rawData: (params: DynamicDataInput) => this.getObsrvProducts(params),
    },

    /// --------- my data cms
    // product cms
    {
      id: 'Product',
      name: 'Product',
      displayName: 'Product',
      type: DynamicValueType.Array,
      fields: [
        {
          id: 'TenantId',
          name: 'TenantId',
          displayName: 'TenantId',
          type: DynamicValueType.String,
          inputData: null,
        },
        {
          id: 'CategoryId',
          name: 'CategoryId',
          displayName: 'CategoryId',
          type: DynamicValueType.String,
          inputData: null,
        },
        {
          id: 'SKU',
          name: 'SKU',
          displayName: 'SKU',
          type: DynamicValueType.String,
          inputData: null,
        },
        {
          id: 'Slug',
          name: 'Slug',
          displayName: 'Slug',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'IsActive',
          name: 'IsActive',
          displayName: 'IsActive',
          type: DynamicValueType.Boolean,

          inputData: null,
        },
        {
          id: 'ProductTypeId',
          name: 'ProductTypeId',
          displayName: 'ProductTypeId',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'Tags',
          name: 'Tags',
          displayName: 'Tags',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'Id',
          name: 'Id',
          displayName: 'Id',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'CreatedAt',
          name: 'CreatedAt',
          displayName: 'CreatedAt',
          type: DynamicValueType.DateTime,

          inputData: null,
        },
        {
          id: 'CreatedBy',
          name: 'CreatedBy',
          displayName: 'CreatedBy',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'ModifiedAt',
          name: 'ModifiedAt',
          displayName: 'ModifiedAt',
          type: DynamicValueType.DateTime,

          inputData: null,
        },
        {
          id: 'ModifiedBy',
          name: 'ModifiedBy',
          displayName: 'ModifiedBy',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'DeletedAt',
          name: 'DeletedAt',
          displayName: 'DeletedAt',
          type: DynamicValueType.DateTime,

          inputData: null,
        },
        {
          id: 'DeletedBy',
          name: 'DeletedBy',
          displayName: 'DeletedBy',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'IsDeleted',
          name: 'IsDeleted',
          displayName: 'IsDeleted',
          type: DynamicValueType.Boolean,

          inputData: null,
        },
        {
          id: 'RowVersion',
          name: 'RowVersion',
          displayName: 'RowVersion',
          type: DynamicValueType.Array,

          inputData: null,
        },
      ],

      inputData: null,
    },
    // product category cms
    {
      id: 'ProductCategory',
      name: 'ProductCategory',
      displayName: 'ProductCategory',
      type: DynamicValueType.Array,
      fields: [
        {
          id: 'TenantId',
          name: 'TenantId',
          displayName: 'TenantId',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'ParentId',
          name: 'ParentId',
          displayName: 'ParentId',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'Slug',
          name: 'Slug',
          displayName: 'Slug',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'Image',
          name: 'Image',
          displayName: 'Image',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'OrderIndex',
          name: 'OrderIndex',
          displayName: 'OrderIndex',
          type: DynamicValueType.Int,

          inputData: null,
        },
        {
          id: 'IsActive',
          name: 'IsActive',
          displayName: 'IsActive',
          type: DynamicValueType.Boolean,

          inputData: null,
        },
        {
          id: 'Id',
          name: 'Id',
          displayName: 'Id',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'CreatedAt',
          name: 'CreatedAt',
          displayName: 'CreatedAt',
          type: DynamicValueType.DateTime,

          inputData: null,
        },
        {
          id: 'CreatedBy',
          name: 'CreatedBy',
          displayName: 'CreatedBy',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'ModifiedAt',
          name: 'ModifiedAt',
          displayName: 'ModifiedAt',
          type: DynamicValueType.DateTime,

          inputData: null,
        },
        {
          id: 'ModifiedBy',
          name: 'ModifiedBy',
          displayName: 'ModifiedBy',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'DeletedAt',
          name: 'DeletedAt',
          displayName: 'DeletedAt',
          type: DynamicValueType.DateTime,

          inputData: null,
        },
        {
          id: 'DeletedBy',
          name: 'DeletedBy',
          displayName: 'DeletedBy',
          type: DynamicValueType.String,

          inputData: null,
        },
        {
          id: 'IsDeleted',
          name: 'IsDeleted',
          displayName: 'IsDeleted',
          type: DynamicValueType.Boolean,

          inputData: null,
        },
        {
          id: 'RowVersion',
          name: 'RowVersion',
          displayName: 'RowVersion',
          type: DynamicValueType.Array,

          inputData: null,
        },
      ],

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
      },
      {
        name: 'price',
        displayName: 'قیمت کالا',
        type: DynamicValueType.Int,
      },
      {
        name: 'description',
        displayName: 'توضیحات کالا',
        type: DynamicValueType.String,
      },
      {
        name: 'image',
        displayName: 'تصویر کالا',
        type: DynamicValueType.String,
      },
    ],
  ];
  constructor(private http: HttpClient) {}

  private getPromiseProducts(input: DynamicDataInput): Promise<DynamicDataStructure[]> {
    return new Promise((resolve, reject) => {
      return this.list;
    });
  }

  private getObsrvProducts(input: DynamicDataInput): Observable<DynamicDataStructure[]> {
    const api = this.http.post<any>('api.test/api/products', input).pipe(
      catchError((err) => {
        return of(this.list);
      }),
    );
    return api;
  }
}
