type OpValue = any;

type Query = {
  [path: string]: OpValue;
};

type Filter = (value: unknown) => boolean;

export function compile(_query: Query): Filter {
  return function () {
    return true;
  };
}
