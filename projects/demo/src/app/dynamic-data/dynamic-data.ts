import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DynamicDataInput, DynamicDataInputType, DynamicDataStructure, DynamicValueType } from 'ngx-page-builder/core';
import { catchError, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class InitializeDynamicData {
  public DynamicData: DynamicDataStructure[] = [
    {
      id: '1',
      displayName: 'Personal Information',
      name: 'personalInfo',
      type: DynamicValueType.Array,
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
    {
      id: '2',
      displayName: 'Job Data',
      name: 'jobData',
      type: DynamicValueType.Array,
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
    },
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
