/** @jest-environment node */
import en from '../../messages/en.json';
import pl from '../../messages/pl.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('messages', () => {
  it('pl.json has exactly the keys of en.json', () => {
    expect(keys(pl).sort()).toEqual(keys(en).sort());
  });
});
