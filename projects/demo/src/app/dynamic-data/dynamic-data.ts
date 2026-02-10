import { DynamicDataStructure, DynamicValueType } from 'ngx-page-builder/core';

export const DynamicData: DynamicDataStructure[] = [
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
    displayName: 'Products',
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
];
