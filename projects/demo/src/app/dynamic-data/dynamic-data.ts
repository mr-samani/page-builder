import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { DynamicDataInput, DynamicDataInputType, DynamicDataStructure, DynamicValueType } from 'ngx-page-builder/core';
import { catchError, map, Observable, of } from 'rxjs';
import type { DummyJSONResponse, Product } from './dumm-json/api-response';

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
      rawData: {
        firstName: 'Mohammad Reza',
        lastName: 'Samani',
        age: 37,
        email: 'mr-samani1368@gmail.com',
      },
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
          id: 'id',
          name: 'id',
          displayName: 'id',
          type: DynamicValueType.String,
        },
        {
          id: 'title',
          name: 'title',
          displayName: 'title',
          type: DynamicValueType.String,
        },
        {
          id: 'description',
          name: 'description',
          displayName: 'description',
          type: DynamicValueType.String,
        },
        {
          id: 'category',
          name: 'category',
          displayName: 'category',
          type: DynamicValueType.String,
        },
        {
          id: 'price',
          name: 'price',
          displayName: 'price',
          type: DynamicValueType.Decimal,
        },
        {
          id: 'discountPercentage',
          name: 'discountPercentage',
          displayName: 'discountPercentage',
          type: DynamicValueType.Decimal,
        },
        {
          id: 'tags',
          name: 'tags',
          displayName: 'tags',
          type: DynamicValueType.ArrayString,
        },
        {
          id: 'brand',
          name: 'brand',
          displayName: 'brand',
          type: DynamicValueType.String,
        },
        {
          id: 'sku',
          name: 'sku',
          displayName: 'sku',
          type: DynamicValueType.String,
        },
        {
          id: 'weight',
          name: 'weight',
          displayName: 'weight',
          type: DynamicValueType.Int,
        },
        {
          id: 'dimensions',
          name: 'dimensions',
          displayName: 'dimensions',
          type: DynamicValueType.Object,
          fields: [
            {
              id: 'width',
              name: 'width',
              displayName: 'width',
              type: DynamicValueType.Decimal,
            },
            {
              id: 'height',
              name: 'height',
              displayName: 'height',
              type: DynamicValueType.Decimal,
            },
            {
              id: 'depth',
              name: 'depth',
              displayName: 'depth',
              type: DynamicValueType.Decimal,
            },
          ],
        },
        {
          id: 'warrantyInformation',
          name: 'warrantyInformation',
          displayName: 'warrantyInformation',
          type: DynamicValueType.String,
        },
        {
          id: 'shippingInformation',
          name: 'shippingInformation',
          displayName: 'shippingInformation',
          type: DynamicValueType.DateTime,
        },
        {
          id: 'availabilityStatus',
          name: 'availabilityStatus',
          displayName: 'availabilityStatus',
          type: DynamicValueType.String,
        },
        {
          id: 'reviews',
          name: 'reviews',
          displayName: 'reviews',
          type: DynamicValueType.Array,
          fields: [
            {
              id: 'rating',
              name: 'rating',
              displayName: 'rating',
              type: DynamicValueType.Decimal,
            },
            {
              id: 'comment',
              name: 'comment',
              displayName: 'comment',
              type: DynamicValueType.String,
            },
            {
              id: 'date',
              name: 'date',
              displayName: 'date',
              type: DynamicValueType.DateTime,
            },
            {
              id: 'reviewerName',
              name: 'reviewerName',
              displayName: 'reviewerName',
              type: DynamicValueType.String,
            },
            {
              id: 'reviewerEmail',
              name: 'reviewerEmail',
              displayName: 'reviewerEmail',
              type: DynamicValueType.String,
            },
          ],
        },
        {
          id: 'returnPolicy',
          name: 'returnPolicy',
          displayName: 'returnPolicy',
          type: DynamicValueType.String,
        },
        {
          id: 'minimumOrderQuantity',
          name: 'minimumOrderQuantity',
          displayName: 'minimumOrderQuantity',
          type: DynamicValueType.Int,
        },
        {
          id: 'meta',
          name: 'meta',
          displayName: 'meta',
          type: DynamicValueType.Object,
          fields: [
            {
              id: 'createdAt',
              name: 'createdAt',
              displayName: 'createdAt',
              type: DynamicValueType.DateTime,
            },
            {
              id: 'updatedAt',
              name: 'updatedAt',
              displayName: 'updatedAt',
              type: DynamicValueType.DateTime,
            },
            {
              id: 'barcode',
              name: 'barcode',
              displayName: 'barcode',
              type: DynamicValueType.String,
            },
            {
              id: 'qrCode',
              name: 'qrCode',
              displayName: 'qrCode',
              type: DynamicValueType.String,
            },
          ],
        },
        {
          id: 'images',
          name: 'images',
          displayName: 'images',
          type: DynamicValueType.ArrayString,
        },
        {
          id: 'thumbnail',
          name: 'thumbnail',
          displayName: 'thumbnail',
          type: DynamicValueType.String,
        },
      ],
      rawData: (params: DynamicDataInput) => this.getObsrvProducts(params),
    },
  ];

  /*----------------------------------------------------------------------------------------------------*/

  constructor(private http: HttpClient) {}

  private getPromiseProducts(input: DynamicDataInput): Promise<DynamicDataStructure[]> {
    return new Promise((resolve, reject) => {
      return [
        {
          id: 1,
          title: 'Essence Mascara Lash Princess',
          description:
            'The Essence Mascara Lash Princess is a popular mascara known for its volumizing and lengthening effects. Achieve dramatic lashes with this long-lasting and cruelty-free formula.',
          category: 'beauty',
          price: 9.99,
          discountPercentage: 10.48,
          rating: 2.56,
          stock: 99,
          tags: ['beauty', 'mascara'],
          brand: 'Essence',
          sku: 'BEA-ESS-ESS-001',
          weight: 4,
          dimensions: {
            width: 15.14,
            height: 13.08,
            depth: 22.99,
          },
          warrantyInformation: '1 week warranty',
          shippingInformation: 'Ships in 3-5 business days',
          availabilityStatus: 'In Stock',
        },
      ];
    });
  }

  private getObsrvProducts(input: DynamicDataInput): Observable<Product[]> {
    const api = this.http.get<DummyJSONResponse>('https://dummyjson.com/products', input).pipe(
      map((m) => m.products ?? []),
      catchError((err) => {
        return of([]);
      }),
    );
    return api;
  }
}
