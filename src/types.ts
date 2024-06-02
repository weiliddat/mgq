type OpValue = any;

export type Query = {
  [path: string]: OpValue;
};

export type Filter = (value: unknown) => boolean;

export type TestCase = {
  filter: Query;
  input: any[];
  expected: any[];
};
