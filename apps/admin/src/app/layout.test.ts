import { metadata } from './layout';

describe('admin layout metadata', () => {
  it('keeps the whole admin out of search engines', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
