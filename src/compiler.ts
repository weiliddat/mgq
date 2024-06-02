import { Query, Filter } from './types';

export function compile(_query: Query): Filter {
  return function () {
    return false;
  };
}
